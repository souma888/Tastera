"""Schemas for grounded AI phrasing over catalog evidence."""

from pydantic import BaseModel, Field


class ConnectionExplanationInput(BaseModel):
    source_id: str = Field(min_length=1, max_length=100)
    target_id: str = Field(min_length=1, max_length=100)


class ConnectionEvidence(BaseModel):
    kind: str
    label: str
    value: str


class ConnectionExplanation(BaseModel):
    explanation: str
    generated: bool
    evidence: list[ConnectionEvidence]
