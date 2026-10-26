"""Small, account-backed collections, public share pages, and follows."""
from secrets import token_urlsafe
from uuid import uuid4
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import get_current_account
from app.models.account import AccountFollowRecord, AccountRecord, CollectionItemRecord, CollectionRecord
from app.models.catalog import MediaItemRecord
from app.schemas.media import MediaItem
from app.services.catalog import to_schema

router = APIRouter(tags=["collections and community"])
SessionDep = Annotated[Session, Depends(get_session)]
AccountDep = Annotated[AccountRecord, Depends(get_current_account)]


class CollectionInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    media_ids: list[str] = Field(default_factory=list, max_length=100)
    visibility: Literal["private", "unlisted", "public"] = "private"


class CollectionView(BaseModel):
    id: str
    name: str
    description: str
    visibility: str
    share_slug: str
    items: list[MediaItem]


class CommunityProfileInput(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    public_profile: bool


def _view(session: Session, record: CollectionRecord) -> CollectionView:
    rows = session.execute(
        select(MediaItemRecord).join(CollectionItemRecord, CollectionItemRecord.media_item_id == MediaItemRecord.id)
        .where(CollectionItemRecord.collection_id == record.id).order_by(CollectionItemRecord.position)
    ).scalars().all()
    return CollectionView(id=record.id, name=record.name, description=record.description,
        visibility=record.visibility, share_slug=record.share_slug, items=[to_schema(row) for row in rows])


@router.get("/me/collections", response_model=list[CollectionView])
def list_collections(session: SessionDep, account: AccountDep):
    rows = session.scalars(select(CollectionRecord).where(CollectionRecord.owner_id == account.id).order_by(CollectionRecord.created_at.desc())).all()
    return [_view(session, row) for row in rows]


@router.post("/me/collections", response_model=CollectionView, status_code=201)
def create_collection(payload: CollectionInput, session: SessionDep, account: AccountDep):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Collection name cannot be blank.")
    ids = list(dict.fromkeys(payload.media_ids))
    found = session.scalars(select(MediaItemRecord).where(MediaItemRecord.id.in_(ids))).all() if ids else []
    if len(found) != len(ids):
        raise HTTPException(status_code=422, detail="One or more collection items are not in the catalog.")
    row = CollectionRecord(id=str(uuid4()), owner_id=account.id, name=name, description=payload.description.strip(), visibility=payload.visibility, share_slug=token_urlsafe(18))
    session.add(row)
    session.flush()
    session.add_all(CollectionItemRecord(collection_id=row.id, media_item_id=item_id, position=index) for index, item_id in enumerate(ids))
    session.commit()
    session.refresh(row)
    return _view(session, row)


@router.put("/me/collections/{collection_id}", response_model=CollectionView)
def update_collection(collection_id: str, payload: CollectionInput, session: SessionDep, account: AccountDep):
    row = session.scalar(select(CollectionRecord).where(CollectionRecord.id == collection_id, CollectionRecord.owner_id == account.id))
    if row is None:
        raise HTTPException(status_code=404, detail="Collection not found.")
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Collection name cannot be blank.")
    ids = list(dict.fromkeys(payload.media_ids))
    found = session.scalars(select(MediaItemRecord).where(MediaItemRecord.id.in_(ids))).all() if ids else []
    if len(found) != len(ids):
        raise HTTPException(status_code=422, detail="One or more collection items are not in the catalog.")
    row.name, row.description, row.visibility = name, payload.description.strip(), payload.visibility
    session.query(CollectionItemRecord).filter_by(collection_id=row.id).delete()
    session.add_all(CollectionItemRecord(collection_id=row.id, media_item_id=item_id, position=index) for index, item_id in enumerate(ids))
    session.commit()
    session.refresh(row)
    return _view(session, row)


@router.delete("/me/collections/{collection_id}", status_code=204)
def delete_collection(collection_id: str, session: SessionDep, account: AccountDep):
    row = session.scalar(select(CollectionRecord).where(CollectionRecord.id == collection_id, CollectionRecord.owner_id == account.id))
    if row is not None:
        session.delete(row)
        session.commit()


@router.get("/share/collections/{share_slug}", response_model=CollectionView)
def public_collection(share_slug: str, session: SessionDep):
    row = session.scalar(select(CollectionRecord).where(CollectionRecord.share_slug == share_slug, CollectionRecord.visibility.in_(["public", "unlisted"])))
    if row is None:
        raise HTTPException(status_code=404, detail="Shared collection not found.")
    return _view(session, row)


@router.get("/community/people")
def public_people(session: SessionDep, account: AccountDep, limit: Annotated[int, Query(ge=1, le=50)] = 30):
    rows = session.execute(select(AccountRecord, func.count(AccountFollowRecord.follower_id).label("followers"))
        .outerjoin(AccountFollowRecord, AccountFollowRecord.followed_id == AccountRecord.id)
        .where(AccountRecord.public_profile.is_(True), AccountRecord.id != account.id)
        .group_by(AccountRecord.id).order_by(AccountRecord.display_name, AccountRecord.email).limit(limit)).all()
    followed = set(session.scalars(select(AccountFollowRecord.followed_id).where(AccountFollowRecord.follower_id == account.id)))
    return [{"id": person.id, "display_name": person.display_name or person.email.split("@")[0], "followers": count, "following": person.id in followed} for person, count in rows]


@router.put("/me/community/profile")
def update_community_profile(payload: CommunityProfileInput, session: SessionDep, account: AccountDep):
    account.display_name = payload.display_name.strip()
    account.public_profile = payload.public_profile
    session.commit()
    return {"display_name": account.display_name, "public_profile": account.public_profile}


@router.get("/me/community/profile")
def get_community_profile(account: AccountDep):
    return {"display_name": account.display_name or "", "public_profile": account.public_profile}


@router.put("/community/follows/{person_id}", status_code=204)
def follow_person(person_id: str, session: SessionDep, account: AccountDep):
    person = session.get(AccountRecord, person_id)
    if person is None or person_id == account.id or not person.public_profile:
        raise HTTPException(status_code=404, detail="Public profile not found.")
    if session.get(AccountFollowRecord, (account.id, person_id)) is None:
        session.add(AccountFollowRecord(follower_id=account.id, followed_id=person_id))
        session.commit()


@router.delete("/community/follows/{person_id}", status_code=204)
def unfollow_person(person_id: str, session: SessionDep, account: AccountDep):
    row = session.get(AccountFollowRecord, (account.id, person_id))
    if row is not None:
        session.delete(row)
        session.commit()
