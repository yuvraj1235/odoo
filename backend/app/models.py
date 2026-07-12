"""SQLAlchemy ORM models for AssetFlow."""
import enum
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ─── Enumerations ─────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    asset_manager = "asset_manager"
    dept_head = "dept_head"
    employee = "employee"


class AssetStatus(str, enum.Enum):
    available = "available"
    allocated = "allocated"
    reserved = "reserved"
    under_maintenance = "under_maintenance"
    lost = "lost"
    retired = "retired"
    disposed = "disposed"


class AssetCondition(str, enum.Enum):
    new = "new"
    good = "good"
    fair = "fair"
    poor = "poor"
    damaged = "damaged"


class AllocationStatus(str, enum.Enum):
    active = "active"
    returned = "returned"
    transferred = "transferred"


class TransferStatus(str, enum.Enum):
    requested = "requested"
    approved = "approved"
    rejected = "rejected"


class BookingStatus(str, enum.Enum):
    upcoming = "upcoming"
    ongoing = "ongoing"
    completed = "completed"
    cancelled = "cancelled"


class MaintenancePriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class SLAStatus(str, enum.Enum):
    normal = "normal"
    warning = "warning"
    breached = "breached"


class MaintenanceStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    technician_assigned = "technician_assigned"
    in_progress = "in_progress"
    resolved = "resolved"


class AuditCycleStatus(str, enum.Enum):
    open = "open"
    closed = "closed"


class AuditItemStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    missing = "missing"
    damaged = "damaged"


class DepartmentStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


# ─── Models ───────────────────────────────────────────────────────────────────

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[DepartmentStatus] = mapped_column(
        SAEnum(DepartmentStatus), default=DepartmentStatus.active
    )
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True
    )
    head_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", use_alter=True, name="fk_dept_head"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    parent: Mapped["Department | None"] = relationship(
        "Department", remote_side="Department.id", foreign_keys="Department.parent_id"
    )
    head: Mapped["User | None"] = relationship(
        "User", foreign_keys="Department.head_user_id", back_populates="headed_department"
    )
    users: Mapped[list["User"]] = relationship(
        "User", foreign_keys="User.department_id", back_populates="department"
    )
    assets: Mapped[list["Asset"]] = relationship("Asset", back_populates="department")
    audit_cycles: Mapped[list["AuditCycle"]] = relationship(
        "AuditCycle", back_populates="department"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.employee)
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    department: Mapped["Department | None"] = relationship(
        "Department", foreign_keys="User.department_id", back_populates="users"
    )
    headed_department: Mapped["Department | None"] = relationship(
        "Department", foreign_keys="Department.head_user_id", back_populates="head"
    )
    allocations: Mapped[list["Allocation"]] = relationship(
        "Allocation", foreign_keys="Allocation.user_id", back_populates="user"
    )
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="user")
    maintenance_requests: Mapped[list["MaintenanceRequest"]] = relationship(
        "MaintenanceRequest", foreign_keys="MaintenanceRequest.user_id", back_populates="user"
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(
        "ActivityLog", back_populates="user"
    )


class AssetCategory(Base):
    __tablename__ = "asset_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_fields: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    assets: Mapped[list["Asset"]] = relationship("Asset", back_populates="category")


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_category_status_location", "category_id", "status", "location"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_tag: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("asset_categories.id"), nullable=True
    )
    status: Mapped[AssetStatus] = mapped_column(
        SAEnum(AssetStatus), default=AssetStatus.available
    )
    condition: Mapped[AssetCondition] = mapped_column(
        SAEnum(AssetCondition), default=AssetCondition.good
    )
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True
    )
    is_bookable: Mapped[bool] = mapped_column(Boolean, default=False)
    acquisition_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    acquisition_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    category: Mapped["AssetCategory | None"] = relationship(
        "AssetCategory", back_populates="assets"
    )
    department: Mapped["Department | None"] = relationship(
        "Department", back_populates="assets"
    )
    allocations: Mapped[list["Allocation"]] = relationship(
        "Allocation", back_populates="asset"
    )
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="asset")
    maintenance_requests: Mapped[list["MaintenanceRequest"]] = relationship(
        "MaintenanceRequest", back_populates="asset"
    )
    audit_items: Mapped[list["AuditItem"]] = relationship(
        "AuditItem", back_populates="asset"
    )
    transfer_requests: Mapped[list["TransferRequest"]] = relationship(
        "TransferRequest", back_populates="asset"
    )


