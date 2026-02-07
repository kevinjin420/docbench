import:jac from walkers.oauth, GitHubLogin, GetCurrentUser, VerifyToken;
import:jac from walkers.models_variants, ListModels, ListVariants;
import:jac from walkers.files, ListTestFiles, ListStashes;

cl {
    def:pub App() -> any {
        has models: list = [];
        has variants: list = [];
        has user: dict | None = None;
        has api_key: str = "";
        has is_loading: bool = True;
        has test_files: list = [];
        has stashes: list = [];

        async can with entry {
            token: str | None = localStorage.getItem("jwt_token");
            if token {
                result: any = root spawn VerifyToken(token=token);
                if result.reports and result.reports[0].get("valid") {
                    user_result: any = root spawn GetCurrentUser(token=token);
                    if user_result.reports {
                        user = user_result.reports[0];
                    }
                }
            }

            saved_key: str = localStorage.getItem("openRouterApiKey") or "";
            if saved_key {
                api_key = saved_key;
                model_result: any = root spawn ListModels(api_key=saved_key);
                if model_result.reports {
                    models = model_result.reports[0].get("models", []);
                }
            }

            variant_result: any = root spawn ListVariants();
            if variant_result.reports {
                variants = variant_result.reports[0].get("variants", []);
            }

            if user and user.get("is_admin") {
                files_result: any = root spawn ListTestFiles();
                if files_result.reports {
                    test_files = files_result.reports[0].get("files", []);
                }
                stash_result: any = root spawn ListStashes();
                if stash_result.reports {
                    stashes = stash_result.reports[0].get("stashes", []);
                }
            }

            is_loading = False;
        }

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
            return <div class="min-h-screen flex items-center justify-center bg-terminal-bg">
                <div class="text-center">
                    <p class="text-text-secondary">Loading DocBench...</p>
                </div>
            </div>;
        }

        return <div class="min-h-screen flex flex-col bg-terminal-bg text-text-primary">
            <header class="bg-terminal-surface border-b border-terminal-border px-8 py-5">
                <div class="max-w-screen-2xl mx-auto flex justify-between items-center">
                    <a href="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <h1 class="text-text-primary text-xl font-semibold tracking-tight">
                            Jaseci <span class="text-terminal-accent">DocBench</span>
                        </h1>
                    </a>
                    <nav class="flex gap-2 items-center">
                        <a href="/leaderboard" class="btn btn-secondary">Leaderboard</a>
                        <a href="/submit" class="btn btn-secondary">Submit</a>
                        <span class="border-l border-terminal-border mx-2 h-6"></span>
                        {user
                            ? <UserMenuComponent user={user} on_logout={handle_logout} />
                            : <LoginButtonComponent />
                        }
                        <ApiKeyDropdown
                            api_key={api_key}
                            on_change={handle_api_key_change}
                            has_models={len(models) > 0}
                        />
                        {user and user.get("is_admin")
                            ? <AdminDropdown
                                test_files_count={len(test_files)}
                                variants_count={len(variants)}
                              />
                            : <span></span>
                        }
                    </nav>
                </div>
            </header>
            <main class="flex-1 p-8">
                <div class="max-w-screen-2xl mx-auto">
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
        def handle_login() -> None {
            result: any = root spawn GitHubLogin();
            if result.reports {
                window.location.href = result.reports[0].get("authorization_url", "/");
            }
        }

        return <button onClick={lambda e: any -> None { handle_login(); }} class="btn btn-secondary flex items-center gap-2">
            Sign in with GitHub
        </button>;
    }

    def:pub UserMenuComponent(props: dict) -> any {
        has is_open: bool = False;

        return <div class="relative">
            <button
                onClick={lambda e: any -> None { is_open = not is_open; }}
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
                <span class="text-sm text-gray-300 max-w-[120px] truncate">
                    {props["user"].get("name", props["user"].get("email", "User"))}
                </span>
            </button>
            {is_open
                ? <div class="absolute right-0 top-full mt-2 w-56 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <div class="p-3 border-b border-terminal-border">
                        <p class="text-sm font-medium text-gray-200">{props["user"].get("name", "User")}</p>
                        <p class="text-xs text-gray-500">{props["user"].get("email", "")}</p>
                    </div>
                    <div class="py-1">
                        <button
                            onClick={lambda e: any -> None { is_open = False; props["on_logout"](); }}
                            class="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-950 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                  </div>
                : <span></span>
            }
        </div>;
    }

    def:pub ApiKeyDropdown(props: dict) -> any {
        has is_open: bool = False;
        has input_val: str = props.get("api_key", "");

        return <div class="relative">
            <button
                onClick={lambda e: any -> None { is_open = not is_open; }}
                class={"btn btn-icon " + ("btn-success" if props.get("has_models") else "btn-secondary")}
                title="Configure API Key"
            >
                Key
            </button>
            {is_open
                ? <div class="absolute right-0 top-full mt-2 w-80 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <div class="p-3 border-b border-terminal-border">
                        <span class="text-xs text-text-muted uppercase tracking-wide">OpenRouter API Key</span>
                    </div>
                    <div class="p-4 space-y-3">
                        <input
                            type="password"
                            value={input_val}
                            onChange={lambda e: any -> None { input_val = e.target.value; props["on_change"](e.target.value); }}
                            placeholder="sk-or-..."
                            class="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                        />
                        <div class="flex items-center gap-2">
                            {props.get("has_models")
                                ? <span class="text-xs text-green-400">Connected</span>
                                : <span class="text-xs text-text-muted">Not configured</span>
                            }
                        </div>
                        <p class="text-xs text-text-muted">
                            Get your API key from openrouter.ai/keys
                        </p>
                    </div>
                  </div>
                : <span></span>
            }
        </div>;
    }

    def:pub AdminDropdown(props: dict) -> any {
        has is_open: bool = False;

        return <div class="relative">
            <button
                onClick={lambda e: any -> None { is_open = not is_open; }}
                class="btn btn-accent flex items-center gap-2"
            >
                Admin
            </button>
            {is_open
                ? <div class="absolute right-0 top-full mt-2 w-48 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <div class="py-1">
                        <a href="/benchmark" class="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">Benchmark</a>
                        <a href="/files" class="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">
                            Files {props.get("test_files_count", 0) > 0 ? f"({props['test_files_count']})" : ""}
                        </a>
                        <a href="/variants" class="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">
                            Variants {props.get("variants_count", 0) > 0 ? f"({props['variants_count']})" : ""}
                        </a>
                        <a href="/tests" class="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">Tests</a>
                        <a href="/users" class="block px-4 py-2.5 text-sm text-gray-300 hover:bg-zinc-800">Users</a>
                    </div>
                  </div>
                : <span></span>
            }
        </div>;
    }

    def:pub RouterOutlet(props: dict) -> any {
        has current_path: str = window.location.pathname;

        if current_path == "/" or current_path == "" {
            return <HomeView />;
        } elif current_path == "/leaderboard" {
            return <LeaderboardView />;
        } elif current_path == "/submit" {
            return <PublicBenchmarkView api_key={props.get("api_key", "")} />;
        } elif current_path == "/auth/callback" {
            return <AuthCallbackView />;
        } elif current_path == "/benchmark" {
            return <BenchmarkView
                models={props.get("models", [])}
                variants={props.get("variants", [])}
                api_key={props.get("api_key", "")}
            />;
        } elif current_path == "/files" {
            return <FileManagerView
                files={props.get("test_files", [])}
                stashes={props.get("stashes", [])}
            />;
        } elif current_path == "/variants" {
            return <VariantsView variants={props.get("variants", [])} />;
        } elif current_path == "/tests" {
            return <TestsView />;
        } elif current_path == "/users" {
            return <UsersView />;
        } else {
            return <div class="text-center py-20">
                <h2 class="text-2xl text-text-primary">Page Not Found</h2>
            </div>;
        }
    }
}
