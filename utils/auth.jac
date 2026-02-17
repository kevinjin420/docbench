import os;
import time;
import jwt;
import from database { UserService }


glob JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production");
glob JWT_ALGORITHM: str = "HS256";
glob JWT_EXPIRY_HOURS: int = 24 * 7;


obj JWTService {
    static def create_token(user: dict) -> str {
        payload = {
            "sub": str(user["id"]),
            "email": user["email"],
            "name": user.get("name"),
            "github_id": user.get("github_id"),
            "is_admin": user.get("is_admin", False),
            "iat": int(time.time()),
            "exp": int(time.time()) + (JWT_EXPIRY_HOURS * 3600)
        };
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM);
    }

    static def verify_token(token: str) -> dict | None {
        try {
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM]);
            if payload.get("exp", 0) < time.time() {
                return None;
            }
            return payload;
        } except Exception as e {
            print(f"JWT decode error: {type(e).__name__}: {e}");
            return None;
        }
    }

    static def get_user_from_token(token: str) -> dict | None {
        payload = JWTService.verify_token(token);
        if not payload {
            return None;
        }
        user_id = payload.get("sub");
        if not user_id {
            return None;
        }
        return UserService.get_by_id(int(user_id));
    }
}


def extract_bearer_token(auth_header: str) -> str | None {
    if auth_header.startswith("Bearer ") {
        return auth_header[7:];
    }
    return None;
}


def get_user_from_token_str(token: str) -> dict | None {
    if not token {
        return None;
    }
    return JWTService.get_user_from_token(str(token));
}


def get_authenticated_user(token: str) -> dict | None {
    return get_user_from_token_str(token);
}


def require_auth_check(token: str) -> tuple {
    user = get_user_from_token_str(token);
    if not user {
        return (None, {"error": "Authentication required"}, 401);
    }
    return (user, None, None);
}


def require_admin_check(token: str) -> tuple {
    user = get_user_from_token_str(token);
    if not user {
        return (None, {"error": "Authentication required"}, 401);
    }
    if not user.get("is_admin") {
        return (None, {"error": "Admin access required"}, 403);
    }
    return (user, None, None);
}
