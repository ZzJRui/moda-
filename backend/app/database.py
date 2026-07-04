"""SQLAlchemy 数据库引擎与会话管理。"""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app import config

# check_same_thread=False：FastAPI 多线程下共享 SQLite 连接所需
engine = create_engine(
    config.DB_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db() -> None:
    """创建所有表。内部 import models 以确保表已注册到 metadata。"""
    # 确保模型已注册到 Base.metadata（避免调用方忘记 import models）
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖：每请求一个会话，结束自动关闭。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
