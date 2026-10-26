"""Shared auth rate limiter. Memory storage keeps the free deployment self-contained."""

from os import getenv

from slowapi import Limiter
from slowapi.util import get_remote_address


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=getenv("TASTERA_RATE_LIMIT_STORAGE_URI", "memory://"),
    headers_enabled=True,
)
