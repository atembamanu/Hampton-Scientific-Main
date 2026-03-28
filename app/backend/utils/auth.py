from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import os
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from models.user import UserResponse
from sqlalchemy.orm import Session
from db.session import SessionLocal
from db.models import User as UserModel

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Security
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# Dependency to get current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    email = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    # Lookup user in Postgres
    with SessionLocal() as db:
        user = db.query(UserModel).filter(UserModel.email == email).one_or_none()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        # Manually map ORM user to UserResponse (field names differ)
        return UserResponse(
            id=user.id,
            firstName=user.first_name,
            lastName=user.last_name,
            email=user.email,
            phone=user.phone,
            facilityName=user.facility_name,
            facilityType=user.facility_type,
            address=user.address,
            city=user.city,
            postalCode=user.postal_code,
            role=user.role,
            can_login=user.can_login,
            created_at=user.created_at,
        )

# Optional auth dependency - returns None if no valid token
async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
):
    if credentials is None:
        return None
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if payload is None:
            return None
        email = payload.get("sub")
        if email is None:
            return None
        with SessionLocal() as db:
            user = (
                db.query(UserModel).filter(UserModel.email == email).one_or_none()
            )
            if user is None:
                return None

            return UserResponse(
                id=user.id,
                firstName=user.first_name,
                lastName=user.last_name,
                email=user.email,
                phone=user.phone,
                facilityName=user.facility_name,
                facilityType=user.facility_type,
                address=user.address,
                city=user.city,
                postalCode=user.postal_code,
                role=user.role,
                can_login=user.can_login,
                created_at=user.created_at,
            )
    except Exception:
        return None

# Admin-only dependency
async def get_admin_user(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user