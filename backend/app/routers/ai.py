"""AI-powered endpoints: Command Palette, OCR Receipt Extraction, Predictive Maintenance."""
import re
import random
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    Asset, AssetCategory, AssetCondition, AssetStatus,
    Booking, BookingStatus, MaintenanceRequest, MaintenanceStatus,
)
from app.security import CurrentUser
from app.cache import cache

router = APIRouter(prefix="/ai", tags=["ai"])
DbDep = Annotated[AsyncSession, Depends(get_db)]


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ─── Feature 1: Command Palette Agent ────────────────────────────────────────

class CommandRequest(BaseModel):
    query: str


class CommandResponse(BaseModel):
    intent: str  # 'filter' | 'bulk_update' | 'navigate' | 'info'
    description: str
    route: str | None = None
    filters: dict | None = None
    bulk_payload: dict | None = None
    results: list[dict] | None = None


# Semantic intent patterns
_FILTER_PATTERNS = [
    (r"\b(show|list|find|get|display)\b.*\b(damaged|poor)\b.*\b(electronics?|laptop|computer)\b",
     {"status": "under_maintenance", "condition": "damaged", "category": "Electronics"},
     "Filtering for damaged electronics"),
    (r"\b(show|list|find|get)\b.*\b(damaged|poor)\b",
     {"condition": "damaged"},
     "Filtering for damaged assets"),
    (r"\b(show|list|find|get)\b.*\b(all|every)\b.*\b(available)\b",
     {"status": "available"},
     "Filtering for available assets"),
    (r"\b(show|list|find|get)\b.*\b(maintenance|repair)\b",
     {"status": "under_maintenance"},
     "Filtering for assets under maintenance"),
    (r"\b(show|list|find|get)\b.*\b(allocated|assigned)\b",
     {"status": "allocated"},
     "Filtering for allocated assets"),
    (r"\b(show|list|find|get)\b.*\b(lost|missing)\b",
     {"status": "lost"},
     "Filtering for lost assets"),
    (r"\b(show|list|find|get)\b.*\b(bookable|shared)\b.*\b(resource|room|vehicle)\b",
     {"is_bookable": True},
     "Filtering for shared/bookable resources"),
]

_BULK_PATTERN = re.compile(
    r"\b(move|relocate|transfer)\b.*\b(all|every)?\b.*\bfrom\b\s+(.+?)\s+\bto\b\s+(.+)",
    re.IGNORECASE,
)

_NAV_PATTERNS = [
    (r"\b(go\s+to|open|navigate)\b.*\b(dashboard|home)\b", "/", "Navigating to Dashboard"),
    (r"\b(go\s+to|open|navigate)\b.*\b(asset|directory)\b", "/assets", "Navigating to Asset Directory"),
    (r"\b(go\s+to|open|navigate)\b.*\b(allocation)\b", "/allocations", "Navigating to Allocations"),
    (r"\b(go\s+to|open|navigate)\b.*\b(booking|schedule)\b", "/bookings", "Navigating to Bookings"),
    (r"\b(go\s+to|open|navigate)\b.*\b(maintenance|repair)\b", "/maintenance", "Navigating to Maintenance"),
    (r"\b(go\s+to|open|navigate)\b.*\b(audit)\b", "/audits", "Navigating to Audits"),
    (r"\b(go\s+to|open|navigate)\b.*\b(report|analytics)\b", "/reports", "Navigating to Reports"),
    (r"\b(go\s+to|open|navigate)\b.*\b(log|activity)\b", "/logs", "Navigating to Activity Logs"),
    (r"\b(go\s+to|open|navigate)\b.*\b(org|setup|department)\b", "/org-setup", "Navigating to Organization Setup"),
]

_INFO_PATTERNS = [
    (r"\b(how many|count|total)\b.*\b(asset)\b", "count_assets"),
    (r"\b(how many|count|total)\b.*\b(maintenance|ticket)\b", "count_maintenance"),
    (r"\b(status|summary|overview)\b", "overview"),
]


