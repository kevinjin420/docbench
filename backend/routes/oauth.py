"""OAuth authentication routes"""
import os
from flask import jsonify, redirect, request, session
from backend.services import OAuthService, JWTService
from backend.utils.auth import require_user
from database import UserService


FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5555')


def register_routes(app, socketio, running_benchmarks):

    @app.route('/api/oauth/github/login', methods=['GET'])
    def github_login():
        """Initiate GitHub OAuth flow"""
        redirect_uri = request.url_root.rstrip('/') + '/api/oauth/github/callback'
        url, state = OAuthService.get_github_authorize_url(redirect_uri)
        session['oauth_state'] = state
        return redirect(url)

    @app.route('/api/oauth/github/callback', methods=['GET'])
    def github_callback():
        """Handle GitHub OAuth callback"""
        code = request.args.get('code')
        state = request.args.get('state')
        error = request.args.get('error')

        if error:
            return redirect(f'{FRONTEND_URL}/auth/callback?error={error}')

        if not code:
            return redirect(f'{FRONTEND_URL}/auth/callback?error=no_code')

        redirect_uri = request.url_root.rstrip('/') + '/api/oauth/github/callback'
        github_user = OAuthService.exchange_github_code(code, redirect_uri, state)

        if not github_user:
            return redirect(f'{FRONTEND_URL}/auth/callback?error=auth_failed')

        user = UserService.get_or_create(
            email=github_user['email'],
            github_id=github_user['github_id'],
            name=github_user['name']
        )

        app.logger.info(f"Created/found user: {user}")

        token = JWTService.create_token(user)
        app.logger.info(f"Created token for user {user['id']}")

        return redirect(f'{FRONTEND_URL}/auth/callback?token={token}')

    @app.route('/api/oauth/me', methods=['GET'])
    @require_user
    def get_current_user():
        """Get current authenticated user info"""
        from flask import g
        if not g.user_info:
            return jsonify({'error': 'Not authenticated'}), 401

        return jsonify({
            'user': {
                'id': g.user_info['id'],
                'email': g.user_info['email'],
                'name': g.user_info['name'],
                'github_id': g.user_info['github_id'],
                'is_admin': g.user_info.get('is_admin', False),
                'avatar_url': f"https://avatars.githubusercontent.com/u/{g.user_info['github_id']}"
            }
        })

    @app.route('/api/oauth/verify', methods=['POST'])
    def verify_token():
        """Verify JWT token validity"""
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'valid': False}), 401

        token = auth_header[7:]
        payload = JWTService.verify_token(token)

        if not payload:
            return jsonify({'valid': False}), 401

        return jsonify({'valid': True, 'user_id': payload.get('sub')})
