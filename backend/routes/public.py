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
    PublicBenchmarkModelService,
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
        """Run a benchmark with only public tests on multiple models"""
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'error': 'API key required'}), 401

        data = request.json or {}
        documentation_url = data.get('documentation_url')
        documentation_content = data.get('documentation_content')
        documentation_name = data.get('documentation_name', 'Unnamed Documentation')
        max_tokens = data.get('max_tokens', 16000)

        if not documentation_url and not documentation_content:
            return jsonify({'error': 'documentation_url or documentation_content is required'}), 400

        public_test_ids = PublicTestConfigService.get_public_test_ids()
        if not public_test_ids:
            return jsonify({'error': 'No public tests configured'}), 400

        active_models = PublicBenchmarkModelService.get_active_models()
        if not active_models:
            fallback_model = os.getenv('PUBLIC_BENCHMARK_MODEL', 'anthropic/claude-sonnet-4')
            active_models = [{'model_id': fallback_model, 'display_name': fallback_model.split('/')[-1]}]

        run_id = f"public_{uuid.uuid4().hex[:12]}"
        model_ids = [m['model_id'] for m in active_models]

        def run_in_background():
            try:
                running_benchmarks[run_id] = {
                    'status': 'running',
                    'progress': 'Initializing...',
                    'is_public': True,
                    'models': model_ids,
                    'model_results': {}
                }
                socketio.emit('public_benchmark_update', {
                    'run_id': run_id,
                    'status': 'running',
                    'progress': 'Initializing...',
                    'models': model_ids
                })

                llm_service = LLMService(api_key=api_key)

                BenchmarkRunService.create(
                    run_id=run_id,
                    model=','.join(model_ids),
                    variant='public'
                )

                model_run_ids = []
                model_results = []

                for idx, model_id in enumerate(model_ids):
                    model_num = idx + 1
                    total_models = len(model_ids)

                    def progress_callback(completed, total, message, **kwargs):
                        progress_text = f'Model {model_num}/{total_models}: {message} ({completed}/{total} tests)'
                        running_benchmarks[run_id].update({
                            'progress': progress_text,
                            'completed': completed,
                            'total': total,
                            'current_model': model_id,
                            'current_model_num': model_num
                        })
                        socketio.emit('public_benchmark_update', {
                            'run_id': run_id,
                            'status': 'running',
                            'progress': progress_text,
                            'completed': completed,
                            'total': total,
                            'current_model': model_id,
                            'current_model_num': model_num,
                            'total_models': total_models
                        })

                    try:
                        result = llm_service.run_public_benchmark(
                            model_id=model_id,
                            documentation_url=documentation_url,
                            documentation_content=documentation_content,
                            max_tokens=max_tokens,
                            public_test_ids=public_test_ids,
                            progress_callback=progress_callback
                        )
                        model_run_id = result.get('run_id', f"{run_id}_{model_id.replace('/', '-')}")
                        model_run_ids.append({'model_id': model_id, 'run_id': model_run_id})
                    except Exception as e:
                        app.logger.error(f'Model {model_id} failed: {e}')
                        model_run_ids.append({'model_id': model_id, 'run_id': None, 'error': str(e)})

                socketio.emit('public_benchmark_update', {
                    'run_id': run_id,
                    'status': 'evaluating',
                    'progress': 'Evaluating responses from all models...'
                })

                evaluator = EvaluatorService()
                all_percentages = []
                all_total_scores = []
                max_score = None
                model_evaluations = {}

                for model_run in model_run_ids:
                    if model_run.get('run_id') is None:
                        continue

                    result_data = BenchmarkResultService.get_by_run_id(model_run['run_id'])
                    if not result_data:
                        continue

                    try:
                        BenchmarkResultService.set_evaluation_status(model_run['run_id'], 'evaluating')
                        eval_result = evaluator.evaluate_responses(
                            result_data['responses'],
                            test_ids=public_test_ids
                        )

                        BenchmarkResultService.update_evaluation(
                            run_id=model_run['run_id'],
                            evaluation_results={
                                'category_breakdown': eval_result['evaluation_results'],
                                'level_breakdown': eval_result.get('level_breakdown', {})
                            },
                            total_score=eval_result['total_score'],
                            max_score=eval_result['max_score'],
                            percentage=eval_result['percentage']
                        )

                        all_percentages.append(eval_result['percentage'])
                        all_total_scores.append(eval_result['total_score'])
                        if max_score is None:
                            max_score = eval_result['max_score']

                        model_evaluations[model_run['model_id']] = {
                            'run_id': model_run['run_id'],
                            'percentage': eval_result['percentage'],
                            'total_score': eval_result['total_score'],
                            'max_score': eval_result['max_score']
                        }

                    except Exception as e:
                        app.logger.error(f'Evaluation failed for {model_run["model_id"]}: {e}')
                        BenchmarkResultService.set_evaluation_status(model_run['run_id'], 'failed')

                if not all_percentages:
                    raise RuntimeError("No models completed successfully")

                avg_percentage = sum(all_percentages) / len(all_percentages)
                avg_total_score = sum(all_total_scores) / len(all_total_scores)

                running_benchmarks[run_id] = {
                    'status': 'completed',
                    'result': {
                        'run_id': run_id,
                        'percentage': round(avg_percentage, 2),
                        'total_score': round(avg_total_score, 2),
                        'max_score': max_score,
                        'documentation_name': documentation_name,
                        'documentation_url': documentation_url,
                        'models': model_ids,
                        'model_results': model_evaluations,
                        'models_completed': len(all_percentages),
                        'models_total': len(model_ids)
                    }
                }

                BenchmarkRunService.complete(run_id=run_id, result_id=None)
                socketio.emit('public_benchmark_update', {
                    'run_id': run_id,
                    'status': 'completed',
                    'result': running_benchmarks[run_id]['result']
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
            'test_count': len(public_test_ids),
            'models': model_ids
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

        benchmark_data = running_benchmarks.get(run_id)
        if benchmark_data and benchmark_data.get('status') == 'completed':
            result = benchmark_data.get('result', {})
            percentage = result.get('percentage')
            total_score = result.get('total_score')
            max_score = result.get('max_score')
            models = result.get('models', [])
            model_used = ', '.join(models) if models else 'unknown'
            benchmark_result_id = None
        else:
            db_result = BenchmarkResultService.get_by_run_id(run_id)
            if not db_result:
                return jsonify({'error': 'Benchmark result not found'}), 404

            if db_result.get('percentage') is None:
                return jsonify({'error': 'Benchmark has not been evaluated yet'}), 400

            percentage = db_result['percentage']
            total_score = db_result['total_score']
            max_score = db_result['max_score']
            model_used = db_result['model']
            benchmark_result_id = db_result['id']

        user_id = None
        if g.user_info:
            user_id = g.user_info.get('id')

        entry_id = LeaderboardService.submit(
            documentation_name=documentation_name,
            documentation_url=documentation_url,
            total_score=total_score,
            max_score=max_score,
            percentage=percentage,
            benchmark_result_id=benchmark_result_id,
            model_used=model_used,
            submitter_email=submitter_email,
            user_id=user_id
        )

        rank = LeaderboardService.get_rank_for_percentage(percentage)

        return jsonify({
            'success': True,
            'entry_id': entry_id,
            'rank': rank,
            'percentage': percentage
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
