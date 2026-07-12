"""Allocations router — allocate, return, and transfer workflow."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    ActivityLog, Allocation, AllocationStatus, Asset, AssetStatus,
    Department, TransferRequest, TransferStatus, User, UserRole
)
from app.schemas import (
    AllocationCreate, AllocationResponse, ReturnRequest,
    TransferCreate, TransferResponse
)
from app.security import CurrentUser, require_roles
from app.cache import cache

router = APIRouter(prefix="/allocations", tags=["allocations"])
DbDep = Annotated[AsyncSession, Depends(get_db)]

_ALLOC_LOAD = [
    selectinload(Allocation.asset).options(
        selectinload(Asset.category),
        selectinload(Asset.department).selectinload(Department.head),
    ),
    selectinload(Allocation.user),
]

_TRANSFER_LOAD = [
    selectinload(TransferRequest.asset).options(
        selectinload(Asset.category),
        selectinload(Asset.department).selectinload(Department.head),
    ),
    selectinload(TransferRequest.from_user),
    selectinload(TransferRequest.to_user),
]


@router.get("/", response_model=list[AllocationResponse])
async def list_allocations(
    db: DbDep,
    current_user: CurrentUser,
    asset_id: int | None = None,
    user_id: int | None = None,
    active_only: bool = True,
) -> list[AllocationResponse]:
    q = select(Allocation).options(*_ALLOC_LOAD)
    if active_only:
        q = q.where(Allocation.status == AllocationStatus.active)
    if asset_id:
        q = q.where(Allocation.asset_id == asset_id)
    if user_id:
        q = q.where(Allocation.user_id == user_id)
    # Employees only see their own
    if current_user.role == UserRole.employee:
        q = q.where(Allocation.user_id == current_user.id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=AllocationResponse, status_code=201)
async def allocate_asset(
    payload: AllocationCreate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> AllocationResponse:
    # Verify asset exists and is available
    asset_result = await db.execute(select(Asset).where(Asset.id == payload.asset_id))
    asset = asset_result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.status != AssetStatus.available:
        # Find current holder for conflict info
        holder_result = await db.execute(
            select(Allocation)
            .options(selectinload(Allocation.user))
            .where(
                Allocation.asset_id == payload.asset_id,
                Allocation.status == AllocationStatus.active,
            )
        )
        active = holder_result.scalar_one_or_none()
        holder_name = active.user.full_name if active else "Unknown"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"Asset is not available (current status: {asset.status.value})",
                "current_holder": holder_name,
                "asset_status": asset.status.value,
            },
        )

    # Verify target user
    user_result = await db.execute(select(User).where(User.id == payload.user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Target user not found")

    alloc = Allocation(**payload.model_dump(), status=AllocationStatus.active)
    db.add(alloc)

    asset.status = AssetStatus.allocated
    await db.flush()

    log = ActivityLog(
        user_id=current_user.id,
        action="asset.allocated",
        entity_type="allocation",
        entity_id=alloc.id,
        details={
            "asset_id": payload.asset_id,
            "user_id": payload.user_id,
            "asset_tag": asset.asset_tag,
        },
    )
    db.add(log)
    await db.commit()
    await db.refresh(alloc)
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")

    result = await db.execute(
        select(Allocation).options(*_ALLOC_LOAD).where(Allocation.id == alloc.id)
    )
    return result.scalar_one()


@router.post("/{alloc_id}/return", response_model=AllocationResponse)
async def return_asset(
    alloc_id: int,
    payload: ReturnRequest,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> AllocationResponse:
    result = await db.execute(
        select(Allocation).options(*_ALLOC_LOAD).where(Allocation.id == alloc_id)
    )
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    if alloc.status != AllocationStatus.active:
        raise HTTPException(status_code=400, detail="Allocation is not active")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    alloc.returned_at = now
    alloc.status = AllocationStatus.returned
    alloc.condition_notes = payload.condition_notes

    asset_result = await db.execute(select(Asset).where(Asset.id == alloc.asset_id))
    asset = asset_result.scalar_one()
    asset.status = AssetStatus.available

    log = ActivityLog(
        user_id=current_user.id,
        action="asset.returned",
        entity_type="allocation",
        entity_id=alloc_id,
        details={
            "asset_id": alloc.asset_id,
            "user_id": alloc.user_id,
            "condition_notes": payload.condition_notes,
        },
    )
    db.add(log)
    await db.commit()
    await db.refresh(alloc)
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")
    return alloc


# ─── Transfer Requests ────────────────────────────────────────────────────────

@router.get("/transfers", response_model=list[TransferResponse])
async def list_transfers(
    db: DbDep,
    current_user: CurrentUser,
    pending_only: bool = False,
) -> list[TransferResponse]:
    q = select(TransferRequest).options(*_TRANSFER_LOAD)
    if pending_only:
        q = q.where(TransferRequest.status == TransferStatus.requested)
    if current_user.role == UserRole.employee:
        q = q.where(
            (TransferRequest.from_user_id == current_user.id) |
            (TransferRequest.to_user_id == current_user.id)
        )
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/transfers", response_model=TransferResponse, status_code=201)
async def request_transfer(
    payload: TransferCreate,
    db: DbDep,
    current_user: CurrentUser,
) -> TransferResponse:
    asset_result = await db.execute(select(Asset).where(Asset.id == payload.asset_id))
    asset = asset_result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    transfer = TransferRequest(
        from_user_id=current_user.id,
        **payload.model_dump(),
        status=TransferStatus.requested,
    )
    db.add(transfer)
    log = ActivityLog(
        user_id=current_user.id,
        action="transfer.requested",
        entity_type="transfer",
        entity_id=None,
        details={"asset_id": payload.asset_id, "to_user_id": payload.to_user_id},
    )
    db.add(log)
    await db.commit()
    await db.refresh(transfer)
    result = await db.execute(
        select(TransferRequest).options(*_TRANSFER_LOAD).where(TransferRequest.id == transfer.id)
    )
    return result.scalar_one()


@router.post("/transfers/{transfer_id}/approve", response_model=TransferResponse)
async def approve_transfer(
    transfer_id: int,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager, UserRole.dept_head))],
) -> TransferResponse:
    result = await db.execute(
        select(TransferRequest).options(*_TRANSFER_LOAD).where(TransferRequest.id == transfer_id)
    )
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status != TransferStatus.requested:
        raise HTTPException(status_code=400, detail="Transfer is not in requested state")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Close old allocation
    old_alloc = await db.execute(
        select(Allocation).where(
            Allocation.asset_id == transfer.asset_id,
            Allocation.user_id == transfer.from_user_id,
            Allocation.status == AllocationStatus.active,
        )
    )
    old = old_alloc.scalar_one_or_none()
    if old:
        old.status = AllocationStatus.transferred
        old.returned_at = now

    # Create new allocation
    new_alloc = Allocation(
        asset_id=transfer.asset_id,
        user_id=transfer.to_user_id,
        allocated_at=now,
        status=AllocationStatus.active,
    )
    db.add(new_alloc)

    transfer.status = TransferStatus.approved
    transfer.actioned_at = now
    transfer.actioned_by_id = current_user.id

    log = ActivityLog(
        user_id=current_user.id,
        action="transfer.approved",
        entity_type="transfer",
        entity_id=transfer_id,
        details={"asset_id": transfer.asset_id, "to_user_id": transfer.to_user_id},
    )
    db.add(log)
    await db.commit()
    await db.refresh(transfer)
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")
    return transfer


@router.post("/transfers/{transfer_id}/reject", response_model=TransferResponse)
async def reject_transfer(
    transfer_id: int,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager, UserRole.dept_head))],
) -> TransferResponse:
    result = await db.execute(
        select(TransferRequest).options(*_TRANSFER_LOAD).where(TransferRequest.id == transfer_id)
    )
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    transfer.status = TransferStatus.rejected
    transfer.actioned_at = now
    transfer.actioned_by_id = current_user.id

    log = ActivityLog(
        user_id=current_user.id,
        action="transfer.rejected",
        entity_type="transfer",
        entity_id=transfer_id,
        details={"asset_id": transfer.asset_id},
    )
    db.add(log)
    await db.commit()
    await db.refresh(transfer)
    return transfer
