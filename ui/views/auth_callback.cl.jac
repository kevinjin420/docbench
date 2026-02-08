import from react { useEffect }
sv import from walkers.oauth { GitHubCallback }

def:pub AuthCallbackView() -> any {
    has status: str = "Processing login...";

    async def handleCallback() -> None {
        search = window.location.search or "";
        if not search {
            status = "No parameters received.";
            return;
        }

        token = "";
        code = "";
        state = "";
        error_param = "";
        return_url = "/";

        raw = search.substring(1);
        pairs = raw.split("&");
        i = 0;
        while i < pairs.length {
            kv = pairs[i].split("=");
            key = kv[0];
            val = decodeURIComponent(kv[1] or "");
            if key == "token" { token = val; }
            if key == "code" { code = val; }
            if key == "state" { state = val; }
            if key == "error" { error_param = val; }
            if key == "return_url" { return_url = val; }
            i += 1;
        }

        if error_param {
            status = "Login failed: " + error_param;
            return;
        }

        if token {
            localStorage.setItem("jwt_token", token);
            window.location.href = return_url;
            return;
        }

        if code {
            status = "Exchanging code...";
            try {
                result = root spawn GitHubCallback(code=code, state=state);
                if result.reports and result.reports[0]["token"] {
                    jwt = result.reports[0]["token"];
                    localStorage.setItem("jwt_token", jwt);
                    window.location.href = return_url;
                } else {
                    err_msg = "";
                    if result.reports {
                        err_msg = result.reports[0]["error"] or "Unknown error";
                    } else {
                        err_msg = "No response from server";
                    }
                    status = "Login failed: " + err_msg;
                }
            } except Exception as e {
                status = "Login failed: " + String(e);
            }
            return;
        }

        status = "No token or code received. Please try again.";
    }

    useEffect(lambda -> None { handleCallback(); }, []);

    return <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-8 text-center max-w-sm">
            <p className="text-text-primary">{status}</p>
            <a href="/" className="text-terminal-accent text-sm mt-4 inline-block hover:underline">
                Return Home
            </a>
        </div>
    </div>;
}
