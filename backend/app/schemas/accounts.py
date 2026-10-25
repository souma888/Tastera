"""Request and response schemas for accounts and saved items."""

from datetime import datetime

from typing import Literal

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
    status: Literal["planned", "in_progress", "finished"]
    rating: int | None = Field(default=None, ge=1, le=5)
    note: str | None = None
    progress_percent: int | None = Field(default=None, ge=0, le=100)
    updated_at: datetime


class SavedMediaPage(BaseModel):
    items: list[SavedMedia]


class SavedMediaUpdate(BaseModel):
    status: Literal["planned", "in_progress", "finished"] | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    note: str | None = Field(default=None, max_length=2000)
    progress_percent: int | None = Field(default=None, ge=0, le=100)


class LibraryActivity(BaseModel):
    id: int
    media_id: str
    title: str
    category: str
    event_type: str
    value: str | None
    created_at: datetime


class LibraryActivityPage(BaseModel):
    items: list[LibraryActivity]
