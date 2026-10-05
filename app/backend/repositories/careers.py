from collections.abc import Sequence
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import JobApplication, JobPost

EMPLOYMENT_TYPES = ("full-time", "part-time", "contract", "internship")


def _clean_job_payload(data: dict) -> dict:
    title = str(data.get("title") or "").strip()[:160]
    if not title:
        raise ValueError("Job title is required")
    emp = str(data.get("employment_type") or "full-time").strip().lower().replace(" ", "-")
    if emp not in EMPLOYMENT_TYPES:
        emp = "full-time"
    return {
        "title": title,
        "department": str(data.get("department") or "").strip()[:80],
        "location": str(data.get("location") or "").strip()[:120],
        "employment_type": emp,
        "description": str(data.get("description") or "").strip()[:20000],
        "requirements": str(data.get("requirements") or "").strip()[:20000],
        "is_published": bool(data.get("is_published", True)),
    }


def list_jobs(db: Session, *, published_only: bool = False) -> Sequence[JobPost]:
    q = db.query(JobPost)
    if published_only:
        q = q.filter(JobPost.is_published.is_(True))
    return q.order_by(JobPost.created_at.desc()).all()


def get_job(db: Session, job_id: str) -> Optional[JobPost]:
    return db.query(JobPost).filter(JobPost.id == job_id).one_or_none()


def application_counts(db: Session) -> dict[str, int]:
    rows = (
        db.query(JobApplication.job_id, func.count(JobApplication.id))
        .group_by(JobApplication.job_id)
        .all()
    )
    return {job_id: int(count) for job_id, count in rows}


def create_job(db: Session, data: dict) -> JobPost:
    payload = _clean_job_payload(data)
    now = datetime.utcnow()
    job = JobPost(id=str(uuid4()), created_at=now, updated_at=now, **payload)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def update_job(db: Session, job: JobPost, data: dict) -> JobPost:
    payload = _clean_job_payload({**{
        "title": job.title,
        "department": job.department,
        "location": job.location,
        "employment_type": job.employment_type,
        "description": job.description,
        "requirements": job.requirements,
        "is_published": job.is_published,
    }, **data})
    for key, value in payload.items():
        setattr(job, key, value)
    job.updated_at = datetime.utcnow()
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def delete_job(db: Session, job: JobPost) -> None:
    db.delete(job)
    db.commit()


def list_applications(db: Session, job_id: Optional[str] = None) -> Sequence[JobApplication]:
    q = db.query(JobApplication)
    if job_id:
        q = q.filter(JobApplication.job_id == job_id)
    return q.order_by(JobApplication.created_at.desc()).all()


def get_application(db: Session, application_id: str) -> Optional[JobApplication]:
    return db.query(JobApplication).filter(JobApplication.id == application_id).one_or_none()


def create_application(db: Session, data: dict) -> JobApplication:
    row = JobApplication(
        id=str(uuid4()),
        job_id=data["job_id"],
        name=str(data["name"]).strip()[:120],
        email=str(data["email"]).strip().lower()[:254],
        phone=(str(data.get("phone") or "").strip()[:24] or None),
        cover_letter=(str(data.get("cover_letter") or "").strip()[:4000] or None),
        cv_filename=data.get("cv_filename"),
        cv_url=data.get("cv_url"),
        status="new",
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def set_application_status(db: Session, application: JobApplication, status: str) -> JobApplication:
    allowed = {"new", "reviewed", "shortlisted", "rejected"}
    next_status = status if status in allowed else "reviewed"
    application.status = next_status
    db.add(application)
    db.commit()
    db.refresh(application)
    return application
