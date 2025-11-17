#!/usr/bin/env python3
"""
SQLite database layer for benchmark caching and metadata persistence
"""

import sqlite3
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any, List
from contextlib import contextmanager


DB_PATH = Path('benchmark.db')


@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize database schema"""
    with get_db() as conn:
        cursor = conn.cursor()

        # Cache table for evaluation results
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS evaluation_cache (
                file_path TEXT PRIMARY KEY,
                file_mtime REAL NOT NULL,
                result_json TEXT NOT NULL,
                cached_at REAL NOT NULL
            )
        ''')

        # Benchmark run history
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS benchmark_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT UNIQUE NOT NULL,
                model TEXT NOT NULL,
                model_id TEXT NOT NULL,
                variant TEXT NOT NULL,
                temperature REAL NOT NULL,
                max_tokens INTEGER NOT NULL,
                test_limit INTEGER,
                concurrency INTEGER NOT NULL,
                status TEXT NOT NULL,
                output_file TEXT,
                started_at REAL NOT NULL,
                completed_at REAL,
                error_message TEXT,
                result_json TEXT
            )
        ''')

        # Create indexes
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_runs_started
            ON benchmark_runs(started_at DESC)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_runs_status
            ON benchmark_runs(status)
        ''')

        conn.commit()
        print("Database initialized successfully")


class EvaluationCache:
    """Manages cached evaluation results with automatic invalidation"""

    @staticmethod
    def get(file_path: str) -> Optional[Dict[str, Any]]:
        """Get cached result if valid"""
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return None

        current_mtime = file_path_obj.stat().st_mtime

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT file_mtime, result_json FROM evaluation_cache WHERE file_path = ?',
                (file_path,)
            )
            row = cursor.fetchone()

            if row and row['file_mtime'] == current_mtime:
                return json.loads(row['result_json'])

            # Invalid cache (file modified or not found)
            if row:
                EvaluationCache.invalidate(file_path)

            return None

    @staticmethod
    def set(file_path: str, result: Dict[str, Any]):
        """Cache evaluation result"""
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            return

        current_mtime = file_path_obj.stat().st_mtime
        result_json = json.dumps(result)
        cached_at = time.time()

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO evaluation_cache
                (file_path, file_mtime, result_json, cached_at)
                VALUES (?, ?, ?, ?)
            ''', (file_path, current_mtime, result_json, cached_at))

    @staticmethod
    def invalidate(file_path: str):
        """Remove cached result"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM evaluation_cache WHERE file_path = ?', (file_path,))

    @staticmethod
    def clear_all():
        """Clear entire cache"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM evaluation_cache')

    @staticmethod
    def get_stats() -> Dict[str, Any]:
        """Get cache statistics"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) as count FROM evaluation_cache')
            count = cursor.fetchone()['count']

            cursor.execute('''
                SELECT SUM(LENGTH(result_json)) as total_bytes
                FROM evaluation_cache
            ''')
            total_bytes = cursor.fetchone()['total_bytes'] or 0

            return {
                'cached_files': count,
                'total_size_bytes': total_bytes,
                'total_size_mb': round(total_bytes / (1024 * 1024), 2)
            }


class BenchmarkRunHistory:
    """Manages benchmark run metadata and history"""

    @staticmethod
    def create_run(
        run_id: str,
        model: str,
        model_id: str,
        variant: str,
        temperature: float,
        max_tokens: int,
        test_limit: Optional[int],
        concurrency: int
    ) -> int:
        """Create new benchmark run record"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO benchmark_runs
                (run_id, model, model_id, variant, temperature, max_tokens,
                 test_limit, concurrency, status, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)
            ''', (run_id, model, model_id, variant, temperature, max_tokens,
                  test_limit, concurrency, time.time()))

            return cursor.lastrowid

    @staticmethod
    def update_run(
        run_id: str,
        status: str,
        output_file: Optional[str] = None,
        error_message: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None
    ):
        """Update benchmark run status and results"""
        result_json = json.dumps(result) if result else None
        completed_at = time.time() if status in ['completed', 'failed'] else None

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE benchmark_runs
                SET status = ?, output_file = ?, completed_at = ?,
                    error_message = ?, result_json = ?
                WHERE run_id = ?
            ''', (status, output_file, completed_at, error_message, result_json, run_id))

    @staticmethod
    def get_run(run_id: str) -> Optional[Dict[str, Any]]:
        """Get run metadata"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM benchmark_runs WHERE run_id = ?', (run_id,))
            row = cursor.fetchone()

            if row:
                data = dict(row)
                if data['result_json']:
                    data['result'] = json.loads(data['result_json'])
                    del data['result_json']
                return data

            return None

    @staticmethod
    def get_recent_runs(limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent benchmark runs"""
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, run_id, model, variant, temperature, max_tokens,
                       test_limit, status, output_file, started_at, completed_at
                FROM benchmark_runs
                ORDER BY started_at DESC
                LIMIT ?
            ''', (limit,))

            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_stats() -> Dict[str, Any]:
        """Get run history statistics"""
        with get_db() as conn:
            cursor = conn.cursor()

            cursor.execute('SELECT COUNT(*) as total FROM benchmark_runs')
            total = cursor.fetchone()['total']

            cursor.execute('''
                SELECT status, COUNT(*) as count
                FROM benchmark_runs
                GROUP BY status
            ''')
            by_status = {row['status']: row['count'] for row in cursor.fetchall()}

            cursor.execute('''
                SELECT model, COUNT(*) as count
                FROM benchmark_runs
                GROUP BY model
                ORDER BY count DESC
                LIMIT 5
            ''')
            top_models = [dict(row) for row in cursor.fetchall()]

            return {
                'total_runs': total,
                'by_status': by_status,
                'top_models': top_models
            }


# Initialize database on module import
init_db()
