#!/usr/bin/env python3
"""
Flask API server for Jac Benchmark Control Panel
Provides REST endpoints for the benchmark suite
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from pathlib import Path
import json
import threading
import subprocess
import os
from benchmark import (
    JacBenchmark,
    LLMBenchmarkRunner,
    MultiDocEvaluator,
    show_stats,
    stash_test_results,
    clean_test_results,
    compare_directories
)

app = Flask(__name__)
CORS(app, origins='*', resources={r"/*": {"origins": "*"}})
socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    async_mode='threading',
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25
)

TESTS_DIR = Path('tests')
RELEASE_DIR = Path('release')

# Store running benchmarks
running_benchmarks = {}

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Benchmark API is running'})

@app.route('/api/models', methods=['GET'])
def get_models():
    """Get list of available model aliases"""
    try:
        runner = LLMBenchmarkRunner()
        models = [
            {'alias': alias, 'model_id': model_id}
            for alias, model_id in sorted(runner.MODEL_MAPPING.items())
        ]
        return jsonify({'models': models})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/variants', methods=['GET'])
def get_variants():
    """Get list of available documentation variants"""
    try:
        runner = LLMBenchmarkRunner()
        variants = runner.get_available_variants()

        # Get file sizes for each variant
        variant_info = []
        for variant in variants:
            doc_file = runner._find_doc_file(variant)
            if doc_file:
                size = doc_file.stat().st_size
                variant_info.append({
                    'name': variant,
                    'file': str(doc_file.name),
                    'size': size,
                    'size_kb': round(size / 1024, 2)
                })

        return jsonify({'variants': variant_info})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get benchmark statistics"""
    try:
        benchmark = JacBenchmark()
        tests = benchmark.tests

        # Calculate stats
        total_tests = len(tests)
        total_points = sum(t['points'] for t in tests)

        # Level breakdown
        level_stats = {}
        for level in range(1, 11):
            level_tests = [t for t in tests if t['level'] == level]
            level_stats[f'level_{level}'] = {
                'count': len(level_tests),
                'points': sum(t['points'] for t in level_tests)
            }

        # Category breakdown
        category_stats = {}
        for test in tests:
            cat = test['category']
            if cat not in category_stats:
                category_stats[cat] = {'count': 0, 'points': 0}
            category_stats[cat]['count'] += 1
            category_stats[cat]['points'] += test['points']

        return jsonify({
            'total_tests': total_tests,
            'total_points': total_points,
            'levels': level_stats,
            'categories': category_stats
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test-files', methods=['GET'])
def get_test_files():
    """Get list of test result files"""
    try:
        test_files = list(TESTS_DIR.glob('*.txt'))
        files = [
            {
                'name': f.name,
                'path': str(f),
                'size': f.stat().st_size,
                'modified': f.stat().st_mtime
            }
            for f in test_files
        ]
        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stashes', methods=['GET'])
def get_stashes():
    """Get list of stashed test result directories"""
    try:
        excluded_dirs = {'reports', '__pycache__', '.git', '.vscode', 'failed_responses'}
        stash_dirs = [d for d in TESTS_DIR.iterdir() if d.is_dir() and d.name not in excluded_dirs]
        stashes = []

        for stash_dir in sorted(stash_dirs, key=lambda x: x.name, reverse=True):
            files = list(stash_dir.glob('*.txt'))
            stashes.append({
                'name': stash_dir.name,
                'path': str(stash_dir),
                'file_count': len(files),
                'created': stash_dir.stat().st_mtime
            })

        return jsonify({'stashes': stashes})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stash/<stash_name>/files', methods=['GET'])
def get_stash_files(stash_name):
    """Get list of files in a specific stash"""
    try:
        stash_dir = TESTS_DIR / stash_name

        if not stash_dir.exists() or not stash_dir.is_dir():
            return jsonify({'error': 'Stash not found'}), 404

        test_files = list(stash_dir.glob('*.txt'))
        files = [
            {
                'name': f.name,
                'path': str(f),
                'size': f.stat().st_size,
                'modified': f.stat().st_mtime,
                'stash': stash_name
            }
            for f in test_files
        ]

        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stash/<stash_name>', methods=['DELETE'])
def delete_stash(stash_name):
    """Delete an entire stash directory"""
    try:
        import shutil
        stash_dir = TESTS_DIR / stash_name

        if not stash_dir.exists() or not stash_dir.is_dir():
            return jsonify({'error': 'Stash not found'}), 404

        excluded_dirs = {'reports', '__pycache__', '.git', '.vscode', 'failed_responses'}
        if stash_name in excluded_dirs:
            return jsonify({'error': 'Cannot delete system directory'}), 403

        shutil.rmtree(stash_dir)
        return jsonify({'status': 'success', 'message': f'Deleted stash {stash_name}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/evaluate-directory', methods=['POST'])
def evaluate_directory():
    """Evaluate all test files in a specific directory"""
    try:
        data = request.json
        directory = data.get('directory', '')

        if not directory:
            target_dir = TESTS_DIR
        else:
            target_dir = TESTS_DIR / directory

        if not target_dir.exists() or not target_dir.is_dir():
            return jsonify({'error': 'Directory not found'}), 404

        test_files = list(target_dir.glob('*.txt'))

        if not test_files:
            return jsonify({'error': 'No test files found in directory'}), 404

        results = {}
        for test_file in test_files:
            try:
                benchmark = JacBenchmark()
                result = benchmark.run_benchmark(str(test_file))
                results[test_file.name] = result
            except Exception as e:
                print(f"Error evaluating {test_file.name}: {e}")
                results[test_file.name] = {'error': str(e)}

        return jsonify({
            'status': 'success',
            'directory': str(target_dir),
            'files_evaluated': len(results),
            'results': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/benchmark/run', methods=['POST'])
def run_benchmark():
    """Run LLM benchmark with concurrent execution and WebSocket updates"""
    data = request.json
    model = data.get('model')
    variant = data.get('variant')
    temperature = data.get('temperature', 0.1)
    max_tokens = data.get('max_tokens', 16000)
    test_limit = data.get('test_limit')
    concurrency = data.get('concurrency', 10)  # Number of concurrent LLM calls

    if not model or not variant:
        return jsonify({'error': 'model and variant are required'}), 400

    # Generate unique ID for this run
    run_id = f"{model}_{variant}_{int(os.times().elapsed * 1000)}"

    def run_in_background():
        try:
            running_benchmarks[run_id] = {'status': 'running', 'progress': 'Initializing...'}
            socketio.emit('benchmark_update', {
                'run_id': run_id,
                'status': 'running',
                'progress': 'Initializing...'
            })

            runner = LLMBenchmarkRunner()

            # Run with concurrent execution and progress callbacks
            def progress_callback(completed, total, message, batch_num=None, num_batches=None):
                progress_text = f'{message} ({completed}/{total} tests)'
                running_benchmarks[run_id]['progress'] = progress_text

                update_data = {
                    'run_id': run_id,
                    'status': 'running',
                    'progress': progress_text,
                    'completed': completed,
                    'total': total,
                    'tests_completed': completed,
                    'tests_total': total
                }

                if batch_num is not None and num_batches is not None:
                    update_data['batch_num'] = batch_num
                    update_data['num_batches'] = num_batches

                socketio.emit('benchmark_update', update_data)

            result = runner.run_benchmark_concurrent(
                model, variant, temperature, max_tokens,
                test_limit=test_limit,
                concurrency=concurrency,
                progress_callback=progress_callback
            )

            running_benchmarks[run_id] = {
                'status': 'completed',
                'result': result,
                'progress': 'Done'
            }
            socketio.emit('benchmark_update', {
                'run_id': run_id,
                'status': 'completed',
                'result': result
            })
        except Exception as e:
            running_benchmarks[run_id] = {
                'status': 'failed',
                'error': str(e),
                'progress': 'Failed'
            }
            socketio.emit('benchmark_update', {
                'run_id': run_id,
                'status': 'failed',
                'error': str(e)
            })

    thread = threading.Thread(target=run_in_background)
    thread.start()

    return jsonify({'run_id': run_id, 'status': 'started'})

@app.route('/api/benchmark/status/<run_id>', methods=['GET'])
def get_benchmark_status(run_id):
    """Get status of running benchmark"""
    if run_id not in running_benchmarks:
        return jsonify({'error': 'Run ID not found'}), 404

    return jsonify(running_benchmarks[run_id])

@app.route('/api/evaluate', methods=['POST'])
def evaluate():
    """Evaluate a test file"""
    data = request.json
    file_path = data.get('file')

    if not file_path:
        return jsonify({'error': 'file is required'}), 400

    try:
        benchmark = JacBenchmark()
        results = benchmark.run_benchmark(file_path)

        return jsonify({
            'summary': results['summary'],
            'total_tests': len(results['results'])
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/evaluate-all', methods=['POST'])
def evaluate_all():
    """Evaluate all variant test files"""
    try:
        evaluator = MultiDocEvaluator()

        # Find which variants have test files
        found_variants = []
        for variant in evaluator.VARIANTS:
            if evaluator.find_variant_file(variant):
                found_variants.append(variant)

        if not found_variants:
            return jsonify({'error': 'No test files found'}), 404

        results = {}
        for variant in found_variants:
            result = evaluator.run_benchmark(variant)
            if result:
                results[variant] = {
                    'summary': result['summary'],
                    'file_size': evaluator.file_sizes.get(variant, 0)
                }

        return jsonify({'results': results, 'variants': found_variants})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stash', methods=['POST'])
def stash():
    """Stash current test results"""
    try:
        stash_test_results()
        return jsonify({'status': 'success', 'message': 'Test results stashed'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clean', methods=['POST'])
def clean():
    """Clean test result files"""
    try:
        clean_test_results()
        return jsonify({'status': 'success', 'message': 'Test files cleaned'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/delete-file', methods=['POST'])
def delete_file():
    """Delete a specific test file"""
    try:
        data = request.json
        file_path = data.get('file_path')

        if not file_path:
            return jsonify({'error': 'file_path is required'}), 400

        file = Path(file_path)

        if not file.exists():
            return jsonify({'error': 'File not found'}), 404

        if not file.is_relative_to(TESTS_DIR):
            return jsonify({'error': 'Invalid file path'}), 403

        file.unlink()
        return jsonify({'status': 'success', 'message': f'Deleted {file.name}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/env-status', methods=['GET'])
def env_status():
    """Check API key status"""
    keys = {
        'ANTHROPIC_API_KEY': bool(os.getenv('ANTHROPIC_API_KEY')),
        'GEMINI_API_KEY': bool(os.getenv('GEMINI_API_KEY')),
        'OPENAI_API_KEY': bool(os.getenv('OPENAI_API_KEY'))
    }

    return jsonify({'keys': keys})

@app.route('/api/compare', methods=['POST'])
def compare_stashes():
    """Compare two stash directories"""
    try:
        data = request.json
        stash1 = data.get('stash1')
        stash2 = data.get('stash2')

        if not stash1 or not stash2:
            return jsonify({'error': 'Both stash1 and stash2 are required'}), 400

        dir1 = TESTS_DIR / stash1
        dir2 = TESTS_DIR / stash2

        if not dir1.exists() or not dir1.is_dir():
            return jsonify({'error': f'Stash not found: {stash1}'}), 404

        if not dir2.exists() or not dir2.is_dir():
            return jsonify({'error': f'Stash not found: {stash2}'}), 404

        # Evaluate all files in both directories
        def evaluate_directory(directory):
            test_files = list(directory.glob('*.txt'))
            scores = []
            category_data = {}

            for test_file in test_files:
                try:
                    benchmark = JacBenchmark()
                    result = benchmark.run_benchmark(str(test_file))

                    if result and result.get('summary'):
                        summary = result['summary']
                        overall_pct = summary.get('overall_percentage', 0)
                        scores.append(overall_pct)

                        # Collect category scores
                        breakdown = summary.get('category_breakdown', {})
                        for category, cat_data in breakdown.items():
                            if category not in category_data:
                                category_data[category] = []
                            category_data[category].append(cat_data.get('percentage', 0))
                except Exception as e:
                    print(f"Error evaluating {test_file}: {e}")

            avg_score = sum(scores) / len(scores) if scores else 0
            category_averages = {cat: sum(vals) / len(vals) for cat, vals in category_data.items()}

            return avg_score, scores, len(test_files), category_averages

        avg_score_1, scores_1, count_1, category_averages_1 = evaluate_directory(dir1)
        avg_score_2, scores_2, count_2, category_averages_2 = evaluate_directory(dir2)

        all_categories = set(category_averages_1.keys()) | set(category_averages_2.keys())

        # Get filenames for metadata parsing
        files1 = [f.name for f in dir1.glob('*.txt')]
        files2 = [f.name for f in dir2.glob('*.txt')]

        return jsonify({
            'status': 'success',
            'stash1': {
                'name': stash1,
                'average_score': avg_score_1,
                'scores': scores_1,
                'file_count': count_1,
                'category_averages': category_averages_1,
                'filenames': files1
            },
            'stash2': {
                'name': stash2,
                'average_score': avg_score_2,
                'scores': scores_2,
                'file_count': count_2,
                'category_averages': category_averages_2,
                'filenames': files2
            },
            'all_categories': sorted(list(all_categories))
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 80)
    print("JAC BENCHMARK API SERVER")
    print("=" * 80)
    print("Server running at: http://localhost:5000")
    print("API endpoints available at: http://localhost:5000/api/*")
    print("WebSocket support enabled for real-time updates")
    print("=" * 80)
    socketio.run(app, debug=True, port=5000, host='0.0.0.0', allow_unsafe_werkzeug=True)
