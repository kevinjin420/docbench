import from react { useEffect }

def:pub AuthCallbackView() -> any {
    has status: str = "Processing login...";

    useEffect(lambda -> None {
        params = URLSearchParams(window.location.search);
        token = params.get("token") or "";
        error = params.get("error") or "";
        return_url = params.get("return_url") or "/";

        if error {
            status = "Login failed: " + error;
        } elif token {
            localStorage.setItem("auth_token", token);
            window.location.href = return_url;
        } else {
            status = "No token received. Please try again.";
        }
    }, []);

    return <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-8 text-center max-w-sm">
            <p className="text-text-primary">{status}</p>
            <a href="/" className="text-terminal-accent text-sm mt-4 inline-block hover:underline">
                Return Home
            </a>
        </div>
    </div>;
}
