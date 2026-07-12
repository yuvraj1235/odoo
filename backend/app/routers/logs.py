"""Activity logs and notifications router."""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import ActivityLog, User, UserRole
from app.schemas import ActivityLogResponse
from app.security import CurrentUser, require_roles

router = APIRouter(prefix="/logs", tags=["logs"])
DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_model=list[ActivityLogResponse])
async def list_logs(
    db: DbDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    entity_type: str | None = Query(None),
) -> list[ActivityLogResponse]:
    q = select(ActivityLog).options(selectinload(ActivityLog.user))

    # Employees see only their own logs
    if current_user.role == UserRole.employee:
        q = q.where(ActivityLog.user_id == current_user.id)

    if entity_type:
        q = q.where(ActivityLog.entity_type == entity_type)

    q = q.order_by(ActivityLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/notifications", response_model=list[dict])
async def get_notifications(db: DbDep, current_user: CurrentUser) -> list[dict]:
    """Return actionable notifications for the current user."""
    from app.models import Allocation, AllocationStatus, MaintenanceRequest, TransferRequest, TransferStatus
    from datetime import datetime, timezone, timedelta

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    notifications = []

    # Overdue allocations for this user
    if current_user.role in (UserRole.admin, UserRole.asset_manager):
        od_result = await db.execute(
            select(Allocation, User)
            .join(User, Allocation.user_id == User.id)
            .where(
                Allocation.status == AllocationStatus.active,
                Allocation.expected_return_date < now,
                Allocation.expected_return_date.isnot(None),
            )
            .limit(5)
        )
        for alloc, user in od_result.all():
            days = (now - alloc.expected_return_date).days
            notifications.append({
                "type": "overdue_return",
                "title": "Overdue Return Alert",
                "message": f"{user.full_name} has an overdue asset return ({days} days late)",
                "severity": "error",
                "entity_type": "allocation",
                "entity_id": alloc.id,
                "created_at": now.isoformat(),
            })

    # Pending transfers needing action
    if current_user.role in (UserRole.admin, UserRole.asset_manager, UserRole.dept_head):
        tr_result = await db.execute(
            select(TransferRequest)
            .where(TransferRequest.status == TransferStatus.requested)
            .limit(5)
        )
        for tr in tr_result.scalars().all():
            notifications.append({
                "type": "pending_transfer",
                "title": "Transfer Request Pending",
                "message": f"Transfer request for asset #{tr.asset_id} awaiting your approval",
                "severity": "warning",
                "entity_type": "transfer",
                "entity_id": tr.id,
                "created_at": tr.requested_at.isoformat(),
            })

    # Recent maintenance requests for this user
    maint_result = await db.execute(
        select(MaintenanceRequest)
        .where(MaintenanceRequest.user_id == current_user.id)
        .order_by(MaintenanceRequest.created_at.desc())
        .limit(3)
    )
    for mr in maint_result.scalars().all():
        notifications.append({
            "type": "maintenance_update",
            "title": "Maintenance Request Update",
            "message": f"Your maintenance request status: {mr.status.value}",
            "severity": "info",
            "entity_type": "maintenance",
            "entity_id": mr.id,
            "created_at": mr.updated_at.isoformat(),
        })

    return notifications
