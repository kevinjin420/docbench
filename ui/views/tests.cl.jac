import from react { useEffect }
sv import from walkers.admin { AdminGetTests, AdminCreateTest, AdminGetTest, AdminUpdateTest, AdminDeleteTest, AdminRestoreTest, AdminHardDeleteTest, AdminTestStats, AdminGetPublicTests, AdminSetPublicTests, AdminAddPublicTest, AdminRemovePublicTest, AdminListModels, AdminAddModel, AdminRemoveModel, AdminToggleModel }

def:pub TestsView() -> any {
    has active_tab: str = "overview";
    has stats: dict = {};
    has tests: list = [];
    has total_tests: int = 0;
    has current_page: int = 0;
    has page_size: int = 25;
    has filter_level: str = "";
    has filter_category: str = "";
    has search_query: str = "";
    has show_deleted: bool = False;
    has is_loading: bool = True;
    has editing_test: dict | None = None;
    has public_test_ids: list = [];
    has benchmark_models: list = [];
    has new_model_id: str = "";
    has new_model_name: str = "";

    useEffect(lambda -> None {
        load_stats();
        load_tests();
        load_public_config();
    }, []);

    async def load_stats() -> None {
        result: any = root spawn AdminTestStats();
        if result.reports {
            stats = result.reports[0];
        }
    }

    async def load_tests() -> None {
        is_loading = True;
        result: any = root spawn AdminGetTests(
            limit=page_size,
            offset=current_page * page_size,
            level=filter_level,
            category=filter_category,
            search=search_query,
            include_deleted=show_deleted
        );
        if result.reports {
            data: dict = result.reports[0];
            tests = (data["tests"] or []);
            total_tests = (data["total"] or 0);
        }
        is_loading = False;
    }

    async def load_public_config() -> None {
        result: any = root spawn AdminGetPublicTests();
        if result.reports {
            data: dict = result.reports[0];
            public_test_ids = (data["test_ids"] or []);
        }
        model_result: any = root spawn AdminListModels();
        if model_result.reports {
            benchmark_models = (model_result.reports[0]["models"] or []);
        }
    }

    async def delete_test(test_id: str) -> None {
        result: any = root spawn AdminDeleteTest(test_id=test_id);
        await load_tests();
        await load_stats();
    }

    async def restore_test(test_id: str) -> None {
        result: any = root spawn AdminRestoreTest(test_id=test_id);
        await load_tests();
    }

    async def save_test(test_data: dict) -> None {
        if test_data["id"] {
            result: any = root spawn AdminUpdateTest(
                test_id=test_data["id"],
                updates=test_data
            );
        } else {
            result: any = root spawn AdminCreateTest(test_data=test_data);
        }
        editing_test = None;
        await load_tests();
        await load_stats();
    }

    async def toggle_public_test(test_id: str) -> None {
        if test_id in public_test_ids {
            result: any = root spawn AdminRemovePublicTest(test_id=test_id);
        } else {
            result: any = root spawn AdminAddPublicTest(test_id=test_id);
        }
        await load_public_config();
    }

    async def add_model() -> None {
        if not new_model_id.trim() {
            return;
        }
        result: any = root spawn AdminAddModel(
            model_id=new_model_id,
            display_name=new_model_name or new_model_id
        );
        new_model_id = "";
        new_model_name = "";
        await load_public_config();
    }

    async def remove_model(model_id: str) -> None {
        result: any = root spawn AdminRemoveModel(model_id=model_id);
        await load_public_config();
    }

    async def toggle_model(model_id: str) -> None {
        result: any = root spawn AdminToggleModel(model_id=model_id);
        await load_public_config();
    }

    return <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-6">Test Management</h1>

        <div className="flex gap-1 mb-6 border-b border-terminal-border">
            {[<button
                key={item[0]}
                onClick={lambda e: any -> None { active_tab = item[0]; }}
                className={("px-4 py-2 text-sm font-medium text-terminal-accent border-b-2 border-terminal-accent") if active_tab == item[0]
                    else ("px-4 py-2 text-sm font-medium text-text-muted hover:text-text-secondary")
                }
              >
                {item[1]}
              </button>
              for item in [["overview", "Overview"], ["definitions", "Test Definitions"], ["public", "Public Suite"]]
            ]}
        </div>

        {(<OverviewTab stats={stats} />) if active_tab == "overview"
         else ((<DefinitionsTab
            tests={tests}
            total={total_tests}
            page={current_page}
            page_size={page_size}
            is_loading={is_loading}
            filter_level={filter_level}
            filter_category={filter_category}
            search_query={search_query}
            show_deleted={show_deleted}
            editing_test={editing_test}
            on_page_change={lambda p: int -> None { current_page = p; load_tests(); }}
            on_filter_level={lambda v: str -> None { filter_level = v; current_page = 0; load_tests(); }}
            on_filter_category={lambda v: str -> None { filter_category = v; current_page = 0; load_tests(); }}
            on_search={lambda v: str -> None { search_query = v; current_page = 0; load_tests(); }}
            on_toggle_deleted={lambda e: any -> None { show_deleted = not show_deleted; load_tests(); }}
            on_delete={delete_test}
            on_restore={restore_test}
            on_edit={lambda t: dict -> None { editing_test = t; }}
            on_save={save_test}
            on_cancel_edit={lambda e: any -> None { editing_test = None; }}
          />) if active_tab == "definitions"
         else (<PublicSuiteTab
            public_test_ids={public_test_ids}
            benchmark_models={benchmark_models}
            tests={tests}
            on_toggle_test={toggle_public_test}
            on_add_model={add_model}
            on_remove_model={remove_model}
            on_toggle_model={toggle_model}
            new_model_id={new_model_id}
            new_model_name={new_model_name}
            on_model_id_change={lambda v: str -> None { new_model_id = v; }}
            on_model_name_change={lambda v: str -> None { new_model_name = v; }}
          />))}
    </div>;
}

