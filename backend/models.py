from pydantic import BaseModel
from typing import Optional, Dict

class StudentCreate(BaseModel):
    registration_number: str
    name: str
    birth_year: int

class StudentUpdate(BaseModel):
    registration_number: Optional[str] = None
    name: Optional[str] = None
    birth_year: Optional[int] = None

class CourseCreate(BaseModel):
    code: str
    name: str
    faculty: str

class CourseUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    faculty: Optional[str] = None

class QuizSubmit(BaseModel):
    answers: Dict[str, str]
