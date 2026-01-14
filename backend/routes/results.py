"""
Results-related route handlers
"""
from flask import jsonify, request
import traceback
from backend.services import EvaluatorService
from backend.utils.auth import require_auth
from database import BenchmarkResultService


def register_routes(app, socketio=None, running_benchmarks=None):
    """Register results routes"""

    @app.route('/api/stats', methods=['GET'])
    @require_auth
    def get_stats():
        """Get benchmark statistics"""
        try:
            from backend.services import EvaluatorService

            evaluator = EvaluatorService()
            tests = evaluator.tests

            total_tests = len(tests)
            total_points = sum(t['points'] for t in tests)

            level_stats = {}
            for level in range(1, 11):
                level_tests = [t for t in tests if t['level'] == level]
                level_stats[f'level_{level}'] = {
                    'count': len(level_tests),
                    'points': sum(t['points'] for t in level_tests)
                }

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

    @app.route('/api/compare', methods=['POST'])
    @require_auth
    def compare_stashes():
        """Compare two stash collections"""
        try:
            data = request.json
            stash1 = data.get('stash1')
            stash2 = data.get('stash2')

            if not stash1 or not stash2:
                return jsonify({'error': 'Both stash1 and stash2 are required'}), 400

            results1 = BenchmarkResultService.get_collection_results(stash1)
            results2 = BenchmarkResultService.get_collection_results(stash2)

            if not results1:
                return jsonify({'error': f'Stash not found: {stash1}'}), 404
            if not results2:
                return jsonify({'error': f'Stash not found: {stash2}'}), 404

            def evaluate_collection(results):
                scores = []
                category_data = {}
                filenames = []

                for result in results:
                    filenames.append(result.get('run_id', ''))
                    pct = result.get('percentage')
                    if pct is not None:
                        scores.append(pct)

                    eval_results = result.get('evaluation_results', {})
                    breakdown = eval_results.get('category_breakdown', {})
                    for category, cat_data in breakdown.items():
                        if category not in category_data:
                            category_data[category] = []
                        category_data[category].append(cat_data.get('percentage', 0))

                avg_score = sum(scores) / len(scores) if scores else 0
                std_dev = 0
                if len(scores) >= 2:
                    variance = sum((s - avg_score) ** 2 for s in scores) / len(scores)
                    std_dev = variance ** 0.5
                category_averages = {cat: sum(vals) / len(vals) for cat, vals in category_data.items()}
                return avg_score, std_dev, scores, len(results), category_averages, filenames

            avg1, std1, scores1, count1, cat_avg1, files1 = evaluate_collection(results1)
            avg2, std2, scores2, count2, cat_avg2, files2 = evaluate_collection(results2)

            all_categories = set(cat_avg1.keys()) | set(cat_avg2.keys())

            return jsonify({
                'status': 'success',
                'stash1': {
                    'name': stash1,
                    'average_score': avg1,
                    'std_dev': std1,
                    'scores': scores1,
                    'file_count': count1,
                    'category_averages': cat_avg1,
                    'filenames': files1
                },
                'stash2': {
                    'name': stash2,
                    'average_score': avg2,
                    'std_dev': std2,
                    'scores': scores2,
                    'file_count': count2,
                    'category_averages': cat_avg2,
                    'filenames': files2
                },
                'all_categories': sorted(list(all_categories))
            })
        except Exception as e:
            app.logger.error(f'Error comparing stashes: {str(e)}')
            app.logger.error(traceback.format_exc())
            return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


