import:jac from walkers.public, ValidateURL, RunPublicBenchmark, GetPublicBenchmarkStatus, GetPublicTests, SubmitToLeaderboard;

cl {
    def:pub PublicBenchmarkView(props: dict) -> any {
        has doc_url: str = "";
        has doc_name: str = "";
        has url_valid: bool = False;
        has url_error: str = "";
        has is_validating: bool = False;
        has is_running: bool = False;
        has run_id: str = "";
        has progress: str = "";
        has result: dict | None = None;
        has submitted: bool = False;
        has public_tests: list = [];
        has test_count: int = 0;

        async can with entry {
            test_result: any = root spawn GetPublicTests();
            if test_result.reports {
                data: dict = test_result.reports[0];
                public_tests = data.get("tests", []);
                test_count = data.get("count", 0);
            }
        }

        async def validate_url() -> None {
            if not doc_url.strip() {
                url_valid = False;
                url_error = "";
                return;
            }
            is_validating = True;
            vresult: any = root spawn ValidateURL(url=doc_url);
            if vresult.reports {
                data: dict = vresult.reports[0];
                url_valid = data.get("valid", False);
                url_error = data.get("error", "");
            }
            is_validating = False;
        }

        async def run_benchmark() -> None {
            api_key: str = props.get("api_key", "");
            if not api_key {
                url_error = "API key required. Configure it in the header.";
                return;
            }
            is_running = True;
            progress = "Starting benchmark...";

            bm_result: any = root spawn RunPublicBenchmark(
                documentation_url=doc_url,
                documentation_name=doc_name or doc_url,
                api_key=api_key
            );
            if bm_result.reports {
                data: dict = bm_result.reports[0];
                if "error" in data {
                    url_error = data["error"];
                    is_running = False;
                    return;
                }
                run_id = data.get("run_id", "");
                await poll_status();
            }
        }

        async def poll_status() -> None {
            while is_running {
                status_result: any = root spawn GetPublicBenchmarkStatus(run_id=run_id);
                if status_result.reports {
                    data: dict = status_result.reports[0];
                    status: str = data.get("status", "");
                    progress = data.get("progress", "");
                    if status == "completed" {
                        result = data.get("result", {});
                        is_running = False;
                    } elif status == "failed" {
                        url_error = data.get("error", "Benchmark failed");
                        is_running = False;
                    }
                }
                if is_running {
                    await asyncio.sleep(2);
                }
            }
        }

        async def submit_to_leaderboard() -> None {
            if not result or not run_id {
                return;
            }
            sub_result: any = root spawn SubmitToLeaderboard(
                run_id=run_id,
                documentation_name=doc_name or doc_url,
                documentation_url=doc_url
            );
            if sub_result.reports {
                data: dict = sub_result.reports[0];
                if data.get("success") {
                    submitted = True;
                }
            }
        }

        return <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold text-text-primary mb-2">Submit Documentation</h1>
            <p class="text-text-secondary mb-8">
                Benchmark your Jac documentation against {str(test_count)} public tests across multiple LLM models.
            </p>

            <div class="bg-terminal-surface border border-terminal-border rounded-lg p-6 mb-6">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-text-secondary mb-2">Documentation Name</label>
                        <input
                            type="text"
                            value={doc_name}
                            onChange={lambda e: any -> None { doc_name = e.target.value; }}
                            placeholder="My Jac Documentation v1"
                            class="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                            disabled={is_running}
                        />
                    </div>
                    <div>
                        <label class="block text-sm text-text-secondary mb-2">Documentation URL</label>
                        <div class="flex gap-2">
                            <input
                                type="url"
                                value={doc_url}
                                onChange={lambda e: any -> None { doc_url = e.target.value; }}
                                onBlur={lambda e: any -> None { validate_url(); }}
                                placeholder="https://example.com/jac-docs.md"
                                class="flex-1 px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                                disabled={is_running}
                            />
                            <button
                                onClick={lambda e: any -> None { validate_url(); }}
                                disabled={is_validating or is_running}
                                class="btn btn-secondary btn-sm"
                            >
                                {is_validating ? "Checking..." : "Validate"}
                            </button>
                        </div>
                        {url_error
                            ? <p class="text-red-400 text-xs mt-1">{url_error}</p>
                            : url_valid
                            ? <p class="text-green-400 text-xs mt-1">URL is reachable</p>
                            : <span></span>
                        }
                    </div>
                </div>

                <div class="mt-6">
                    {not is_running and not result
                        ? <button
                            onClick={lambda e: any -> None { run_benchmark(); }}
                            disabled={not url_valid or not doc_url}
                            class="btn btn-primary btn-lg btn-block"
                          >
                            Run Benchmark ({str(test_count)} tests)
                          </button>
                        : <span></span>
                    }
                </div>
            </div>

            {is_running
                ? <div class="bg-terminal-surface border border-blue-600/30 rounded-lg p-6 mb-6">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                        <span class="text-blue-400 font-medium">Benchmark Running</span>
                    </div>
                    <p class="text-text-secondary text-sm">{progress}</p>
                  </div>
                : <span></span>
            }

            {result
                ? <div class="bg-terminal-surface border border-green-600/30 rounded-lg p-6 mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-xl font-semibold text-text-primary">Results</h3>
                        <span class="text-3xl font-bold text-terminal-accent font-mono">
                            {f"{result.get('percentage', 0):.1f}%"}
                        </span>
                    </div>
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div class="text-center">
                            <div class="text-lg font-mono text-text-primary">{str(result.get("total_score", 0))}</div>
                            <div class="text-xs text-text-muted">Total Score</div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-mono text-text-primary">{str(result.get("max_score", 0))}</div>
                            <div class="text-xs text-text-muted">Max Score</div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-mono text-text-primary">{str(result.get("models_completed", 0))}/{str(result.get("models_total", 0))}</div>
                            <div class="text-xs text-text-muted">Models</div>
                        </div>
                    </div>
                    {not submitted
                        ? <button
                            onClick={lambda e: any -> None { submit_to_leaderboard(); }}
                            class="btn btn-success-solid btn-block"
                          >
                            Submit to Leaderboard
                          </button>
                        : <div class="text-center py-3 text-green-400 font-medium">
                            Submitted to leaderboard!
                          </div>
                    }
                  </div>
                : <span></span>
            }
        </div>;
    }
}
