#!/usr/bin/env python3
"""
Database models and schemas for Jaseci Benchmark

Two separate databases:
1. Public DB (PostgreSQL) - access_tokens, leaderboard_entries, public_test_config
2. Local DB (SQLite) - benchmark_results, benchmark_runs, collections, documentation_variants
"""

import os
from contextlib import contextmanager

from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, JSON, Index, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.pool import QueuePool
from sqlalchemy.dialects.postgresql import JSONB

LocalBase = declarative_base()
PublicBase = declarative_base()


def _get_local_db_url() -> str:
    """Get local database URL"""
    url = os.getenv('LOCAL_DATABASE_URL') or os.getenv('DATABASE_URL')
    if not url:
        db_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(db_dir, 'benchmark.db')
        return f'sqlite:///{db_path}'
    return url


def _get_public_db_url() -> str:
    """Get public database URL"""
    url = os.getenv('PUBLIC_DATABASE_URL') or os.getenv('DATABASE_URL')
    if not url:
        db_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        db_path = os.path.join(db_dir, 'public.db')
        return f'sqlite:///{db_path}'
    return url


def _is_postgres(url: str) -> bool:
    return 'postgresql' in url


def _get_json_type(url: str):
    """Return JSONB for PostgreSQL, JSON for SQLite"""
    if _is_postgres(url):
        return JSONB
    return JSON


# ============================================================================
# LOCAL DATABASE MODELS (SQLite - ephemeral/dev data)
# ============================================================================

class Collection(LocalBase):
    """Collections for grouping benchmark results"""
    __tablename__ = 'collections'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(256), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(Float, nullable=False)

    results = relationship('BenchmarkResult', back_populates='collection_obj')

    __table_args__ = (
        Index('idx_collection_created', created_at.desc()),
    )


class BenchmarkResult(LocalBase):
    """Complete benchmark results with all test responses"""
    __tablename__ = 'benchmark_results'

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(256), unique=True, nullable=False, index=True)

    model = Column(String(256), nullable=False, index=True)
    model_id = Column(String(256), nullable=False)
    variant = Column(String(128), nullable=False, index=True)

    temperature = Column(Float, nullable=False)
    max_tokens = Column(Integer, nullable=False)

    total_tests = Column(Integer, nullable=False)
    batch_size = Column(Integer, nullable=True)
    num_batches = Column(Integer, nullable=True)

    responses = Column(JSON, nullable=False)
    run_metadata = Column(JSON, nullable=True)

    evaluation_results = Column(JSON, nullable=True)
    total_score = Column(Float, nullable=True, index=True)
    max_score = Column(Float, nullable=True)
    percentage = Column(Float, nullable=True, index=True)

    created_at = Column(Float, nullable=False, index=True)
    evaluated_at = Column(Float, nullable=True)

    status = Column(String(32), nullable=False, default='completed', index=True)
    evaluation_status = Column(String(32), nullable=True, default='pending', index=True)

    collection_id = Column(Integer, ForeignKey('collections.id'), nullable=True, index=True)
    collection_obj = relationship('Collection', back_populates='results')

    __table_args__ = (
        Index('idx_model_variant', 'model', 'variant'),
        Index('idx_created_at_desc', created_at.desc()),
        Index('idx_score_desc', total_score.desc()),
    )


class BenchmarkRun(LocalBase):
    """Benchmark run tracking"""
    __tablename__ = 'benchmark_runs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(256), unique=True, nullable=False, index=True)

    model = Column(String(256), nullable=False, index=True)
    model_id = Column(String(256), nullable=False)
    variant = Column(String(128), nullable=False)

    temperature = Column(Float, nullable=False)
    max_tokens = Column(Integer, nullable=False)

    status = Column(String(32), nullable=False, index=True)
    progress = Column(String(512), nullable=True)
    result_id = Column(Integer, nullable=True)

    started_at = Column(Float, nullable=False, index=True)
    completed_at = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    run_metadata = Column(JSON, nullable=True)

    __table_args__ = (
        Index('idx_status_started', 'status', started_at.desc()),
    )


class DocumentationVariant(LocalBase):
    """Documentation variants - just name and URL"""
    __tablename__ = 'documentation_variants'

    id = Column(Integer, primary_key=True, autoincrement=True)
    variant_name = Column(String(128), unique=True, nullable=False, index=True)
    url = Column(String(512), nullable=False)


# ============================================================================
# PUBLIC DATABASE MODELS (PostgreSQL - shared/persistent data)
# ============================================================================

