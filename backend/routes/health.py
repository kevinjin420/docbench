"""Health route handlers"""
from flask import jsonify
from sqlalchemy import text
from backend.utils.auth import require_auth
from database import get_db
from database.models import BenchmarkResult, BenchmarkRun, Collection


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
        with get_db() as session:
            deleted_results = session.query(BenchmarkResult).delete()
            deleted_runs = session.query(BenchmarkRun).delete()
            deleted_collections = session.query(Collection).delete()
        return jsonify({'status': 'success'})