def:pub OverviewTab(props: dict) -> any {
    stats: dict = (props["stats"] or {});
    levels: list = (stats["by_level"] or []);
    categories: list = (stats["by_category"] or []);

    return <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-terminal-accent font-mono">{String(stats["total"] or 0)}</div>
            <div className="text-text-muted text-sm mt-1">Total Tests</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-text-primary font-mono">{String(stats["active"] or 0)}</div>
            <div className="text-text-muted text-sm mt-1">Active</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-red-400 font-mono">{String(stats["deleted"] or 0)}</div>
            <div className="text-text-muted text-sm mt-1">Deleted</div>
        </div>

        <div className="md:col-span-3 bg-terminal-surface border border-terminal-border rounded-lg p-6">
            <h3 className="text-text-primary font-medium mb-4">By Level</h3>
            <div className="grid grid-cols-5 gap-3">
                {[<div key={(l["level"] or "")} className="text-center">
                    <div className="text-lg font-mono text-text-primary">{String(l["count"] or 0)}</div>
                    <div className="text-xs text-text-muted">{(l["level"] or "")}</div>
                  </div>
                  for l in levels
                ]}
            </div>
        </div>

        <div className="md:col-span-3 bg-terminal-surface border border-terminal-border rounded-lg p-6">
            <h3 className="text-text-primary font-medium mb-4">By Category</h3>
            <div className="grid grid-cols-3 gap-3">
                {[<div key={(c["category"] or "")} className="flex justify-between items-center py-1 border-b border-terminal-border">
                    <span className="text-text-secondary text-sm">{(c["category"] or "")}</span>
                    <span className="text-text-primary font-mono text-sm">{String(c["count"] or 0)}</span>
                  </div>
                  for c in categories
                ]}
            </div>
        </div>
    </div>;
}

