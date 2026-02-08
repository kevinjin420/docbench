import jwt;
import time;
import from env { JWT_SECRET_KEY }

glob JWT_ALGORITHM: str = "HS256";
glob JWT_EXPIRY_HOURS: int = 168;

def create_jwt(user_data: dict) -> str {
    payload: dict = {
        "sub": str(user_data.get("id", "")),
        "email": user_data.get("email", ""),
        "name": user_data.get("name", ""),
        "github_id": user_data.get("github_id", ""),
        "is_admin": user_data.get("is_admin", False),
        "iat": int(time.time()),
        "exp": int(time.time()) + (JWT_EXPIRY_HOURS * 3600)
    };
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM);
}

def verify_jwt(token: str) -> dict | None {
    try {
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]);
        if payload.get("exp", 0) < time.time() {
            return None;
        }
        return payload;
    } except Exception as e {
        print(f"JWT decode error: {type(e).__name__}: {e}");
        return None;
    }
}

def extract_token_from_header(headers: dict) -> str | None {
    auth_header: str = headers.get("Authorization", "");
    if auth_header.startswith("Bearer ") {
        return auth_header[7:];
    }
    return None;
}
