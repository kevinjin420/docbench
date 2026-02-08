import requests;
import from env { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_AUTHORIZE_URL, GITHUB_TOKEN_URL, GITHUB_API_URL }
import from utils.auth { create_jwt, verify_jwt }
import from utils.logger { log_error }

def get_github_authorize_url(redirect_uri: str) -> tuple {
    import from urllib.parse { urlencode }
    import from secrets { token_urlsafe }

    state: str = token_urlsafe(32);
    params: dict = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email",
        "state": state
    };
    url: str = f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}";
    return (url, state);
}

def exchange_github_code(code: str, redirect_uri: str, state: str | None = None) -> dict | None {
    try {
        token_response: any = requests.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
                "state": state
            },
            headers={"Accept": "application/json"},
            timeout=10
        );
        token_data: dict = token_response.json();
        access_token: str | None = token_data.get("access_token");
        if not access_token {
            log_error(f"No access token in response: {token_data}");
            return None;
        }
        user_info: dict | None = fetch_github_user(access_token);
        return user_info;
    } except Exception as e {
        log_error(f"Error exchanging GitHub code: {e}");
        return None;
    }
}

def fetch_github_user(access_token: str) -> dict | None {
    headers: dict = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json"
    };
    try {
        user_resp: any = requests.get(f"{GITHUB_API_URL}/user", headers=headers, timeout=10);
        user_resp.raise_for_status();
        user_data: dict = user_resp.json();

        email: str | None = user_data.get("email");
        if not email {
            email_resp: any = requests.get(f"{GITHUB_API_URL}/user/emails", headers=headers, timeout=10);
            email_resp.raise_for_status();
            emails: list = email_resp.json();
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
            "email": email or f"{user_data.get('id')}@users.noreply.github.com",
            "login": user_data.get("login")
        };
    } except Exception as e {
        log_error(f"Error fetching GitHub user: {e}");
        return None;
    }
}
