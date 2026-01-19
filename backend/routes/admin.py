"""Admin route handlers"""
import os
from flask import jsonify, request
from backend.utils.auth import require_admin
from database import (
    PublicTestConfigService,
    LeaderboardService,
    BenchmarkResultService,
    UserService,
    AdminEmailService
)
from backend.services import EvaluatorService


def register_routes(app, socketio, running_benchmarks):

    @app.route('/api/admin/public-tests', methods=['GET'])
    @require_admin
    def get_public_tests_config():
        """Get current public test configuration"""
        config = PublicTestConfigService.get_config()
        public_ids = PublicTestConfigService.get_public_test_ids()

        evaluator = EvaluatorService()
        all_test_ids = [t['id'] for t in evaluator.tests]

        return jsonify({
            'config': config,
            'public_test_ids': public_ids,
            'public_count': len(public_ids),
            'total_available': len(all_test_ids),
            'all_test_ids': all_test_ids
        })

    @app.route('/api/admin/public-tests', methods=['POST'])
    @require_admin
    def set_public_tests():
        """Set which tests are in the public suite"""
        from flask import g

        data = request.json or {}
        test_ids = data.get('test_ids', [])

        if not isinstance(test_ids, list):
            return jsonify({'error': 'test_ids must be an array'}), 400

        evaluator = EvaluatorService()
        valid_ids = {t['id'] for t in evaluator.tests}
        invalid_ids = [tid for tid in test_ids if tid not in valid_ids]

        if invalid_ids:
            return jsonify({
                'error': f'Invalid test IDs: {invalid_ids}',
                'valid_ids': list(valid_ids)
            }), 400

        token_id = g.token_info.get('id') if hasattr(g, 'token_info') else None
        PublicTestConfigService.set_public_tests(test_ids, added_by=token_id)

        return jsonify({
            'success': True,
            'public_test_count': len(test_ids),
            'test_ids': test_ids
        })

    @app.route('/api/admin/public-tests/add', methods=['POST'])
    @require_admin
    def add_public_test():
        """Add a single test to the public suite"""
        from flask import g

        data = request.json or {}
        test_id = data.get('test_id')

        if not test_id:
            return jsonify({'error': 'test_id is required'}), 400

        evaluator = EvaluatorService()
        valid_ids = {t['id'] for t in evaluator.tests}

        if test_id not in valid_ids:
            return jsonify({'error': f'Invalid test ID: {test_id}'}), 400

        token_id = g.token_info.get('id') if hasattr(g, 'token_info') else None
        PublicTestConfigService.add_public_test(test_id, added_by=token_id)

        return jsonify({'success': True, 'test_id': test_id})

    @app.route('/api/admin/public-tests/remove', methods=['POST'])
    @require_admin
    def remove_public_test():
        """Remove a test from the public suite"""
        data = request.json or {}
        test_id = data.get('test_id')

        if not test_id:
            return jsonify({'error': 'test_id is required'}), 400

        success = PublicTestConfigService.remove_public_test(test_id)
        return jsonify({'success': success, 'test_id': test_id})

    @app.route('/api/admin/leaderboard/<int:entry_id>', methods=['DELETE'])
    @require_admin
    def hide_leaderboard_entry(entry_id):
        """Hide a leaderboard entry"""
        success = LeaderboardService.hide_entry(entry_id)
        if success:
            return jsonify({'success': True, 'message': 'Entry hidden'})
        return jsonify({'error': 'Entry not found'}), 404

    @app.route('/api/admin/leaderboard/<int:entry_id>/unhide', methods=['POST'])
    @require_admin
    def unhide_leaderboard_entry(entry_id):
        """Unhide a leaderboard entry"""
        success = LeaderboardService.unhide_entry(entry_id)
        if success:
            return jsonify({'success': True, 'message': 'Entry unhidden'})
        return jsonify({'error': 'Entry not found'}), 404

    @app.route('/api/admin/stats', methods=['GET'])
    @require_admin
    def get_admin_stats():
        """Get platform statistics"""
        benchmark_stats = BenchmarkResultService.get_stats()
        leaderboard_count = LeaderboardService.get_total_count()
        public_test_count = len(PublicTestConfigService.get_public_test_ids())

        return jsonify({
            'benchmarks': benchmark_stats,
            'leaderboard_entries': leaderboard_count,
            'public_tests_configured': public_test_count
        })

    @app.route('/api/admin/users', methods=['GET'])
    @require_admin
    def list_users():
        """List all users"""
        users = UserService.list_all(limit=500)
        admin_emails = os.getenv('ADMIN_EMAILS', '')
        admin_email_list = [e.strip().lower() for e in admin_emails.split(',') if e.strip()]

        return jsonify({
            'users': users,
            'admin_emails_env': admin_email_list
        })

    @app.route('/api/admin/users/<int:user_id>/admin', methods=['POST'])
    @require_admin
    def set_user_admin(user_id):
        """Set user admin status"""
        data = request.json or {}
        is_admin = data.get('is_admin', False)

        success = UserService.set_admin(user_id, is_admin)
        if success:
            return jsonify({'success': True, 'user_id': user_id, 'is_admin': is_admin})
        return jsonify({'error': 'User not found'}), 404

    @app.route('/api/admin/admin-emails', methods=['GET'])
    @require_admin
    def list_admin_emails():
        """List all admin emails from database"""
        emails = AdminEmailService.list_all()
        admin_emails_env = os.getenv('ADMIN_EMAILS', '')
        env_list = [e.strip().lower() for e in admin_emails_env.split(',') if e.strip()]
        return jsonify({
            'emails': emails,
            'env_emails': env_list
        })

    @app.route('/api/admin/admin-emails', methods=['POST'])
    @require_admin
    def add_admin_email():
        """Add an admin email"""
        from flask import g

        data = request.json or {}
        email = data.get('email', '').strip()

        if not email:
            return jsonify({'error': 'email is required'}), 400

        added_by = None
        if hasattr(g, 'user_info') and g.user_info:
            added_by = g.user_info.get('id')
        elif hasattr(g, 'token_info') and g.token_info:
            added_by = g.token_info.get('id')

        result = AdminEmailService.add(email, added_by=added_by)

        if result.get('already_exists'):
            return jsonify({'success': True, 'email': result, 'message': 'Email already exists'})

        return jsonify({'success': True, 'email': result})

    @app.route('/api/admin/admin-emails/<int:email_id>', methods=['DELETE'])
    @require_admin
    def remove_admin_email(email_id):
        """Remove an admin email by ID"""
        success = AdminEmailService.remove_by_id(email_id)
        if success:
            return jsonify({'success': True, 'message': 'Email removed'})
        return jsonify({'error': 'Email not found'}), 404
