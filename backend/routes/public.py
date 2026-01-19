"""Public benchmark and leaderboard route handlers"""
import json
import os
import re
import threading
import traceback
import uuid
import requests
from flask import jsonify, request, g
from backend.services import LLMService, EvaluatorService
from backend.utils.rate_limit import rate_limit
from backend.utils.auth import optional_user
from database import (
    BenchmarkResultService,
    BenchmarkRunService,
    PublicTestConfigService,
    LeaderboardService
)


def register_routes(app, socketio, running_benchmarks):

    @app.route('/api/public/tests', methods=['GET'])
    def get_public_tests():
        """Get list of public test IDs and metadata"""
        test_ids = PublicTestConfigService.get_public_test_ids()

        evaluator = EvaluatorService()
        all_tests = evaluator.tests

        public_tests = []
        for test in all_tests:
            if test['id'] in test_ids:
                public_tests.append({
                    'id': test['id'],
                    'level': test.get('level'),
                    'category': test.get('category'),
                    'task': test.get('task'),
                    'points': test.get('points')
                })

        return jsonify({
            'tests': public_tests,
            'count': len(public_tests)
        })

    @app.route('/api/public/validate-url', methods=['POST'])
    def validate_documentation_url():
        """Validate that a documentation URL is reachable"""
        data = request.json or {}
        url = data.get('url', '').strip()

        if not url:
            return jsonify({'valid': False, 'error': 'URL is required'})

        url_pattern = re.compile(
            r'^https?://'
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
            r'localhost|'
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
            r'(?::\d+)?'
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)

        if not url_pattern.match(url):
            return jsonify({'valid': False, 'error': 'Invalid URL format'})

        try:
            response = requests.head(url, timeout=10, allow_redirects=True)
            if response.status_code < 400:
                return jsonify({'valid': True})
            else:
                response = requests.get(url, timeout=10, allow_redirects=True, stream=True)
                if response.status_code < 400:
                    return jsonify({'valid': True})
                return jsonify({
                    'valid': False,
                    'error': f'URL returned status {response.status_code}'
                })
        except requests.exceptions.Timeout:
            return jsonify({'valid': False, 'error': 'URL request timed out'})
        except requests.exceptions.ConnectionError:
            return jsonify({'valid': False, 'error': 'Could not connect to URL'})
        except requests.exceptions.RequestException as e:
            return jsonify({'valid': False, 'error': f'Request failed: {str(e)}'})

    @app.route('/api/public/benchmark', methods=['POST'])
    @rate_limit(max_requests=10, window_seconds=3600)
    def run_public_benchmark():
        """Run a benchmark with only public tests"""
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'error': 'API key required'}), 401

        data = request.json or {}
        model = os.getenv('PUBLIC_BENCHMARK_MODEL', 'anthropic/claude-sonnet-4')
        documentation_url = data.get('documentation_url')
        documentation_content = data.get('documentation_content')
        documentation_name = data.get('documentation_name', 'Unnamed Documentation')
        max_tokens = data.get('max_tokens', 16000)

        if not documentation_url and not documentation_content:
            return jsonify({'error': 'documentation_url or documentation_content is required'}), 400

        public_test_ids = PublicTestConfigService.get_public_test_ids()
        if not public_test_ids:
            return jsonify({'error': 'No public tests configured'}), 400

        run_id = f"public_{uuid.uuid4().hex[:12]}"

        def run_in_background():
            try:
                running_benchmarks[run_id] = {
                    'status': 'running',
                    'progress': 'Initializing...',
                    'is_public': True
                }
                socketio.emit('public_benchmark_update', {
                    'run_id': run_id,
                    'status': 'running',
                    'progress': 'Initializing...'
                })

                llm_service = LLMService(api_key=api_key)

                BenchmarkRunService.create(
                    run_id=run_id,
                    model=model,
                    model_id=model,
                    variant='public',
                    max_tokens=max_tokens
                )

                def progress_callback(completed, total, message, **kwargs):
                    progress_text = f'{message} ({completed}/{total} tests)'
                    running_benchmarks[run_id].update({
                        'progress': progress_text,
                        'completed': completed,
                        'total': total
                    })
                    socketio.emit('public_benchmark_update', {
                        'run_id': run_id,
                        'status': 'running',
                        'progress': progress_text,
                        'completed': completed,
                        'total': total
                    })

                result = llm_service.run_public_benchmark(
                    model_id=model,
                    documentation_url=documentation_url,
                    documentation_content=documentation_content,
                    max_tokens=max_tokens,
                    public_test_ids=public_test_ids,
                    progress_callback=progress_callback
                )

                actual_run_id = result.get('run_id', run_id)

                socketio.emit('public_benchmark_update', {
                    'run_id': run_id,
                    'status': 'evaluating',
                    'progress': 'Evaluating responses...'
                })

                result_data = BenchmarkResultService.get_by_run_id(actual_run_id)

                if result_data:
                    try:
                        BenchmarkResultService.set_evaluation_status(actual_run_id, 'evaluating')
                        evaluator = EvaluatorService()
                        eval_result = evaluator.evaluate_responses(
                            result_data['responses'],
                            test_ids=public_test_ids
                        )

                        BenchmarkResultService.update_evaluation(
                            run_id=actual_run_id,
                            evaluation_results={
                                'category_breakdown': eval_result['evaluation_results'],
                                'level_breakdown': eval_result.get('level_breakdown', {})
                            },
                            total_score=eval_result['total_score'],
                            max_score=eval_result['max_score'],
                            percentage=eval_result['percentage']
                        )

                        running_benchmarks[run_id] = {
                            'status': 'completed',
                            'result': {
                                'run_id': actual_run_id,
                                'percentage': eval_result['percentage'],
                                'total_score': eval_result['total_score'],
                                'max_score': eval_result['max_score'],
                                'documentation_name': documentation_name,
                                'documentation_url': documentation_url,
                                'model': model
                            }
                        }

                        BenchmarkRunService.complete(run_id=actual_run_id, result_id=None)
                        socketio.emit('public_benchmark_update', {
                            'run_id': run_id,
                            'status': 'completed',
                            'result': running_benchmarks[run_id]['result']
                        })

                    except Exception as e:
                        app.logger.error(f'Evaluation failed: {run_id} - {e}')
                        traceback.print_exc()
                        BenchmarkResultService.set_evaluation_status(actual_run_id, 'failed')
                        running_benchmarks[run_id] = {'status': 'failed', 'error': str(e)}
                        socketio.emit('public_benchmark_update', {
                            'run_id': run_id,
                            'status': 'failed',
                            'error': str(e)
                        })

            except Exception as e:
                app.logger.error(f'Public benchmark failed: {run_id} - {e}')
                traceback.print_exc()
                running_benchmarks[run_id] = {'status': 'failed', 'error': str(e)}
                BenchmarkRunService.fail(run_id=run_id, error_message=str(e))
                socketio.emit('public_benchmark_update', {
                    'run_id': run_id,
                    'status': 'failed',
                    'error': str(e)
                })

        threading.Thread(target=run_in_background).start()
        return jsonify({
            'run_id': run_id,
            'status': 'started',
            'test_count': len(public_test_ids)
        })

    @app.route('/api/public/benchmark/<run_id>/status', methods=['GET'])
    def get_public_benchmark_status(run_id):
        """Check status of a public benchmark run"""
        if run_id in running_benchmarks:
            return jsonify(running_benchmarks[run_id])

        result = BenchmarkResultService.get_by_run_id(run_id)
        if result:
            return jsonify({
                'status': 'completed' if result.get('percentage') else 'pending',
                'result': {
                    'run_id': result['run_id'],
                    'percentage': result.get('percentage'),
                    'total_score': result.get('total_score'),
                    'max_score': result.get('max_score')
                }
            })

        return jsonify({'error': 'Benchmark not found'}), 404

    @app.route('/api/public/leaderboard/submit', methods=['POST'])
    @optional_user
    def submit_to_leaderboard():
        """Submit a completed benchmark to the leaderboard"""
        data = request.json or {}
        run_id = data.get('run_id')
        documentation_name = data.get('documentation_name')
        documentation_url = data.get('documentation_url')
        submitter_email = data.get('submitter_email')

        if not run_id:
            return jsonify({'error': 'run_id is required'}), 400
        if not documentation_name:
            return jsonify({'error': 'documentation_name is required'}), 400
        if not documentation_url:
            documentation_url = 'file://uploaded'

        result = BenchmarkResultService.get_by_run_id(run_id)
        if not result:
            return jsonify({'error': 'Benchmark result not found'}), 404

        if result.get('percentage') is None:
            return jsonify({'error': 'Benchmark has not been evaluated yet'}), 400

        user_id = None
        if g.user_info:
            user_id = g.user_info.get('id')

        entry_id = LeaderboardService.submit(
            documentation_name=documentation_name,
            documentation_url=documentation_url,
            total_score=result['total_score'],
            max_score=result['max_score'],
            percentage=result['percentage'],
            benchmark_result_id=result['id'],
            model_used=result['model'],
            submitter_email=submitter_email,
            user_id=user_id
        )

        rank = LeaderboardService.get_rank_for_percentage(result['percentage'])

        return jsonify({
            'success': True,
            'entry_id': entry_id,
            'rank': rank,
            'percentage': result['percentage']
        })

    @app.route('/api/public/leaderboard', methods=['GET'])
    def get_leaderboard():
        """Get the public leaderboard"""
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)

        limit = min(limit, 100)

        entries = LeaderboardService.get_leaderboard(limit=limit, offset=offset)
        total = LeaderboardService.get_total_count()

        return jsonify({
            'entries': entries,
            'total': total,
            'limit': limit,
            'offset': offset
        })

    @app.route('/api/public/leaderboard/<int:entry_id>', methods=['GET'])
    def get_leaderboard_entry(entry_id):
        """Get details of a specific leaderboard entry"""
        entry = LeaderboardService.get_entry_by_id(entry_id)
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404

        return jsonify(entry)
