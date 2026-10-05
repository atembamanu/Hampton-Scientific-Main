from datetime import datetime

from pydantic import BaseModel, field_serializer

from utils.app_time import serialize_datetime


class AppModel(BaseModel):
    """BaseModel whose datetimes are emitted in the company time zone with an offset.

    Pydantic serialises its own datetime fields before FastAPI's encoders run, so
    response models need this hook to match the dict-based endpoints.
    """

    @field_serializer("*", mode="wrap", when_used="json")
    def _serialize_app_datetimes(self, value, handler):
        if isinstance(value, datetime):
            return serialize_datetime(value)
        return handler(value)
