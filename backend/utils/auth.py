from functools import wraps
from flask import request, jsonify, g


def get_user_token_from_request():
    """Extract user JWT from Authorization header"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None


def require_auth(f):
    """Decorator that requires valid authentication via JWT"""
    @wraps(f)
    def decorated(*args, **kwargs):
        from backend.services import JWTService

        user_token = get_user_token_from_request()
        if user_token:
            user_info = JWTService.get_user_from_token(user_token)
            if not user_info:
                return jsonify({'error': 'Invalid or expired token'}), 401
            g.user_info = user_info
            return f(*args, **kwargs)

        return jsonify({'error': 'Authentication required'}), 401
    return decorated


def require_admin(f):
    """Decorator that requires admin access via JWT"""
    @wraps(f)
    def decorated(*args, **kwargs):
        from backend.services import JWTService

        user_token = get_user_token_from_request()
        if user_token:
            user_info = JWTService.get_user_from_token(user_token)
            if not user_info:
                return jsonify({'error': 'Invalid or expired token'}), 401
            if not user_info.get('is_admin'):
                return jsonify({'error': 'Admin access required'}), 403
            g.user_info = user_info
            return f(*args, **kwargs)

        return jsonify({'error': 'Authentication required'}), 401
    return decorated


def require_user(f):
    """Decorator that requires a valid user JWT (Authorization: Bearer)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        from backend.services import JWTService
        from flask import current_app
        token = get_user_token_from_request()
        current_app.logger.info(f"require_user: token present = {bool(token)}")
        if not token:
            return jsonify({'error': 'Authorization required'}), 401

        payload = JWTService.verify_token(token)
        current_app.logger.info(f"require_user: payload = {payload}")

        user_info = JWTService.get_user_from_token(token)
        current_app.logger.info(f"require_user: user_info = {user_info}")
        if not user_info:
            return jsonify({'error': 'Invalid or expired token'}), 401

        g.user_info = user_info
        return f(*args, **kwargs)
    return decorated


def optional_user(f):
    """Decorator that validates user JWT if present but doesn't require it"""
    @wraps(f)
    def decorated(*args, **kwargs):
        from backend.services import JWTService
        token = get_user_token_from_request()
        if token:
            user_info = JWTService.get_user_from_token(token)
            g.user_info = user_info
        else:
            g.user_info = None
        return f(*args, **kwargs)
    return decorated
