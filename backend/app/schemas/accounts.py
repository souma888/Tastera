"""Request and response schemas for accounts and saved items."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.media import MediaItem


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class Account(BaseModel):
    id: str
    email: EmailStr


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    account: Account


class SavedMedia(MediaItem):
    saved_at: datetime


class SavedMediaPage(BaseModel):
    items: list[SavedMedia]
