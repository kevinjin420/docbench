import from react { useEffect }
import "./styles.css";
sv import from walkers.oauth { GitHubLogin, GetCurrentUser, VerifyToken }
sv import from walkers.models_variants { ListModels, ListVariants }
sv import from walkers.files { ListTestFiles, ListStashes }

import from .views.home { HomeView }
import from .views.leaderboard { LeaderboardView }
import from .views.public_benchmark { PublicBenchmarkView }
import from .views.benchmark { BenchmarkView }
import from .views.file_manager { FileManagerView }
import from .views.variants { VariantsView }
import from .views.tests { TestsView }
import from .views.users { UsersView }
import from .views.auth_callback { AuthCallbackView }

def:pub App() -> any {
    has models: list = [];
    has variants: list = [];
    has user: dict | None = None;
    has api_key: str = "";
    has is_loading: bool = True;
    has test_files: list = [];
    has stashes: list = [];

    async def initApp() -> None {
        try {
            token = localStorage.getItem("jwt_token");
            if token {
                result = root spawn VerifyToken(token=token);
                if result.reports and result.reports[0]["valid"] {
                    user_result = root spawn GetCurrentUser(token=token);
                    if user_result.reports {
                        user = user_result.reports[0];
                    }
                }
            }
        } except Exception as e {}

        try {
            saved_key = localStorage.getItem("openRouterApiKey") or "";
            if saved_key {
                api_key = saved_key;
                model_result = root spawn ListModels(api_key=saved_key);
                if model_result.reports {
                    models = model_result.reports[0]["models"];
                }
            }
        } except Exception as e {}

        try {
            variant_result = root spawn ListVariants();
            if variant_result.reports {
                variants = variant_result.reports[0]["variants"];
            }
        } except Exception as e {}

        try {
            if user and user["is_admin"] {
                files_result = root spawn ListTestFiles();
                if files_result.reports {
                    test_files = files_result.reports[0]["files"];
                }
                stash_result = root spawn ListStashes();
                if stash_result.reports {
                    stashes = stash_result.reports[0]["stashes"];
                }
            }
        } except Exception as e {}

        is_loading = False;
    }

    useEffect(lambda -> None { initApp(); }, []);

    def handle_logout() -> None {
        localStorage.removeItem("jwt_token");
        user = None;
    }

    def handle_api_key_change(key: str) -> None {
        api_key = key;
        if key {
            localStorage.setItem("openRouterApiKey", key);
        } else {
            localStorage.removeItem("openRouterApiKey");
        }
    }

    if is_loading {
        return <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
            <div className="text-center">
                <p className="text-text-secondary">Loading DocBench...</p>
            </div>
        </div>;
    }

    return <div className="min-h-screen flex flex-col bg-terminal-bg text-text-primary">
        <header className="bg-terminal-surface border-b border-terminal-border px-8 py-5">
            <div className="max-w-screen-2xl mx-auto flex justify-between items-center">
                <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <h1 className="text-text-primary text-xl font-semibold tracking-tight">
                        Jaseci <span className="text-terminal-accent">DocBench</span>
                    </h1>
                </a>
                <nav className="flex gap-2 items-center">
                    <a href="/leaderboard" className="btn btn-secondary">Leaderboard</a>
                    <a href="/submit" className="btn btn-secondary">Submit</a>
                    <span className="border-l border-terminal-border mx-2 h-6"></span>
                    {(<UserMenuComponent user={user} on_logout={handle_logout} />) if user else (<LoginButtonComponent />)}
                    <ApiKeyDropdown
                        api_key={api_key}
                        on_change={handle_api_key_change}
                        has_models={models.length > 0}
                    />
                    {(<AdminDropdown
                        test_files_count={test_files.length}
                        variants_count={variants.length}
                      />) if (user and user["is_admin"]) else (<span></span>)}
                </nav>
            </div>
        </header>
        <main className="flex-1 p-8">
            <div className="max-w-screen-2xl mx-auto">
                <RouterOutlet
                    models={models}
                    variants={variants}
                    user={user}
                    api_key={api_key}
                    test_files={test_files}
                    stashes={stashes}
                />
            </div>
        </main>
    </div>;
}

def:pub LoginButtonComponent() -> any {
    async def handle_login() -> None {
        result: any = root spawn GitHubLogin();
        if result.reports {
            window.location.href = result.reports[0]["authorization_url"];
        }
    }

    return <button onClick={lambda e: any -> None { handle_login(); }} className="btn btn-secondary flex items-center gap-2">
        Sign in with GitHub
    </button>;
}

