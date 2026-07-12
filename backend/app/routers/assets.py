"""Assets router — CRUD, search, lifecycle, history."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    ActivityLog, Allocation, AllocationStatus, Asset, AssetCategory,
    AssetStatus, Department, User, UserRole
)
from app.schemas import AssetCreate, AssetResponse, AssetUpdate, AllocationResponse
from app.security import CurrentUser, require_roles
from app.cache import cache

router = APIRouter(prefix="/assets", tags=["assets"])
DbDep = Annotated[AsyncSession, Depends(get_db)]

_ASSET_LOAD = [
    selectinload(Asset.category),
    selectinload(Asset.department).selectinload(Department.head),
    selectinload(Asset.allocations).selectinload(Allocation.user),
]


def _next_tag(existing_tags: list[str]) -> str:
    max_n = 0
    for t in existing_tags:
        try:
            max_n = max(max_n, int(t.split("-")[1]))
        except (IndexError, ValueError):
            pass
    return f"AF-{max_n + 1:04d}"


async def _enrich(asset: Asset, db: AsyncSession) -> AssetResponse:
    resp = AssetResponse.model_validate(asset)
    # Find current holder
    alloc_result = await db.execute(
        select(Allocation)
        .options(selectinload(Allocation.user))
        .where(
            Allocation.asset_id == asset.id,
            Allocation.status == AllocationStatus.active,
        )
        .order_by(Allocation.allocated_at.desc())
        .limit(1)
    )
    active_alloc = alloc_result.scalar_one_or_none()
    if active_alloc:
        from app.schemas import UserResponse
        resp.current_holder = UserResponse.model_validate(active_alloc.user)
    return resp


@router.get("/", response_model=list[AssetResponse])
async def list_assets(
    db: DbDep,
    current_user: CurrentUser,
    search: str | None = Query(None),
    status: AssetStatus | None = Query(None),
    category_id: int | None = Query(None),
    department_id: int | None = Query(None),
    location: str | None = Query(None),
    is_bookable: bool | None = Query(None),
    skip: int = 0,
    limit: int = 100,
) -> list[AssetResponse]:
    q = select(Asset).options(*_ASSET_LOAD)
    if search:
        q = q.where(
            Asset.name.ilike(f"%{search}%") | Asset.asset_tag.ilike(f"%{search}%")
        )
    if status:
        q = q.where(Asset.status == status)
    if category_id:
        q = q.where(Asset.category_id == category_id)
    if department_id:
        q = q.where(Asset.department_id == department_id)
    if location:
        q = q.where(Asset.location.ilike(f"%{location}%"))
    if is_bookable is not None:
        q = q.where(Asset.is_bookable == is_bookable)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    assets = result.scalars().all()
    return [await _enrich(a, db) for a in assets]


@router.post("/", response_model=AssetResponse, status_code=201)
async def create_asset(
    payload: AssetCreate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> AssetResponse:
    # Generate unique tag
    tags_result = await db.execute(select(Asset.asset_tag))
    existing_tags = [row[0] for row in tags_result.fetchall()]
    tag = _next_tag(existing_tags)

    asset = Asset(asset_tag=tag, **payload.model_dump())
    db.add(asset)
    await db.flush()

    log = ActivityLog(
        user_id=current_user.id,
        action="asset.created",
        entity_type="asset",
        entity_id=asset.id,
        details={"asset_tag": tag, "name": payload.name},
    )
    db.add(log)
    await db.commit()
    await db.refresh(asset)
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")
    return await _enrich(asset, db)


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(asset_id: int, db: DbDep, current_user: CurrentUser) -> AssetResponse:
    result = await db.execute(
        select(Asset).options(*_ASSET_LOAD).where(Asset.id == asset_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return await _enrich(asset, db)


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: int,
    payload: AssetUpdate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> AssetResponse:
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(asset, field, value)
    asset.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    log = ActivityLog(
        user_id=current_user.id,
        action="asset.updated",
        entity_type="asset",
        entity_id=asset_id,
        details=update_data,
    )
    db.add(log)
    await db.commit()
    await db.refresh(asset)
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")
    return await _enrich(asset, db)


@router.delete("/{asset_id}", status_code=204)
async def delete_asset(
    asset_id: int,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> None:
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)
    await db.commit()
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")


@router.get("/{asset_id}/history", response_model=list[AllocationResponse])
async def get_asset_history(
    asset_id: int,
    db: DbDep,
    current_user: CurrentUser,
) -> list[AllocationResponse]:
    result = await db.execute(
        select(Allocation)
        .options(
            selectinload(Allocation.user),
            selectinload(Allocation.asset),
        )
        .where(Allocation.asset_id == asset_id)
        .order_by(Allocation.allocated_at.desc())
    )
    return result.scalars().all()
