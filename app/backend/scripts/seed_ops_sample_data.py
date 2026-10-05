"""
Seed sample operations data: facilities, users, quotes, orders, invoices,
messages, activity, and shipments for the admin dashboard demo.

Run inside the backend container (after seed_initial_data):

    docker compose exec backend python -m scripts.seed_initial_data
    docker compose exec backend python -m scripts.seed_ops_sample_data
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from db.session import SessionLocal
from db.models import (
    ActivityEvent,
    Branch,
    ContactInquiry,
    DeliveryLocation,
    Invoice,
    InvoiceItem,
    Order,
    OrderItem,
    Organization,
    Product,
    Quote,
    QuoteItem,
    QuoteMessage,
    Shipment,
    ShipmentItem,
    User,
    UserBranchAssignment,
)
from scripts.seed_initial_data import (
    ensure_admin_user,
    ensure_categories_and_products,
    ensure_email_settings,
    ensure_site_settings,
)
from utils.auth import get_password_hash

SEED_MARKER = "Kenyatta National Hospital"
DEMO_PASSWORD = "HamptonDemo2026!"


def _uid(prefix: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"hampton-seed.{prefix}"))


def _days_ago(days: int, hours: int = 0) -> datetime:
    return datetime.utcnow() - timedelta(days=days, hours=hours)


def _calc_totals(
    line_items: list[dict],
    *,
    quoted: bool = False,
    tax_rate: float = 16,
    discount: float = 0,
    delivery: float = 0,
) -> tuple[float, float, float, float]:
    subtotal = 0.0
    list_subtotal = 0.0
    for row in line_items:
        qty = int(row["quantity"])
        list_price = float(row.get("list_price") or 0)
        unit_price = float(row.get("unit_price") or 0)
        list_subtotal += list_price * qty
        if quoted and unit_price > 0:
            subtotal += unit_price * qty
        else:
            subtotal += list_price * qty
    tax_amount = round(subtotal * tax_rate / 100, 2)
    total = round(subtotal + tax_amount - discount + delivery, 2)
    return round(subtotal, 2), round(list_subtotal, 2), tax_amount, total


def _activity(
    session,
    *,
    entity_type: str,
    entity_id: str,
    event_type: str,
    summary: str,
    created_at: datetime,
    actor_id: str | None = None,
    actor_name: str | None = None,
    actor_role: str | None = None,
) -> None:
    session.add(
        ActivityEvent(
            id=str(uuid.uuid4()),
            entity_type=entity_type,
            entity_id=entity_id,
            event_type=event_type,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_role=actor_role,
            summary=summary,
            is_customer_visible=True,
            created_at=created_at,
        )
    )


def _add_quote_item(
    quote_id: str,
    product: Product,
    quantity: int,
    *,
    unit_price: float = 0,
) -> QuoteItem:
    list_price = float(product.price or 0)
    return QuoteItem(
        id=str(uuid.uuid4()),
        quote_id=quote_id,
        product_id=product.id,
        product_name=product.name,
        category=product.category_name,
        quantity=quantity,
        quoted_quantity=quantity,
        list_price=list_price,
        unit_price=unit_price,
    )


def _seed_already_present(session) -> bool:
    return (
        session.query(Organization)
        .filter(Organization.name == SEED_MARKER)
        .one_or_none()
        is not None
    )


def ensure_ops_staff(session) -> User:
    email = "ops@hamptonscientific.com"
    user = session.query(User).filter(User.email == email).one_or_none()
    if user:
        return user
    user = User(
        id=_uid("ops-staff"),
        first_name="Sarah",
        last_name="Mwangi",
        email=email,
        phone="+254712345678",
        hashed_password=get_password_hash(DEMO_PASSWORD),
        facility_name="Hampton Scientific",
        facility_type="Admin",
        role="admin",
        can_login=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(user)
    session.flush()
    print(f"[seed] Ops staff user created: {email} / {DEMO_PASSWORD}")
    return user


def _make_quote(
    session,
    *,
    key: str,
    quote_number: str,
    org: Organization,
    branch: Branch,
    location: DeliveryLocation,
    requester: User,
    admin: User,
    products: list[Product],
    status: str,
    handler: str,
    created_at: datetime,
    assigned_admin_id: str | None = None,
    quoted: bool = False,
    customer_response: str | None = None,
    items_spec: list[tuple[int, float | None]] | None = None,
) -> tuple[Quote, list[QuoteItem]]:
    quote_id = _uid(f"quote-{key}")
    items_spec = items_spec or [(2, None), (5, None)]
    quote_items: list[QuoteItem] = []
    for idx, (qty, quoted_price) in enumerate(items_spec):
        product = products[idx % len(products)]
        unit = float(
            quoted_price
            if quoted_price is not None
            else ((product.price or 0) if quoted else 0)
        )
        quote_items.append(_add_quote_item(quote_id, product, qty, unit_price=unit))

    line_rows = [
        {"quantity": qi.quantity, "list_price": qi.list_price, "unit_price": qi.unit_price}
        for qi in quote_items
    ]
    subtotal, list_subtotal, tax_amount, total = _calc_totals(line_rows, quoted=quoted)

    quote = Quote(
        id=quote_id,
        quote_number=quote_number,
        user_id=requester.id,
        organization_id=org.id,
        ordered_by_user_id=requester.id,
        ordered_for_branch_id=branch.id,
        delivery_location_id=location.id,
        facility_name=org.name,
        contact_person=f"{requester.first_name} {requester.last_name}",
        email=requester.email,
        phone=requester.phone,
        address=branch.physical_address,
        additional_notes=f"Sample quote ({key}) for demo purposes.",
        status=status,
        current_handler=handler,
        customer_response=customer_response,
        assigned_admin_id=assigned_admin_id or admin.id,
        subtotal=subtotal,
        list_subtotal=list_subtotal,
        tax_rate=16,
        tax_amount=tax_amount,
        total=total,
        include_vat=True,
        quoted_at=created_at if quoted else None,
        quoted_by_user_id=admin.id if quoted else None,
        created_at=created_at,
        updated_at=created_at + timedelta(hours=2),
    )
    session.add(quote)
    session.add_all(quote_items)
    _activity(
        session,
        entity_type="quote",
        entity_id=quote_id,
        event_type="submitted",
        summary=f"{quote.contact_person} submitted quote {quote_number}",
        actor_id=requester.id,
        actor_name=quote.contact_person,
        actor_role="customer",
        created_at=created_at,
    )
    return quote, quote_items


def _make_order_from_quote(
    session,
    quote: Quote,
    quote_items: list[QuoteItem],
    *,
    order_key: str,
    order_number: str,
    status: str,
    delivery_status: str,
    created_at: datetime,
) -> tuple[Order, list[OrderItem]]:
    order_id = _uid(f"order-{order_key}")
    order = Order(
        id=order_id,
        order_number=order_number,
        organization_id=quote.organization_id,
        ordered_by_user_id=quote.ordered_by_user_id,
        ordered_for_branch_id=quote.ordered_for_branch_id,
        delivery_location_id=quote.delivery_location_id,
        quote_id=quote.id,
        status=status,
        delivery_status=delivery_status,
        ordered_at=created_at,
        created_at=created_at,
        updated_at=created_at + timedelta(hours=1),
    )
    session.add(order)
    order_items: list[OrderItem] = []
    for qi in quote_items:
        order_items.append(
            OrderItem(
                id=str(uuid.uuid4()),
                order_id=order_id,
                product_id=qi.product_id,
                product_name=qi.product_name,
                category=qi.category,
                quantity=int(qi.quoted_quantity or qi.quantity or 1),
                list_price=qi.list_price,
                unit_price=float(qi.unit_price or 0),
            )
        )
    session.add_all(order_items)
    quote.customer_response = quote.customer_response or "accepted"
    quote.status = "accepted"
    _activity(
        session,
        entity_type="order",
        entity_id=order_id,
        event_type="created",
        summary=f"Order {order_number} created from {quote.quote_number}",
        actor_name="Admin User",
        actor_role="admin",
        created_at=created_at,
    )
    return order, order_items


def _make_invoice(
    session,
    quote: Quote,
    quote_items: list[QuoteItem],
    *,
    invoice_number: str,
    status: str,
    created_at: datetime,
    due_date: datetime | None,
) -> Invoice:
    invoice_id = _uid(f"invoice-{invoice_number}")
    invoice = Invoice(
        id=invoice_id,
        invoice_number=invoice_number,
        quote_id=quote.id,
        user_id=quote.ordered_by_user_id,
        organization_id=quote.organization_id,
        branch_id=quote.ordered_for_branch_id,
        facility_name=quote.facility_name,
        contact_person=quote.contact_person,
        email=quote.email,
        phone=quote.phone,
        address=quote.address,
        subtotal=quote.subtotal,
        tax_rate=quote.tax_rate,
        tax_amount=quote.tax_amount,
        total=quote.total,
        include_vat=quote.include_vat,
        payment_terms="Net 30",
        due_date=due_date,
        status=status,
        created_at=created_at,
        updated_at=created_at,
        paid_at=created_at if status == "paid" else None,
    )
    session.add(invoice)
    for qi in quote_items:
        session.add(
            InvoiceItem(
                id=str(uuid.uuid4()),
                invoice_id=invoice_id,
                product_id=qi.product_id,
                product_name=qi.product_name,
                category=qi.category,
                quantity=int(qi.quoted_quantity or qi.quantity or 1),
                original_price=qi.list_price,
                modified_price=float(qi.unit_price or 0),
            )
        )
    _activity(
        session,
        entity_type="invoice",
        entity_id=invoice_id,
        event_type="created",
        summary=f"Invoice {invoice_number} issued for {quote.quote_number}",
        actor_name="Admin User",
        actor_role="admin",
        created_at=created_at,
    )
    return invoice


def seed_ops_sample_data(session) -> None:
    if _seed_already_present(session):
        print(f"[seed] Ops sample data already present ({SEED_MARKER})")
        return

    admin = session.query(User).filter(User.email == "admin@hamptonscientific.com").one_or_none()
    if not admin:
        raise RuntimeError("Admin user missing — run seed_initial_data first")

    ensure_ops_staff(session)
    products = session.query(Product).order_by(Product.name.asc()).limit(6).all()
    if len(products) < 2:
        raise RuntimeError("Need at least 2 products — run seed_initial_data first")

    org_knh_id = _uid("org-knh")
    org_aga_id = _uid("org-aga")
    org_nwh_id = _uid("org-nwh")
    branch_knh_main = _uid("branch-knh-main")
    branch_knh_west = _uid("branch-knh-west")
    branch_aga_main = _uid("branch-aga-main")
    branch_nwh_main = _uid("branch-nwh-main")

    org_knh = Organization(
        id=org_knh_id,
        name="Kenyatta National Hospital",
        facility_type="hospital",
        registration_number="HOSP-KNH-001",
        phone="+254202726000",
        email="procurement@knh.or.ke",
        address_line="Hospital Road, Upper Hill",
        county="Nairobi",
        country="Kenya",
        is_multi_branch=True,
        settings={"branch_users_can_order_directly": True},
        created_at=_days_ago(120),
    )
    org_aga = Organization(
        id=org_aga_id,
        name="Aga Khan University Hospital",
        facility_type="hospital",
        registration_number="HOSP-AKU-002",
        phone="+254732699000",
        email="supply@aku.ac.ke",
        address_line="Third Parklands Avenue",
        county="Nairobi",
        country="Kenya",
        is_multi_branch=False,
        settings={"branch_users_can_order_directly": False},
        created_at=_days_ago(90),
    )
    org_nwh = Organization(
        id=org_nwh_id,
        name="Nairobi West Hospital",
        facility_type="clinic",
        registration_number="CLN-NWH-003",
        phone="+254733456789",
        email="lab@nairobiwest.co.ke",
        address_line="Ngong Road, Nairobi",
        county="Nairobi",
        country="Kenya",
        is_multi_branch=False,
        settings={},
        created_at=_days_ago(60),
    )
    session.add_all([org_knh, org_aga, org_nwh])

    branch_knh_main_row = Branch(
        id=branch_knh_main,
        organization_id=org_knh_id,
        name="Main Campus",
        branch_code="MAIN",
        contact_name="Dr. Jane Wanjiku",
        phone="+254712000001",
        email="jane.wanjiku@knh.or.ke",
        physical_address="Hospital Road, Upper Hill",
        delivery_address="Receiving Bay, Block A",
        county="Nairobi",
        is_main=True,
        created_at=_days_ago(120),
    )
    branch_knh_west_row = Branch(
        id=branch_knh_west,
        organization_id=org_knh_id,
        name="Westlands Annex",
        branch_code="WEST",
        contact_name="Emmanuel Atemba",
        phone="+254712000002",
        email="e.atembe@knh.or.ke",
        physical_address="Waiyaki Way, Westlands",
        delivery_address="Annex loading dock",
        county="Nairobi",
        is_main=False,
        created_at=_days_ago(100),
    )
    branch_aga_main_row = Branch(
        id=branch_aga_main,
        organization_id=org_aga_id,
        name="Parklands Campus",
        branch_code="MAIN",
        contact_name="Dr. Peter Ochieng",
        phone="+254733000003",
        email="p.ochieng@aku.ac.ke",
        physical_address="Third Parklands Avenue",
        delivery_address="Central stores",
        county="Nairobi",
        is_main=True,
        created_at=_days_ago(90),
    )
    branch_nwh_main_row = Branch(
        id=branch_nwh_main,
        organization_id=org_nwh_id,
        name="Main Facility",
        branch_code="MAIN",
        contact_name="Dr. Mercy Kamau",
        phone="+254744000004",
        email="m.kamau@nairobiwest.co.ke",
        physical_address="Ngong Road",
        delivery_address="Front reception",
        county="Nairobi",
        is_main=True,
        created_at=_days_ago(60),
    )
    session.add_all([branch_knh_main_row, branch_knh_west_row, branch_aga_main_row, branch_nwh_main_row])

    loc_knh_main = DeliveryLocation(
        id=_uid("loc-knh-main"),
        organization_id=org_knh_id,
        branch_id=branch_knh_main,
        label="Central Stores",
        contact_name="Dr. Jane Wanjiku",
        phone="+254712000001",
        address_line="Receiving Bay, Block A, Hospital Road",
        county="Nairobi",
        is_default=True,
    )
    loc_knh_west = DeliveryLocation(
        id=_uid("loc-knh-west"),
        organization_id=org_knh_id,
        branch_id=branch_knh_west,
        label="Annex Delivery Point",
        contact_name="Emmanuel Atemba",
        phone="+254712000002",
        address_line="Waiyaki Way, Westlands",
        county="Nairobi",
        is_default=True,
    )
    loc_aga = DeliveryLocation(
        id=_uid("loc-aga"),
        organization_id=org_aga_id,
        branch_id=branch_aga_main,
        label="Main Receiving",
        contact_name="Dr. Peter Ochieng",
        phone="+254733000003",
        address_line="Third Parklands Avenue",
        county="Nairobi",
        is_default=True,
    )
    loc_nwh = DeliveryLocation(
        id=_uid("loc-nwh"),
        organization_id=org_nwh_id,
        branch_id=branch_nwh_main,
        label="Lab Entrance",
        contact_name="Dr. Mercy Kamau",
        phone="+254744000004",
        address_line="Ngong Road, Nairobi",
        county="Nairobi",
        is_default=True,
    )
    session.add_all([loc_knh_main, loc_knh_west, loc_aga, loc_nwh])

    users_spec = [
        ("user-jane", org_knh, branch_knh_main, "Jane", "Wanjiku", "jane.wanjiku@knh.or.ke", "org_admin"),
        ("user-atembe", org_knh, branch_knh_west, "Emmanuel", "Atemba", "e.atembe@knh.or.ke", "branch_admin"),
        ("user-peter", org_aga, branch_aga_main, "Peter", "Ochieng", "p.ochieng@aku.ac.ke", "org_admin"),
        ("user-mercy", org_nwh, branch_nwh_main, "Mercy", "Kamau", "m.kamau@nairobiwest.co.ke", "org_admin"),
    ]
    users: dict[str, User] = {}
    for key, org, branch_id, first, last, email, role in users_spec:
        user = User(
            id=_uid(key),
            organization_id=org.id,
            first_name=first,
            last_name=last,
            email=email,
            phone="+254700000000",
            hashed_password=get_password_hash(DEMO_PASSWORD),
            job_title="Procurement Lead",
            facility_name=org.name,
            facility_type=org.facility_type,
            address="Nairobi",
            city="Nairobi",
            role=role,
            can_login=True,
            created_at=_days_ago(80),
        )
        session.add(user)
        session.add(
            UserBranchAssignment(
                id=str(uuid.uuid4()),
                user_id=user.id,
                branch_id=branch_id,
                is_primary=True,
            )
        )
        users[key] = user

    session.flush()

    jane = users["user-jane"]
    atembe = users["user-atembe"]
    peter = users["user-peter"]
    mercy = users["user-mercy"]
    ops_staff = session.query(User).filter(User.email == "ops@hamptonscientific.com").one()

    # Quotes across workflow stages
    q_submitted, _ = _make_quote(
        session,
        key="submitted",
        quote_number="QT-SAMPLE-0001",
        org=org_knh,
        branch=branch_knh_main_row,
        location=loc_knh_main,
        requester=jane,
        admin=admin,
        products=products,
        status="pending",
        handler="ADMIN_REVIEW",
        created_at=_days_ago(1),
    )
    q_review, _ = _make_quote(
        session,
        key="review",
        quote_number="QT-SAMPLE-0002",
        org=org_aga,
        branch=branch_aga_main_row,
        location=loc_aga,
        requester=peter,
        admin=admin,
        products=products,
        status="pending",
        handler="UNDER_REVIEW",
        created_at=_days_ago(3),
        assigned_admin_id=ops_staff.id,
    )
    q_info, qi_info = _make_quote(
        session,
        key="info",
        quote_number="QT-SAMPLE-0003",
        org=org_knh,
        branch=branch_knh_west_row,
        location=loc_knh_west,
        requester=atembe,
        admin=admin,
        products=products,
        status="pending",
        handler="AWAITING_INFORMATION",
        created_at=_days_ago(4),
    )
    q_prep, _ = _make_quote(
        session,
        key="prep",
        quote_number="QT-SAMPLE-0004",
        org=org_nwh,
        branch=branch_nwh_main_row,
        location=loc_nwh,
        requester=mercy,
        admin=admin,
        products=products,
        status="pending",
        handler="PREPARING_QUOTE",
        created_at=_days_ago(5),
    )
    q_awaiting, qi_awaiting = _make_quote(
        session,
        key="awaiting",
        quote_number="QT-SAMPLE-0005",
        org=org_aga,
        branch=branch_aga_main_row,
        location=loc_aga,
        requester=peter,
        admin=admin,
        products=products,
        status="quoted",
        handler="CUSTOMER_REVIEW",
        created_at=_days_ago(7),
        quoted=True,
        items_spec=[(1, float(products[0].price or 140000)), (10, float(products[1].price or 4500))],
    )
    q_accepted, qi_accepted = _make_quote(
        session,
        key="accepted",
        quote_number="QT-SAMPLE-0006",
        org=org_knh,
        branch=branch_knh_main_row,
        location=loc_knh_main,
        requester=jane,
        admin=admin,
        products=products,
        status="accepted",
        handler="CUSTOMER_REVIEW",
        created_at=_days_ago(10),
        quoted=True,
        customer_response="accepted",
        items_spec=[(1, float(products[0].price or 145000)), (20, float(products[1].price or 4800))],
    )
    q_converted, qi_converted = _make_quote(
        session,
        key="converted",
        quote_number="QT-SAMPLE-0007",
        org=org_nwh,
        branch=branch_nwh_main_row,
        location=loc_nwh,
        requester=mercy,
        admin=admin,
        products=products,
        status="accepted",
        handler="CUSTOMER_REVIEW",
        created_at=_days_ago(14),
        quoted=True,
        customer_response="accepted",
        items_spec=[(2, float(products[0].price or 148000)), (8, float(products[1].price or 5000))],
    )
    q_rejected, _ = _make_quote(
        session,
        key="rejected",
        quote_number="QT-SAMPLE-0008",
        org=org_knh,
        branch=branch_knh_west_row,
        location=loc_knh_west,
        requester=atembe,
        admin=admin,
        products=products,
        status="rejected",
        handler="CUSTOMER_REVIEW",
        created_at=_days_ago(20),
        quoted=True,
        customer_response="rejected",
    )
    q_cancelled, _ = _make_quote(
        session,
        key="cancelled",
        quote_number="QT-SAMPLE-0009",
        org=org_aga,
        branch=branch_aga_main_row,
        location=loc_aga,
        requester=peter,
        admin=admin,
        products=products,
        status="cancelled",
        handler="ADMIN_REVIEW",
        created_at=_days_ago(25),
    )

    # Messages (including unread for dashboard)
    session.add_all([
        QuoteMessage(
            id=str(uuid.uuid4()),
            quote_id=q_info.id,
            sender_id=atembe.id,
            sender_role="customer",
            sender_name="Emmanuel Atemba",
            body="Can you confirm whether the microscope includes a warranty and installation?",
            is_read=False,
            created_at=_days_ago(3, 2),
        ),
        QuoteMessage(
            id=str(uuid.uuid4()),
            quote_id=q_info.id,
            sender_id=admin.id,
            sender_role="admin",
            sender_name="Admin User",
            body="Thanks — we include 12-month warranty and on-site installation within Nairobi.",
            is_read=True,
            created_at=_days_ago(3, 1),
        ),
        QuoteMessage(
            id=str(uuid.uuid4()),
            quote_id=q_awaiting.id,
            sender_id=peter.id,
            sender_role="customer",
            sender_name="Dr. Peter Ochieng",
            body="We need delivery before end of month. Is that feasible?",
            is_read=False,
            created_at=_days_ago(2),
        ),
        QuoteMessage(
            id=str(uuid.uuid4()),
            quote_id=q_submitted.id,
            sender_id=jane.id,
            sender_role="customer",
            sender_name="Dr. Jane Wanjiku",
            body="Please prioritize this request for our haematology lab expansion.",
            is_read=False,
            created_at=_days_ago(0, 5),
        ),
    ])

    session.flush()

    # Orders & shipments
    order_processing, oi_processing = _make_order_from_quote(
        session,
        q_accepted,
        qi_accepted,
        order_key="processing",
        order_number="ORD-SAMPLE-0001",
        status="processing",
        delivery_status="pending",
        created_at=_days_ago(8),
    )
    order_dispatched, oi_dispatched = _make_order_from_quote(
        session,
        q_converted,
        qi_converted,
        order_key="dispatched",
        order_number="ORD-SAMPLE-0002",
        status="dispatched",
        delivery_status="dispatched",
        created_at=_days_ago(12),
    )

    session.flush()

    ship1 = Shipment(
        id=_uid("ship-1"),
        order_id=order_dispatched.id,
        status="dispatched",
        notes="Courier: Wells Fargo — tracking WF-88231",
        created_at=_days_ago(10),
        updated_at=_days_ago(9),
    )
    session.add(ship1)
    session.flush()
    for oi in oi_dispatched:
        session.add(
            ShipmentItem(
                id=str(uuid.uuid4()),
                shipment_id=ship1.id,
                order_item_id=oi.id,
                product_id=oi.product_id,
                product_name=oi.product_name,
                quantity=oi.quantity,
            )
        )

    session.flush()

    # Invoices
    _make_invoice(
        session,
        q_converted,
        qi_converted,
        invoice_number="INV-SAMPLE-2026-000001",
        status="awaiting_payment",
        created_at=_days_ago(11),
        due_date=_days_ago(2),
    )
    _make_invoice(
        session,
        q_accepted,
        qi_accepted,
        invoice_number="INV-SAMPLE-2026-000002",
        status="paid",
        created_at=_days_ago(7),
        due_date=_days_ago(1),
    )

    # Contact inquiries
    session.add_all([
        ContactInquiry(
            id=str(uuid.uuid4()),
            name="Dr. James Mutua",
            email="j.mutua@example.co.ke",
            phone="+254722111222",
            subject="Training enquiry",
            message="We would like training on haematology analyzers for 6 lab technologists.",
            status="new",
            created_at=_days_ago(2),
        ),
        ContactInquiry(
            id=str(uuid.uuid4()),
            name="Grace Njeri",
            email="grace.njeri@example.com",
            phone="+254733999888",
            subject="Product availability",
            message="Do you stock CellScan reagents for urgent delivery?",
            status="new",
            created_at=_days_ago(1),
        ),
    ])

    session.commit()
    print("[seed] Ops sample data created:")
    print("  - 3 facilities (organizations) with branches & delivery locations")
    print("  - 4 facility users + 1 ops staff admin")
    print("  - 9 quotes across workflow stages")
    print("  - 4 quote messages (3 unread)")
    print("  - 2 orders with 1 shipment")
    print("  - 2 invoices (1 unpaid/overdue, 1 paid)")
    print("  - 2 contact inquiries")
    print(f"  Facility login password: {DEMO_PASSWORD}")


def main() -> None:
    session = SessionLocal()
    try:
        ensure_admin_user(session)
        ensure_site_settings(session)
        ensure_email_settings(session)
        ensure_categories_and_products(session)
        seed_ops_sample_data(session)
    finally:
        session.close()


if __name__ == "__main__":
    main()