def:pub UserMenuComponent(props: dict) -> any {
    has is_open: bool = False;

    return <div className="relative">
        <button
            onClick={lambda e: any -> None { is_open = not is_open; }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
            <span className="text-sm text-gray-300 max-w-[120px] truncate">
                {props["user"]["name"] or props["user"]["email"] or "User"}
            </span>
        </button>
        {(<div className="absolute right-0 top-full mt-2 w-56 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-terminal-border">
                <p className="text-sm font-medium text-gray-200">{props["user"]["name"] or "User"}</p>
                <p className="text-xs text-gray-500">{props["user"]["email"] or ""}</p>
            </div>
            <div className="py-1">
                <button
                    onClick={lambda e: any -> None { is_open = False; props["on_logout"](); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-950 transition-colors"
                >
                    Sign Out
                </button>
            </div>
          </div>) if is_open else (<span></span>)}
    </div>;
}

def:pub ApiKeyDropdown(props: dict) -> any {
    has is_open: bool = False;
    has input_val: str = props["api_key"] or "";

    return <div className="relative">
        <button
            onClick={lambda e: any -> None { is_open = not is_open; }}
            className={("btn btn-icon btn-success") if props["has_models"] else ("btn btn-icon btn-secondary")}
            title="Configure API Key"
        >
            Key
        </button>
        {(<div className="absolute right-0 top-full mt-2 w-80 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-terminal-border">
                <span className="text-xs text-text-muted uppercase tracking-wide">OpenRouter API Key</span>
            </div>
            <div className="p-4 space-y-3">
                <input
                    type="password"
                    value={input_val}
                    onChange={lambda e: any -> None { input_val = e.target.value; props["on_change"](e.target.value); }}
                    placeholder="sk-or-..."
                    className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                />
                <div className="flex items-center gap-2">
                    {(<span className="text-xs text-green-400">Connected</span>) if props["has_models"] else (<span className="text-xs text-text-muted">Not configured</span>)}
                </div>
                <p className="text-xs text-text-muted">
                    Get your API key from openrouter.ai/keys
                </p>
            </div>
          </div>) if is_open else (<span></span>)}
    </div>;
}

def:pub AdminDropdown(props: dict) -> any {
    has is_open: bool = False;

    return <div className="relative">
        <button
            onClick={lambda e: any -> None { is_open = not is_open; }}
            className="btn btn-accent flex items-center gap-2"
        >
            Admin
        </button>
        {(<div className="absolute right-0 top-full mt-2 w-48 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="py-1">
                <a href="/benchmark" className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">Benchmark</a>
                <a href="/files" className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">
                    {"Files (" + String(props["test_files_count"]) + ")" if props["test_files_count"] > 0 else "Files"}
                </a>
                <a href="/variants" className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">
                    {"Variants (" + String(props["variants_count"]) + ")" if props["variants_count"] > 0 else "Variants"}
                </a>
                <a href="/tests" className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">Tests</a>
                <a href="/users" className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">Users</a>
            </div>
          </div>) if is_open else (<span></span>)}
    </div>;
}

def:pub RouterOutlet(props: dict) -> any {
    has current_path: str = window.location.pathname;

    if current_path == "/" or current_path == "" {
        return <HomeView />;
    } elif current_path == "/leaderboard" {
        return <LeaderboardView />;
    } elif current_path == "/submit" {
        return <PublicBenchmarkView api_key={props["api_key"] or ""} />;
    } elif current_path == "/auth/callback" {
        return <AuthCallbackView />;
    } elif current_path == "/benchmark" {
        return <BenchmarkView
            models={props["models"] or []}
            variants={props["variants"] or []}
            api_key={props["api_key"] or ""}
        />;
    } elif current_path == "/files" {
        return <FileManagerView
            files={props["test_files"] or []}
            stashes={props["stashes"] or []}
        />;
    } elif current_path == "/variants" {
        return <VariantsView variants={props["variants"] or []} />;
    } elif current_path == "/tests" {
        return <TestsView />;
    } elif current_path == "/users" {
        return <UsersView />;
    } else {
        return <div className="text-center py-20">
            <h2 className="text-2xl text-text-primary">Page Not Found</h2>
        </div>;
    }
}
