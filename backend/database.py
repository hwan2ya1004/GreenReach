"""
GreenReach Database 설정
PostgreSQL + PostGIS 연동
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# 환경변수에서 DB URL 읽기 (없으면 로컬 기본값)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://greenreach:greenreach@localhost:5432/greenreach"
)

# Render PostgreSQL은 postgres:// 로 시작하는 경우가 있어 수정
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI 의존성 주입용 DB 세션"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
