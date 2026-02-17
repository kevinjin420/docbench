import time;
import from collections { defaultdict }


obj RateLimiter {
    has requests: dict = {};

    def postinit {
        self.requests = defaultdict(list);
    }

    def is_allowed(key: str, max_requests: int, window_seconds: int) -> tuple {
        now = time.time();
        self.requests[key] = [t for t in self.requests[key] if now - t < window_seconds];
        if len(self.requests[key]) >= max_requests {
            oldest = min(self.requests[key]);
            retry_after = int(window_seconds - (now - oldest)) + 1;
            return (False, retry_after);
        }
        self.requests[key].append(now);
        return (True, 0);
    }

    def get_remaining(key: str, max_requests: int, window_seconds: int) -> int {
        now = time.time();
        self.requests[key] = [t for t in self.requests[key] if now - t < window_seconds];
        return max(0, max_requests - len(self.requests[key]));
    }
}

glob rate_limiter: RateLimiter = RateLimiter();


def check_rate_limit(
    client_ip: str, max_requests: int = 10, window_seconds: int = 3600
) -> tuple {
    (allowed, retry_after) = rate_limiter.is_allowed(client_ip, max_requests, window_seconds);
    if not allowed {
        return (False, {
            "error": "Rate limit exceeded",
            "retry_after": retry_after,
            "message": f"Too many requests. Try again in {retry_after} seconds."
        });
    }
    return (True, None);
}
