from functools import wraps
from flask import request, jsonify, g
from database import AccessTokenService


def get_admin_token_from_request():
    """Extract admin access token from X-Access-Token header"""
    return request.headers.get('X-Access-Token')


def get_user_token_from_request():
    """Extract user JWT from Authorization header"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None


def require_auth(f):
    """Decorator that requires a valid admin access token (X-Access-Token)"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_admin_token_from_request()
        if not token:
            return jsonify({'error': 'Access token required'}), 401

        token_info = AccessTokenService.validate(token)
        if not token_info:
            return jsonify({'error': 'Invalid or expired token'}), 401

        g.token_info = token_info
        g.user_info = None
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator that requires a valid admin access token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_admin_token_from_request()
        if not token:
            return jsonify({'error': 'Access token required'}), 401

        token_info = AccessTokenService.validate(token)
        if not token_info:
            return jsonify({'error': 'Invalid or expired token'}), 401

        if not token_info.get('is_admin'):
            return jsonify({'error': 'Admin access required'}), 403

        g.token_info = token_info
        g.user_info = None
        return f(*args, **kwargs)
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
        g.token_info = None
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
        g.token_info = None
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    """Decorator that validates admin token if present but doesn't require it"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_admin_token_from_request()
        if token:
            token_info = AccessTokenService.validate(token)
            g.token_info = token_info
        else:
            g.token_info = None
        g.user_info = None
        return f(*args, **kwargs)
    return decorated
