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
from google import genai
from google.genai import types

# Import models
from models.user import UserResponse

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
from db.init_db import init_db
from db.session import SessionLocal
from sqlalchemy import text

# Import route modules
from routes import products, quotes, invoices, training, contact, stats, auth, admin

from contextlib import asynccontextmanager
from playwright.async_api import async_playwright
import base64
from jinja2 import Environment, FileSystemLoader

# ============================================
# Playwright & PDF Singleton Logic
# ============================================
class PDFManager:
    playwright = None
    browser = None
    jinja_env = None

    @classmethod
    async def start(cls):
        logger.info("Starting Playwright Browser...")
        cls.playwright = await async_playwright().start()
        # Important for Docker: --no-sandbox and --disable-dev-shm-usage
        cls.browser = await cls.playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        # Setup Jinja2 (Assumes templates are in a folder named 'templates')
        template_path = ROOT_DIR / "utils" / "templates"
        template_path.mkdir(parents=True, exist_ok=True)
        cls.jinja_env = Environment(loader=FileSystemLoader(str(template_path)))

    @classmethod
    async def stop(cls):
        logger.info("Closing Playwright Browser...")
        if cls.browser:
            await cls.browser.close()
        if cls.playwright:
            await cls.playwright.stop()

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
    
    ci = await get_company_info()
    set_company_info(ci)
    
    yield # Server runs here
    
    # SHUTDOWN
    scheduler.shutdown(wait=False)
    genai_client.close()
    await PDFManager.stop()

# Initialize App with lifespan
app = FastAPI(title="Hampton Scientific API", lifespan=lifespan)

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
# Chatbot Route (for product/training queries)
# ============================================

# Setup Gemini
genai_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
MODEL_ID = "gemini-2.0-flash"

import time

# Global cache to save tokens and DB hits
CONTEXT_CACHE = {
    "data": "",
    "last_updated": 0
}
CACHE_EXPIRY = 3600  # 1 hour in seconds

async def get_cached_system_context():
    current_time = time.time()

    # If cache is fresh, return it
    if CONTEXT_CACHE["data"] and (current_time - CONTEXT_CACHE["last_updated"] < CACHE_EXPIRY):
        return CONTEXT_CACHE["data"]

    # Otherwise, fetch from Postgres
    from db.models import Product, ProductCategory, TrainingProgramORM

    with SessionLocal() as session:
        products = (
            session.query(Product)
            .order_by(Product.created_at.desc())
            .limit(30)
            .all()
        )
        categories = (
            session.query(ProductCategory)
            .order_by(ProductCategory.display_order.asc())
            .limit(15)
            .all()
        )
        trainings = (
            session.query(TrainingProgramORM)
            .order_by(TrainingProgramORM.created_at.desc())
            .limit(10)
            .all()
        )

    p_list = "\n".join([f"- {p.name}" for p in products])
    c_list = "\n".join([f"- {c.name}" for c in categories])
    t_list = "\n".join([f"- {t.title}" for t in trainings])

    context = f"CATEGORIES:\n{c_list}\n\nPRODUCTS:\n{p_list}\n\nTRAINING:\n{t_list}"

    # Update cache
    CONTEXT_CACHE["data"] = context
    CONTEXT_CACHE["last_updated"] = current_time
    return context

@api_router.post("/chatbot/query")
async def chatbot_query(query: dict):
    user_message = query.get("message", "")
    session_id = query.get("session_id", "default")
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3001')

    try:
        # Get fast cached context
        business_context = await get_cached_system_context()

        # High-density instruction
        system_instruction = f"""
Role: Professional Support for Hampton Scientific (Nairobi).
{business_context}

Links:
- Contact: {frontend_url}/contact
- Products: {frontend_url}/products

Rules: 
1. Link to [Products Page]({frontend_url}/products) for items. 
2. If unlisted, suggest custom quotes via [Contact]({frontend_url}/contact).
3. Be concise and professional.
"""

        past_messages = await get_chat_history(session_id)

        chat = genai_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7
            ),
            history=past_messages
        )

        response = chat.send_message(user_message)
        ai_message = response.text

        # Background task: Save to Postgres chat history
        from repositories import chat as chat_repo

        with SessionLocal() as session:
            chat_repo.append_chat_messages(
                session,
                session_id,
                [
                    {"role": "user", "content": user_message},
                    {"role": "assistant", "content": ai_message},
                ],
            )

        return {"message": ai_message, "session_id": session_id}

    except Exception as e:
        logger.error(f"Chatbot Error: {e}")
        return {"message": "System busy. Please try again in a moment.", "session_id": session_id}

# Get chat history helper
async def get_chat_history(session_id, limit=3):
    from repositories import chat as chat_repo

    with SessionLocal() as session:
        history = chat_repo.get_recent_messages(session, session_id, limit)
    # they come newest-first; reverse to oldest-first
    history.reverse()

    formatted_history = []
    for msg in history:
        role = "model" if msg.role == "assistant" else "user"
        # Truncate very long past messages to 200 characters to save tokens
        content = (msg.content[:200] + "..") if len(msg.content) > 200 else msg.content

        formatted_history.append(
            types.Content(role=role, parts=[types.Part(text=content)])
        )
    return formatted_history

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
from fastapi.staticfiles import StaticFiles

app.mount(
    "/images/products",
    StaticFiles(directory=PRODUCT_UPLOAD_DIR),
    name="product-images",
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

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3001")
_cors_list = [o.strip() for o in _cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
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
    genai_client.close()

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