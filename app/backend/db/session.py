import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
  # Fall back to a sensible default; this keeps local non-Docker runs from crashing
  DATABASE_URL = "postgresql+psycopg2://hs_user:hs_password_2026@localhost:5432/hampton_scientific"

engine = create_engine(DATABASE_URL, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

