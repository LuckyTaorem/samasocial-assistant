from typing import List, Optional, Union
from pydantic import BaseModel, field_validator

class Resource(BaseModel):
    id: Optional[str] = "1"
    title: str
    type: str
    url: str

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v):
        return str(v) if v is not None else "1"

class Lesson(BaseModel):
    id: Optional[str] = "1"
    title: str
    topics: List[str] = []
    difficulty: Optional[str] = "Beginner"
    resources: List[Resource] = []
    assessment: Optional[str] = None

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v):
        return str(v) if v is not None else "1"

    @field_validator("topics", mode="before")
    @classmethod
    def coerce_topics(cls, v):
        if isinstance(v, str):
            return [v]
        return v or []

class Module(BaseModel):
    id: Optional[str] = "1"
    title: str
    learningObjectives: List[str] = []
    prerequisites: Optional[List[str]] = []
    lessons: List[Lesson] = []
    assessment: Optional[str] = "Module assessment to be defined"

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v):
        return str(v) if v is not None else "1"

    @field_validator("learningObjectives", mode="before")
    @classmethod
    def coerce_objectives(cls, v):
        if isinstance(v, str):
            return [v]
        return v or []

    @field_validator("prerequisites", mode="before")
    @classmethod
    def coerce_prereq(cls, v):
        if isinstance(v, str):
            return [v]
        return v or []

class CoursePlan(BaseModel):
    subject: str
    targetAudience: str
    duration: str
    modules: List[Module] = []

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    messages: List[ChatMessage]
    current_plan: Optional[CoursePlan] = None

class AIResponse(BaseModel):
    reply: str
    plan: Optional[CoursePlan] = None