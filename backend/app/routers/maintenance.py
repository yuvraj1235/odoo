"""Maintenance router — request, approve, pipeline, resolve."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    ActivityLog, Asset, AssetStatus, MaintenanceRequest, MaintenanceStatus,
    User, UserRole
)
from app.schemas import MaintenanceCreate, MaintenanceResponse, MaintenanceUpdate
from app.security import CurrentUser, require_roles

router = APIRouter(prefix="/maintenance", tags=["maintenance"])
DbDep = Annotated[AsyncSession, Depends(get_db)]

_MR_LOAD = [
    selectinload(MaintenanceRequest.asset).selectinload(Asset.category),
    selectinload(MaintenanceRequest.user),
    selectinload(MaintenanceRequest.assigned_to),
]


@router.get("/", response_model=list[MaintenanceResponse])
async def list_requests(
    db: DbDep,
    current_user: CurrentUser,
    status_filter: MaintenanceStatus | None = None,
    asset_id: int | None = None,
) -> list[MaintenanceResponse]:
    q = select(MaintenanceRequest).options(*_MR_LOAD)
    if status_filter:
        q = q.where(MaintenanceRequest.status == status_filter)
    if asset_id:
        q = q.where(MaintenanceRequest.asset_id == asset_id)
    if current_user.role == UserRole.employee:
        q = q.where(MaintenanceRequest.user_id == current_user.id)
    result = await db.execute(q.order_by(MaintenanceRequest.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=MaintenanceResponse, status_code=201)
async def create_request(
    payload: MaintenanceCreate,
    db: DbDep,
    current_user: CurrentUser,
) -> MaintenanceResponse:
    asset_result = await db.execute(select(Asset).where(Asset.id == payload.asset_id))
    if not asset_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Asset not found")

    mr = MaintenanceRequest(
        user_id=current_user.id,
        status=MaintenanceStatus.pending,
        **payload.model_dump(),
    )
    db.add(mr)
    await db.flush()

    log = ActivityLog(
        user_id=current_user.id,
        action="maintenance.requested",
        entity_type="maintenance",
        entity_id=mr.id,
        details={"asset_id": payload.asset_id, "priority": payload.priority.value},
    )
    db.add(log)
    await db.commit()
    await db.refresh(mr)

    result = await db.execute(
        select(MaintenanceRequest).options(*_MR_LOAD).where(MaintenanceRequest.id == mr.id)
    )
    return result.scalar_one()


@router.patch("/{mr_id}", response_model=MaintenanceResponse)
async def update_request(
    mr_id: int,
    payload: MaintenanceUpdate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> MaintenanceResponse:
    result = await db.execute(
        select(MaintenanceRequest).options(*_MR_LOAD).where(MaintenanceRequest.id == mr_id)
    )
    mr = result.scalar_one_or_none()
    if not mr:
        raise HTTPException(status_code=404, detail="Maintenance request not found")

    old_status = mr.status
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(mr, field, value)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    mr.updated_at = now

    # Status transition logic
    asset_result = await db.execute(select(Asset).where(Asset.id == mr.asset_id))
    asset = asset_result.scalar_one_or_none()

    if payload.status:
        if payload.status == MaintenanceStatus.approved and asset:
            asset.status = AssetStatus.under_maintenance
        elif payload.status == MaintenanceStatus.resolved:
            mr.resolved_at = now
            if asset:
                asset.status = AssetStatus.available

    log = ActivityLog(
        user_id=current_user.id,
        action=f"maintenance.status_changed",
        entity_type="maintenance",
        entity_id=mr_id,
        details={
            "from_status": old_status.value,
            "to_status": payload.status.value if payload.status else old_status.value,
        },
    )
    db.add(log)
    await db.commit()
    await db.refresh(mr)
    return mr


@router.get("/{mr_id}", response_model=MaintenanceResponse)
async def get_request(mr_id: int, db: DbDep, current_user: CurrentUser) -> MaintenanceResponse:
    result = await db.execute(
        select(MaintenanceRequest).options(*_MR_LOAD).where(MaintenanceRequest.id == mr_id)
    )
    mr = result.scalar_one_or_none()
    if not mr:
        raise HTTPException(status_code=404, detail="Maintenance request not found")
    return mr
