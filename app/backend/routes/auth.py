from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from datetime import datetime, timedelta
import uuid

from models.user import User, UserCreate, UserResponse, UserUpdate, AdminUserCreate
from utils.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
    get_current_user,
    get_admin_user,
)
from utils.email_service import send_password_reset_email, send_welcome_email
from utils.logger import logger
from sqlalchemy.orm import Session
from sqlalchemy import func
from deps import get_db
from db.models import User as UserModel

# ============================================
# Public Auth Routes
# ============================================

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
):
    """Register a new user."""
    # Check if user already exists
    existing_user = (
        db.query(UserModel).filter(UserModel.email == user_data.email).one_or_none()
    )
    if existing_user:
        raise HTTPException(
            status_code=400, detail="User with this email already exists"
        )

    # Hash password
    hashed_password = get_password_hash(user_data.password)

    new_id = str(uuid.uuid4())
    now = datetime.utcnow()
    user_row = UserModel(
        id=new_id,
        first_name=user_data.firstName,
        last_name=user_data.lastName,
        email=user_data.email,
        phone=user_data.phone,
        hashed_password=hashed_password,
        facility_name=user_data.facilityName,
        facility_type=user_data.facilityType,
        address=user_data.address,
        city=user_data.city,
        postal_code=user_data.postalCode,
        role="customer",
        can_login=True,
        created_at=now,
        updated_at=now,
    )

    db.add(user_row)
    db.commit()
    logger.info(f"New user registered: {user_data.email}")
    
    # Send welcome email
    try:
        send_welcome_email(user_data.firstName, user_data.email)
    except Exception as e:
        logger.error(f"Failed to send welcome email: {e}")
    
    # Return user without password (manual mapping due to different field names)
    return UserResponse(
        id=user_row.id,
        firstName=user_row.first_name,
        lastName=user_row.last_name,
        email=user_row.email,
        phone=user_row.phone,
        facilityName=user_row.facility_name,
        facilityType=user_row.facility_type,
        address=user_row.address,
        city=user_row.city,
        postalCode=user_row.postal_code,
        role=user_row.role,
        can_login=user_row.can_login,
        created_at=user_row.created_at,
    )

@router.post("/login")
async def login(
    credentials: dict,
    db: Session = Depends(get_db),
):
    """Login user and return access token."""
    email = (credentials.get("email") or "").strip()
    password = credentials.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    user = (
        db.query(UserModel)
        .filter(func.lower(UserModel.email) == email.lower())
        .one_or_none()
    )

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not getattr(user, "can_login", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")

    from utils.permissions import reject_wrong_login_portal

    reject_wrong_login_portal(user.role, credentials.get("portal"))

    access_token = create_access_token(data={"sub": user.email})

    from utils.facility_auth import build_auth_payload

    user_payload = build_auth_payload(db, user)
    logger.info(f"User logged in: {email}")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_payload,
    }


@router.post("/refresh")
async def refresh_session(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Issue a new 30-minute access token while the current session is still valid."""
    user = (
        db.query(UserModel)
        .filter(UserModel.email == current_user.email)
        .one_or_none()
    )
    if not user or not getattr(user, "can_login", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")

    access_token = create_access_token(data={"sub": user.email})
    from utils.facility_auth import build_auth_payload

    logger.info(f"Session extended: {user.email}")
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 30 * 60,
        "user": build_auth_payload(db, user),
    }


@router.post("/forgot-password")
async def forgot_password(
    request: dict,
    db: Session = Depends(get_db),
):
    """Send password reset email."""
    email = request.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    user = (
        db.query(UserModel)
        .filter(UserModel.email == email)
        .one_or_none()
    )
    if not user:
        # Don't reveal if email exists or not
        return {"message": "If the email exists, a reset link has been sent"}
    if user.role == "branch_user":
        raise HTTPException(
            status_code=403,
            detail="Branch personnel passwords are managed by your facility admin",
        )
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    reset_expires = datetime.utcnow() + timedelta(hours=1)
    
    # Store reset token
    user.reset_token = reset_token
    user.reset_token_expires = reset_expires
    user.updated_at = datetime.utcnow()
    db.add(user)
    db.commit()
    
    # Send reset email
    try:
        import os

        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3001")
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        send_password_reset_email(email, reset_token, reset_url)
        logger.info(f"Password reset email sent to: {email}")
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")
    
    return {"message": "If the email exists, a reset link has been sent"}

@router.post("/reset-password")
async def reset_password(
    request: dict,
    db: Session = Depends(get_db),
):
    """Reset password using token."""
    token = request.get("token")
    new_password = request.get("password")
    
    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password required")
    
    user = (
        db.query(UserModel)
        .filter(
            UserModel.reset_token == token,
            UserModel.reset_token_expires > datetime.utcnow(),
        )
        .one_or_none()
    )
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if user.role == "branch_user":
        raise HTTPException(
            status_code=403,
            detail="Branch personnel passwords are managed by your facility admin",
        )
    
    # Update password
    hashed_password = get_password_hash(new_password)
    user.hashed_password = hashed_password
    user.reset_token = None
    user.reset_token_expires = None
    user.updated_at = datetime.utcnow()
    db.add(user)
    db.commit()
    
    logger.info(f"Password reset for: {user.email}")
    
    return {"message": "Password reset successfully"}

# ============================================
# Protected User Routes
# ============================================

@router.get("/me")
async def get_current_user_profile(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user profile with organization context."""
    from utils.facility_auth import build_auth_payload

    user_row = db.query(UserModel).filter(UserModel.id == current_user.id).one_or_none()
    if user_row:
        return build_auth_payload(db, user_row)
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user profile."""
    if current_user.role == "branch_user":
        raise HTTPException(
            status_code=403,
            detail="Your profile is managed by your facility admin",
        )
    update_data = user_update.dict(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    update_data["updated_at"] = datetime.utcnow()
    
    user_row = (
        db.query(UserModel)
        .filter(UserModel.id == current_user.id)
        .one_or_none()
    )
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    for key, value in update_data.items():
        if key == "firstName":
            setattr(user_row, "first_name", value)
        elif key == "lastName":
            setattr(user_row, "last_name", value)
        elif key == "facilityName":
            setattr(user_row, "facility_name", value)
        elif key == "facilityType":
            setattr(user_row, "facility_type", value)
        elif key == "postalCode":
            setattr(user_row, "postal_code", value)
        else:
            setattr(user_row, key, value)

    db.add(user_row)
    db.commit()
    db.refresh(user_row)
    logger.info(f"User profile updated: {current_user.email}")
    
    return UserResponse(
        id=user_row.id,
        firstName=user_row.first_name,
        lastName=user_row.last_name,
        email=user_row.email,
        phone=user_row.phone,
        facilityName=user_row.facility_name,
        facilityType=user_row.facility_type,
        address=user_row.address,
        city=user_row.city,
        postalCode=user_row.postal_code,
        role=user_row.role,
        can_login=user_row.can_login,
        created_at=user_row.created_at,
    )