"""Users router — directory, role management (Admin only for role changes)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ActivityLog, Department, User, UserRole
from app.schemas import UserResponse, UserUpdate, UserWithDept
from app.security import CurrentUser, require_roles

router = APIRouter(prefix="/users", tags=["users"])
DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_model=list[UserWithDept])
async def list_users(
    db: DbDep,
    current_user: CurrentUser,
    search: str | None = Query(None),
    role: UserRole | None = Query(None),
    department_id: int | None = Query(None),
    skip: int = 0,
    limit: int = 50,
) -> list[UserWithDept]:
    q = select(User).options(selectinload(User.department))
    if search:
        q = q.where(
            (User.full_name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )
    if role:
        q = q.where(User.role == role)
    if department_id:
        q = q.where(User.department_id == department_id)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserWithDept)
async def get_user(user_id: int, db: DbDep, current_user: CurrentUser) -> UserWithDept:
    result = await db.execute(
        select(User).options(selectinload(User.department)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> UserResponse:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    if payload.role and payload.role != old_role:
        log = ActivityLog(
            user_id=current_user.id,
            action="user.role_changed",
            entity_type="user",
            entity_id=user_id,
            details={
                "changed_user": user.email,
                "from_role": old_role.value,
                "to_role": payload.role.value,
                "changed_by": current_user.full_name,
            },
        )
        db.add(log)

    await db.commit()
    await db.refresh(user)
    return user
