"""Authentication route handlers"""
from flask import jsonify, request
from database import AccessTokenService
from backend.utils.auth import require_auth, require_admin


def register_routes(app, socketio, running_benchmarks):

    @app.route('/api/auth/validate', methods=['POST'])
    @require_auth
    def validate_token():
        """Validate an access token"""
        from flask import g
        return jsonify({
            'valid': True,
            'name': g.token_info.get('name'),
            'is_admin': g.token_info.get('is_admin', False)
        })

    @app.route('/api/admin/tokens', methods=['POST'])
    @require_admin
    def create_token():
        """Create a new access token (admin only)"""
        data = request.json or {}
        name = data.get('name', 'unnamed')
        is_admin = data.get('is_admin', False)
        expires_days = data.get('expires_days')

        plaintext, token_id = AccessTokenService.create(
            name=name,
            is_admin=is_admin,
            expires_days=expires_days
        )

        return jsonify({
            'token': plaintext,
            'id': token_id,
            'message': 'Save this token now. It will not be shown again.'
        })

    @app.route('/api/admin/tokens', methods=['GET'])
    @require_admin
    def list_tokens():
        """List all access tokens (admin only)"""
        tokens = AccessTokenService.list_all()
        return jsonify({'tokens': tokens})

    @app.route('/api/admin/tokens/<int:token_id>', methods=['DELETE'])
    @require_admin
    def revoke_token(token_id):
        """Revoke an access token (admin only)"""
        success = AccessTokenService.revoke(token_id)
        if success:
            return jsonify({'success': True, 'message': 'Token revoked'})
        return jsonify({'error': 'Token not found'}), 404
