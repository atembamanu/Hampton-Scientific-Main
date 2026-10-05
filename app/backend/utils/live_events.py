"""In-memory live event hub for facility and company-staff dashboards."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Any, Dict, Optional, Set

from utils.permissions import is_company_staff
from utils.app_time import serialize_datetime


class LiveEventHub:
    def __init__(self) -> None:
        self._subscribers: list[tuple[Set[str], asyncio.Queue]] = []
        self._lock = asyncio.Lock()
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    async def subscribe(self, rooms: Set[str]) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.append((set(rooms), queue))
        return queue

    async def unsubscribe(self, queue: asyncio.Queue) -> None:
        async with self._lock:
            self._subscribers = [pair for pair in self._subscribers if pair[1] is not queue]

    def _deliver(self, event: Dict[str, Any], rooms: Set[str]) -> None:
        payload = dict(event)
        payload.setdefault("at", serialize_datetime(datetime.utcnow()))
        for sub_rooms, queue in list(self._subscribers):
            if sub_rooms & rooms:
                try:
                    queue.put_nowait(payload)
                except asyncio.QueueFull:
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                    try:
                        queue.put_nowait(payload)
                    except asyncio.QueueFull:
                        pass

    def publish(self, event: Dict[str, Any], rooms: Set[str]) -> None:
        loop = self.loop
        if loop and loop.is_running():
            loop.call_soon_threadsafe(self._deliver, event, rooms)
        else:
            self._deliver(event, rooms)


hub = LiveEventHub()


def encode_sse(event: Dict[str, Any]) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


def rooms_for_event(
    *,
    organization_id: Optional[str] = None,
    quote_id: Optional[str] = None,
    order_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
    staff_only: bool = False,
) -> Set[str]:
    rooms = {"staff"}
    if staff_only:
        return rooms
    if organization_id:
        rooms.add(f"org:{organization_id}")
    if quote_id:
        rooms.add(f"quote:{quote_id}")
    if order_id:
        rooms.add(f"order:{order_id}")
    if invoice_id:
        rooms.add(f"invoice:{invoice_id}")
    return rooms


def rooms_for_user(user, organization_id: Optional[str] = None) -> Set[str]:
    rooms: Set[str] = set()
    role = getattr(user, "role", None)
    if is_company_staff(role):
        rooms.add("staff")
    if organization_id:
        rooms.add(f"org:{organization_id}")
    return rooms


def publish_entity_event(
    event_type: str,
    *,
    entity_type: str,
    entity_id: str,
    organization_id: Optional[str] = None,
    quote_id: Optional[str] = None,
    order_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
    staff_only: bool = False,
) -> None:
    event = {
        "type": event_type,
        "entityType": entity_type,
        "entityId": entity_id,
        "organizationId": organization_id,
        "quoteId": quote_id,
        "orderId": order_id,
        "invoiceId": invoice_id,
    }
    rooms = rooms_for_event(
        organization_id=organization_id,
        quote_id=quote_id or (entity_id if entity_type == "quote" else None),
        order_id=order_id or (entity_id if entity_type == "order" else None),
        invoice_id=invoice_id or (entity_id if entity_type == "invoice" else None),
        staff_only=staff_only,
    )
    hub.publish(event, rooms)
