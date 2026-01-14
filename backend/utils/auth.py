from functools import wraps
from flask import request, jsonify, g
from database import AccessTokenService


def get_token_from_request():
    """Extract access token from request header"""
    return request.headers.get('X-Access-Token')


def require_auth(f):
    """Decorator that requires a valid access token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({'error': 'Access token required'}), 401

        token_info = AccessTokenService.validate(token)
        if not token_info:
            return jsonify({'error': 'Invalid or expired token'}), 401

        g.token_info = token_info
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator that requires a valid admin access token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({'error': 'Access token required'}), 401

        token_info = AccessTokenService.validate(token)
        if not token_info:
            return jsonify({'error': 'Invalid or expired token'}), 401

        if not token_info.get('is_admin'):
            return jsonify({'error': 'Admin access required'}), 403

        g.token_info = token_info
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    """Decorator that validates token if present but doesn't require it"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if token:
            token_info = AccessTokenService.validate(token)
            g.token_info = token_info
        else:
            g.token_info = None
        return f(*args, **kwargs)
    return decorated
