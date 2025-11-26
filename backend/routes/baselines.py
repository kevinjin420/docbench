"""API routes for baseline management"""

from flask import jsonify, request
from backend.services.baseline_service import BaselineService


def register_routes(app, socketio=None, running_benchmarks=None):
    """Register baseline-related API routes"""

    @app.route('/api/baselines/establish', methods=['POST'])
    def establish_baseline():
        """
        Establish baseline for model+documentation combination.

        Body:
            {
                "model": "claude-sonnet-4.5",
                "documentation": "mini_v3",
                "temperature": 0.1  // optional, default 0.1
            }

        Returns:
            {
                "baseline_id": 1,
                "baseline_percentage": 62.3,
                "baseline_total_score": 74.76,
                "run_id": "baseline_run_abc123",
                "category_baselines": {...}
            }
        """
        data = request.json
        model = data.get('model')
        doc_variant = data.get('documentation')
        temperature = data.get('temperature', 0.1)

        if not model or not doc_variant:
            return jsonify({'error': 'model and documentation are required'}), 400

        try:
            baseline = BaselineService.establish_baseline(
                model=model,
                doc_variant=doc_variant,
                temperature=temperature
            )
            return jsonify(baseline)
        except Exception as e:
            app.logger.error(f"Failed to establish baseline: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/baselines/list', methods=['GET'])
    def list_baselines():
        """
        List all active baselines.

        Returns:
            {
                "baselines": [
                    {
                        "id": 1,
                        "model": "claude-sonnet-4.5",
                        "documentation_variant": "mini_v3",
                        "baseline_percentage": 62.3,
                        "created_at": 1732483200.0,
                        "baseline_run_id": "baseline_run_abc123"
                    },
                    ...
                ]
            }
        """
        try:
            baselines = BaselineService.list_baselines()
            return jsonify({'baselines': baselines})
        except Exception as e:
            app.logger.error(f"Failed to list baselines: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/baselines/get', methods=['GET'])
    def get_baseline():
        """
        Get baseline for specific model+doc combination.

        Query params:
            model: Model identifier
            documentation: Documentation variant

        Returns:
            {
                "id": 1,
                "baseline_percentage": 62.3,
                "baseline_total_score": 74.76,
                "category_baselines": {...},
                ...
            }
        """
        model = request.args.get('model')
        documentation = request.args.get('documentation')

        if not model or not documentation:
            return jsonify({'error': 'model and documentation query params are required'}), 400

        try:
            baseline = BaselineService.get_active_baseline(model, documentation)

            if not baseline:
                return jsonify({'error': 'No baseline found for this model+documentation combination'}), 404

            return jsonify(baseline)
        except Exception as e:
            app.logger.error(f"Failed to get baseline: {e}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/baselines/apply', methods=['POST'])
    def apply_baseline():
        """
        Manually apply baseline correction to a run.

        Body:
            {
                "run_id": "run_002",
                "model": "claude-sonnet-4.5",
                "documentation": "mini_v3"
            }

        Returns:
            {
                "raw_percentage": 69.4,
                "corrected_percentage": 62.3,
                "learning_bonus": 7.1
            }
        """
        data = request.json
        run_id = data.get('run_id')
        model = data.get('model')
        documentation = data.get('documentation')

        if not run_id or not model or not documentation:
            return jsonify({'error': 'run_id, model, and documentation are required'}), 400

        try:
            result = BaselineService.apply_baseline_correction(run_id, model, documentation)

            if not result:
                return jsonify({'error': 'Correction failed - no baseline or run not found'}), 500

            return jsonify(result)
        except Exception as e:
            app.logger.error(f"Failed to apply baseline correction: {e}")
            return jsonify({'error': str(e)}), 500
