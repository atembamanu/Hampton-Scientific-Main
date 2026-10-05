from pathlib import Path

from env_loader import load_app_env

# Load environment variables FIRST, before everything else
ROOT_DIR = Path(__file__).parent
load_app_env()

# NOW import everything else
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import io
from typing import List, Optional
from datetime import datetime, timedelta

# Import utilities (NOW safe to import after .env is loaded)
from utils.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
    get_current_user,
    get_optional_user,
    get_admin_user,
)
from utils.email_service import set_company_info
from utils.app_time import install_json_encoders, APP_TIMEZONE_NAME
from db.init_db import init_db
from db.session import SessionLocal
from sqlalchemy import text

# Import route modules
from routes import (
    products, quotes, invoices, training, contact, stats, auth, admin,
    facilities, organizations, branches, facility_users, delivery_locations, orders,
    admin_ops, events, field, admin_facilities, careers,
)

from contextlib import asynccontextmanager
from playwright.async_api import async_playwright
import base64
import asyncio
from jinja2 import Environment, FileSystemLoader

# ============================================
# Playwright & PDF Singleton Logic
# ============================================
class PDFManager:
    playwright = None
    browser = None
    jinja_env = None
    _loop = None

    @classmethod
    async def start(cls):
        logger.info("Starting Playwright Browser...")
        cls.playwright = await async_playwright().start()
        # Important for Docker: --no-sandbox and --disable-dev-shm-usage
        cls.browser = await cls.playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        try:
            cls._loop = asyncio.get_running_loop()
        except RuntimeError:
            cls._loop = None
        # Setup Jinja2 (Assumes templates are in a folder named 'templates')
        template_path = ROOT_DIR / "utils" / "templates"
        template_path.mkdir(parents=True, exist_ok=True)
        cls.jinja_env = Environment(loader=FileSystemLoader(str(template_path)))

    @classmethod
    async def stop(cls):
        logger.info("Closing Playwright Browser...")
        try:
            if cls.browser:
                await cls.browser.close()
        except Exception:
            logger.debug("PDFManager browser close failed", exc_info=True)
        try:
            if cls.playwright:
                await cls.playwright.stop()
        except Exception:
            logger.debug("PDFManager playwright stop failed", exc_info=True)
        cls.browser = None
        cls.playwright = None
        cls._loop = None

    @classmethod
    async def ensure_ready(cls):
        """Restart Playwright if missing or bound to a different event loop."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        needs_start = cls.browser is None or (cls._loop is not None and loop is not None and cls._loop is not loop)
        if needs_start:
            if cls.browser is not None or cls.playwright is not None:
                try:
                    await cls.stop()
                except Exception:
                    cls.browser = None
                    cls.playwright = None
                    cls._loop = None
            await cls.start()

    @classmethod
    async def generate_pdf(cls, template_name: str, data: dict) -> str:
        """Renders HTML and converts to Base64 PDF string"""
        template = cls.jinja_env.get_template(template_name)
        html_content = template.render(data)
        
        page = await cls.browser.new_page()
        try:
            await page.set_content(html_content)
            await page.wait_for_load_state("networkidle")
            
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "20px", "bottom": "20px", "left": "20px", "right": "20px"}
            )
            return base64.b64encode(pdf_bytes).decode('utf-8')
        finally:
            await page.close()

# ============================================
# Lifespan Context Manager
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    init_db()
    await PDFManager.start()
    
    scheduler.add_job(run_followup_checks, 'interval', hours=1, id='email_followups', replace_existing=True)
    scheduler.start()
    from utils.live_events import hub
    hub.bind_loop(asyncio.get_running_loop())
    
    ci = await get_company_info()
    set_company_info(ci)
    
    yield # Server runs here
    
    # SHUTDOWN
    scheduler.shutdown(wait=False)
    await PDFManager.stop()

# Initialize App with lifespan
app = FastAPI(title="Hampton Scientific API", lifespan=lifespan)

# All API datetimes go out in the company time zone (APP_TIMEZONE, default Africa/Nairobi)
# with an explicit offset, so browsers render them in the viewer's local time.
install_json_encoders()
logging.getLogger(__name__).info("Company time zone: %s", APP_TIMEZONE_NAME)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Helper: get company info from DB settings (Postgres)
async def get_company_info() -> dict:
    from db.models import SiteSettings

    with SessionLocal() as session:
        settings = (
            session.query(SiteSettings)
            .filter(SiteSettings.id == "site_settings")
            .one_or_none()
        )

        if not settings:
            return {
                "company_name": "Hampton Scientific Limited",
                "address": "",
                "po_box": "",
                "phone": "",
                "email": "",
                "working_hours": "",
                "bank_name": "",
                "bank_account_name": "",
                "bank_account_number": "",
                "mpesa_paybill": "",
                "mpesa_account_number": "",
                "mpesa_account_name": "",
            }

        return {
            "company_name": settings.company_name
            or "Hampton Scientific Limited",
            "address": settings.address or "",
            "po_box": settings.po_box or "",
            "phone": settings.phone or "",
            "email": settings.email or "",
            "working_hours": settings.working_hours or "",
            "bank_name": settings.bank_name or "",
            "bank_account_name": settings.bank_account_name or "",
            "bank_account_number": settings.bank_account_number or "",
            "mpesa_paybill": settings.mpesa_paybill or "",
            "mpesa_account_number": settings.mpesa_account_number or "",
            "mpesa_account_name": settings.mpesa_account_name or "",
        }

# ============================================
# Chatbot Route (legacy stub — Gemini / Google API removed)
# ============================================

@api_router.post("/chatbot/query")
async def chatbot_query(query: dict):
    session_id = query.get("session_id", "default")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3001")
    return {
        "message": (
            "Our chatbot is currently unavailable. "
            f"Please browse the catalogue or contact us at {frontend_url}/contact."
        ),
        "session_id": session_id,
    }

# ============================================
# Health Check
# ============================================

@api_router.get("/")
async def root():
    return {"message": "Hampton Scientific API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    try:
        # Check Postgres connectivity instead of MongoDB
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "postgres"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Service unavailable")

# Serve uploaded product images
PRODUCT_UPLOAD_DIR = ROOT_DIR / "routes" / "uploads" / "products"
PRODUCT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHAT_UPLOAD_DIR = ROOT_DIR / "routes" / "uploads" / "chat"
CHAT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CAREER_UPLOAD_DIR = ROOT_DIR / "routes" / "uploads" / "careers"
CAREER_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
from fastapi.staticfiles import StaticFiles

app.mount(
    "/images/products",
    StaticFiles(directory=PRODUCT_UPLOAD_DIR),
    name="product-images",
)
app.mount(
    "/files/chat",
    StaticFiles(directory=CHAT_UPLOAD_DIR),
    name="chat-files",
)

# Include the router in the main app
app.include_router(api_router)

# Include the refactored route modules
app.include_router(auth.router, prefix="/api/auth")
app.include_router(admin.router, prefix="/api/admin")
app.include_router(products.router, prefix="/api/products")
app.include_router(quotes.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(training.router, prefix="/api/training")
app.include_router(contact.router, prefix="/api")
app.include_router(stats.router, prefix="/api/admin")
app.include_router(facilities.router, prefix="/api/facilities")
app.include_router(organizations.router, prefix="/api/organizations")
app.include_router(branches.router, prefix="/api/branches")
app.include_router(facility_users.router, prefix="/api/users")
app.include_router(delivery_locations.router, prefix="/api/delivery-locations")
app.include_router(orders.router, prefix="/api/orders")
app.include_router(admin_ops.router, prefix="/api/admin")
app.include_router(admin_facilities.router, prefix="/api/admin")
app.include_router(field.router, prefix="/api/admin")
app.include_router(events.router, prefix="/api")
app.include_router(careers.public_router, prefix="/api/careers")
app.include_router(careers.admin_router, prefix="/api/admin/careers")

def _parse_cors_origins() -> List[str]:
    """Split CORS_ORIGINS; strip whitespace, optional wrapping quotes, trailing slashes."""
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3001")
    out: List[str] = []
    for part in raw.split(","):
        o = part.strip()
        if len(o) >= 2 and o[0] == o[-1] and o[0] in "\"'":
            o = o[1:-1].strip()
        o = o.rstrip("/")
        if o:
            out.append(o)
    return out or ["http://localhost:3001"]


_cors_list = _parse_cors_origins()
_cors_regex = (os.getenv("CORS_ORIGIN_REGEX") or "").strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_list,
    allow_origin_regex=_cors_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(
    "CORS allow_origins=%s allow_origin_regex=%s",
    _cors_list,
    _cors_regex or "(none)",
)

# Background scheduler for email follow-ups
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup_scheduler():
    # Ensure Postgres tables exist before starting background jobs
    init_db()
    scheduler.add_job(run_followup_checks, 'interval', hours=1, id='email_followups', replace_existing=True)
    scheduler.start()
    logger.info("Email follow-up scheduler started (runs every hour)")
    # Load company info for emails
    ci = await get_company_info()
    set_company_info(ci)
    logger.info("Company info loaded for email templates")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown(wait=False)

# ============================================
# Background Email Follow-Up Scheduler
# ============================================

async def run_followup_checks():
    """Run scheduled follow-up email checks"""
    try:
        from utils.email_followup import (
            get_followup_settings,
            get_quotes_needing_followup,
            mark_quote_followup_sent,
            get_invoices_needing_reminder,
            mark_invoice_reminder_sent,
            log_email,
        )
        from utils.email_service import (
            send_quote_followup_email,
            send_invoice_reminder_email_from_template,
        )

        with SessionLocal() as session:
            settings = await get_followup_settings(session)

            # Check quote follow-ups
            if settings.get("quote_followup_enabled"):
                hours = settings.get("quote_followup_hours", 24)
                quotes = await get_quotes_needing_followup(session, hours)
                for quote in quotes:
                    try:
                        send_quote_followup_email(
                            quote["contact_person"],
                            quote["email"],
                            quote["facility_name"],
                            quote["id"],
                            quote["items"]
                        )
                        await log_email(session, {
                            "to": [quote["email"]],
                            "subject": f"Quote Follow-Up - {quote['id'][:8].upper()}",
                            "type": "quote_followup_auto",
                            "related_id": quote["id"],
                            "status": "sent"
                        })
                        await mark_quote_followup_sent(session, quote["id"])
                        logger.info(f"Auto follow-up sent for quote {quote['id'][:8]}")
                    except Exception as e:
                        logger.error(f"Failed auto follow-up for quote {quote['id'][:8]}: {e}")

            # Check invoice reminders
            if settings.get("invoice_followup_enabled"):
                days = settings.get("invoice_followup_days", 7)
                invoices = await get_invoices_needing_reminder(session, days)
                for inv in invoices:
                    try:
                        due_date = inv.get("due_date")
                        is_overdue = due_date < datetime.utcnow() if due_date else False
                        send_invoice_reminder_email_from_template(inv, is_overdue=is_overdue)
                        await log_email(session, {
                            "to": [inv["email"]],
                            "subject": f"Invoice Reminder - {inv['invoice_number']}",
                            "type": "invoice_reminder_auto",
                            "related_id": inv["id"],
                            "status": "sent"
                        })
                        await mark_invoice_reminder_sent(session, inv["id"])
                        logger.info(f"Auto reminder sent for invoice {inv['invoice_number']}")
                    except Exception as e:
                        logger.error(f"Failed auto reminder for invoice {inv.get('invoice_number')}: {e}")

        logger.info("Follow-up check completed")
    except Exception as e:
        logger.error(f"Follow-up check error: {e}")