"""Database seed data for AssetFlow."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Asset, AssetCategory, AssetCondition, AssetStatus, AuditCycle,
    AuditCycleStatus, AuditItem, AuditItemStatus, Booking, BookingStatus,
    Department, DepartmentStatus, MaintenancePriority, MaintenanceRequest,
    MaintenanceStatus, TransferRequest, TransferStatus, User, UserRole,
    Allocation, AllocationStatus
)
from app.security import hash_password


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def seed_database(db: AsyncSession) -> None:
    """Seed the database with initial data if empty."""
    # Check if already seeded
    result = await db.execute(select(User))
    if result.scalar_one_or_none():
        return

    # ── Departments ──────────────────────────────────────────────────────────
    eng_dept = Department(name="Engineering", status=DepartmentStatus.active)
    marketing_dept = Department(name="Marketing", status=DepartmentStatus.active)
    hr_dept = Department(name="Human Resources", status=DepartmentStatus.active)
    it_dept = Department(name="IT Infrastructure", status=DepartmentStatus.active)

    db.add_all([eng_dept, marketing_dept, hr_dept, it_dept])
    await db.flush()

    # ── Users ─────────────────────────────────────────────────────────────────
    admin = User(
        email="admin@assetflow.io",
        hashed_password=hash_password("admin123"),
        full_name="Alex Admin",
        role=UserRole.admin,
        is_active=True,
    )
    sarah = User(
        email="sarah.chen@assetflow.io",
        hashed_password=hash_password("sarah123"),
        full_name="Sarah Chen",
        role=UserRole.asset_manager,
        department_id=it_dept.id,
        is_active=True,
    )
    marcus = User(
        email="marcus.j@assetflow.io",
        hashed_password=hash_password("marcus123"),
        full_name="Marcus Johnson",
        role=UserRole.dept_head,
        department_id=eng_dept.id,
        is_active=True,
    )
    priya = User(
        email="priya.k@assetflow.io",
        hashed_password=hash_password("priya123"),
        full_name="Priya Kapoor",
        role=UserRole.employee,
        department_id=eng_dept.id,
        is_active=True,
    )
    david = User(
        email="david.r@assetflow.io",
        hashed_password=hash_password("david123"),
        full_name="David Rodriguez",
        role=UserRole.employee,
        department_id=marketing_dept.id,
        is_active=True,
    )

    db.add_all([admin, sarah, marcus, priya, david])
    await db.flush()

    # Update dept heads
    eng_dept.head_user_id = marcus.id
    it_dept.head_user_id = sarah.id

    # ── Asset Categories ──────────────────────────────────────────────────────
    electronics = AssetCategory(
        name="Electronics",
        description="Computing and electronic devices",
        custom_fields={"warranty_period": "months", "voltage": "V"},
    )
    vehicles = AssetCategory(
        name="Vehicles",
        description="Company fleet and transportation",
        custom_fields={"license_plate": "text", "mileage": "km"},
    )
    furniture = AssetCategory(
        name="Furniture",
        description="Office furniture and fixtures",
        custom_fields={},
    )
    tools = AssetCategory(
        name="Tools & Equipment",
        description="Workshop and manufacturing tools",
        custom_fields={"calibration_date": "date"},
    )
    rooms = AssetCategory(
        name="Conference Rooms",
        description="Bookable meeting and conference spaces",
        custom_fields={"capacity": "persons", "av_equipment": "boolean"},
    )

    db.add_all([electronics, vehicles, furniture, tools, rooms])
    await db.flush()

    # ── Assets ────────────────────────────────────────────────────────────────
    now = utcnow()
    macbook = Asset(
        name='MacBook Pro 16"',
        asset_tag="AF-0001",
        serial_number="MBP2023XYZ",
        category_id=electronics.id,
        status=AssetStatus.allocated,
        condition=AssetCondition.good,
        location="Engineering Lab - Desk 3",
        department_id=eng_dept.id,
        is_bookable=False,
        acquisition_date=now - timedelta(days=300),
        acquisition_cost=2499.00,
        notes="Assigned to senior engineer",
    )
    camry = Asset(
        name="Toyota Camry 2023",
        asset_tag="AF-0002",
        serial_number="1HGBH41JXMN109186",
        category_id=vehicles.id,
        status=AssetStatus.available,
        condition=AssetCondition.good,
        location="Parking Lot B",
        department_id=None,
        is_bookable=True,
        acquisition_date=now - timedelta(days=180),
        acquisition_cost=28000.00,
    )
    conf_room = Asset(
        name="Conference Room B2",
        asset_tag="AF-0003",
        serial_number=None,
        category_id=rooms.id,
        status=AssetStatus.available,
        condition=AssetCondition.good,
        location="Floor 2, Block B",
        department_id=None,
        is_bookable=True,
        acquisition_date=now - timedelta(days=730),
        acquisition_cost=15000.00,
        notes="Capacity: 12, AV equipped",
    )
    printer_3d = Asset(
        name="Industrial 3D Printer",
        asset_tag="AF-0004",
        serial_number="3DP-MK3S-2023",
        category_id=tools.id,
        status=AssetStatus.under_maintenance,
        condition=AssetCondition.fair,
        location="Engineering Lab - Workshop",
        department_id=eng_dept.id,
        is_bookable=False,
        acquisition_date=now - timedelta(days=450),
        acquisition_cost=3200.00,
    )
    standing_desk = Asset(
        name="Height-Adjustable Standing Desk Set",
        asset_tag="AF-0005",
        serial_number="SD-FLEX-A4",
        category_id=furniture.id,
        status=AssetStatus.reserved,
        condition=AssetCondition.new,
        location="Storage Room 1A",
        department_id=marketing_dept.id,
        is_bookable=False,
        acquisition_date=now - timedelta(days=10),
        acquisition_cost=850.00,
        notes="Reserved for new hire David Rodriguez",
    )

    db.add_all([macbook, camry, conf_room, printer_3d, standing_desk])
    await db.flush()

    # ── Allocation: MacBook → Priya ───────────────────────────────────────────
    alloc1 = Allocation(
        asset_id=macbook.id,
        user_id=priya.id,
        department_id=eng_dept.id,
        allocated_at=now - timedelta(days=60),
        expected_return_date=now + timedelta(days=300),
        status=AllocationStatus.active,
    )
    db.add(alloc1)

    # ── Maintenance: 3D Printer ────────────────────────────────────────────────
    maint1 = MaintenanceRequest(
        asset_id=printer_3d.id,
        user_id=marcus.id,
        issue_description="Extruder nozzle clogged; layer adhesion failure on large prints",
        priority=MaintenancePriority.high,
        status=MaintenanceStatus.in_progress,
        assigned_to_id=sarah.id,
    )
    db.add(maint1)

    # ── Booking: Conference Room B2 ───────────────────────────────────────────
    booking1 = Booking(
        asset_id=conf_room.id,
        user_id=marcus.id,
        start_time=now.replace(hour=9, minute=0, second=0) + timedelta(days=1),
        end_time=now.replace(hour=10, minute=0, second=0) + timedelta(days=1),
        status=BookingStatus.upcoming,
        notes="Q3 Engineering All-Hands",
    )
    booking2 = Booking(
        asset_id=conf_room.id,
        user_id=david.id,
        start_time=now.replace(hour=14, minute=0, second=0) + timedelta(days=1),
        end_time=now.replace(hour=15, minute=30, second=0) + timedelta(days=1),
        status=BookingStatus.upcoming,
        notes="Marketing budget review",
    )
    db.add_all([booking1, booking2])

    # ── Transfer Request: Laptop from Priya to David ──────────────────────────
    transfer1 = TransferRequest(
        asset_id=macbook.id,
        from_user_id=priya.id,
        to_user_id=david.id,
        status=TransferStatus.requested,
        notes="David needs the laptop for a client presentation next week",
    )
    db.add(transfer1)

    await db.commit()
    print("✅ Database seeded successfully")
