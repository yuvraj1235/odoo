"""Asset categories router."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Asset, AssetCategory, User, UserRole
from app.schemas import CategoryCreate, CategoryResponse, CategoryUpdate
from app.security import CurrentUser, require_roles

router = APIRouter(prefix="/categories", tags=["categories"])
DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_model=list[CategoryResponse])
async def list_categories(db: DbDep, current_user: CurrentUser) -> list[CategoryResponse]:
    result = await db.execute(select(AssetCategory))
    categories = result.scalars().all()
    # Attach asset count
    out = []
    for cat in categories:
        count_result = await db.execute(
            select(func.count()).select_from(Asset).where(Asset.category_id == cat.id)
        )
        count = count_result.scalar_one()
        cat_resp = CategoryResponse.model_validate(cat)
        cat_resp.asset_count = count
        out.append(cat_resp)
    return out


@router.post("/", response_model=CategoryResponse, status_code=201)
async def create_category(
    payload: CategoryCreate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> CategoryResponse:
    cat = AssetCategory(**payload.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    result = CategoryResponse.model_validate(cat)
    result.asset_count = 0
    return result


@router.patch("/{cat_id}", response_model=CategoryResponse)
async def update_category(
    cat_id: int,
    payload: CategoryUpdate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin, UserRole.asset_manager))],
) -> CategoryResponse:
    result = await db.execute(select(AssetCategory).where(AssetCategory.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    await db.commit()
    await db.refresh(cat)

    count_result = await db.execute(
        select(func.count()).select_from(Asset).where(Asset.category_id == cat.id)
    )
    resp = CategoryResponse.model_validate(cat)
    resp.asset_count = count_result.scalar_one()
    return resp


@router.delete("/{cat_id}", status_code=204)
async def delete_category(
    cat_id: int,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> None:
    result = await db.execute(select(AssetCategory).where(AssetCategory.id == cat_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()