@router.post("/command", response_model=CommandResponse)
async def ai_command(
    payload: CommandRequest,
    db: DbDep,
    current_user: CurrentUser,
) -> CommandResponse:
    """Semantic intent-parsing AI command palette endpoint."""
    query = payload.query.strip()
    q_lower = query.lower()

    # 1. Check for navigation intent
    for pattern, route, desc in _NAV_PATTERNS:
        if re.search(pattern, q_lower):
            return CommandResponse(
                intent="navigate", description=desc, route=route
            )

    # 2. Check for bulk update intent
    bulk_match = _BULK_PATTERN.search(q_lower)
    if bulk_match:
        from_loc = bulk_match.group(3).strip().title()
        to_loc = bulk_match.group(4).strip().title()
        # Count matching assets
        count_result = await db.execute(
            select(func.count()).select_from(Asset).where(
                Asset.location.ilike(f"%{from_loc}%")
            )
        )
        matched = count_result.scalar_one()
        # Get list of affected assets
        asset_result = await db.execute(
            select(Asset.id, Asset.name, Asset.asset_tag, Asset.location).where(
                Asset.location.ilike(f"%{from_loc}%")
            ).limit(20)
        )
        affected = [
            {"id": r.id, "name": r.name, "asset_tag": r.asset_tag, "current_location": r.location}
            for r in asset_result.all()
        ]
        return CommandResponse(
            intent="bulk_update",
            description=f"Move {matched} asset(s) from '{from_loc}' to '{to_loc}'",
            bulk_payload={
                "action": "location_reassign",
                "from_location": from_loc,
                "to_location": to_loc,
                "affected_count": matched,
            },
            results=affected,
        )

    # 3. Check for info/stats intent
    for pattern, info_type in _INFO_PATTERNS:
        if re.search(pattern, q_lower):
            if info_type == "count_assets":
                result = await db.execute(select(func.count()).select_from(Asset))
                total = result.scalar_one()
                return CommandResponse(
                    intent="info",
                    description=f"Total assets in the system: {total}",
                    results=[{"metric": "total_assets", "value": total}],
                )
            elif info_type == "count_maintenance":
                result = await db.execute(
                    select(func.count()).select_from(MaintenanceRequest).where(
                        MaintenanceRequest.status.in_([
                            MaintenanceStatus.pending,
                            MaintenanceStatus.approved,
                            MaintenanceStatus.in_progress,
                        ])
                    )
                )
                total = result.scalar_one()
                return CommandResponse(
                    intent="info",
                    description=f"Active maintenance tickets: {total}",
                    results=[{"metric": "active_maintenance", "value": total}],
                )
            elif info_type == "overview":
                assets_total = (await db.execute(select(func.count()).select_from(Asset))).scalar_one()
                avail = (await db.execute(
                    select(func.count()).select_from(Asset).where(Asset.status == AssetStatus.available)
                )).scalar_one()
                alloc = (await db.execute(
                    select(func.count()).select_from(Asset).where(Asset.status == AssetStatus.allocated)
                )).scalar_one()
                maint = (await db.execute(
                    select(func.count()).select_from(Asset).where(
                        Asset.status == AssetStatus.under_maintenance
                    )
                )).scalar_one()
                return CommandResponse(
                    intent="info",
                    description=f"System overview — Total: {assets_total} | Available: {avail} | Allocated: {alloc} | Under Maintenance: {maint}",
                    results=[
                        {"metric": "total", "value": assets_total},
                        {"metric": "available", "value": avail},
                        {"metric": "allocated", "value": alloc},
                        {"metric": "under_maintenance", "value": maint},
                    ],
                )

    # 4. Check for filter intent
    for pattern, filters, desc in _FILTER_PATTERNS:
        if re.search(pattern, q_lower):
            # Enrich with category resolution if specified
            final_filters = dict(filters)
            if "category" in final_filters:
                cat_result = await db.execute(
                    select(AssetCategory.id).where(
                        AssetCategory.name.ilike(f"%{final_filters['category']}%")
                    )
                )
                cat = cat_result.scalar_one_or_none()
                if cat:
                    final_filters["category_id"] = cat
                del final_filters["category"]

            return CommandResponse(
                intent="filter",
                description=desc,
                route="/assets",
                filters=final_filters,
            )

    # 5. Fallback — generic search across assets
    search_result = await db.execute(
        select(Asset.id, Asset.name, Asset.asset_tag, Asset.status, Asset.location).where(
            Asset.name.ilike(f"%{query}%") | Asset.asset_tag.ilike(f"%{query}%")
        ).limit(10)
    )
    matches = [
        {"id": r.id, "name": r.name, "asset_tag": r.asset_tag, "status": r.status, "location": r.location}
        for r in search_result.all()
    ]
    if matches:
        return CommandResponse(
            intent="filter",
            description=f"Found {len(matches)} asset(s) matching '{query}'",
            route="/assets",
            filters={"search": query},
            results=matches,
        )

    return CommandResponse(
        intent="info",
        description=f"I couldn't find specific actions for '{query}'. Try: 'show all damaged electronics', 'move all assets from Desk E12 to Room B2', or 'go to maintenance'.",
    )