def:pub DefinitionsTab(props: dict) -> any {
    tests: list = (props["tests"] or []);
    total: int = (props["total"] or 0);
    page: int = (props["page"] or 0);
    page_size: int = (props["page_size"] or 25);

    return <div>
        <div className="flex gap-3 items-center mb-4 flex-wrap">
            <input
                type="text"
                value={(props["search_query"] or "")}
                onChange={lambda e: any -> None { props["on_search"](e.target.value); }}
                placeholder="Search tests..."
                className="px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm min-w-[200px]"
            />
            <select
                value={(props["filter_level"] or "")}
                onChange={lambda e: any -> None { props["on_filter_level"](e.target.value); }}
                className="px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
            >
                <option value="">All Levels</option>
                {[<option key={lv} value={lv}>{lv}</option>
                  for lv in ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"]
                ]}
            </select>
            <select
                value={(props["filter_category"] or "")}
                onChange={lambda e: any -> None { props["on_filter_category"](e.target.value); }}
                className="px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
            >
                <option value="">All Categories</option>
            </select>
            <label className="flex items-center gap-2 text-text-muted text-sm">
                <input
                    type="checkbox"
                    checked={(props["show_deleted"] or False)}
                    onChange={props["on_toggle_deleted"]}
                />
                Show Deleted
            </label>
            <button
                onClick={lambda e: any -> None { props["on_edit"]({}); }}
                className="btn btn-primary btn-sm ml-auto"
            >
                New Test
            </button>
        </div>

        {(<TestEditor
            test={(props["editing_test"] or {})}
            on_save={props["on_save"]}
            on_cancel={props["on_cancel_edit"]}
          />) if props["editing_test"] != null
            else (<span></span>)
        }

        <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-terminal-border">
                        <th className="px-3 py-2 text-left text-xs text-text-muted uppercase">ID</th>
                        <th className="px-3 py-2 text-left text-xs text-text-muted uppercase">Task</th>
                        <th className="px-3 py-2 text-left text-xs text-text-muted uppercase">Level</th>
                        <th className="px-3 py-2 text-left text-xs text-text-muted uppercase">Category</th>
                        <th className="px-3 py-2 text-right text-xs text-text-muted uppercase">Points</th>
                        <th className="px-3 py-2 text-right text-xs text-text-muted uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {[<tr key={(t["test_id"] or String(tests.indexOf(t)))} className={"border-b border-terminal-border " + (("opacity-50") if (t["deleted"] or False) else (""))}>
                        <td className="px-3 py-2 text-text-secondary text-xs font-mono">{(t["test_id"] or "")}</td>
                        <td className="px-3 py-2 text-text-primary text-sm truncate max-w-xs">{(t["task"] or "")}</td>
                        <td className="px-3 py-2 text-text-secondary text-sm">{(t["level"] or "")}</td>
                        <td className="px-3 py-2 text-text-secondary text-sm">{(t["category"] or "")}</td>
                        <td className="px-3 py-2 text-right text-text-secondary text-sm font-mono">{String(t["points"] or 0)}</td>
                        <td className="px-3 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                                <button
                                    onClick={lambda e: any -> None { props["on_edit"](t); }}
                                    className="text-terminal-accent text-xs hover:underline"
                                >
                                    Edit
                                </button>
                                {(<button
                                    onClick={lambda e: any -> None { props["on_restore"]((t["test_id"] or "")); }}
                                    className="text-green-400 text-xs hover:underline"
                                  >
                                    Restore
                                  </button>) if (t["deleted"] or False)
                                    else (<button
                                        onClick={lambda e: any -> None { props["on_delete"]((t["test_id"] or "")); }}
                                        className="text-red-400 text-xs hover:underline"
                                      >
                                        Delete
                                      </button>)
                                }
                            </div>
                        </td>
                      </tr>
                      for t in tests
                    ]}
                </tbody>
            </table>
        </div>

        {(<div className="flex justify-center gap-4 mt-4">
            <button
                onClick={lambda e: any -> None { props["on_page_change"](Math.max(0, page - 1)); }}
                disabled={page == 0}
                className="btn btn-secondary btn-sm"
            >
                Previous
            </button>
            <span className="text-text-muted text-sm self-center">
                Page {String(page + 1)} of {String((total + page_size - 1) // page_size)}
            </span>
            <button
                onClick={lambda e: any -> None { props["on_page_change"](page + 1); }}
                disabled={(page + 1) * page_size >= total}
                className="btn btn-secondary btn-sm"
            >
                Next
            </button>
          </div>) if total > page_size
            else (<span></span>)
        }
    </div>;
}

def:pub TestEditor(props: dict) -> any {
    test_data: dict = (props["test"] or {});
    has task_val: str = (test_data["task"] or "");
    has level_val: str = (test_data["level"] or "L1");
    has category_val: str = (test_data["category"] or "");
    has points_val: int = (test_data["points"] or 1);
    has prompt_val: str = (test_data["prompt"] or "");
    has ref_code_val: str = (test_data["reference_code"] or "");

    return <div className="bg-terminal-surface border border-terminal-accent/30 rounded-lg p-4 mb-4">
        <h3 className="text-text-primary font-medium mb-3">
            {("Edit Test") if test_data["id"] else ("New Test")}
        </h3>
        <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs text-text-muted mb-1">Task</label>
                <input
                    type="text"
                    value={task_val}
                    onChange={lambda e: any -> None { task_val = e.target.value; }}
                    className="w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                />
            </div>
            <div className="flex gap-3">
                <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1">Level</label>
                    <select
                        value={level_val}
                        onChange={lambda e: any -> None { level_val = e.target.value; }}
                        className="w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                    >
                        {[<option key={lv} value={lv}>{lv}</option>
                          for lv in ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"]
                        ]}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1">Category</label>
                    <input
                        type="text"
                        value={category_val}
                        onChange={lambda e: any -> None { category_val = e.target.value; }}
                        className="w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                    />
                </div>
                <div className="w-20">
                    <label className="block text-xs text-text-muted mb-1">Points</label>
                    <input
                        type="number"
                        min="1"
                        value={String(points_val)}
                        onChange={lambda e: any -> None { points_val = parseInt(e.target.value) if e.target.value else 1; }}
                        className="w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm text-center"
                    />
                </div>
            </div>
            <div className="col-span-2">
                <label className="block text-xs text-text-muted mb-1">Prompt</label>
                <textarea
                    value={prompt_val}
                    onChange={lambda e: any -> None { prompt_val = e.target.value; }}
                    rows="3"
                    className="w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm font-mono"
                ></textarea>
            </div>
            <div className="col-span-2">
                <label className="block text-xs text-text-muted mb-1">Reference Code</label>
                <textarea
                    value={ref_code_val}
                    onChange={lambda e: any -> None { ref_code_val = e.target.value; }}
                    rows="4"
                    className="w-full px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm font-mono"
                ></textarea>
            </div>
        </div>
        <div className="flex gap-2 mt-3 justify-end">
            <button
                onClick={props["on_cancel"]}
                className="btn btn-ghost btn-sm"
            >
                Cancel
            </button>
            <button
                onClick={lambda e: any -> None {
                    props["on_save"]({
                        "id": (test_data["id"] or ""),
                        "task": task_val,
                        "level": level_val,
                        "category": category_val,
                        "points": points_val,
                        "prompt": prompt_val,
                        "reference_code": ref_code_val
                    });
                }}
                className="btn btn-primary btn-sm"
            >
                Save
            </button>
        </div>
    </div>;
}

def:pub PublicSuiteTab(props: dict) -> any {
    public_test_ids: list = (props["public_test_ids"] or []);
    benchmark_models: list = (props["benchmark_models"] or []);

    return <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
                <h3 className="text-text-primary font-medium mb-3">
                    Public Test IDs ({String(public_test_ids.length)})
                </h3>
                <p className="text-text-muted text-xs mb-3">
                    Tests included in the public benchmark suite.
                </p>
                <div className="max-h-96 overflow-y-auto space-y-1">
                    {[<div key={tid} className="flex items-center justify-between py-1 px-2 bg-terminal-bg rounded">
                        <span className="text-text-secondary text-xs font-mono">{tid}</span>
                        <button
                            onClick={lambda e: any -> None { props["on_toggle_test"](tid); }}
                            className="text-red-400 text-xs"
                        >
                            Remove
                        </button>
                      </div>
                      for tid in public_test_ids
                    ]}
                </div>
            </div>
        </div>

        <div>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
                <h3 className="text-text-primary font-medium mb-3">
                    Benchmark Models ({String(benchmark_models.length)})
                </h3>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={(props["new_model_id"] or "")}
                        onChange={lambda e: any -> None { props["on_model_id_change"](e.target.value); }}
                        placeholder="model-id"
                        className="flex-1 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                    />
                    <input
                        type="text"
                        value={(props["new_model_name"] or "")}
                        onChange={lambda e: any -> None { props["on_model_name_change"](e.target.value); }}
                        placeholder="Display Name"
                        className="flex-1 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                    />
                    <button
                        onClick={lambda e: any -> None { props["on_add_model"](); }}
                        className="btn btn-primary btn-sm"
                    >
                        Add
                    </button>
                </div>
                <div className="space-y-2">
                    {[<div key={(m["model_id"] or "")} className="flex items-center justify-between py-2 px-3 bg-terminal-bg rounded">
                        <div>
                            <div className="text-text-primary text-sm">{(m["display_name"] or m["model_id"] or "")}</div>
                            <div className="text-text-muted text-xs font-mono">{(m["model_id"] or "")}</div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={lambda e: any -> None { props["on_toggle_model"]((m["model_id"] or "")); }}
                                className={("px-2 py-1 text-xs rounded bg-green-600/20 text-green-400") if m["active"]
                                    else ("px-2 py-1 text-xs rounded bg-terminal-border text-text-muted")
                                }
                            >
                                {("Active") if m["active"] else ("Inactive")}
                            </button>
                            <button
                                onClick={lambda e: any -> None { props["on_remove_model"]((m["model_id"] or "")); }}
                                className="text-red-400 text-xs"
                            >
                                Remove
                            </button>
                        </div>
                      </div>
                      for m in benchmark_models
                    ]}
                </div>
            </div>
        </div>
    </div>;
}
