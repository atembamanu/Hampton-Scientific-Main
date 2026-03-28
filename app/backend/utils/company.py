"""
Company information utilities.
"""

from server import db

async def get_company_info() -> dict:
    """Get company information from site settings."""
    site_settings = await db.site_settings.find_one({"_id": "site_settings"}) or {}
    return {
        "company_name": site_settings.get("company_name", "Hampton Scientific Limited"),
        "address": site_settings.get("address", ""),
        "po_box": site_settings.get("po_box", ""),
        "phone": site_settings.get("phone", ""),
        "email": site_settings.get("email", ""),
        "bank_name": site_settings.get("bank_name", ""),
        "bank_account_name": site_settings.get("bank_account_name", ""),
        "bank_account_number": site_settings.get("bank_account_number", ""),
        "mpesa_paybill": site_settings.get("mpesa_paybill", ""),
        "mpesa_account_number": site_settings.get("mpesa_account_number", ""),
        "mpesa_account_name": site_settings.get("mpesa_account_name", ""),
    }

async def set_company_info(info: dict):
    """Update company information in site settings."""
    await db.site_settings.update_one(
        {"_id": "site_settings"},
        {"$set": info},
        upsert=True
    )