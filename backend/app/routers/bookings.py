"""Bookings router with strict overlap validation."""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    ActivityLog, Asset, AssetStatus, Booking, BookingStatus, Department, User, UserRole
)
from app.schemas import BookingCreate, BookingResponse, BookingUpdate
from app.security import CurrentUser, require_roles
from app.cache import cache

router = APIRouter(prefix="/bookings", tags=["bookings"])
DbDep = Annotated[AsyncSession, Depends(get_db)]

_BOOKING_LOAD = [
    selectinload(Booking.asset).options(
        selectinload(Asset.category),
        selectinload(Asset.department).selectinload(Department.head),
    ),
    selectinload(Booking.user),
]


async def _check_overlap(
    db: AsyncSession,
    asset_id: int,
    start: datetime,
    end: datetime,
    exclude_id: int | None = None,
) -> Booking | None:
    """Return conflicting booking if overlap exists, else None."""
    # Overlap condition: existing.start < new.end AND existing.end > new.start
    q = select(Booking).options(selectinload(Booking.user)).where(
        Booking.asset_id == asset_id,
        Booking.status.in_([BookingStatus.upcoming, BookingStatus.ongoing]),
        Booking.start_time < end,
        Booking.end_time > start,
    )
    if exclude_id:
        q = q.where(Booking.id != exclude_id)
    result = await db.execute(q)
    return result.scalar_one_or_none()


async def _get_smart_recommendations(
    db: AsyncSession,
    asset: Asset,
    start: datetime,
    end: datetime,
) -> list[dict]:
    """Find unbooked alternative resources in the same category during requested window."""
    q = select(Asset).where(
        Asset.category_id == asset.category_id,
        Asset.id != asset.id,
        Asset.is_bookable == True,
        Asset.status == AssetStatus.available,
    )
    result = await db.execute(q)
    alternatives = result.scalars().all()

    recommendations = []
    for alt in alternatives:
        conflict = await _check_overlap(db, alt.id, start, end)
        if not conflict:
            recommendations.append({
                "id": alt.id,
                "resource_id": alt.asset_tag,
                "name": alt.name,
                "location": alt.location,
            })
            if len(recommendations) >= 4:
                break
    return recommendations


@router.get("/", response_model=list[BookingResponse])
async def list_bookings(
    db: DbDep,
    current_user: CurrentUser,
    asset_id: int | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    status: BookingStatus | None = Query(None),
) -> list[BookingResponse]:
    q = select(Booking).options(*_BOOKING_LOAD)
    if asset_id:
        q = q.where(Booking.asset_id == asset_id)
    if from_date:
        q = q.where(Booking.end_time >= from_date)
    if to_date:
        q = q.where(Booking.start_time <= to_date)
    if status:
        q = q.where(Booking.status == status)
    if current_user.role == UserRole.employee:
        q = q.where(Booking.user_id == current_user.id)
    result = await db.execute(q.order_by(Booking.start_time))
    return result.scalars().all()


@router.post("/", response_model=BookingResponse, status_code=201)
async def create_booking(
    payload: BookingCreate,
    db: DbDep,
    current_user: CurrentUser,
) -> BookingResponse:
    # Verify asset is bookable
    asset_result = await db.execute(select(Asset).where(Asset.id == payload.asset_id))
    asset = asset_result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not asset.is_bookable:
        raise HTTPException(status_code=400, detail="Asset is not bookable")

    # Strict overlap validation with Smart Swap Recommendation Engine
    conflict = await _check_overlap(db, payload.asset_id, payload.start_time, payload.end_time)
    if conflict:
        recs = await _get_smart_recommendations(db, asset, payload.start_time, payload.end_time)
        team_name = conflict.user.full_name if conflict.user else "Another User"
        time_str = f"{conflict.start_time.strftime('%H:%M')} - {conflict.end_time.strftime('%H:%M')}"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "status": "conflict",
                "message": "Resource is unavailable during this time window.",
                "conflicting_booking": { "team": team_name, "time": time_str },
                "recommendations": recs,
            },
        )

    booking = Booking(
        asset_id=payload.asset_id,
        user_id=current_user.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        notes=payload.notes,
        status=BookingStatus.upcoming,
    )
    db.add(booking)
    await db.flush()

    log = ActivityLog(
        user_id=current_user.id,
        action="booking.created",
        entity_type="booking",
        entity_id=booking.id,
        details={"asset_id": payload.asset_id},
    )
    db.add(log)
    await db.commit()
    await db.refresh(booking)
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")

    result = await db.execute(
        select(Booking).options(*_BOOKING_LOAD).where(Booking.id == booking.id)
    )
    return result.scalar_one()


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(booking_id: int, db: DbDep, current_user: CurrentUser) -> BookingResponse:
    result = await db.execute(
        select(Booking).options(*_BOOKING_LOAD).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.patch("/{booking_id}", response_model=BookingResponse)
async def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: DbDep,
    current_user: CurrentUser,
) -> BookingResponse:
    result = await db.execute(
        select(Booking).options(*_BOOKING_LOAD).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Only owner or admin/manager can update
    if booking.user_id != current_user.id and current_user.role not in (
        UserRole.admin, UserRole.asset_manager
    ):
        raise HTTPException(status_code=403, detail="Not authorized to update this booking")

    # Check overlap if times are changing
    new_start = payload.start_time or booking.start_time
    new_end = payload.end_time or booking.end_time
    if payload.start_time or payload.end_time:
        conflict = await _check_overlap(db, booking.asset_id, new_start, new_end, booking_id)
        if conflict:
            raise HTTPException(
                status_code=409,
                detail={"message": "Updated slot conflicts with existing booking"},
            )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(booking, field, value)

    await db.commit()
    await db.refresh(booking)
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")
    return booking


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: int,
    db: DbDep,
    current_user: CurrentUser,
) -> BookingResponse:
    result = await db.execute(
        select(Booking).options(*_BOOKING_LOAD).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.id and current_user.role not in (
        UserRole.admin, UserRole.asset_manager
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    booking.status = BookingStatus.cancelled
    await db.commit()
    await db.refresh(booking)
    await cache.invalidate_pattern("analytics")
    await cache.invalidate_pattern("ai:")
    return booking
