"""
GreenReach DB 모델
PostGIS GEOMETRY 컬럼 포함
"""
from sqlalchemy import Column, String, Float, Boolean, Text, Integer, DateTime
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from .database import Base


class ChatFeedback(Base):
    """AI 챗봇 피드백 테이블 — 사용자 👍/👎 반응을 저장해 모델 진화에 활용"""
    __tablename__ = "chat_feedbacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question = Column(Text, nullable=False)       # 사용자 질문
    answer = Column(Text, nullable=False)          # AI 응답
    intent = Column(String(50))                    # 분류된 의도 (best_district 등)
    confidence = Column(Float)                     # 의도 분류 신뢰도 (0~1)
    rating = Column(Integer, nullable=False)       # 1=👍 좋아요, 0=👎 나빠요
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Park(Base):
    __tablename__ = "parks"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    type = Column(String(50), index=True)
    district = Column(String(50), index=True)
    address = Column(Text)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    area = Column(Float, default=0.0)
    facilities = Column(Text, default="")       # JSON 문자열로 저장
    child_friendly = Column(Boolean, default=False)
    pet_friendly = Column(Boolean, default=False)
    accessible = Column(Boolean, default=False)
    designated_date = Column(String(20))
    manager = Column(String(200))
    phone = Column(String(50))
    data_date = Column(String(20))

    # PostGIS GEOMETRY 컬럼 (POINT, WGS84 = SRID 4326)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