class Allocation(Base):
    __tablename__ = "allocations"
    __table_args__ = (
        Index("ix_allocations_asset_user", "asset_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("assets.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True
    )
    allocated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expected_return_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    condition_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[AllocationStatus] = mapped_column(
        SAEnum(AllocationStatus), default=AllocationStatus.active
    )

    asset: Mapped["Asset"] = relationship("Asset", back_populates="allocations")
    user: Mapped["User"] = relationship(
        "User", foreign_keys="Allocation.user_id", back_populates="allocations"
    )
    department: Mapped["Department | None"] = relationship("Department")


class TransferRequest(Base):
    __tablename__ = "transfer_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("assets.id"), nullable=False)
    from_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    to_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    status: Mapped[TransferStatus] = mapped_column(
        SAEnum(TransferStatus), default=TransferStatus.requested
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    actioned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actioned_by_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    asset: Mapped["Asset"] = relationship("Asset", back_populates="transfer_requests")
    from_user: Mapped["User"] = relationship("User", foreign_keys="TransferRequest.from_user_id")
    to_user: Mapped["User"] = relationship("User", foreign_keys="TransferRequest.to_user_id")
    actioned_by: Mapped["User | None"] = relationship(
        "User", foreign_keys="TransferRequest.actioned_by_id"
    )


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_bookings_asset_time", "asset_id", "start_time", "end_time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("assets.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        SAEnum(BookingStatus), default=BookingStatus.upcoming
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    asset: Mapped["Asset"] = relationship("Asset", back_populates="bookings")
    user: Mapped["User"] = relationship("User", back_populates="bookings")


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("assets.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    issue_description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[MaintenancePriority] = mapped_column(
        SAEnum(MaintenancePriority), default=MaintenancePriority.medium
    )
    status: Mapped[MaintenanceStatus] = mapped_column(
        SAEnum(MaintenanceStatus), default=MaintenanceStatus.pending
    )
    sla_status: Mapped[SLAStatus] = mapped_column(
        SAEnum(SLAStatus), default=SLAStatus.normal
    )
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    asset: Mapped["Asset"] = relationship("Asset", back_populates="maintenance_requests")
    user: Mapped["User"] = relationship(
        "User", foreign_keys="MaintenanceRequest.user_id", back_populates="maintenance_requests"
    )
    assigned_to: Mapped["User | None"] = relationship(
        "User", foreign_keys="MaintenanceRequest.assigned_to_id"
    )


class AuditCycle(Base):
    __tablename__ = "audit_cycles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id"), nullable=True
    )
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    date_from: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    date_to: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[AuditCycleStatus] = mapped_column(
        SAEnum(AuditCycleStatus), default=AuditCycleStatus.open
    )
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    department: Mapped["Department | None"] = relationship(
        "Department", back_populates="audit_cycles"
    )
    created_by: Mapped["User"] = relationship("User", foreign_keys="AuditCycle.created_by_id")
    items: Mapped[list["AuditItem"]] = relationship("AuditItem", back_populates="audit_cycle")


class AuditItem(Base):
    __tablename__ = "audit_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    audit_cycle_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("audit_cycles.id"), nullable=False
    )
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("assets.id"), nullable=False)
    auditor_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    status: Mapped[AuditItemStatus] = mapped_column(
        SAEnum(AuditItemStatus), default=AuditItemStatus.pending
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    audited_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    audit_cycle: Mapped["AuditCycle"] = relationship("AuditCycle", back_populates="items")
    asset: Mapped["Asset"] = relationship("Asset", back_populates="audit_items")
    auditor: Mapped["User | None"] = relationship("User", foreign_keys="AuditItem.auditor_id")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User | None"] = relationship("User", back_populates="activity_logs")