class User(PublicBase):
    """Users authenticated via OAuth"""
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(256), unique=True, nullable=False, index=True)
    name = Column(String(256), nullable=True)
    github_id = Column(String(256), unique=True, nullable=False, index=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(Float, nullable=False)
    last_login_at = Column(Float, nullable=True)

    leaderboard_entries = relationship('LeaderboardEntry', back_populates='user')

    __table_args__ = (
        Index('idx_user_github', 'github_id'),
    )


class AccessToken(PublicBase):
    """Access tokens for authenticated users"""
    __tablename__ = 'access_tokens'

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_hash = Column(String(256), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(Float, nullable=False)
    expires_at = Column(Float, nullable=True)
    last_used_at = Column(Float, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index('idx_token_active', 'is_active', 'token_hash'),
    )


class AdminEmail(PublicBase):
    """Emails that are granted admin access"""
    __tablename__ = 'admin_emails'

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(256), unique=True, nullable=False, index=True)
    added_at = Column(Float, nullable=False)
    added_by = Column(Integer, nullable=True)


class PublicTestConfig(PublicBase):
    """Configuration for which tests are in the public suite"""
    __tablename__ = 'public_test_config'

    id = Column(Integer, primary_key=True, autoincrement=True)
    test_id = Column(String(64), unique=True, nullable=False, index=True)
    is_public = Column(Boolean, nullable=False, default=True)
    added_at = Column(Float, nullable=False)
    added_by = Column(Integer, nullable=True)


class PublicBenchmarkModel(PublicBase):
    """Models configured for public benchmark evaluation"""
    __tablename__ = 'public_benchmark_models'

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(String(256), unique=True, nullable=False, index=True)
    display_name = Column(String(256), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    priority = Column(Integer, nullable=False, default=0)
    added_at = Column(Float, nullable=False)
    added_by = Column(Integer, nullable=True)

    __table_args__ = (
        Index('idx_pbm_active_priority', 'is_active', priority.desc()),
    )


class LeaderboardEntry(PublicBase):
    """Public leaderboard entries for documentation submissions"""
    __tablename__ = 'leaderboard_entries'

    id = Column(Integer, primary_key=True, autoincrement=True)
    documentation_name = Column(String(256), nullable=False)
    documentation_url = Column(String(1024), nullable=False)
    submitter_email = Column(String(256), nullable=True)

    total_score = Column(Float, nullable=False)
    max_score = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False, index=True)

    # Store result data directly (no FK since different databases)
    benchmark_result_id = Column(Integer, nullable=True)
    evaluation_snapshot = Column(JSON, nullable=True)

    model_used = Column(String(256), nullable=False)
    submitted_at = Column(Float, nullable=False, index=True)
    is_visible = Column(Boolean, nullable=False, default=True)

    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    user = relationship('User', back_populates='leaderboard_entries')

    __table_args__ = (
        Index('idx_leaderboard_percentage_desc', percentage.desc()),
        Index('idx_leaderboard_submitted', submitted_at.desc()),
        Index('idx_leaderboard_visible', 'is_visible', percentage.desc()),
    )


# ============================================================================
# DATABASE ENGINES AND SESSIONS
# ============================================================================

def _create_engine(db_url: str):
    """Create engine with appropriate settings"""
    engine_kwargs = {
        'echo': os.getenv('SQL_ECHO', 'false').lower() == 'true'
    }

    if _is_postgres(db_url):
        engine_kwargs.update({
            'poolclass': QueuePool,
            'pool_size': int(os.getenv('DB_POOL_SIZE', '10')),
            'max_overflow': int(os.getenv('DB_MAX_OVERFLOW', '20')),
            'pool_pre_ping': True,
            'pool_recycle': 3600,
        })

    return create_engine(db_url, **engine_kwargs)


# Local database (SQLite)
local_engine = _create_engine(_get_local_db_url())
LocalSession = sessionmaker(autocommit=False, autoflush=False, bind=local_engine)

# Public database (PostgreSQL)
public_engine = _create_engine(_get_public_db_url())
PublicSession = sessionmaker(autocommit=False, autoflush=False, bind=public_engine)

# Legacy aliases
engine = local_engine
SessionLocal = LocalSession


@contextmanager
def get_db() -> Session:
    """Context manager for local database sessions"""
    session = LocalSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def get_public_db() -> Session:
    """Context manager for public database sessions"""
    session = PublicSession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """Initialize both database schemas"""
    try:
        LocalBase.metadata.create_all(bind=local_engine)
        print(f"Local database initialized ({_get_local_db_url()})")
    except Exception as e:
        print(f"Error initializing local database: {e}")
        raise

    try:
        PublicBase.metadata.create_all(bind=public_engine)
        print(f"Public database initialized ({_get_public_db_url()})")
    except Exception as e:
        print(f"Error initializing public database: {e}")
        raise


def init_local_db():
    """Initialize only local database"""
    LocalBase.metadata.create_all(bind=local_engine)
    print(f"Local database initialized ({_get_local_db_url()})")


def init_public_db():
    """Initialize only public database"""
    PublicBase.metadata.create_all(bind=public_engine)
    print(f"Public database initialized ({_get_public_db_url()})")


def drop_all_tables():
    """Drop all tables (use with caution!)"""
    LocalBase.metadata.drop_all(bind=local_engine)
    PublicBase.metadata.drop_all(bind=public_engine)
    print("All tables dropped")


# Initialize databases on module import
if os.getenv('AUTO_INIT_DB', 'true').lower() == 'true':
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Could not auto-initialize database: {e}")
