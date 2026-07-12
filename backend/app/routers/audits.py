"""Audit cycles router."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    ActivityLog, Asset, AssetStatus, AuditCycle, AuditCycleStatus,
    AuditItem, AuditItemStatus, Department, User, UserRole
)
from app.schemas import (
    AuditCycleCreate, AuditCycleResponse, AuditItemResponse, AuditItemUpdate
)
from app.security import CurrentUser, require_roles

router = APIRouter(prefix="/audits", tags=["audits"])
DbDep = Annotated[AsyncSession, Depends(get_db)]

_CYCLE_LOAD = [
    selectinload(AuditCycle.department),
    selectinload(AuditCycle.created_by),
    selectinload(AuditCycle.items).selectinload(AuditItem.asset).options(
        selectinload(Asset.category),
        selectinload(Asset.department).selectinload(Department.head),
    ),
    selectinload(AuditCycle.items).selectinload(AuditItem.auditor),
]


@router.get("/", response_model=list[AuditCycleResponse])
async def list_audits(db: DbDep, current_user: CurrentUser) -> list[AuditCycleResponse]:
    result = await db.execute(
        select(AuditCycle).options(*_CYCLE_LOAD).order_by(AuditCycle.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=AuditCycleResponse, status_code=201)
async def create_audit(
    payload: AuditCycleCreate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> AuditCycleResponse:
    cycle = AuditCycle(
        name=payload.name,
        department_id=payload.department_id,
        location=payload.location,
        date_from=payload.date_from,
        date_to=payload.date_to,
        status=AuditCycleStatus.open,
        created_by_id=current_user.id,
    )
    db.add(cycle)
    await db.flush()

    # Scope assets: by department or location
    q = select(Asset)
    if payload.department_id:
        q = q.where(Asset.department_id == payload.department_id)
    if payload.location:
        q = q.where(Asset.location.ilike(f"%{payload.location}%"))

    asset_result = await db.execute(q)
    assets = asset_result.scalars().all()

    for asset in assets:
        item = AuditItem(
            audit_cycle_id=cycle.id,
            asset_id=asset.id,
            auditor_id=payload.auditor_ids[0] if payload.auditor_ids else None,
            status=AuditItemStatus.pending,
        )
        db.add(item)

    log = ActivityLog(
        user_id=current_user.id,
        action="audit.cycle_created",
        entity_type="audit_cycle",
        entity_id=cycle.id,
        details={"name": payload.name, "assets_scoped": len(assets)},
    )
    db.add(log)
    await db.commit()
    await db.refresh(cycle)

    result = await db.execute(
        select(AuditCycle).options(*_CYCLE_LOAD).where(AuditCycle.id == cycle.id)
    )
    return result.scalar_one()


@router.get("/{cycle_id}", response_model=AuditCycleResponse)
async def get_audit(cycle_id: int, db: DbDep, current_user: CurrentUser) -> AuditCycleResponse:
    result = await db.execute(
        select(AuditCycle).options(*_CYCLE_LOAD).where(AuditCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    return cycle


@router.patch("/{cycle_id}/items/{item_id}", response_model=AuditItemResponse)
async def update_audit_item(
    cycle_id: int,
    item_id: int,
    payload: AuditItemUpdate,
    db: DbDep,
    current_user: CurrentUser,
) -> AuditItemResponse:
    result = await db.execute(
        select(AuditItem)
        .options(
            selectinload(AuditItem.asset).options(
                selectinload(Asset.category),
                selectinload(Asset.department).selectinload(Department.head),
            ),
            selectinload(AuditItem.auditor),
        )
        .where(AuditItem.id == item_id, AuditItem.audit_cycle_id == cycle_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Audit item not found")

    # Verify cycle is open
    cycle_result = await db.execute(select(AuditCycle).where(AuditCycle.id == cycle_id))
    cycle = cycle_result.scalar_one_or_none()
    if cycle and cycle.status == AuditCycleStatus.closed:
        raise HTTPException(status_code=400, detail="Audit cycle is closed")

    item.status = payload.status
    item.notes = payload.notes
    item.audited_at = datetime.now(timezone.utc).replace(tzinfo=None)

    await db.commit()
    await db.refresh(item)
    return item


@router.post("/{cycle_id}/close", response_model=AuditCycleResponse)
async def close_audit(
    cycle_id: int,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> AuditCycleResponse:
    result = await db.execute(
        select(AuditCycle).options(*_CYCLE_LOAD).where(AuditCycle.id == cycle_id)
    )
    cycle = result.scalar_one_or_none()
    if not cycle:
        raise HTTPException(status_code=404, detail="Audit cycle not found")
    if cycle.status == AuditCycleStatus.closed:
        raise HTTPException(status_code=400, detail="Already closed")

    cycle.status = AuditCycleStatus.closed

    # Auto-mark missing assets as Lost
    missing_count = 0
    for item in cycle.items:
        if item.status == AuditItemStatus.missing:
            asset_result = await db.execute(select(Asset).where(Asset.id == item.asset_id))
            asset = asset_result.scalar_one_or_none()
            if asset:
                asset.status = AssetStatus.lost
                missing_count += 1

    log = ActivityLog(
        user_id=current_user.id,
        action="audit.cycle_closed",
        entity_type="audit_cycle",
        entity_id=cycle_id,
        details={"name": cycle.name, "assets_marked_lost": missing_count},
    )
    db.add(log)
    await db.commit()
    await db.refresh(cycle)

    result = await db.execute(
        select(AuditCycle).options(*_CYCLE_LOAD).where(AuditCycle.id == cycle_id)
    )
    return result.scalar_one()