# ─── Feature 1b: Execute Bulk Update ─────────────────────────────────────────

class BulkLocationUpdate(BaseModel):
    from_location: str
    to_location: str


@router.post("/command/execute-bulk")
async def execute_bulk_update(
    payload: BulkLocationUpdate,
    db: DbDep,
    current_user: CurrentUser,
) -> dict:
    """Execute a confirmed bulk location re-assignment."""
    result = await db.execute(
        select(Asset).where(Asset.location.ilike(f"%{payload.from_location}%"))
    )
    assets = result.scalars().all()
    count = 0
    for asset in assets:
        asset.location = payload.to_location
        count += 1
    await db.commit()
    return {"status": "success", "updated_count": count, "new_location": payload.to_location}


# ─── Feature 2: OCR / Document Extraction ────────────────────────────────────

class ExtractedReceiptData(BaseModel):
    asset_name: str | None = None
    serial_number: str | None = None
    acquisition_date: str | None = None
    acquisition_cost: float | None = None
    confidence: float = 0.0
    raw_text: str | None = None


def _mock_ocr_extract(file_bytes: bytes, filename: str) -> ExtractedReceiptData:
    """Simulate intelligent document parsing. Uses filename hash for deterministic results."""
    # Produce deterministic but varied mock data based on file content
    h = hashlib.md5(file_bytes[:4096]).hexdigest()
    seed_val = int(h[:8], 16)
    rng = random.Random(seed_val)

    vendors = [
        ("Dell Technologies", "Dell Latitude 5540", "DLLT"),
        ("Apple Inc.", "MacBook Pro 16\" M4", "APPL"),
        ("Lenovo Group", "ThinkPad X1 Carbon Gen 12", "LNVO"),
        ("HP Inc.", "HP EliteBook 860 G11", "HPEB"),
        ("Samsung Electronics", "Samsung Galaxy Tab S9", "SMSG"),
        ("Cisco Systems", "Cisco IP Phone 8845", "CSCO"),
        ("Brother Industries", "Brother MFC-L8900CDW Printer", "BRTH"),
        ("Epson", "Epson WorkForce Pro WF-4830", "EPSN"),
    ]

    vendor = rng.choice(vendors)
    serial = f"{vendor[2]}-{rng.randint(100000, 999999)}-{rng.choice('ABCDEFGH')}"
    cost = round(rng.uniform(299.99, 4599.99), 2)
    days_ago = rng.randint(1, 365)
    acq_date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
    confidence = round(rng.uniform(0.82, 0.97), 2)

    raw_text = (
        f"INVOICE #{rng.randint(10000, 99999)}\n"
        f"Vendor: {vendor[0]}\n"
        f"Item: {vendor[1]}\n"
        f"Serial: {serial}\n"
        f"Date: {acq_date}\n"
        f"Amount: ${cost:,.2f}\n"
        f"Payment: NET 30\n"
    )

    return ExtractedReceiptData(
        asset_name=vendor[1],
        serial_number=serial,
        acquisition_date=acq_date,
        acquisition_cost=cost,
        confidence=confidence,
        raw_text=raw_text,
    )


