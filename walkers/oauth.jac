import os;
import from services.oauth_service { OAuthService }
import from database { UserService }
import from utils.auth { extract_bearer_token, JWTService, get_user_from_token_str }


glob FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8000");
glob BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000");


walker :pub GithubLogin {
    obj __specs__ {
        static has methods: list = ["post"];
    }
    can login with Root entry {
        redirect_uri = f"{FRONTEND_URL}/auth/callback";
        (url, state) = OAuthService.get_github_authorize_url(redirect_uri);
        report {"redirect_url": url, "state": state};
    }
}


walker :pub GithubCallback {
    has code: str = "";
    has state: str = "";
    has error: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can callback with Root entry {
        if self.error {
            report {"redirect": f"{FRONTEND_URL}/auth/callback?error={self.error}"};
            disengage;
        }
        if not self.code {
            report {"redirect": f"{FRONTEND_URL}/auth/callback?error=no_code"};
            disengage;
        }

        redirect_uri = f"{FRONTEND_URL}/auth/callback";
        github_user = OAuthService.exchange_github_code(self.code, redirect_uri, self.state);

        if not github_user {
            report {"redirect": f"{FRONTEND_URL}/auth/callback?error=auth_failed"};
            disengage;
        }

        user = UserService.get_or_create(
            email=github_user["email"],
            github_id=github_user["github_id"],
            name=github_user["name"]
        );
        token = JWTService.create_token(user);
        report {"redirect": f"{FRONTEND_URL}/auth/callback?token={token}"};
    }
}


walker :pub GetCurrentUser {
    has auth_token: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can get_me with Root entry {
        if not self.auth_token {
            report {"error": "Not authenticated"};
            disengage;
        }
        payload = JWTService.verify_token(self.auth_token);
        if not payload {
            report {"error": "Not authenticated"};
            disengage;
        }
        user = UserService.get_by_id(payload.get("sub"));
        if not user {
            report {"error": "User not found"};
            disengage;
        }
        report {
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "github_id": user["github_id"],
                "is_admin": user.get("is_admin", False),
                "avatar_url": f"https://avatars.githubusercontent.com/u/{user['github_id']}"
            }
        };
    }
}


walker :pub VerifyToken {
    has auth_token: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
    }
    can verify with Root entry {
        if not self.auth_token {
            report {"valid": False};
            disengage;
        }
        payload = JWTService.verify_token(self.auth_token);
        if not payload {
            report {"valid": False};
            disengage;
        }
        report {"valid": True, "user_id": payload.get("sub")};
    }
}
