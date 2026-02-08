import time;
import from models.nodes { UserNode, AdminEmailNode }
import from models.edges { HasUser, HasAdminEmail }
import from services.oauth_service { get_github_authorize_url, exchange_github_code }
import from utils.auth { create_jwt, verify_jwt }
import from env { FRONTEND_URL }

walker GitHubLogin {
    has redirect_uri: str = "";

    obj __specs__ {
        static has methods: list = ["get", "post"];
        static has auth: bool = False;
    }
    can login with `root entry {
        if not self.redirect_uri {
            self.redirect_uri = f"{FRONTEND_URL}/auth/callback";
        }
        (url, state) = get_github_authorize_url(self.redirect_uri);
        report {"authorization_url": url, "state": state};
    }
}

walker GitHubCallback {
    has code: str = "";
    has state: str = "";
    has redirect_uri: str = "";

    obj __specs__ {
        static has methods: list = ["get", "post"];
        static has auth: bool = False;
    }
    can callback with `root entry {
        if not self.code {
            report {"error": "Authorization code required"};
            disengage;
        }
        if not self.redirect_uri {
            self.redirect_uri = f"{FRONTEND_URL}/auth/callback";
        }

        user_info: dict | None = exchange_github_code(self.code, self.redirect_uri, self.state);
        if not user_info {
            report {"error": "Authentication failed"};
            disengage;
        }

        existing_user: UserNode | None = None;
        for unode in [->:HasUser:->(`?UserNode)] {
            if unode.github_id == user_info["github_id"] {
                existing_user = unode;
                break;
            }
        }

        admin_emails: set = set();
        for ae in [->:HasAdminEmail:->(`?AdminEmailNode)] {
            admin_emails.add(ae.email.lower());
        }
        is_admin: bool = user_info.get("email", "").lower() in admin_emails;

        if existing_user {
            existing_user.name = user_info.get("name", existing_user.name);
            existing_user.email = user_info.get("email", existing_user.email);
            existing_user.last_login_at = time.time();
            existing_user.is_admin = is_admin or existing_user.is_admin;
            user_node: UserNode = existing_user;
        } else {
            user_node = (here +>:HasUser:+> UserNode(
                email=user_info.get("email", ""),
                name=user_info.get("name", ""),
                github_id=user_info["github_id"],
                is_admin=is_admin,
                created_at=time.time(),
                last_login_at=time.time()
            ))[0];
        }

        token_data: dict = {
            "id": str(user_node),
            "email": user_node.email,
            "name": user_node.name,
            "github_id": user_node.github_id,
            "is_admin": user_node.is_admin
        };
        jwt_token: str = create_jwt(token_data);

        report {
            "token": jwt_token,
            "user": {
                "id": str(user_node),
                "email": user_node.email,
                "name": user_node.name,
                "is_admin": user_node.is_admin
            }
        };
    }
}

walker GetCurrentUser {
    has token: str = "";

    obj __specs__ {
        static has methods: list = ["get", "post"];
        static has auth: bool = True;
    }
    can fetch with `root entry {
        payload: dict | None = verify_jwt(self.token);
        if not payload {
            report {"error": "Invalid or expired token"};
            disengage;
        }

        user_id: str = payload.get("sub", "");
        for unode in [->:HasUser:->(`?UserNode)] {
            if str(unode) == user_id {
                report {
                    "id": str(unode),
                    "email": unode.email,
                    "name": unode.name,
                    "github_id": unode.github_id,
                    "is_admin": unode.is_admin,
                    "created_at": unode.created_at,
                    "last_login_at": unode.last_login_at
                };
                disengage;
            }
        }
        report {"error": "User not found"};
    }
}

walker VerifyToken {
    has token: str = "";

    obj __specs__ {
        static has methods: list = ["post"];
        static has auth: bool = False;
    }
    can verify with `root entry {
        if not self.token {
            report {"valid": False, "error": "Token required"};
            disengage;
        }
        payload: dict | None = verify_jwt(self.token);
        if payload {
            report {"valid": True, "payload": payload};
        } else {
            report {"valid": False, "error": "Invalid or expired token"};
        }
    }
}
