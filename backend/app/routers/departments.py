"""Departments router."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ActivityLog, Department, User, UserRole
from app.schemas import DepartmentCreate, DepartmentResponse, DepartmentUpdate
from app.security import CurrentUser, require_roles

router = APIRouter(prefix="/departments", tags=["departments"])
DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_model=list[DepartmentResponse])
async def list_departments(db: DbDep, current_user: CurrentUser) -> list[DepartmentResponse]:
    result = await db.execute(
        select(Department).options(selectinload(Department.head))
    )
    return result.scalars().all()


@router.post("/", response_model=DepartmentResponse, status_code=201)
async def create_department(
    payload: DepartmentCreate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> DepartmentResponse:
    dept = Department(**payload.model_dump())
    db.add(dept)
    await db.flush()
    log = ActivityLog(
        user_id=current_user.id,
        action="department.created",
        entity_type="department",
        entity_id=dept.id,
        details={"name": dept.name},
    )
    db.add(log)
    await db.commit()
    await db.refresh(dept)
    return dept


@router.get("/{dept_id}", response_model=DepartmentResponse)
async def get_department(dept_id: int, db: DbDep, current_user: CurrentUser) -> DepartmentResponse:
    result = await db.execute(
        select(Department).options(selectinload(Department.head)).where(Department.id == dept_id)
    )
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@router.patch("/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: int,
    payload: DepartmentUpdate,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> DepartmentResponse:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(dept, field, value)

    await db.commit()
    await db.refresh(dept)
    return dept


@router.delete("/{dept_id}", status_code=204)
async def delete_department(
    dept_id: int,
    db: DbDep,
    current_user: Annotated[User, Depends(require_roles(UserRole.admin))],
) -> None:
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    await db.delete(dept)
    await db.commit()
