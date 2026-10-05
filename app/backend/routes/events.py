import asyncio

from types import SimpleNamespace
from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db.models import User
from db.session import SessionLocal
from utils.auth import decode_access_token
from utils.live_events import encode_sse, hub, rooms_for_user
from utils.permissions import is_company_staff

router = APIRouter()


def _user_from_token(token: str):
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == payload["sub"]).one_or_none()
        if not user or not user.can_login:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return SimpleNamespace(
            id=user.id,
            role=user.role,
            organization_id=user.organization_id,
            email=user.email,
        )
    finally:
        db.close()


@router.get("/events/stream")
async def stream_live_events(
    request: Request,
    token: str = Query(...),
    quote_id: str | None = Query(default=None),
    order_id: str | None = Query(default=None),
):
    user = _user_from_token(token)
    rooms = rooms_for_user(user, user.organization_id)
    if is_company_staff(user.role):
        rooms.add("staff")
    if quote_id:
        rooms.add(f"quote:{quote_id}")
    if order_id:
        rooms.add(f"order:{order_id}")
    if not rooms:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No live rooms for this user")

    queue = await hub.subscribe(rooms)

    async def generate():
        try:
            yield encode_sse({"type": "connected", "entityType": "session", "entityId": user.id})
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20)
                    yield encode_sse(event)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            await hub.unsubscribe(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
