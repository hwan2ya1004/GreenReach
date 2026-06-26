"""
GreenReach Database 설정
PostgreSQL + PostGIS 연동 (Supabase 호환)
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# 환경변수에서 DB URL 읽기 (없으면 로컬 기본값)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://greenreach:greenreach@localhost:5432/greenreach"
)

# Render / Supabase 모두 postgres:// 로 시작하는 경우가 있어 수정
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Supabase 무료 플랜은 동시 연결 수가 제한적 (최대 ~20개)
# Session Pooler 사용 시 pool_size=2, max_overflow=3 으로 낮게 설정
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=2,
    max_overflow=3,
    connect_args={
        "connect_timeout": 10,
        "sslmode": "require",       # Supabase는 SSL 필수
        "options": "-c statement_timeout=30000",  # 30초 타임아웃
    },
    # Session Pooler 사용 시 prepared statements 비활성화
    execution_options={"no_parameters": False},
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
