from pydantic import BaseModel, Field
from uuid import UUID, uuid4


class User(BaseModel):
    user_id: UUID = Field(default_factory=uuid4)
    username: str
    password_hash: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    user_id: UUID
    username: str
