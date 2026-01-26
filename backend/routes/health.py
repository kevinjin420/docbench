"""Health route handlers"""
import traceback
from flask import jsonify, request
from sqlalchemy import text
from backend.utils.auth import require_auth
from backend.utils.logger import log_error, log_info
from database import get_db
from database.models import (
    BenchmarkResult, BenchmarkRun, Collection,
    LocalBase, local_engine
)


def register_routes(app, socketio=None, running_benchmarks=None):

    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Health check endpoint for Kubernetes probes"""
        try:
            with get_db() as session:
                session.execute(text("SELECT 1"))
            return jsonify({'status': 'healthy', 'database': 'connected'})
        except Exception as e:
            return jsonify({'status': 'unhealthy', 'error': str(e)}), 503

    @app.route('/api/running', methods=['GET'])
    def get_running():
        if running_benchmarks is None:
            return jsonify({'runs': {}})
        active = {k: v for k, v in running_benchmarks.items() if v.get('status') == 'running'}
        return jsonify({'runs': active})

    @app.route('/api/clear-db', methods=['POST'])
    @require_auth
    def clear_database():
        """Drop and recreate all database tables"""
        data = request.json or {}
        nuke = data.get('nuke', False)

        if nuke:
            try:
                log_info("[NUKE] Dropping local database tables with CASCADE...")
                with local_engine.connect() as conn:
                    # Get all table names in public schema
                    result = conn.execute(text(
                        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
                    ))
                    tables = [row[0] for row in result]
                    log_info(f"[NUKE] Found tables: {tables}")

                    # Drop each table with CASCADE
                    for table in tables:
                        log_info(f"[NUKE] Dropping table: {table}")
                        conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                    conn.commit()

                log_info("[NUKE] Recreating local database tables...")
                LocalBase.metadata.create_all(bind=local_engine)
                log_info("[NUKE] Local database tables recreated successfully")

                return jsonify({
                    'status': 'success',
                    'message': 'Local benchmark tables dropped and recreated'
                })
            except Exception as e:
                log_error(f"[NUKE] Failed to nuke database: {e}")
                traceback.print_exc()
                return jsonify({
                    'status': 'error',
                    'message': str(e)
                }), 500
        else:
            with get_db() as session:
                session.query(BenchmarkResult).delete()
                session.query(BenchmarkRun).delete()
                session.query(Collection).delete()
            return jsonify({'status': 'success', 'message': 'Data cleared'})
