"""Analytics router — KPIs, utilization, heatmaps."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from fastapi import Depends

from app.database import get_db
from app.models import (
    Allocation, AllocationStatus, Asset, AssetCategory, AssetStatus,
    Booking, BookingStatus, Department, MaintenanceRequest, MaintenanceStatus,
    TransferRequest, TransferStatus
)
from app.schemas import (
    BookingHeatmapItem, DeptAllocation, KPIResponse,
    MaintenanceByCategory, UtilizationItem
)
from app.security import CurrentUser
from app.cache import cache

router = APIRouter(prefix="/analytics", tags=["analytics"])
DbDep = Annotated[AsyncSession, Depends(get_db)]


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/kpis", response_model=KPIResponse)
async def get_kpis(db: DbDep, current_user: CurrentUser) -> KPIResponse:
    cached = await cache.get("analytics:kpis")
    if cached is not None:
        return cached

    now = utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    available = await db.execute(
        select(func.count()).select_from(Asset).where(Asset.status == AssetStatus.available)
    )
    allocated = await db.execute(
        select(func.count()).select_from(Asset).where(Asset.status == AssetStatus.allocated)
    )
    maint_today = await db.execute(
        select(func.count()).select_from(MaintenanceRequest).where(
            MaintenanceRequest.created_at >= today_start,
            MaintenanceRequest.created_at <= today_end,
        )
    )
    active_bookings = await db.execute(
        select(func.count()).select_from(Booking).where(
            Booking.status.in_([BookingStatus.upcoming, BookingStatus.ongoing])
        )
    )
    pending_transfers = await db.execute(
        select(func.count()).select_from(TransferRequest).where(
            TransferRequest.status == TransferStatus.requested
        )
    )
    # Upcoming returns in next 7 days
    next_week = now + timedelta(days=7)
    upcoming_returns = await db.execute(
        select(func.count()).select_from(Allocation).where(
            Allocation.status == AllocationStatus.active,
            Allocation.expected_return_date.between(now, next_week),
        )
    )
    # Overdue: past expected return date, still active
    overdue_returns = await db.execute(
        select(func.count()).select_from(Allocation).where(
            Allocation.status == AllocationStatus.active,
            Allocation.expected_return_date < now,
            Allocation.expected_return_date.isnot(None),
        )
    )

    res = KPIResponse(
        assets_available=available.scalar_one(),
        assets_allocated=allocated.scalar_one(),
        maintenance_today=maint_today.scalar_one(),
        active_bookings=active_bookings.scalar_one(),
        pending_transfers=pending_transfers.scalar_one(),
        upcoming_returns=upcoming_returns.scalar_one(),
        overdue_returns=overdue_returns.scalar_one(),
    )
    await cache.set("analytics:kpis", res, ttl_seconds=300)
    return res


@router.get("/overdue", response_model=list[dict])
async def get_overdue(db: DbDep, current_user: CurrentUser) -> list[dict]:
    now = utcnow()
    result = await db.execute(
        select(Allocation, Asset, Asset.name.label("asset_name"))
        .join(Asset, Allocation.asset_id == Asset.id)
        .where(
            Allocation.status == AllocationStatus.active,
            Allocation.expected_return_date < now,
            Allocation.expected_return_date.isnot(None),
        )
    )
    rows = result.all()
    out = []
    for alloc, asset, _ in rows:
        days_overdue = (now - alloc.expected_return_date).days
        out.append({
            "allocation_id": alloc.id,
            "asset_id": asset.id,
            "asset_name": asset.name,
            "asset_tag": asset.asset_tag,
            "user_id": alloc.user_id,
            "expected_return_date": alloc.expected_return_date.isoformat(),
            "days_overdue": days_overdue,
        })
    return out


@router.get("/utilization", response_model=list[UtilizationItem])
async def get_utilization(db: DbDep, current_user: CurrentUser) -> list[UtilizationItem]:
    cached = await cache.get("analytics:utilization")
    if cached is not None:
        return cached

    result = await db.execute(
        select(
            Asset.id,
            Asset.name,
            Asset.asset_tag,
            func.count(Allocation.id).label("allocation_count"),
            func.coalesce(
                func.sum(
                    func.julianday(
                        func.coalesce(Allocation.returned_at, func.datetime("now"))
                    ) - func.julianday(Allocation.allocated_at)
                ),
                0,
            ).label("total_days"),
        )
        .outerjoin(Allocation, Asset.id == Allocation.asset_id)
        .group_by(Asset.id)
        .order_by(func.count(Allocation.id).desc())
        .limit(20)
    )
    rows = result.all()
    res = [
        UtilizationItem(
            asset_name=r.name,
            asset_tag=r.asset_tag,
            allocation_count=r.allocation_count,
            total_days=round(float(r.total_days), 1),
        )
        for r in rows
    ]
    await cache.set("analytics:utilization", res, ttl_seconds=600)
    return res


@router.get("/maintenance-by-category", response_model=list[MaintenanceByCategory])
async def get_maintenance_by_category(
    db: DbDep, current_user: CurrentUser
) -> list[MaintenanceByCategory]:
    cached = await cache.get("analytics:maintenance-by-category")
    if cached is not None:
        return cached

    result = await db.execute(
        select(
            AssetCategory.name,
            func.count(MaintenanceRequest.id).label("count"),
        )
        .join(Asset, AssetCategory.id == Asset.category_id)
        .join(MaintenanceRequest, Asset.id == MaintenanceRequest.asset_id)
        .group_by(AssetCategory.name)
        .order_by(func.count(MaintenanceRequest.id).desc())
    )
    res = [
        MaintenanceByCategory(category_name=r.name, count=r.count)
        for r in result.all()
    ]
    await cache.set("analytics:maintenance-by-category", res, ttl_seconds=600)
    return res


@router.get("/department-allocation", response_model=list[DeptAllocation])
async def get_dept_allocation(db: DbDep, current_user: CurrentUser) -> list[DeptAllocation]:
    cached = await cache.get("analytics:department-allocation")
    if cached is not None:
        return cached

    result = await db.execute(
        select(
            Department.name,
            func.count(Allocation.id).label("allocated_count"),
        )
        .join(Allocation, Department.id == Allocation.department_id)
        .where(Allocation.status == AllocationStatus.active)
        .group_by(Department.name)
        .order_by(func.count(Allocation.id).desc())
    )
    res = [
        DeptAllocation(department_name=r.name, allocated_count=r.allocated_count)
        for r in result.all()
    ]
    await cache.set("analytics:department-allocation", res, ttl_seconds=600)
    return res


@router.get("/booking-heatmap", response_model=list[BookingHeatmapItem])
async def get_booking_heatmap(db: DbDep, current_user: CurrentUser) -> list[BookingHeatmapItem]:
    cached = await cache.get("analytics:booking-heatmap")
    if cached is not None:
        return cached

    result = await db.execute(
        select(
            extract("hour", Booking.start_time).label("hour"),
            extract("dow", Booking.start_time).label("dow"),
            func.count(Booking.id).label("count"),
        )
        .group_by("hour", "dow")
        .order_by("dow", "hour")
    )
    res = [
        BookingHeatmapItem(
            hour=int(r.hour),
            day_of_week=int(r.dow),
            booking_count=r.count,
        )
        for r in result.all()
    ]
    await cache.set("analytics:booking-heatmap", res, ttl_seconds=600)
    return res
