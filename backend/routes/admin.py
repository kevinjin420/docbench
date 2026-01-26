"""Admin route handlers"""
import os
from flask import jsonify, request
from backend.utils.auth import require_admin
from database import (
    PublicTestConfigService,
    PublicBenchmarkModelService,
    LeaderboardService,
    BenchmarkResultService,
    UserService,
    AdminEmailService,
    TestDefinitionService
)
from backend.services import EvaluatorService


def register_routes(app, socketio, running_benchmarks):

    @app.route('/api/admin/public-tests', methods=['GET'])
    @require_admin
    def get_public_tests_config():
        """Get current public test configuration"""
        config = PublicTestConfigService.get_config()
        public_ids = set(PublicTestConfigService.get_public_test_ids())

        evaluator = EvaluatorService()
        all_tests = [
            {
                'id': t['id'],
                'level': t.get('level', 1),
                'category': t.get('category', 'Unknown'),
                'task': t.get('task', ''),
                'points': t.get('points', 0),
                'is_public': t['id'] in public_ids
            }
            for t in evaluator.tests
        ]

        return jsonify({
            'config': config,
            'public_test_ids': list(public_ids),
            'public_count': len(public_ids),
            'total_available': len(all_tests),
            'total_points': sum(t['points'] for t in all_tests),
            'public_points': sum(t['points'] for t in all_tests if t['is_public']),
            'tests': all_tests
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

        user_id = g.user_info.get('id') if hasattr(g, 'user_info') and g.user_info else None
        PublicTestConfigService.set_public_tests(test_ids, added_by=user_id)

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

        user_id = g.user_info.get('id') if hasattr(g, 'user_info') and g.user_info else None
        PublicTestConfigService.add_public_test(test_id, added_by=user_id)

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

    @app.route('/api/admin/benchmark-models', methods=['GET'])
    @require_admin
    def get_benchmark_models():
        """Get all configured benchmark models"""
        models = PublicBenchmarkModelService.get_all_models()
        active_models = [m for m in models if m['is_active']]
        return jsonify({
            'models': models,
            'active_count': len(active_models)
        })

    @app.route('/api/admin/benchmark-models', methods=['POST'])
    @require_admin
    def add_benchmark_model():
        """Add a model to the benchmark configuration"""
        from flask import g

        data = request.json or {}
        model_id = data.get('model_id', '').strip()
        display_name = data.get('display_name', '').strip() or None
        priority = data.get('priority', 0)

        if not model_id:
            return jsonify({'error': 'model_id is required'}), 400

        added_by = None
        if hasattr(g, 'user_info') and g.user_info:
            added_by = g.user_info.get('id')

        result = PublicBenchmarkModelService.add_model(
            model_id=model_id,
            display_name=display_name,
            priority=priority,
            added_by=added_by
        )

        return jsonify({'success': True, 'model': result})

    @app.route('/api/admin/benchmark-models/<int:model_id>', methods=['DELETE'])
    @require_admin
    def remove_benchmark_model(model_id):
        """Remove a model from the configuration"""
        success = PublicBenchmarkModelService.remove_model(model_id)
        if success:
            return jsonify({'success': True, 'message': 'Model removed'})
        return jsonify({'error': 'Model not found'}), 404

    @app.route('/api/admin/benchmark-models/<int:model_id>/active', methods=['POST'])
    @require_admin
    def set_benchmark_model_active(model_id):
        """Set whether a model is active"""
        data = request.json or {}
        is_active = data.get('is_active', True)

        success = PublicBenchmarkModelService.set_active(model_id, is_active)
        if success:
            return jsonify({'success': True, 'is_active': is_active})
        return jsonify({'error': 'Model not found'}), 404

    @app.route('/api/admin/tests', methods=['GET'])
    @require_admin
    def get_test_definitions():
        """Get all test definitions with filters"""
        level = request.args.get('level', type=int)
        category = request.args.get('category')
        test_type = request.args.get('type')
        search = request.args.get('search')
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'

        if search:
            tests = TestDefinitionService.search(search, include_inactive=include_inactive)
        elif level:
            tests = TestDefinitionService.get_by_level(level, include_inactive=include_inactive)
        elif category:
            tests = TestDefinitionService.get_by_category(category, include_inactive=include_inactive)
        else:
            tests = TestDefinitionService.get_all_full(include_inactive=include_inactive)

        if test_type:
            tests = [t for t in tests if t.get('type', 'generate') == test_type]

        return jsonify({
            'tests': tests,
            'total': len(tests)
        })

    @app.route('/api/admin/tests', methods=['POST'])
    @require_admin
    def create_test_definition():
        """Create a new test definition"""
        from flask import g

        data = request.json or {}

        required_fields = ['id', 'level', 'category', 'task', 'required_elements']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        user_id = g.user_info.get('id') if hasattr(g, 'user_info') and g.user_info else None

        try:
            test = TestDefinitionService.create(
                test_id=data['id'],
                level=data['level'],
                category=data['category'],
                task=data['task'],
                required_elements=data['required_elements'],
                points=data.get('points', 10),
                test_type=data.get('type', 'generate'),
                forbidden_elements=data.get('forbidden_elements'),
                broken_code=data.get('broken_code'),
                partial_code=data.get('partial_code'),
                python_code=data.get('python_code'),
                test_harness=data.get('test_harness'),
                error_hint=data.get('error_hint'),
                completion_hint=data.get('completion_hint'),
                created_by=user_id
            )
            return jsonify({'success': True, 'test': test}), 201
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

    @app.route('/api/admin/tests/<test_id>', methods=['GET'])
    @require_admin
    def get_test_definition(test_id):
        """Get a single test definition"""
        test = TestDefinitionService.get_by_test_id(test_id)
        if test:
            return jsonify({'test': test})
        return jsonify({'error': 'Test not found'}), 404

    @app.route('/api/admin/tests/<test_id>', methods=['PUT'])
    @require_admin
    def update_test_definition(test_id):
        """Update a test definition"""
        data = request.json or {}

        update_data = {}
        field_mapping = {
            'level': 'level',
            'category': 'category',
            'task': 'task',
            'required_elements': 'required_elements',
            'points': 'points',
            'type': 'test_type',
            'forbidden_elements': 'forbidden_elements',
            'broken_code': 'broken_code',
            'partial_code': 'partial_code',
            'python_code': 'python_code',
            'test_harness': 'test_harness',
            'error_hint': 'error_hint',
            'completion_hint': 'completion_hint',
            'is_active': 'is_active'
        }

        for json_field, db_field in field_mapping.items():
            if json_field in data:
                update_data[db_field] = data[json_field]

        if not update_data:
            return jsonify({'error': 'No valid fields to update'}), 400

        result = TestDefinitionService.update(test_id, **update_data)
        if result:
            return jsonify({'success': True, 'test': result})
        return jsonify({'error': 'Test not found'}), 404

    @app.route('/api/admin/tests/<test_id>', methods=['DELETE'])
    @require_admin
    def delete_test_definition(test_id):
        """Soft delete a test definition"""
        success = TestDefinitionService.delete(test_id)
        if success:
            return jsonify({'success': True, 'message': 'Test deactivated'})
        return jsonify({'error': 'Test not found'}), 404

    @app.route('/api/admin/tests/<test_id>/restore', methods=['POST'])
    @require_admin
    def restore_test_definition(test_id):
        """Restore a soft-deleted test definition"""
        success = TestDefinitionService.restore(test_id)
        if success:
            return jsonify({'success': True, 'message': 'Test restored'})
        return jsonify({'error': 'Test not found'}), 404

    @app.route('/api/admin/tests/<test_id>/hard-delete', methods=['DELETE'])
    @require_admin
    def hard_delete_test_definition(test_id):
        """Permanently delete a test definition"""
        success = TestDefinitionService.hard_delete(test_id)
        if success:
            return jsonify({'success': True, 'message': 'Test permanently deleted'})
        return jsonify({'error': 'Test not found'}), 404

    @app.route('/api/admin/tests/bulk', methods=['POST'])
    @require_admin
    def bulk_create_tests():
        """Bulk create test definitions"""
        from flask import g

        data = request.json or {}
        tests = data.get('tests', [])

        if not tests:
            return jsonify({'error': 'No tests provided'}), 400

        user_id = g.user_info.get('id') if hasattr(g, 'user_info') and g.user_info else None
        result = TestDefinitionService.bulk_create(tests, created_by=user_id)

        return jsonify({
            'success': True,
            'created': result['created'],
            'updated': result['updated'],
            'errors': result['errors']
        })

    @app.route('/api/admin/tests/export', methods=['GET'])
    @require_admin
    def export_tests():
        """Export all tests in tests.json format"""
        tests = TestDefinitionService.export_all()
        return jsonify(tests)

    @app.route('/api/admin/tests/import', methods=['POST'])
    @require_admin
    def import_tests():
        """Import tests from JSON"""
        from flask import g

        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        if isinstance(data, list):
            tests = data
        elif isinstance(data, dict) and 'tests' in data:
            tests = data['tests']
        else:
            return jsonify({'error': 'Invalid format. Expected array or {tests: [...]}'}), 400

        user_id = g.user_info.get('id') if hasattr(g, 'user_info') and g.user_info else None
        result = TestDefinitionService.bulk_create(tests, created_by=user_id)

        return jsonify({
            'success': True,
            'created': result['created'],
            'updated': result['updated'],
            'errors': result['errors']
        })

    @app.route('/api/admin/tests/stats', methods=['GET'])
    @require_admin
    def get_test_stats():
        """Get test definition statistics"""
        stats = TestDefinitionService.get_stats()
        return jsonify(stats)
