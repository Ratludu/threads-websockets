import datetime
from typing import Optional
from uuid import UUID
import uuid
from pydantic import BaseModel, Field


class Comment(BaseModel):
    comment_id: UUID = Field(default_factory=uuid.uuid4)
    thread_id: Optional[str] = ""
    author: str
    content: str
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.now)
