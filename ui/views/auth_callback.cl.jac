cl {
    def:pub AuthCallbackView() -> any {
        has status: str = "Processing login...";

        can with entry {
            params: any = URLSearchParams(window.location.search);
            token: str = params.get("token") or "";
            error: str = params.get("error") or "";
            return_url: str = params.get("return_url") or "/";

            if error {
                status = f"Login failed: {error}";
                return;
            }

            if token {
                localStorage.setItem("auth_token", token);
                window.location.href = return_url;
            } else {
                status = "No token received. Please try again.";
            }
        }

        return <div class="flex items-center justify-center min-h-[60vh]">
            <div class="bg-terminal-surface border border-terminal-border rounded-lg p-8 text-center max-w-sm">
                <p class="text-text-primary">{status}</p>
                <a href="/" class="text-terminal-accent text-sm mt-4 inline-block hover:underline">
                    Return Home
                </a>
            </div>
        </div>;
    }
}
