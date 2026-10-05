"""
Test-cycle dataset: purge facility/transaction test data and rebuild a related,
realistic dataset (about 20+ rows per table) for end-to-end testing.

What is PRESERVED: company staff users (admin/operations/sales), product
catalogue, site settings, email settings, training programs, chat history.

What is PURGED (in FK-safe order): shipments, orders, invoices, modified quotes,
quote revisions, quote messages, activity events, quotes, training
registrations, contact inquiries, newsletter subscriptions, email logs,
facility users, branch assignments, delivery locations, branches, organizations.

Run inside the backend container:

    docker compose exec backend python -m scripts.seed_test_cycle --purge --yes

Without --purge the script refuses to run if test-cycle data already exists.
"""
from __future__ import annotations

import argparse
import sys
import uuid
from datetime import datetime, timedelta

from sqlalchemy import delete, select

from db.session import SessionLocal
from db.models import (
    ActivityEvent,
    Branch,
    ContactInquiry,
    DeliveryLocation,
    EmailLog,
    Invoice,
    InvoiceItem,
    ModifiedQuote,
    ModifiedQuoteItem,
    NewsletterSubscription,
    Order,
    OrderItem,
    Organization,
    Product,
    Quote,
    QuoteItem,
    QuoteMessage,
    QuoteRevision,
    Shipment,
    ShipmentItem,
    TrainingRegistrationORM,
    User,
    UserBranchAssignment,
)
from scripts.seed_initial_data import (
    ensure_admin_user,
    ensure_categories_and_products,
    ensure_email_settings,
    ensure_site_settings,
)
from utils.app_time import app_date_stamp
from utils.auth import get_password_hash
from utils.document_refs import format_reference, sibling_reference
from utils.permissions import COMPANY_ROLES
from utils.totals import document_pricing, items_to_pricing_payload

NAMESPACE = "hampton-testcycle"
MARKER_ORG = "Riverside Teaching Hospital"
FACILITY_PASSWORD = "HamptonDemo2026!"
TAX_RATE = 16.0
NOW = datetime.utcnow()


