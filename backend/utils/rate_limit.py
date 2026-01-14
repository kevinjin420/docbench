import time
from functools import wraps
from collections import defaultdict
from flask import request, jsonify


class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """Check if request is allowed. Returns (is_allowed, retry_after_seconds)"""
        now = time.time()
        self.requests[key] = [t for t in self.requests[key] if now - t < window_seconds]

        if len(self.requests[key]) >= max_requests:
            oldest = min(self.requests[key])
            retry_after = int(window_seconds - (now - oldest)) + 1
            return False, retry_after

        self.requests[key].append(now)
        return True, 0

    def get_remaining(self, key: str, max_requests: int, window_seconds: int) -> int:
        """Get remaining requests in window"""
        now = time.time()
        self.requests[key] = [t for t in self.requests[key] if now - t < window_seconds]
        return max(0, max_requests - len(self.requests[key]))


rate_limiter = RateLimiter()


def rate_limit(max_requests: int, window_seconds: int, key_func=None):
    """
    Rate limiting decorator.

    Args:
        max_requests: Maximum number of requests allowed in window
        window_seconds: Time window in seconds
        key_func: Optional function to extract rate limit key from request.
                  Defaults to client IP address.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if key_func:
                key = key_func()
            else:
                key = request.headers.get('X-Forwarded-For', request.remote_addr)

            allowed, retry_after = rate_limiter.is_allowed(key, max_requests, window_seconds)

            if not allowed:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': retry_after,
                    'message': f'Too many requests. Try again in {retry_after} seconds.'
                }), 429

            return f(*args, **kwargs)
        return decorated
    return decorator


def get_rate_limit_headers(key: str, max_requests: int, window_seconds: int) -> dict:
    """Get rate limit headers for response"""
    remaining = rate_limiter.get_remaining(key, max_requests, window_seconds)
    return {
        'X-RateLimit-Limit': str(max_requests),
        'X-RateLimit-Remaining': str(remaining),
        'X-RateLimit-Window': str(window_seconds)
    }
