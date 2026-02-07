import time;

glob rate_limit_store: dict = {};

def is_rate_allowed(key: str, max_requests: int, window_seconds: int) -> tuple {
    now: float = time.time();
    if key not in rate_limit_store {
        rate_limit_store[key] = [];
    }
    rate_limit_store[key] = [t for t in rate_limit_store[key] if now - t < window_seconds];
    if len(rate_limit_store[key]) >= max_requests {
        oldest: float = min(rate_limit_store[key]);
        retry_after: int = int(window_seconds - (now - oldest)) + 1;
        return (False, retry_after);
    }
    rate_limit_store[key].append(now);
    return (True, 0);
}

def get_rate_remaining(key: str, max_requests: int, window_seconds: int) -> int {
    now: float = time.time();
    if key not in rate_limit_store {
        return max_requests;
    }
    rate_limit_store[key] = [t for t in rate_limit_store[key] if now - t < window_seconds];
    return max(0, max_requests - len(rate_limit_store[key]));
}
