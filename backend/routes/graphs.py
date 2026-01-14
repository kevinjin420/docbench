"""Graph generation route handlers"""
from flask import jsonify, request, Response
import traceback
from backend.services import GraphService
from backend.utils.auth import require_auth
from database import BenchmarkResultService


def get_format_and_mimetype(req):
    """Get format from request and return (format, mimetype)"""
    fmt = req.args.get('format', 'svg').lower()
    if fmt not in ('svg', 'png'):
        fmt = 'svg'
    mimetype = 'image/svg+xml' if fmt == 'svg' else 'image/png'
    return fmt, mimetype


def register_routes(app, socketio=None, running_benchmarks=None):
    """Register graph routes"""

    @app.route('/api/graph/collections', methods=['GET'])
    @require_auth
    def graph_collections():
        """Generate bar chart of all collections"""
        try:
            fmt, mimetype = get_format_and_mimetype(request)
            collections = BenchmarkResultService.get_collections()
            collections_data = []

            for coll in collections:
                name = coll.get('name', '')
                results = BenchmarkResultService.get_collection_results(name)

                if not results:
                    continue

                scores = [r.get('percentage', 0) for r in results if r.get('percentage') is not None]
                avg = sum(scores) / len(scores) if scores else 0
                std_dev = (sum((s - avg) ** 2 for s in scores) / len(scores)) ** 0.5 if len(scores) > 1 else 0

                first = results[0] if results else {}
                model = first.get('model', 'Unknown')
                variant = first.get('variant', '')

                collections_data.append({
                    'name': name,
                    'model': model,
                    'variant': variant,
                    'average_score': avg,
                    'std_dev': std_dev,
                    'count': len(results)
                })

            graph_data = GraphService.collections_bar_chart(collections_data, fmt)
            return Response(graph_data, mimetype=mimetype)

        except Exception as e:
            app.logger.error(f'Error generating collections graph: {str(e)}')
            app.logger.error(traceback.format_exc())
            return jsonify({'error': str(e)}), 500

    @app.route('/api/graph/evaluation', methods=['POST'])
    @require_auth
    def graph_evaluation():
        """Generate chart for evaluation results"""
        try:
            fmt, mimetype = get_format_and_mimetype(request)
            data = request.json
            collection_name = data.get('collection')

            if not collection_name:
                return jsonify({'error': 'collection is required'}), 400

            results = BenchmarkResultService.get_collection_results(collection_name)
            if not results:
                return jsonify({'error': 'Collection not found'}), 404

            runs_data = []
            for r in results:
                runs_data.append({
                    'name': r.get('run_id', ''),
                    'percentage': r.get('percentage', 0)
                })

            first = results[0] if results else {}
            model = first.get('model', 'Unknown')
            variant = first.get('variant', '')
            title = f"{model} - {variant}" if variant else model

            graph_data = GraphService.evaluation_runs_chart(runs_data, title=title, fmt=fmt)
            return Response(graph_data, mimetype=mimetype)

        except Exception as e:
            app.logger.error(f'Error generating evaluation graph: {str(e)}')
            app.logger.error(traceback.format_exc())
            return jsonify({'error': str(e)}), 500

    @app.route('/api/graph/compare', methods=['POST'])
    @require_auth
    def graph_compare():
        """Generate comparison chart between two stashes"""
        try:
            fmt, mimetype = get_format_and_mimetype(request)
            data = request.json
            stash1_name = data.get('stash1')
            stash2_name = data.get('stash2')

            if not stash1_name or not stash2_name:
                return jsonify({'error': 'Both stash1 and stash2 are required'}), 400

            results1 = BenchmarkResultService.get_collection_results(stash1_name)
            results2 = BenchmarkResultService.get_collection_results(stash2_name)

            if not results1 or not results2:
                return jsonify({'error': 'One or both stashes not found'}), 404

            def process_results(results, name):
                scores = [r.get('percentage', 0) for r in results if r.get('percentage') is not None]
                avg = sum(scores) / len(scores) if scores else 0
                std_dev = (sum((s - avg) ** 2 for s in scores) / len(scores)) ** 0.5 if len(scores) > 1 else 0

                category_data = {}
                for result in results:
                    eval_results = result.get('evaluation_results', {})
                    breakdown = eval_results.get('category_breakdown', {})
                    for cat, cat_data in breakdown.items():
                        if cat not in category_data:
                            category_data[cat] = []
                        category_data[cat].append(cat_data.get('percentage', 0))

                category_averages = {cat: sum(vals) / len(vals) for cat, vals in category_data.items()}

                return {
                    'name': name,
                    'average_score': avg,
                    'std_dev': std_dev,
                    'category_averages': category_averages
                }

            stash1 = process_results(results1, stash1_name)
            stash2 = process_results(results2, stash2_name)

            all_categories = sorted(set(stash1['category_averages'].keys()) | set(stash2['category_averages'].keys()))

            graph_data = GraphService.comparison_chart(stash1, stash2, all_categories, fmt)
            return Response(graph_data, mimetype=mimetype)

        except Exception as e:
            app.logger.error(f'Error generating comparison graph: {str(e)}')
            app.logger.error(traceback.format_exc())
            return jsonify({'error': str(e)}), 500
