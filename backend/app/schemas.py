"""Pydantic V2 schemas for all API request/response objects."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, field_validator, model_config

from app.models import (
    AllocationStatus,
    AssetCondition,
    AssetStatus,
    AuditCycleStatus,
    AuditItemStatus,
    BookingStatus,
    DepartmentStatus,
    MaintenancePriority,
    MaintenanceStatus,
    TransferStatus,
    UserRole,
)


# ─── Auth ────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    model_config = model_config(str_strip_whitespace=True)
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


# ─── User ─────────────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    email: str
    full_name: str
    role: UserRole
    department_id: int | None
    is_active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    department_id: int | None = None
    is_active: bool | None = None


class UserWithDept(UserResponse):
    department: "DepartmentResponse | None" = None


# ─── Department ───────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    head_user_id: int | None = None
    parent_id: int | None = None
    status: DepartmentStatus = DepartmentStatus.active


class DepartmentUpdate(BaseModel):
    name: str | None = None
    head_user_id: int | None = None
    parent_id: int | None = None
    status: DepartmentStatus | None = None


class DepartmentResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    name: str
    status: DepartmentStatus
    parent_id: int | None
    head_user_id: int | None
    created_at: datetime
    head: "UserResponse | None" = None


# ─── Asset Category ───────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: str | None = None
    custom_fields: dict | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    custom_fields: dict | None = None


class CategoryResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    name: str
    description: str | None
    custom_fields: dict | None
    created_at: datetime
    asset_count: int = 0


# ─── Asset ────────────────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    name: str
    serial_number: str | None = None
    category_id: int | None = None
    condition: AssetCondition = AssetCondition.good
    location: str | None = None
    department_id: int | None = None
    is_bookable: bool = False
    acquisition_date: datetime | None = None
    acquisition_cost: float | None = None
    notes: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    serial_number: str | None = None
    category_id: int | None = None
    status: AssetStatus | None = None
    condition: AssetCondition | None = None
    location: str | None = None
    department_id: int | None = None
    is_bookable: bool | None = None
    acquisition_cost: float | None = None
    notes: str | None = None


class AssetResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    name: str
    asset_tag: str
    serial_number: str | None
    category_id: int | None
    status: AssetStatus
    condition: AssetCondition
    location: str | None
    department_id: int | None
    is_bookable: bool
    acquisition_date: datetime | None
    acquisition_cost: float | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    category: "CategoryResponse | None" = None
    department: "DepartmentResponse | None" = None
    current_holder: "UserResponse | None" = None


# ─── Allocation ───────────────────────────────────────────────────────────────

class AllocationCreate(BaseModel):
    asset_id: int
    user_id: int
    department_id: int | None = None
    expected_return_date: datetime | None = None


class AllocationResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    asset_id: int
    user_id: int
    department_id: int | None
    allocated_at: datetime
    expected_return_date: datetime | None
    returned_at: datetime | None
    condition_notes: str | None
    status: AllocationStatus
    asset: "AssetResponse | None" = None
    user: "UserResponse | None" = None


class ReturnRequest(BaseModel):
    condition_notes: str | None = None


# ─── Transfer ─────────────────────────────────────────────────────────────────

class TransferCreate(BaseModel):
    asset_id: int
    to_user_id: int
    notes: str | None = None


class TransferResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    asset_id: int
    from_user_id: int
    to_user_id: int
    status: TransferStatus
    notes: str | None
    requested_at: datetime
    actioned_at: datetime | None
    asset: "AssetResponse | None" = None
    from_user: "UserResponse | None" = None
    to_user: "UserResponse | None" = None


# ─── Booking ──────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    asset_id: int
    start_time: datetime
    end_time: datetime
    notes: str | None = None

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v: datetime, info: Any) -> datetime:
        if "start_time" in info.data and v <= info.data["start_time"]:
            raise ValueError("end_time must be after start_time")
        return v


class BookingUpdate(BaseModel):
    start_time: datetime | None = None
    end_time: datetime | None = None
    notes: str | None = None
    status: BookingStatus | None = None


class BookingResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    asset_id: int
    user_id: int
    start_time: datetime
    end_time: datetime
    status: BookingStatus
    notes: str | None
    created_at: datetime
    asset: "AssetResponse | None" = None
    user: "UserResponse | None" = None


# ─── Maintenance ──────────────────────────────────────────────────────────────

class MaintenanceCreate(BaseModel):
    asset_id: int
    issue_description: str
    priority: MaintenancePriority = MaintenancePriority.medium


class MaintenanceUpdate(BaseModel):
    status: MaintenanceStatus | None = None
    priority: MaintenancePriority | None = None
    assigned_to_id: int | None = None
    resolution_notes: str | None = None


class MaintenanceResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    asset_id: int
    user_id: int
    assigned_to_id: int | None
    issue_description: str
    priority: MaintenancePriority
    status: MaintenanceStatus
    resolution_notes: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    asset: "AssetResponse | None" = None
    user: "UserResponse | None" = None
    assigned_to: "UserResponse | None" = None


# ─── Audit ────────────────────────────────────────────────────────────────────

class AuditCycleCreate(BaseModel):
    name: str
    department_id: int | None = None
    location: str | None = None
    date_from: datetime
    date_to: datetime
    auditor_ids: list[int] = []


class AuditItemUpdate(BaseModel):
    status: AuditItemStatus
    notes: str | None = None


class AuditItemResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    audit_cycle_id: int
    asset_id: int
    auditor_id: int | None
    status: AuditItemStatus
    notes: str | None
    audited_at: datetime | None
    asset: "AssetResponse | None" = None
    auditor: "UserResponse | None" = None


class AuditCycleResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    name: str
    department_id: int | None
    location: str | None
    date_from: datetime
    date_to: datetime
    status: AuditCycleStatus
    created_by_id: int
    created_at: datetime
    department: "DepartmentResponse | None" = None
    items: list["AuditItemResponse"] = []
    created_by: "UserResponse | None" = None


# ─── Analytics / KPIs ────────────────────────────────────────────────────────

class KPIResponse(BaseModel):
    assets_available: int
    assets_allocated: int
    maintenance_today: int
    active_bookings: int
    pending_transfers: int
    upcoming_returns: int
    overdue_returns: int


class UtilizationItem(BaseModel):
    asset_name: str
    asset_tag: str
    allocation_count: int
    total_days: float


class MaintenanceByCategory(BaseModel):
    category_name: str
    count: int


class DeptAllocation(BaseModel):
    department_name: str
    allocated_count: int


class BookingHeatmapItem(BaseModel):
    hour: int
    day_of_week: int
    booking_count: int


# ─── Activity Log ────────────────────────────────────────────────────────────

class ActivityLogResponse(BaseModel):
    model_config = model_config(from_attributes=True)
    id: int
    user_id: int | None
    action: str
    entity_type: str | None
    entity_id: int | None
    details: dict | None
    created_at: datetime
    user: "UserResponse | None" = None


# ─── Pagination ───────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    per_page: int
    pages: int
