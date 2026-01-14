"""Model and variant route handlers"""
from flask import jsonify, request
from backend.services import LLMService
from backend.utils.auth import require_auth
from database import DocumentationService


def register_routes(app, socketio=None, running_benchmarks=None):

    @app.route('/api/models', methods=['GET'])
    def get_models():
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({'models': [], 'error': 'API key required'})
        try:
            llm_service = LLMService(api_key=api_key)
            models = llm_service.fetch_available_models()
        except RuntimeError as e:
            return jsonify({'models': [], 'error': str(e)})
        formatted = [
            {
                'id': m.get('id'),
                'name': m.get('name'),
                'context_length': m.get('context_length'),
                'pricing': m.get('pricing'),
                'architecture': m.get('architecture'),
                'top_provider': m.get('top_provider')
            }
            for m in models
        ]
        return jsonify({'models': formatted})

    @app.route('/api/variants', methods=['GET'])
    def get_variants():
        variants = DocumentationService.get_all_variants()
        return jsonify({'variants': variants})

    @app.route('/api/variants', methods=['POST'])
    @require_auth
    def create_variant():
        data = request.get_json()
        variant_name = data.get('variant_name')
        url = data.get('url')

        if not variant_name or not url:
            return jsonify({'error': 'variant_name and url are required'}), 400

        try:
            DocumentationService.create_variant(variant_name, url)
            return jsonify({'success': True, 'message': 'Variant created successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/variants/<variant_name>', methods=['DELETE'])
    @require_auth
    def delete_variant(variant_name):
        try:
            DocumentationService.delete_variant(variant_name)
            return jsonify({'success': True, 'message': 'Variant deleted successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
