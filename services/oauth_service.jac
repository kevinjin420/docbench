import os;
import requests;
import from authlib.integrations.requests_client { OAuth2Session }
import from database { UserService }


glob GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "");
glob GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "");
glob GITHUB_AUTHORIZE_URL: str = "https://github.com/login/oauth/authorize";
glob GITHUB_TOKEN_URL: str = "https://github.com/login/oauth/access_token";
glob GITHUB_API_URL: str = "https://api.github.com";


obj OAuthService {
    static def get_github_oauth_client(redirect_uri: str) -> any {
        return OAuth2Session(
            client_id=GITHUB_CLIENT_ID,
            client_secret=GITHUB_CLIENT_SECRET,
            redirect_uri=redirect_uri,
            scope="read:user user:email"
        );
    }

    static def get_github_authorize_url(redirect_uri: str) -> tuple {
        client = OAuthService.get_github_oauth_client(redirect_uri);
        (url, state) = client.create_authorization_url(GITHUB_AUTHORIZE_URL);
        return (url, state);
    }

    static def exchange_github_code(
        code: str, redirect_uri: str, state: str | None = None
    ) -> dict | None {
        client = OAuthService.get_github_oauth_client(redirect_uri);
        try {
            token = client.fetch_token(GITHUB_TOKEN_URL, code=code, state=state);
        } except Exception as e {
            print(f"Error fetching GitHub token: {e}");
            return None;
        }
        access_token = token.get("access_token");
        if not access_token {
            return None;
        }
        user_info = OAuthService._fetch_github_user(access_token);
        return user_info;
    }

    static def _fetch_github_user(access_token: str) -> dict | None {
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json"
        };
        try {
            user_resp = requests.get(
                f"{GITHUB_API_URL}/user", headers=headers, timeout=10
            );
            user_resp.raise_for_status();
            user_data = user_resp.json();

            email = user_data.get("email");
            if not email {
                email_resp = requests.get(
                    f"{GITHUB_API_URL}/user/emails", headers=headers, timeout=10
                );
                email_resp.raise_for_status();
                emails = email_resp.json();
                for e in emails {
                    if e.get("primary") and e.get("verified") {
                        email = e.get("email");
                        break;
                    }
                }
                if not email and emails {
                    email = emails[0].get("email");
                }
            }
            return {
                "github_id": str(user_data.get("id")),
                "name": user_data.get("name") or user_data.get("login"),
                "email": (email) if email else f"{user_data.get('id')}@users.noreply.github.com",
                "login": user_data.get("login")
            };
        } except Exception as e {
            print(f"Error fetching GitHub user: {e}");
            return None;
        }
    }
}
