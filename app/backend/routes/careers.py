from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from deps import get_db
from models.career import JobApplication, JobPost, JobPostCreate
from models.user import UserResponse
from repositories import careers as careers_repo
from utils.career_uploads import cv_disk_path, save_cv_upload
from utils.contact_validation import raise_if_invalid_email, raise_if_invalid_phone
from utils.logger import logger
from utils.permissions import require_company_permission

public_router = APIRouter()
admin_router = APIRouter()


def _job_out(job, counts: Optional[dict] = None) -> JobPost:
    return JobPost(
        id=job.id,
        title=job.title,
        department=job.department or "",
        location=job.location or "",
        employment_type=job.employment_type or "full-time",
        description=job.description or "",
        requirements=job.requirements or "",
        is_published=bool(job.is_published),
        application_count=(counts or {}).get(job.id, 0),
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _application_out(row, job_title: str = "") -> JobApplication:
    return JobApplication(
        id=row.id,
        job_id=row.job_id,
        job_title=job_title,
        name=row.name,
        email=row.email,
        phone=row.phone,
        cover_letter=row.cover_letter,
        cv_filename=row.cv_filename,
        cv_url=row.cv_url,
        status=row.status or "new",
        created_at=row.created_at,
    )


@public_router.get("", response_model=List[JobPost], tags=["careers"])
async def list_published_jobs(db: Session = Depends(get_db)):
    return [_job_out(job) for job in careers_repo.list_jobs(db, published_only=True)]


@public_router.get("/{job_id}", response_model=JobPost, tags=["careers"])
async def get_published_job(job_id: str, db: Session = Depends(get_db)):
    job = careers_repo.get_job(db, job_id)
    if not job or not job.is_published:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_out(job)


@public_router.post("/{job_id}/apply", response_model=JobApplication, tags=["careers"])
async def apply_for_job(
    job_id: str,
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    cover_letter: str = Form(""),
    cv: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    job = careers_repo.get_job(db, job_id)
    if not job or not job.is_published:
        raise HTTPException(status_code=404, detail="Job not found")
    full_name = (name or "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Name is required")
    raise_if_invalid_email(email)
    if (phone or "").strip():
        raise_if_invalid_phone(phone)
    content = await cv.read()
    saved = save_cv_upload(cv, content)
    row = careers_repo.create_application(db, {
        "job_id": job.id,
        "name": full_name,
        "email": email,
        "phone": phone,
        "cover_letter": cover_letter,
        "cv_filename": saved["filename"],
        "cv_url": saved["url"],
    })
    logger.info(f"Job application for {job.title} from {row.email}")
    return _application_out(row, job.title)


@admin_router.get("/jobs", response_model=List[JobPost], tags=["careers"])
async def admin_list_jobs(
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    counts = careers_repo.application_counts(db)
    return [_job_out(job, counts) for job in careers_repo.list_jobs(db)]


@admin_router.post("/jobs", response_model=JobPost, tags=["careers"])
async def admin_create_job(
    body: JobPostCreate,
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    try:
        job = careers_repo.create_job(db, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.info(f"Job posted by {current_user.email}: {job.title}")
    return _job_out(job)


@admin_router.put("/jobs/{job_id}", response_model=JobPost, tags=["careers"])
async def admin_update_job(
    job_id: str,
    body: JobPostCreate,
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    job = careers_repo.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        job = careers_repo.update_job(db, job, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _job_out(job, careers_repo.application_counts(db))


@admin_router.delete("/jobs/{job_id}", tags=["careers"])
async def admin_delete_job(
    job_id: str,
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    job = careers_repo.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    careers_repo.delete_job(db, job)
    logger.info(f"Job deleted by {current_user.email}: {job_id}")
    return {"message": "Job removed"}


@admin_router.get("/jobs/{job_id}/applications", response_model=List[JobApplication], tags=["careers"])
async def admin_list_job_applications(
    job_id: str,
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    job = careers_repo.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return [_application_out(row, job.title) for row in careers_repo.list_applications(db, job_id)]


@admin_router.get("/applications", response_model=List[JobApplication], tags=["careers"])
async def admin_list_all_applications(
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    jobs = {job.id: job.title for job in careers_repo.list_jobs(db)}
    return [_application_out(row, jobs.get(row.job_id, "")) for row in careers_repo.list_applications(db)]


@admin_router.get("/applications/{application_id}", response_model=JobApplication, tags=["careers"])
async def admin_get_application(
    application_id: str,
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    row = careers_repo.get_application(db, application_id)
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    job = careers_repo.get_job(db, row.job_id)
    return _application_out(row, job.title if job else "")


@admin_router.patch("/applications/{application_id}", response_model=JobApplication, tags=["careers"])
async def admin_update_application(
    application_id: str,
    body: dict,
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    row = careers_repo.get_application(db, application_id)
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    row = careers_repo.set_application_status(db, row, str(body.get("status") or "reviewed"))
    job = careers_repo.get_job(db, row.job_id)
    return _application_out(row, job.title if job else "")


@admin_router.get("/applications/{application_id}/cv", tags=["careers"])
async def admin_download_cv(
    application_id: str,
    current_user: UserResponse = Depends(require_company_permission("careers")),
    db: Session = Depends(get_db),
):
    row = careers_repo.get_application(db, application_id)
    if not row or not row.cv_url:
        raise HTTPException(status_code=404, detail="CV not found")
    stored = row.cv_url.rsplit("/", 1)[-1]
    path = cv_disk_path(stored)
    return FileResponse(path, filename=row.cv_filename or stored)