# --------------------------------------------------------------------------- helpers
def _uid(key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{NAMESPACE}.{key}"))


def _ago(days: float, hours: float = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours)


def _ahead(days: float) -> datetime:
    return NOW + timedelta(days=days)


def _phone(n: int) -> str:
    return f"+2547{10000000 + n * 7919 % 89999999:08d}"


def _slug(name: str) -> str:
    return "".join(ch for ch in name.lower().replace("&", "and") if ch.isalnum() or ch == " ").replace(" ", "")[:18]


def _activity(session, *, entity_type, entity_id, event_type, summary, created_at,
              actor_id=None, actor_name=None, actor_role=None, field_name=None,
              previous_value=None, new_value=None, customer_visible=True) -> None:
    session.add(ActivityEvent(
        id=str(uuid.uuid4()),
        entity_type=entity_type,
        entity_id=entity_id,
        event_type=event_type,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        summary=summary,
        field_name=field_name,
        previous_value=previous_value,
        new_value=new_value,
        is_customer_visible=customer_visible,
        created_at=created_at,
    ))


def _totals(items: list[QuoteItem]) -> dict:
    """Canonical totals, identical to what the API overlays at read time."""
    return document_pricing(items_to_pricing_payload(items), tax_rate=TAX_RATE, include_vat=True)


# --------------------------------------------------------------------------- reference data
ORGS = [
    # name, type, county, street, multi-branch second branch (name, code, street) or None
    ("Riverside Teaching Hospital", "hospital", "Nairobi", "Argwings Kodhek Road, Hurlingham", ("Riverside Annex", "ANX", "Ring Road, Kilimani")),
    ("Mombasa Coastal General Hospital", "hospital", "Mombasa", "Moi Avenue, Mombasa Island", None),
    ("Kisumu Lakeside Referral Hospital", "hospital", "Kisumu", "Kakamega Road, Kisumu", ("Lakeside Satellite Clinic", "SAT", "Oginga Odinga Street")),
    ("Nakuru Rift Valley Hospital", "hospital", "Nakuru", "Kenyatta Avenue, Nakuru", None),
    ("Eldoret Highlands Medical Centre", "hospital", "Uasin Gishu", "Uganda Road, Eldoret", None),
    ("Upper Hill Mission Hospital", "hospital", "Nairobi", "Hospital Road, Upper Hill", None),
    ("Karen Springs Hospital", "hospital", "Nairobi", "Karen Road, Karen", None),
    ("Little Angels Children's Hospital", "hospital", "Nairobi", "Muthaiga Road, Muthaiga", None),
    ("Kijabe Valley Hospital", "hospital", "Kiambu", "Kijabe Mission Road", None),
    ("Bomet Community Hospital", "hospital", "Bomet", "Bomet–Kaplong Road", None),
    ("Precision Diagnostics Laboratory", "laboratory", "Nairobi", "Lenana Road, Kilimani", ("Precision Collection Centre", "CC", "Ngong Road, Prestige Plaza")),
    ("MediLab Pathology Services", "laboratory", "Mombasa", "Nyali Road, Nyali", None),
    ("Kisii Highlands Hospital", "hospital", "Kisii", "Kisii–Kilgoris Road", None),
    ("Meru Central Hospital", "hospital", "Meru", "Meru–Nanyuki Highway", None),
    ("Parklands Family Clinic", "clinic", "Nairobi", "Third Parklands Avenue", ("Parklands Clinic Kilimani", "KLM", "Argwings Kodhek Road, Kilimani")),
    ("Thika Road Medical Centre", "clinic", "Kiambu", "Thika Superhighway, Ruiru", None),
    ("Westgate Pharmacy Ltd", "pharmacy", "Nairobi", "Mwanzi Road, Westlands", ("Westgate Pharmacy Karen", "KRN", "Karen Shopping Centre")),
    ("Nyali Pharmaceuticals", "pharmacy", "Mombasa", "Links Road, Nyali", None),
    ("Machakos Plains Hospital", "hospital", "Machakos", "Machakos–Wote Road", None),
    ("Nyeri Hills Referral Hospital", "hospital", "Nyeri", "Kenyatta Road, Nyeri", None),
]

FIRST_NAMES = [
    "Amina", "Brian", "Cynthia", "David", "Esther", "Felix", "Grace", "Hassan", "Irene", "James",
    "Kevin", "Lydia", "Mercy", "Nelson", "Olive", "Peter", "Queenter", "Robert", "Sharon", "Titus",
    "Wanjiru", "Otieno", "Faith", "George", "Halima", "Ian", "Joyce", "Kamau", "Linet", "Moses",
]
LAST_NAMES = [
    "Wanjiku", "Odhiambo", "Mutua", "Kiptoo", "Njeri", "Omondi", "Chebet", "Mwangi", "Achieng", "Kariuki",
    "Wafula", "Nyambura", "Barasa", "Muthoni", "Kipchoge", "Auma", "Kimani", "Onyango", "Waweru", "Cheruiyot",
    "Ndung'u", "Makena", "Ouma", "Kilonzo", "Adhiambo", "Rotich", "Njoroge", "Otieno", "Mumbi", "Korir",
]

CUSTOMER_MESSAGES = [
    "Kindly confirm whether installation and calibration are included in the quoted price.",
    "Can this be delivered before the end of the month? We have an audit coming up.",
    "Please advise on the warranty period for the analyzer.",
    "We would like to reduce the quantity on the reagents line to 6 packs.",
    "Is there a discount available if we increase the order to two units?",
    "Do you offer training for our lab technologists as part of this order?",
    "Please share the delivery timeline for the centrifuge.",
    "Our procurement committee has approved this; please proceed.",
    "The delivery address should be the annex receiving bay, not the main gate.",
    "Thank you — received in good condition.",
]
ADMIN_MESSAGES = [
    "Thanks for your request — installation, calibration and a 12-month warranty are included.",
    "Delivery within Nairobi is typically 3–5 working days after order confirmation.",
    "We have updated the quantities as requested; the revised quote is attached.",
    "A 5% volume discount has been applied for two units.",
    "Yes — a half-day operator training session is included at no extra cost.",
    "Your invoice is attached. Kindly settle within the payment terms.",
]

INQUIRY_SUBJECTS = [
    ("Training enquiry", "We would like training on haematology analyzers for 6 lab technologists."),
    ("Product availability", "Do you stock CellScan reagents for urgent delivery to Nakuru?"),
    ("Service contract", "Please share pricing for an annual preventive maintenance contract."),
    ("Tender documents", "Kindly send your company profile and KEBS certificates for our tender."),
    ("Bulk pricing", "We are equipping three new labs — is volume pricing available?"),
    ("Demo request", "Can we schedule a demonstration of the CellScan 30 at our facility?"),
    ("Spare parts", "We need a replacement rotor for a 4000 RPM centrifuge."),
    ("Delivery outside Nairobi", "Do you deliver to Garissa County and at what cost?"),
    ("Payment terms", "Do you accept LPO-based payment with Net 60 terms for county hospitals?"),
    ("Partnership", "We distribute lab consumables in Western Kenya and would like to partner."),
]

TRAINING_TYPES = [
    "Haematology Analyzer Operation",
    "Laboratory QA/QC Fundamentals",
    "Point-of-Care Testing",
    "Microscopy Essentials",
    "Equipment Preventive Maintenance",
]


# --------------------------------------------------------------------------- purge
PURGE_ORDER = [
    ShipmentItem, Shipment, OrderItem, Order,
    InvoiceItem, Invoice,
    ModifiedQuoteItem, ModifiedQuote, QuoteRevision, QuoteMessage, ActivityEvent,
    QuoteItem, Quote,
    TrainingRegistrationORM, ContactInquiry, NewsletterSubscription, EmailLog,
    UserBranchAssignment,
]


def purge_test_data(session) -> dict[str, int]:
    removed: dict[str, int] = {}
    for model in PURGE_ORDER:
        removed[model.__tablename__] = session.execute(delete(model)).rowcount
    removed["users (facility)"] = session.execute(
        delete(User).where(User.role.notin_(list(COMPANY_ROLES)))
    ).rowcount
    # Staff never belong to an organization; clear any stray link before orgs go.
    session.execute(User.__table__.update().values(organization_id=None))
    for model in (DeliveryLocation, Branch, Organization):
        removed[model.__tablename__] = session.execute(delete(model)).rowcount
    session.flush()
    return removed


def has_test_cycle_data(session) -> bool:
    return session.scalar(select(Organization.id).where(Organization.name == MARKER_ORG)) is not None


# --------------------------------------------------------------------------- builders
class Ctx:
    def __init__(self, session, staff: list[User], products: list[Product]):
        self.session = session
        self.staff = staff
        self.products = products
        self.orgs: list[Organization] = []
        self.branches: dict[str, list[Branch]] = {}
        self.locations: dict[str, DeliveryLocation] = {}
        self.org_admins: dict[str, User] = {}
        self.branch_users: dict[str, list[User]] = {}
        self.requesters: list[tuple[Organization, Branch, User]] = []
        self.quotes: list[tuple[Quote, list[QuoteItem]]] = []
        self.orders: list[tuple[Order, list[OrderItem]]] = []
        self.invoices: list[Invoice] = []
        self.seq = 0

    def staff_for(self, i: int) -> User:
        return self.staff[i % len(self.staff)]

    def next_stem(self, created_at: datetime) -> str:
        self.seq += 1
        return f"{app_date_stamp(created_at)}{self.seq}"


def build_facilities(ctx: Ctx) -> None:
    s = ctx.session
    name_i = 0
    for idx, (name, ftype, county, street, extra) in enumerate(ORGS):
        org_id = _uid(f"org-{idx}")
        slug = _slug(name)
        created = _ago(150 - idx * 6)
        org = Organization(
            id=org_id, name=name, facility_type=ftype,
            registration_number=f"{ftype[:3].upper()}-{2026}-{idx + 1:03d}",
            tax_number=f"P0{51000000 + idx * 137:08d}K",
            phone=_phone(idx), email=f"procurement@{slug}.co.ke",
            website=f"https://www.{slug}.co.ke", address_line=street, county=county, country="Kenya",
            is_multi_branch=bool(extra),
            settings={"branch_users_can_order_directly": idx % 3 != 1},
            created_at=created, updated_at=created,
        )
        s.add(org)
        ctx.orgs.append(org)

        branch_specs = [("Main Facility", "MAIN", street, True)]
        if extra:
            branch_specs.append((extra[0], extra[1], extra[2], False))
        ctx.branches[org_id] = []
        ctx.branch_users[org_id] = []
        for b_i, (bname, code, bstreet, is_main) in enumerate(branch_specs):
            first, last = FIRST_NAMES[name_i % len(FIRST_NAMES)], LAST_NAMES[name_i % len(LAST_NAMES)]
            name_i += 1
            branch = Branch(
                id=_uid(f"branch-{idx}-{code}"), organization_id=org_id, name=bname, branch_code=code,
                contact_name=f"{first} {last}", phone=_phone(100 + idx * 3 + b_i),
                email=f"{code.lower()}@{slug}.co.ke", physical_address=bstreet,
                delivery_address=f"Receiving bay, {bstreet}", county=county, status="active", is_main=is_main,
                created_at=created + timedelta(days=b_i * 7), updated_at=created,
            )
            s.add(branch)
            ctx.branches[org_id].append(branch)
            loc = DeliveryLocation(
                id=_uid(f"loc-{idx}-{code}"), organization_id=org_id, branch_id=branch.id,
                label=f"{bname} – Stores", contact_name=branch.contact_name, phone=branch.phone,
                email=branch.email, address_line=branch.delivery_address, county=county, country="Kenya",
                delivery_instructions="Deliver 8am–4pm weekdays. Call the stores officer on arrival.",
                is_default=True, created_at=created, updated_at=created,
            )
            s.add(loc)
            ctx.locations[branch.id] = loc

            # One user per branch: org_admin on the main branch, branch_admin on the second.
            role = "org_admin" if is_main else "branch_admin"
            user = User(
                id=_uid(f"user-{idx}-{code}"), organization_id=org_id, first_name=first, last_name=last,
                email=f"{first.lower()}.{last.lower().replace(chr(39), '')}@{slug}.co.ke",
                phone=branch.phone, hashed_password=get_password_hash(FACILITY_PASSWORD),
                job_title="Procurement Lead" if is_main else "Branch Manager",
                facility_name=name, facility_type=ftype, address=bstreet, city=county,
                role=role, can_login=True, created_at=created + timedelta(days=1), updated_at=created,
            )
            s.add(user)
            s.add(UserBranchAssignment(id=_uid(f"assign-{idx}-{code}"), user_id=user.id, branch_id=branch.id, is_primary=True, created_at=created))
            if is_main:
                ctx.org_admins[org_id] = user
            ctx.branch_users[org_id].append(user)
            ctx.requesters.append((org, branch, user))

        # Multi-branch orgs also get a branch_user on the main branch (order-placing staff).
        if extra:
            main_branch = ctx.branches[org_id][0]
            first, last = FIRST_NAMES[name_i % len(FIRST_NAMES)], LAST_NAMES[(name_i + 7) % len(LAST_NAMES)]
            name_i += 1
            bu = User(
                id=_uid(f"user-{idx}-BU"), organization_id=org_id, first_name=first, last_name=last,
                email=f"{first.lower()}.{last.lower().replace(chr(39), '')}@{slug}.co.ke",
                phone=_phone(300 + idx), hashed_password=get_password_hash(FACILITY_PASSWORD),
                job_title="Lab Technologist", facility_name=name, facility_type=ftype, address=street, city=county,
                role="branch_user", can_login=True, created_at=created + timedelta(days=3), updated_at=created,
            )
            s.add(bu)
            s.add(UserBranchAssignment(id=_uid(f"assign-{idx}-BU"), user_id=bu.id, branch_id=main_branch.id, is_primary=True, created_at=created))
            ctx.branch_users[org_id].append(bu)
            ctx.requesters.append((org, main_branch, bu))
    s.flush()


def _snapshot(branch: Branch, loc: DeliveryLocation, *, rider: bool = False) -> dict:
    snap = {
        "label": loc.label,
        "branch_name": branch.name,
        "contact_name": loc.contact_name,
        "phone": loc.phone,
        "address_line": loc.address_line,
        "county": loc.county,
        "delivery_instructions": loc.delivery_instructions,
    }
    if rider:
        snap.update({"rider_name": "Dennis Kiprop", "rider_no": "+254711223344"})
    return snap


QUOTE_PLAN = (
    # (count, kind, status, handler, quoted, customer_response)
    [("submitted", "pending", "ADMIN_REVIEW", False, None)] * 4
    + [("under_review", "pending", "UNDER_REVIEW", False, None)] * 3
    + [("awaiting_information", "pending", "AWAITING_INFORMATION", False, None)] * 3
    # Under review with draft prices already keyed in but not yet sent.
    + [("under_review_priced", "pending", "UNDER_REVIEW", True, None)] * 3
    + [("awaiting_customer", "quoted", "CUSTOMER_REVIEW", True, None)] * 3
    + [("accepted", "accepted", "CUSTOMER_REVIEW", True, "accepted")] * 2
    + [("rejected", "rejected", "CUSTOMER_REVIEW", True, "rejected")] * 1
    + [("cancelled", "cancelled", "ADMIN_REVIEW", False, None)] * 1
    + [("ordered", "accepted", "LOCKED_APPROVED", True, "accepted")] * 20
    + [("direct_invoice", "invoiced", "AWAITING_PAYMENT", True, "accepted")] * 6
)

ORDER_STATUS_SEQUENCE = ["order_placed", "processing", "dispatched", "out_for_delivery", "delivered"]

ORDER_PLAN = (
    [("order_placed", "pending")] * 3
    + [("processing", "pending")] * 6
    + [("dispatched", "dispatched")] * 3
    + [("out_for_delivery", "out_for_delivery")] * 2
    + [("delivered", "delivered")] * 6
)


def build_quotes(ctx: Ctx) -> None:
    s = ctx.session
    n_products = len(ctx.products)
    for i, (kind, status, handler, quoted, response) in enumerate(QUOTE_PLAN):
        org, branch, requester = ctx.requesters[i % len(ctx.requesters)]
        loc = ctx.locations[branch.id]
        if kind in ("ordered", "direct_invoice"):
            created = _ago(80 - (i - 20) * 2.8)
        else:
            created = _ago({"submitted": 0.4, "under_review": 2, "awaiting_information": 4, "under_review_priced": 6,
                            "awaiting_customer": 8, "accepted": 11, "rejected": 18, "cancelled": 22}[kind] + (i % 4) * 0.5)
        staff = ctx.staff_for(i)
        quote_id = _uid(f"quote-{i}")
        stem = ctx.next_stem(created)
        # `quoted` = prices keyed in; `sent` = published to the customer.
        sent = quoted and kind != "under_review_priced"

        n_items = 2 + (i % 3)
        items: list[QuoteItem] = []
        for k in range(n_items):
            p = ctx.products[(i + k * 2) % n_products]
            qty = [1, 2, 5, 10, 3, 4][(i + k) % 6]
            list_price = float(p.price or 0)
            discount_pct = [0, 0, 5, 3, 0, 8][(i + k) % 6]
            unit = round(list_price * (1 - discount_pct / 100), 2) if quoted else 0.0
            items.append(QuoteItem(
                id=str(uuid.uuid4()), quote_id=quote_id, product_id=p.id, product_name=p.name,
                category=p.category_name, quantity=qty, quoted_quantity=qty, list_price=list_price,
                buying_price=float(p.buying_price or 0) or None, unit_price=unit,
                notes="Urgent" if k == 0 and i % 5 == 0 else None,
            ))
        pricing = _totals(items)

        quote = Quote(
            id=quote_id, quote_number=format_reference("quote", stem),
            user_id=requester.id, organization_id=org.id, ordered_by_user_id=requester.id,
            ordered_for_branch_id=branch.id, delivery_location_id=loc.id,
            delivery_snapshot=_snapshot(branch, loc),
            facility_name=org.name, contact_person=f"{requester.first_name} {requester.last_name}",
            email=requester.email, phone=requester.phone, address=branch.physical_address,
            additional_notes=f"Test-cycle quote #{i + 1} ({kind.replace('_', ' ')}).",
            status=status, current_handler=handler, customer_response=response,
            discount_amount=pricing["discount_amount"], tax_rate=TAX_RATE, tax_amount=pricing["tax_amount"],
            subtotal=pricing["subtotal"], list_subtotal=pricing["list_subtotal"], total=pricing["total"], include_vat=True,
            quoted_at=created + timedelta(days=1) if sent else None,
            quoted_by_user_id=staff.id if sent else None,
            assigned_admin_id=staff.id if kind != "submitted" else None,
            validity_days=30, created_at=created, updated_at=created + timedelta(hours=3),
        )
        s.add(quote)
        s.add_all(items)
        ctx.quotes.append((quote, items))

        actor = quote.contact_person
        _activity(s, entity_type="quote", entity_id=quote_id, event_type="submitted",
                  summary=f"{actor} submitted quote {quote.quote_number}", created_at=created,
                  actor_id=requester.id, actor_name=actor, actor_role="customer")
        if kind not in ("submitted", "cancelled"):
            _activity(s, entity_type="quote", entity_id=quote_id, event_type="status_change",
                      summary=f"{staff.first_name} {staff.last_name} performed 'start review'",
                      created_at=created + timedelta(hours=5), actor_id=staff.id,
                      actor_name=f"{staff.first_name} {staff.last_name}", actor_role="admin",
                      field_name="status", previous_value="pending/ADMIN_REVIEW", new_value="pending/UNDER_REVIEW",
                      customer_visible=False)
        if sent:
            _activity(s, entity_type="quote", entity_id=quote_id, event_type="status_change",
                      summary=f"{staff.first_name} {staff.last_name} performed 'send quote'",
                      created_at=created + timedelta(days=1), actor_id=staff.id,
                      actor_name=f"{staff.first_name} {staff.last_name}", actor_role="admin",
                      field_name="status", previous_value="pending/UNDER_REVIEW", new_value="quoted/CUSTOMER_REVIEW")
        if response:
            _activity(s, entity_type="quote", entity_id=quote_id, event_type="customer_response",
                      summary=f"{actor} {response} quote {quote.quote_number}",
                      created_at=created + timedelta(days=2), actor_id=requester.id, actor_name=actor, actor_role="customer")
        if kind == "cancelled":
            _activity(s, entity_type="quote", entity_id=quote_id, event_type="status_change",
                      summary=f"{staff.first_name} {staff.last_name} performed 'cancel'",
                      created_at=created + timedelta(days=1), actor_id=staff.id,
                      actor_name=f"{staff.first_name} {staff.last_name}", actor_role="admin",
                      field_name="status", previous_value="pending/ADMIN_REVIEW", new_value="cancelled/ADMIN_REVIEW")
    s.flush()


def build_messages(ctx: Ctx) -> int:
    s = ctx.session
    unread = 0
    msg_i = 0

    def add(quote: Quote, sender: User | None, role: str, body: str, created: datetime, is_read: bool):
        nonlocal msg_i, unread
        name = f"{sender.first_name} {sender.last_name}" if sender else "Hampton Scientific"
        s.add(QuoteMessage(id=_uid(f"msg-{msg_i}"), quote_id=quote.id, sender_id=sender.id if sender else None,
                           sender_role=role, sender_name=name, body=body, attachments=[], is_read=is_read, created_at=created))
        if role == "customer" and not is_read:
            unread += 1
        msg_i += 1

    by_kind: dict[str, list[tuple[Quote, User]]] = {}
    for i, (quote, _items) in enumerate(ctx.quotes):
        kind = QUOTE_PLAN[i][0]
        requester = s.get(User, quote.ordered_by_user_id)
        by_kind.setdefault(kind, []).append((quote, requester))

    for q, u in by_kind["awaiting_information"]:
        staff = s.get(User, q.assigned_admin_id)
        add(q, u, "customer", CUSTOMER_MESSAGES[0], q.created_at + timedelta(hours=6), True)
        add(q, staff, "admin", ADMIN_MESSAGES[0], q.created_at + timedelta(hours=9), True)
        add(q, u, "customer", CUSTOMER_MESSAGES[3], q.created_at + timedelta(days=1), False)
    for n, (q, u) in enumerate(by_kind["awaiting_customer"]):
        staff = s.get(User, q.assigned_admin_id)
        add(q, staff, "admin", ADMIN_MESSAGES[1], q.quoted_at, True)
        if n < 2:
            add(q, u, "customer", CUSTOMER_MESSAGES[1 + n], q.quoted_at + timedelta(days=1), False)
    for n, (q, u) in enumerate(by_kind["submitted"]):
        if n < 2:
            add(q, u, "customer", CUSTOMER_MESSAGES[7 if n else 4], q.created_at + timedelta(hours=1), False)
    for n, (q, u) in enumerate(by_kind["ordered"][:4]):
        add(q, u, "customer", CUSTOMER_MESSAGES[8 if n % 2 else 9], q.created_at + timedelta(days=5), True)
    for q, u in by_kind["direct_invoice"][:2]:
        staff = s.get(User, q.assigned_admin_id)
        add(q, staff, "admin", ADMIN_MESSAGES[5], q.created_at + timedelta(days=3), True)
    s.flush()
    return unread


def build_orders(ctx: Ctx) -> None:
    s = ctx.session
    ordered = [(i, q, items) for i, (q, items) in enumerate(ctx.quotes) if QUOTE_PLAN[i][0] == "ordered"]
    for n, ((i, quote, q_items), (status, delivery_status)) in enumerate(zip(ordered, ORDER_PLAN)):
        placed = quote.created_at + timedelta(days=3)
        order_id = _uid(f"order-{n}")
        branch = s.get(Branch, quote.ordered_for_branch_id)
        loc = ctx.locations[branch.id]
        shipped = status in ("dispatched", "out_for_delivery", "delivered")
        order = Order(
            id=order_id, order_number=sibling_reference(quote.quote_number, "order"),
            organization_id=quote.organization_id, ordered_by_user_id=quote.ordered_by_user_id,
            ordered_for_branch_id=branch.id, delivery_location_id=loc.id, quote_id=quote.id,
            status=status, delivery_status=delivery_status,
            delivery_snapshot=_snapshot(branch, loc, rider=shipped),
            notes="Deliver to stores; call ahead." if n % 3 == 0 else None,
            ordered_at=placed,
            dispatched_at=placed + timedelta(days=2) if shipped else None,
            delivered_at=placed + timedelta(days=4) if status == "delivered" else None,
            created_at=placed, updated_at=placed + timedelta(days=4 if shipped else 1),
        )
        s.add(order)
        o_items = [OrderItem(
            id=str(uuid.uuid4()), order_id=order_id, product_id=qi.product_id, product_name=qi.product_name,
            category=qi.category, quantity=int(qi.quoted_quantity or qi.quantity or 1),
            list_price=qi.list_price, buying_price=qi.buying_price, unit_price=float(qi.unit_price or 0), notes=qi.notes,
        ) for qi in q_items]
        s.add_all(o_items)
        ctx.orders.append((order, o_items))

        staff = ctx.staff_for(n)
        staff_name = f"{staff.first_name} {staff.last_name}"
        _activity(s, entity_type="order", entity_id=order_id, event_type="created",
                  summary=f"Order {order.order_number} created from {quote.quote_number}",
                  created_at=placed, actor_id=staff.id, actor_name=staff_name, actor_role="admin")
        _activity(s, entity_type="quote", entity_id=quote.id, event_type="order_created",
                  summary=f"{staff_name} created order {order.order_number}",
                  created_at=placed, actor_id=staff.id, actor_name=staff_name, actor_role="admin")
        reached = ORDER_STATUS_SEQUENCE[1:ORDER_STATUS_SEQUENCE.index(status) + 1]
        for step, label in enumerate(reached):
            _activity(s, entity_type="order", entity_id=order_id, event_type="status_change",
                      summary=f"{staff_name} changed order status to {label.replace('_', ' ')}",
                      created_at=placed + timedelta(days=step + 1), actor_id=staff.id, actor_name=staff_name,
                      actor_role="admin", field_name="status", new_value=label)
    s.flush()


def build_shipments(ctx: Ctx) -> int:
    s = ctx.session
    count = 0
    for n, (order, o_items) in enumerate(ctx.orders):
        if order.status == "order_placed":
            continue
        if order.status == "processing" and n % 2:
            continue
        ship_status = "processing" if order.status == "processing" else order.status
        groups = [o_items[:1], o_items[1:]] if len(o_items) > 1 else [o_items]
        for g_i, group in enumerate(groups):
            if not group:
                continue
            ship = Shipment(
                id=_uid(f"ship-{n}-{g_i}"), order_id=order.id, status=ship_status,
                notes=f"Courier: Rift Express — tracking RX{800000 + n * 17 + g_i}",
                created_at=(order.dispatched_at or order.updated_at) - timedelta(hours=6 * g_i),
                updated_at=order.updated_at,
            )
            s.add(ship)
            s.flush()
            for oi in group:
                s.add(ShipmentItem(id=str(uuid.uuid4()), shipment_id=ship.id, order_item_id=oi.id,
                                   product_id=oi.product_id, product_name=oi.product_name, quantity=oi.quantity))
            count += 1
    s.flush()
    return count


# (status, due offset days from created) — negative = already overdue
INVOICE_PLAN_ORDERS = {
    "delivered": ("paid", 30),
    "dispatched": ("awaiting_payment", 30),
    "out_for_delivery": ("awaiting_payment", 30),
}
DIRECT_INVOICE_PLAN = [("paid", 30), ("paid", 14)] + [("awaiting_payment", d) for d in (30, 7, 30, 14)]


def build_invoices(ctx: Ctx) -> None:
    s = ctx.session

    def make(quote: Quote, q_items: list[QuoteItem], *, status: str, created: datetime, due: datetime, key: str):
        inv_id = _uid(f"invoice-{key}")
        staff = ctx.staff_for(len(ctx.invoices))
        inv = Invoice(
            id=inv_id, invoice_number=sibling_reference(quote.quote_number, "invoice"), quote_id=quote.id,
            user_id=quote.ordered_by_user_id, organization_id=quote.organization_id, branch_id=quote.ordered_for_branch_id,
            facility_name=quote.facility_name, contact_person=quote.contact_person, email=quote.email,
            phone=quote.phone, address=quote.address,
            subtotal=quote.subtotal, discount_amount=quote.discount_amount, tax_rate=quote.tax_rate,
            tax_amount=quote.tax_amount, total=quote.total, include_vat=True,
            payment_terms="Net 30", due_date=due, status=status,
            notes="Thank you for your business." if status == "paid" else None,
            created_by=staff.id, created_at=created, updated_at=created,
            paid_at=created + timedelta(days=9) if status == "paid" else None,
        )
        s.add(inv)
        for qi in q_items:
            s.add(InvoiceItem(id=str(uuid.uuid4()), invoice_id=inv_id, product_id=qi.product_id, product_name=qi.product_name,
                              category=qi.category, quantity=int(qi.quoted_quantity or qi.quantity or 1),
                              original_price=qi.list_price, modified_price=float(qi.unit_price or 0)))
        staff_name = f"{staff.first_name} {staff.last_name}"
        _activity(s, entity_type="invoice", entity_id=inv_id, event_type="created",
                  summary=f"Invoice {inv.invoice_number} issued for {quote.quote_number}",
                  created_at=created, actor_id=staff.id, actor_name=staff_name, actor_role="admin")
        if status == "paid":
            _activity(s, entity_type="invoice", entity_id=inv_id, event_type="paid",
                      summary=f"{staff_name} marked {inv.invoice_number} as paid",
                      created_at=inv.paid_at, actor_id=staff.id, actor_name=staff_name, actor_role="admin")
        ctx.invoices.append(inv)

    # Invoices on orders: all delivered/dispatched/out-for-delivery, plus the first 3 processing orders.
    processing_seen = 0
    overdue_toggle = 0
    for n, (order, _o_items) in enumerate(ctx.orders):
        quote, q_items = next((q, it) for q, it in ctx.quotes if q.id == order.quote_id)
        if order.status in INVOICE_PLAN_ORDERS:
            status, due_days = INVOICE_PLAN_ORDERS[order.status]
        elif order.status == "processing" and processing_seen < 3:
            processing_seen += 1
            status, due_days = "awaiting_payment", 30
        else:
            continue
        created = (order.dispatched_at or order.updated_at) + timedelta(hours=2)
        due = created + timedelta(days=due_days)
        # Make some of the open ones overdue so the dashboard has an overdue bucket.
        if status != "paid":
            overdue_toggle += 1
            if overdue_toggle % 2 == 1:
                due = _ago(3 + overdue_toggle)
        make(quote, q_items, status=status, created=created, due=due, key=f"order-{n}")

    direct = [(q, it) for i, (q, it) in enumerate(ctx.quotes) if QUOTE_PLAN[i][0] == "direct_invoice"]
    for n, ((quote, q_items), (status, due_days)) in enumerate(zip(direct, DIRECT_INVOICE_PLAN)):
        created = quote.created_at + timedelta(days=2)
        due = created + timedelta(days=due_days)
        if status == "awaiting_payment" and n == 3:
            due = _ago(6)
        make(quote, q_items, status=status, created=created, due=due, key=f"direct-{n}")
    s.flush()


def build_public_records(ctx: Ctx) -> None:
    s = ctx.session
    statuses = ["new"] * 8 + ["read"] * 6 + ["responded"] * 6
    for i in range(20):
        subject, message = INQUIRY_SUBJECTS[i % len(INQUIRY_SUBJECTS)]
        first, last = FIRST_NAMES[(i * 3) % len(FIRST_NAMES)], LAST_NAMES[(i * 5) % len(LAST_NAMES)]
        s.add(ContactInquiry(
            id=_uid(f"inquiry-{i}"), name=f"{first} {last}", email=f"{first.lower()}.{last.lower().replace(chr(39), '')}@example.co.ke",
            phone=_phone(500 + i), subject=subject, message=message, status=statuses[i], created_at=_ago(i * 1.7),
        ))
    for i in range(20):
        org, branch, user = ctx.requesters[(i * 3) % len(ctx.requesters)]
        s.add(TrainingRegistrationORM(
            id=_uid(f"training-{i}"), user_id=user.id if i % 2 == 0 else None, facility_name=org.name,
            contact_person=f"{user.first_name} {user.last_name}", email=user.email, phone=user.phone,
            training_type=TRAINING_TYPES[i % len(TRAINING_TYPES)], number_of_participants=2 + i % 6,
            preferred_date=_ahead(7 + i * 3).strftime("%Y-%m-%d"),
            message="Please schedule on-site if possible." if i % 3 == 0 else None,
            status=["pending", "confirmed", "completed", "pending"][i % 4],
            created_at=_ago(i * 2.3), updated_at=_ago(i * 2.3),
        ))
    for i in range(20):
        first, last = FIRST_NAMES[(i * 7) % len(FIRST_NAMES)], LAST_NAMES[(i * 11) % len(LAST_NAMES)]
        s.add(NewsletterSubscription(
            id=_uid(f"newsletter-{i}"), email=f"{first.lower()}{i}@{['gmail.com', 'yahoo.com', 'outlook.com'][i % 3]}",
            subscribed=i % 6 != 5, subscribed_at=_ago(i * 4),
        ))
    s.flush()


# --------------------------------------------------------------------------- main
def seed_test_cycle(session, *, purge: bool) -> None:
    if has_test_cycle_data(session) and not purge:
        print("[seed] Test-cycle data already present; re-run with --purge to rebuild.")
        return

    ensure_admin_user(session)
    ensure_site_settings(session)
    ensure_email_settings(session)
    ensure_categories_and_products(session)
    session.flush()

    if purge:
        removed = purge_test_data(session)
        print("[seed] Purged:", ", ".join(f"{k}={v}" for k, v in removed.items() if v))

    staff = (
        session.query(User)
        .filter(User.role.in_(list(COMPANY_ROLES)), User.can_login.is_(True))
        .order_by(User.created_at.asc())
        .all()
    )
    products = session.query(Product).order_by(Product.name.asc()).all()
    if len(products) < 3:
        raise RuntimeError("Need at least 3 products in the catalogue")

    ctx = Ctx(session, staff, products)
    build_facilities(ctx)
    build_quotes(ctx)
    unread = build_messages(ctx)
    build_orders(ctx)
    shipments = build_shipments(ctx)
    build_invoices(ctx)
    build_public_records(ctx)
    session.commit()

    n_branches = sum(len(b) for b in ctx.branches.values())
    n_users = sum(len(u) for u in ctx.branch_users.values())
    print("[seed] Test-cycle data created:")
    print(f"  organizations={len(ctx.orgs)} branches={n_branches} delivery_locations={n_branches} facility_users={n_users}")
    print(f"  quotes={len(ctx.quotes)} orders={len(ctx.orders)} invoices={len(ctx.invoices)} shipments={shipments}")
    print(f"  quote_messages unread(customer)={unread}; contact_inquiries=20 training_registrations=20 newsletter=20")
    print(f"  Facility login password for every facility user: {FACILITY_PASSWORD}")
    print(f"  Example org_admin: {ctx.org_admins[ctx.orgs[0].id].email}")
    print(f"  Example branch_admin: {ctx.branch_users[ctx.orgs[0].id][1].email}")
    print(f"  Example branch_user: {ctx.branch_users[ctx.orgs[0].id][2].email}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--purge", action="store_true", help="delete existing facility/transaction data first")
    parser.add_argument("--yes", action="store_true", help="skip the interactive confirmation for --purge")
    args = parser.parse_args(argv)

    if args.purge and not args.yes:
        answer = input("This will DELETE all facilities, facility users, quotes, orders, invoices and related rows. Type 'purge' to continue: ")
        if answer.strip().lower() != "purge":
            print("Aborted.")
            return 1

    session = SessionLocal()
    try:
        seed_test_cycle(session, purge=args.purge)
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
