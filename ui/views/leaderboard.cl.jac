sv import from walkers.public { GetLeaderboard }
import from react { useEffect }

def:pub LeaderboardView() -> any {
    has entries: list = [];
    has total: int = 0;
    has is_loading: bool = True;
    has current_page: int = 0;
    has page_size: int = 25;

    useEffect(lambda -> None {
        fetch_entries();
    }, []);

    async def fetch_entries() -> None {
        is_loading = True;
        result: any = root spawn GetLeaderboard(
            limit=page_size, offset=current_page * page_size
        );
        if result.reports {
            data: dict = result.reports[0];
            entries = data["entries"] or [];
            total = data["total"] or 0;
        }
        is_loading = False;
    }

    if is_loading {
        return <div className="text-center py-20">
            <p className="text-text-secondary">Loading leaderboard...</p>
        </div>;
    }

    return <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-text-primary">Leaderboard</h1>
            <button
                onClick={lambda e: any -> None { fetch_entries(); }}
                className="btn btn-secondary"
            >
                Refresh
            </button>
        </div>

        {(<div className="grid grid-cols-3 gap-4 mb-8">
            {[<PodiumCard entry={entries[i]} rank={i + 1} key={String(i)} />
              for i in [0, 1, 2] if i < entries.length]}
          </div>) if entries.length >= 3 else (<span></span>)}

        <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-terminal-border">
                        <th className="px-4 py-3 text-left text-xs text-text-muted uppercase">Rank</th>
                        <th className="px-4 py-3 text-left text-xs text-text-muted uppercase">Documentation</th>
                        <th className="px-4 py-3 text-left text-xs text-text-muted uppercase">Model</th>
                        <th className="px-4 py-3 text-right text-xs text-text-muted uppercase">Score</th>
                        <th className="px-4 py-3 text-right text-xs text-text-muted uppercase">Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    {[<tr key={String(entries.indexOf(entry))} className="border-b border-terminal-border hover:bg-terminal-elevated">
                        <td className="px-4 py-3 text-text-secondary font-mono">
                            {String(current_page * page_size + entries.indexOf(entry) + 1)}
                        </td>
                        <td className="px-4 py-3">
                            <div className="text-text-primary font-medium">{(entry["documentation_name"] or "")}</div>
                            <div className="text-xs text-text-muted truncate max-w-xs">{(entry["documentation_url"] or "")}</div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-sm">{(entry["model_used"] or "")}</td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">
                            {String(entry["total_score"] or 0) + "/" + String(entry["max_score"] or 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <div className="w-24 bg-terminal-bg rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-terminal-accent rounded-full"
                                        style={"width: " + String(entry["percentage"] or 0) + "%"}
                                    ></div>
                                </div>
                                <span className="font-mono text-terminal-accent font-medium">
                                    {String(entry["percentage"] or 0) + "%"}
                                </span>
                            </div>
                        </td>
                      </tr>
                      for entry in entries
                    ]}
                </tbody>
            </table>
        </div>

        {(<div className="flex justify-center gap-4 mt-6">
            <button
                onClick={lambda e: any -> None { current_page = Math.max(0, current_page - 1); fetch_entries(); }}
                disabled={current_page == 0}
                className="btn btn-secondary btn-sm"
            >
                Previous
            </button>
            <span className="text-text-muted text-sm self-center">
                {"Page " + String(current_page + 1) + " of " + String((total + page_size - 1) // page_size)}
            </span>
            <button
                onClick={lambda e: any -> None { current_page = current_page + 1; fetch_entries(); }}
                disabled={(current_page + 1) * page_size >= total}
                className="btn btn-secondary btn-sm"
            >
                Next
            </button>
          </div>) if total > page_size else (<span></span>)}
    </div>;
}

def:pub PodiumCard(props: dict) -> any {
    entry: dict = props["entry"];
    rank: int = props["rank"];
    colors: list = ["text-yellow-400", "text-gray-400", "text-amber-600"];
    bg_colors: list = ["border-yellow-600/30", "border-gray-600/30", "border-amber-600/30"];

    return <div className={"bg-terminal-surface border rounded-lg p-6 text-center " + bg_colors[rank - 1]}>
        <div className={"text-4xl font-bold mb-2 " + colors[rank - 1]}>
            {"#" + String(rank)}
        </div>
        <h3 className="text-text-primary font-semibold text-lg mb-1 truncate">
            {(entry["documentation_name"] or "")}
        </h3>
        <p className="text-text-muted text-sm mb-3">{(entry["model_used"] or "")}</p>
        <div className="text-3xl font-bold text-terminal-accent font-mono">
            {String(entry["percentage"] or 0) + "%"}
        </div>
    </div>;
}
