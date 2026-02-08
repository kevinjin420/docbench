sv import from walkers.files { ListTestFiles, ListStashes, CreateStash, DeleteStash, DeleteFile, CleanResults, ExportCSV, GetStashFiles }

def:pub FileManagerView(props: dict) -> any {
    has files: list = props.get("files", []);
    has stashes: list = props.get("stashes", []);
    has selected_stash: str = "";
    has stash_files: list = [];
    has is_loading: bool = False;

    async def refresh() -> None {
        is_loading = True;
        file_result: any = root spawn ListTestFiles();
        if file_result.reports {
            files = file_result.reports[0].get("files", []);
        }
        stash_result: any = root spawn ListStashes();
        if stash_result.reports {
            stashes = stash_result.reports[0].get("stashes", []);
        }
        is_loading = False;
    }

    async def stash_all() -> None {
        result: any = root spawn CreateStash();
        await refresh();
    }

    async def clean_all() -> None {
        result: any = root spawn CleanResults();
        await refresh();
    }

    async def delete_stash(name: str) -> None {
        result: any = root spawn DeleteStash(stash_name=name);
        await refresh();
    }

    async def delete_file(run_id: str) -> None {
        result: any = root spawn DeleteFile(run_id=run_id);
        await refresh();
    }

    async def view_stash(name: str) -> None {
        selected_stash = name;
        result: any = root spawn GetStashFiles(stash_name=name);
        if result.reports {
            stash_files = result.reports[0].get("files", []);
        }
    }

    async def export_csv() -> None {
        result: any = root spawn ExportCSV();
        if result.reports {
            csv_data: str = result.reports[0].get("csv", "");
        }
    }

    return <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-text-primary">File Manager</h1>
            <div className="flex gap-2">
                <button onClick={lambda e: any -> None { stash_all(); }} className="btn btn-primary btn-sm">
                    Stash All
                </button>
                <button onClick={lambda e: any -> None { clean_all(); }} className="btn btn-danger btn-sm">
                    Clean
                </button>
                <button onClick={lambda e: any -> None { export_csv(); }} className="btn btn-secondary btn-sm">
                    Export CSV
                </button>
                <button onClick={lambda e: any -> None { refresh(); }} className="btn btn-ghost btn-sm">
                    Refresh
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
                <h2 className="text-lg font-semibold text-text-primary mb-4">
                    Uncollected Results ({String(files.length)})
                </h2>
                <div className="space-y-2">
                    {[<div key={f["run_id"]} className="bg-terminal-surface border border-terminal-border rounded p-3 flex justify-between items-center">
                        <div>
                            <div className="text-text-primary text-sm font-mono truncate max-w-xs">{f["run_id"]}</div>
                            <div className="text-text-muted text-xs">{f["model"]} / {f["variant"]}</div>
                            {(<span className="text-terminal-accent text-xs font-mono">{String(f["percentage"]) + "%"}</span>)
                            if f.get("percentage", 0) > 0
                            else (<span className="text-text-muted text-xs">Not evaluated</span>)}
                        </div>
                        <button
                            onClick={lambda e: any -> None { delete_file(f["run_id"]); }}
                            className="btn btn-danger btn-sm btn-icon"
                        >
                            X
                        </button>
                      </div>
                      for f in files
                    ]}
                    {(<p className="text-text-muted text-sm text-center py-4">No uncollected results</p>)
                    if files.length == 0
                    else None}
                </div>
            </div>

            <div>
                <h2 className="text-lg font-semibold text-text-primary mb-4">
                    Collections ({String(stashes.length)})
                </h2>
                <div className="space-y-2">
                    {[<div key={s["name"]} className="bg-terminal-surface border border-terminal-border rounded p-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <button
                                    onClick={lambda e: any -> None { view_stash(s["name"]); }}
                                    className="text-text-primary text-sm font-medium hover:text-terminal-accent"
                                >
                                    {s["name"]}
                                </button>
                                <div className="text-text-muted text-xs">{String(s.get("result_count", 0))} files</div>
                            </div>
                            <button
                                onClick={lambda e: any -> None { delete_stash(s["name"]); }}
                                className="btn btn-danger btn-sm btn-icon"
                            >
                                X
                            </button>
                        </div>
                        {(<div className="mt-3 pt-3 border-t border-terminal-border space-y-1">
                            {[<div key={sf["run_id"]} className="text-xs text-text-secondary font-mono flex justify-between">
                                <span className="truncate">{sf["run_id"]}</span>
                                {(<span className="text-terminal-accent">{String(sf["percentage"]) + "%"}</span>)
                                if sf.get("percentage", 0) > 0
                                else None}
                              </div>
                              for sf in stash_files
                            ]}
                          </div>)
                        if selected_stash == s["name"] and stash_files.length > 0
                        else None}
                      </div>
                      for s in stashes
                    ]}
                    {(<p className="text-text-muted text-sm text-center py-4">No collections</p>)
                    if stashes.length == 0
                    else None}
                </div>
            </div>
        </div>
    </div>;
}
