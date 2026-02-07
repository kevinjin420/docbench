import:jac from walkers.benchmarks, RunBenchmark, EvaluateResult;

cl {
    def:pub BenchmarkView(props: dict) -> any {
        has selected_model: str = "";
        has selected_variant: str = "";
        has queue_size: int = 1;
        has batch_size: int = 45;
        has is_running: bool = False;
        has run_id: str = "";
        has progress: str = "";
        has completed_runs: list = [];

        async def run_benchmark() -> None {
            api_key: str = props.get("api_key", "");
            if not api_key or not selected_model or not selected_variant {
                return;
            }
            is_running = True;
            progress = "Starting...";

            for i in range(queue_size) {
                result: any = root spawn RunBenchmark(
                    model=selected_model,
                    variant=selected_variant,
                    max_tokens=16000,
                    batch_size=batch_size,
                    api_key=api_key
                );
                if result.reports {
                    data: dict = result.reports[0];
                    run_id = data.get("run_id", "");
                    completed_runs.append(data);
                }
            }
            is_running = False;
            progress = "All runs completed";
        }

        return <div class="max-w-6xl mx-auto">
            <h1 class="text-3xl font-bold text-text-primary mb-6">Benchmark Runner</h1>

            <div class="bg-terminal-surface border border-terminal-border rounded-lg p-6 mb-6">
                <div class="flex gap-4 items-center flex-wrap">
                    <div class="flex items-center gap-2">
                        <label class="text-text-secondary text-sm font-medium uppercase">Model:</label>
                        <select
                            value={selected_model}
                            onChange={lambda e: any -> None { selected_model = e.target.value; }}
                            disabled={is_running}
                            class="px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm min-w-[200px]"
                        >
                            <option value="">Select model...</option>
                            {[<option key={m["id"]} value={m["id"]}>{m.get("name", m["id"])}</option>
                              for m in props.get("models", [])]}
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-text-secondary text-sm font-medium uppercase">Docs:</label>
                        <select
                            value={selected_variant}
                            onChange={lambda e: any -> None { selected_variant = e.target.value; }}
                            disabled={is_running}
                            class="px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm min-w-[150px]"
                        >
                            <option value="">Select variant...</option>
                            {[<option key={v["variant_name"]} value={v["variant_name"]}>{v["variant_name"]}</option>
                              for v in props.get("variants", [])]}
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-text-muted text-sm uppercase">Runs:</label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={str(queue_size)}
                            onChange={lambda e: any -> None { queue_size = int(e.target.value) if e.target.value else 1; }}
                            disabled={is_running}
                            class="w-16 px-2 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm text-center"
                        />
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-text-muted text-sm uppercase">Batch:</label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={str(batch_size)}
                            onChange={lambda e: any -> None { batch_size = int(e.target.value) if e.target.value else 45; }}
                            disabled={is_running}
                            class="w-16 px-2 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm text-center"
                        />
                    </div>
                    <div class="ml-auto">
                        {not is_running
                            ? <button
                                onClick={lambda e: any -> None { run_benchmark(); }}
                                disabled={not selected_model or not selected_variant}
                                class="btn btn-primary"
                              >
                                Run {f"({queue_size})" if queue_size > 1 else ""}
                              </button>
                            : <div class="flex items-center gap-2 text-blue-400">
                                <div class="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                                <span class="text-sm">{progress}</span>
                              </div>
                        }
                    </div>
                </div>
            </div>

            {len(completed_runs) > 0
                ? <div class="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
                    <div class="px-4 py-3 border-b border-terminal-border">
                        <h3 class="text-text-primary font-medium">Completed Runs</h3>
                    </div>
                    {[<div key={str(i)} class="px-4 py-3 border-b border-terminal-border flex items-center justify-between">
                        <div>
                            <span class="text-text-primary text-sm font-mono">{run.get("run_id", "")}</span>
                            <span class="text-text-muted text-xs ml-3">{run.get("status", "")}</span>
                        </div>
                      </div>
                      for (i, run) in enumerate(completed_runs)
                    ]}
                  </div>
                : <div class="bg-terminal-surface border border-terminal-border rounded-lg p-12 text-center">
                    <p class="text-text-muted">No benchmark runs yet. Configure and click Run to start.</p>
                  </div>
            }
        </div>;
    }
}
