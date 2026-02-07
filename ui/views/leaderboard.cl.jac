import:jac from walkers.public, GetLeaderboard;

cl {
    def:pub LeaderboardView() -> any {
        has entries: list = [];
        has total: int = 0;
        has is_loading: bool = True;
        has current_page: int = 0;
        has page_size: int = 25;

        async can with entry {
            await fetch_entries();
        }

        async def fetch_entries() -> None {
            is_loading = True;
            result: any = root spawn GetLeaderboard(
                limit=page_size, offset=current_page * page_size
            );
            if result.reports {
                data: dict = result.reports[0];
                entries = data.get("entries", []);
                total = data.get("total", 0);
            }
            is_loading = False;
        }

        if is_loading {
            return <div class="text-center py-20">
                <p class="text-text-secondary">Loading leaderboard...</p>
            </div>;
        }

        return <div class="max-w-6xl mx-auto">
            <div class="flex justify-between items-center mb-8">
                <h1 class="text-3xl font-bold text-text-primary">Leaderboard</h1>
                <button
                    onClick={lambda e: any -> None { fetch_entries(); }}
                    class="btn btn-secondary"
                >
                    Refresh
                </button>
            </div>

            {len(entries) >= 3
                ? <div class="grid grid-cols-3 gap-4 mb-8">
                    {[<PodiumCard entry={entries[i]} rank={i + 1} key={str(i)} />
                      for i in range(min(3, len(entries)))]}
                  </div>
                : <span></span>
            }

            <div class="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-terminal-border">
                            <th class="px-4 py-3 text-left text-xs text-text-muted uppercase">Rank</th>
                            <th class="px-4 py-3 text-left text-xs text-text-muted uppercase">Documentation</th>
                            <th class="px-4 py-3 text-left text-xs text-text-muted uppercase">Model</th>
                            <th class="px-4 py-3 text-right text-xs text-text-muted uppercase">Score</th>
                            <th class="px-4 py-3 text-right text-xs text-text-muted uppercase">Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[<tr key={str(i)} class="border-b border-terminal-border hover:bg-terminal-elevated">
                            <td class="px-4 py-3 text-text-secondary font-mono">
                                {str(current_page * page_size + i + 1)}
                            </td>
                            <td class="px-4 py-3">
                                <div class="text-text-primary font-medium">{entry.get("documentation_name", "")}</div>
                                <div class="text-xs text-text-muted truncate max-w-xs">{entry.get("documentation_url", "")}</div>
                            </td>
                            <td class="px-4 py-3 text-text-secondary text-sm">{entry.get("model_used", "")}</td>
                            <td class="px-4 py-3 text-right font-mono text-text-secondary">
                                {str(entry.get("total_score", 0))}/{str(entry.get("max_score", 0))}
                            </td>
                            <td class="px-4 py-3 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <div class="w-24 bg-terminal-bg rounded-full h-2 overflow-hidden">
                                        <div
                                            class="h-full bg-terminal-accent rounded-full"
                                            style={f"width: {entry.get('percentage', 0)}%"}
                                        ></div>
                                    </div>
                                    <span class="font-mono text-terminal-accent font-medium">
                                        {f"{entry.get('percentage', 0):.1f}%"}
                                    </span>
                                </div>
                            </td>
                          </tr>
                          for (i, entry) in enumerate(entries)
                        ]}
                    </tbody>
                </table>
            </div>

            {total > page_size
                ? <div class="flex justify-center gap-4 mt-6">
                    <button
                        onClick={lambda e: any -> None { current_page = max(0, current_page - 1); fetch_entries(); }}
                        disabled={current_page == 0}
                        class="btn btn-secondary btn-sm"
                    >
                        Previous
                    </button>
                    <span class="text-text-muted text-sm self-center">
                        Page {str(current_page + 1)} of {str((total + page_size - 1) // page_size)}
                    </span>
                    <button
                        onClick={lambda e: any -> None { current_page = current_page + 1; fetch_entries(); }}
                        disabled={(current_page + 1) * page_size >= total}
                        class="btn btn-secondary btn-sm"
                    >
                        Next
                    </button>
                  </div>
                : <span></span>
            }
        </div>;
    }

    def:pub PodiumCard(props: dict) -> any {
        entry: dict = props["entry"];
        rank: int = props["rank"];
        colors: list = ["text-yellow-400", "text-gray-400", "text-amber-600"];
        bg_colors: list = ["border-yellow-600/30", "border-gray-600/30", "border-amber-600/30"];

        return <div class={"bg-terminal-surface border rounded-lg p-6 text-center " + bg_colors[rank - 1]}>
            <div class={"text-4xl font-bold mb-2 " + colors[rank - 1]}>
                {"#" + str(rank)}
            </div>
            <h3 class="text-text-primary font-semibold text-lg mb-1 truncate">
                {entry.get("documentation_name", "")}
            </h3>
            <p class="text-text-muted text-sm mb-3">{entry.get("model_used", "")}</p>
            <div class="text-3xl font-bold text-terminal-accent font-mono">
                {f"{entry.get('percentage', 0):.1f}%"}
            </div>
        </div>;
    }
}