@router.post("/extract-receipt", response_model=ExtractedReceiptData)
async def extract_receipt(
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> ExtractedReceiptData:
    """Accept an uploaded invoice/receipt and extract structured asset data."""
    contents = await file.read()
    if len(contents) == 0:
        return ExtractedReceiptData(confidence=0.0, raw_text="Empty file uploaded.")

    result = _mock_ocr_extract(contents, file.filename or "unknown")
    return result


# ─── Feature 3: Predictive Maintenance Forecasting ───────────────────────────

class PredictiveAssetRisk(BaseModel):
    asset_id: int
    asset_name: str
    asset_tag: str
    category_name: str | None
    risk_score: float  # 0.0 to 1.0
    predictive_alert: bool
    risk_factors: dict
    last_maintenance_days: int | None
    total_booking_hours: float
    asset_age_days: int


@router.get("/predictive-maintenance", response_model=list[PredictiveAssetRisk])
async def predictive_maintenance(
    db: DbDep,
    current_user: CurrentUser,
) -> list[PredictiveAssetRisk]:
    """Compute AI-driven failure risk scores for active assets."""
    cached = await cache.get("ai:predictive-maintenance")
    if cached is not None:
        return cached

    now = utcnow()

    # Fetch all non-retired, non-disposed assets
    result = await db.execute(
        select(Asset)
        .options(selectinload(Asset.category))
        .where(Asset.status.notin_([AssetStatus.disposed, AssetStatus.retired]))
        .order_by(Asset.created_at)
    )
    assets = result.scalars().all()

    risk_items: list[PredictiveAssetRisk] = []

    for asset in assets:
        # Factor 1: Asset age (days since creation)
        age_days = (now - asset.created_at).days
        age_factor = min(age_days / 1460, 1.0)  # 4 years = max

        # Factor 2: Time since last maintenance resolution
        last_maint_result = await db.execute(
            select(MaintenanceRequest.resolved_at)
            .where(
                MaintenanceRequest.asset_id == asset.id,
                MaintenanceRequest.status == MaintenanceStatus.resolved,
                MaintenanceRequest.resolved_at.isnot(None),
            )
            .order_by(MaintenanceRequest.resolved_at.desc())
            .limit(1)
        )
        last_resolved = last_maint_result.scalar_one_or_none()
        if last_resolved:
            days_since_maint = (now - last_resolved).days
        else:
            days_since_maint = age_days  # Never maintained → full age
        maint_factor = min(days_since_maint / 365, 1.0)  # 1 year without maint = max

        # Factor 3: Total booking hours (runtime proxy)
        booking_result = await db.execute(
            select(
                func.coalesce(
                    func.sum(
                        (func.julianday(Booking.end_time) - func.julianday(Booking.start_time)) * 24
                    ),
                    0.0,
                )
            ).where(
                Booking.asset_id == asset.id,
                Booking.status.in_([BookingStatus.completed, BookingStatus.ongoing]),
            )
        )
        total_hours = float(booking_result.scalar_one() or 0.0)
        runtime_factor = min(total_hours / 2000, 1.0)  # 2000 hours = max

        # Factor 4: Condition penalty
        condition_weights = {
            AssetCondition.new: 0.0,
            AssetCondition.good: 0.05,
            AssetCondition.fair: 0.25,
            AssetCondition.poor: 0.6,
            AssetCondition.damaged: 0.9,
        }
        condition_factor = condition_weights.get(asset.condition, 0.1)

        # Factor 5: Historical maintenance frequency
        maint_count_result = await db.execute(
            select(func.count()).select_from(MaintenanceRequest).where(
                MaintenanceRequest.asset_id == asset.id
            )
        )
        maint_count = maint_count_result.scalar_one()
        freq_factor = min(maint_count / 10, 1.0)  # 10+ tickets = max

        # Weighted composite score
        risk_score = (
            age_factor * 0.20
            + maint_factor * 0.25
            + runtime_factor * 0.15
            + condition_factor * 0.25
            + freq_factor * 0.15
        )
        risk_score = round(min(risk_score, 1.0), 3)

        risk_items.append(PredictiveAssetRisk(
            asset_id=asset.id,
            asset_name=asset.name,
            asset_tag=asset.asset_tag,
            category_name=asset.category.name if asset.category else None,
            risk_score=risk_score,
            predictive_alert=risk_score >= 0.80,
            risk_factors={
                "age": round(age_factor, 2),
                "maintenance_gap": round(maint_factor, 2),
                "runtime": round(runtime_factor, 2),
                "condition": round(condition_factor, 2),
                "frequency": round(freq_factor, 2),
            },
            last_maintenance_days=days_since_maint if last_resolved else None,
            total_booking_hours=round(total_hours, 1),
            asset_age_days=age_days,
        ))

    # Sort by risk_score descending
    risk_items.sort(key=lambda x: x.risk_score, reverse=True)
    await cache.set("ai:predictive-maintenance", risk_items, ttl_seconds=600)
    return risk_items
