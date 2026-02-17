import from dotenv { load_dotenv }

glob _dotenv_loaded: bool = load_dotenv() or True;

import from database { init_db }

include utils;
include services;
include walkers;

with entry {
    init_db();
}

cl import from react { useState, useEffect, useCallback, useRef }
cl import from "@jac/runtime" {
    Router,
    Routes,
    Route,
    Link,
    useNavigate,
    useLocation
}
cl import from "react-router-dom" { useSearchParams }
cl import "./styles.css";

cl {
    async def apiCall(walkerName: str, payload: dict = {}, extraHeaders: dict = {}) -> any {
        merged = Object.assign({"Content-Type": "application/json"}, extraHeaders);
        token = localStorage.getItem("docbench_token");
        body = Object.assign({}, payload);
        if token {
            merged["Authorization"] = "Bearer " + token;
            body["auth_token"] = token;
        }
        resp = await fetch("/walker/" + walkerName, {
            "method": "POST",
            "headers": merged,
            "body": JSON.stringify(body)
        });
        data = await resp.json();
        if data and data["ok"] and data["data"] and data["data"]["reports"] {
            reports = data["data"]["reports"];
            if reports.length > 0 {
                return reports[0];
            }
        }
        return None;
    }

    def AppHeader(user: any, onLogout: any) -> any {
        has menuOpen: bool = False;
        location = useLocation();
        menuRef = useRef(None);

        useEffect(lambda -> None {
            def handleClick(e: any) -> None {
                if menuRef.current and not menuRef.current.contains(e.target) {
                    menuOpen = False;
                }
            }
            document.addEventListener("mousedown", handleClick);
            return lambda -> None { document.removeEventListener("mousedown", handleClick); };
        }, []);

        return
            <header className="header">
                <div className="header-left">
                    <Link to="/" className="logo">
                        {"Jaseci "}<span>{"DocBench"}</span>
                    </Link>
                    <nav className="nav-links">
                        <Link to="/leaderboard" className={"nav-link" + (" active" if location.pathname == "/leaderboard" else "")}>{"Leaderboard"}</Link>
                        <Link to="/submit" className={"nav-link" + (" active" if location.pathname == "/submit" else "")}>{"Submit"}</Link>
                        {(
                            <Link to="/benchmark" className={"nav-link" + (" active" if location.pathname == "/benchmark" else "")}>{"Benchmark"}</Link>
                        ) if user and user["is_admin"] else None}
                        {(
                            <Link to="/files" className={"nav-link" + (" active" if location.pathname == "/files" else "")}>{"Files"}</Link>
                        ) if user and user["is_admin"] else None}
                    </nav>
                </div>
                <div className="header-right">
                    {(
                        <div className="dropdown" ref={menuRef}>
                            <button className="user-btn" onClick={lambda e: any -> None { menuOpen = not menuOpen; }}>
                                {(
                                    <img src={user["avatar_url"]} className="user-avatar" alt="" />
                                ) if user["avatar_url"] else None}
                                <span>{user["name"] or user["email"]}</span>
                            </button>
                            {(
                                <div className="dropdown-menu">
                                    <div style={{"padding": "0.5rem 0.75rem", "fontSize": "0.8rem", "color": "var(--text-muted)", "borderBottom": "1px solid var(--border-primary)", "marginBottom": "0.25rem"}}>
                                        {user["email"]}
                                    </div>
                                    <button className="dropdown-item" onClick={lambda e: any -> None { onLogout(); menuOpen = False; }}>
                                        {"Sign Out"}
                                    </button>
                                </div>
                            ) if menuOpen else None}
                        </div>
                    ) if user else (
                        <LoginBtn />
                    )}
                </div>
            </header>;
    }

    def LoginBtn -> any {
        async def doLogin -> None {
            localStorage.setItem("docbench_return_url", window.location.pathname);
            result = await apiCall("GithubLogin");
            if result and result["redirect_url"] {
                window.location.href = result["redirect_url"];
            }
        }

        return
            <button className="btn btn-secondary" onClick={lambda e: any -> None { doLogin(); }}>
                {"Sign in with GitHub"}
            </button>;
    }

    def AuthCallbackPage(onLogin: any) -> any {
        navigate = useNavigate();
        searchParams = useSearchParams()[0];

        async def handleCallback -> None {
            token = searchParams.get("token");
            if token {
                localStorage.setItem("docbench_token", token);
                onLogin();
                returnUrl = localStorage.getItem("docbench_return_url") or "/";
                localStorage.removeItem("docbench_return_url");
                navigate(returnUrl);
                return;
            }
            code = searchParams.get("code");
            state = searchParams.get("state");
            if code {
                result = await apiCall("GithubCallback", {"code": code, "state": (state or "")});
                if result and result["redirect"] {
                    url = result["redirect"];
                    qmark = url.indexOf("?");
                    if qmark >= 0 {
                        params = url.substring(qmark);
                        sp = Reflect.construct(URLSearchParams, [params]);
                        cbToken = sp.get("token");
                        if cbToken {
                            localStorage.setItem("docbench_token", cbToken);
                            onLogin();
                        }
                    }
                }
            }
            returnUrl = localStorage.getItem("docbench_return_url") or "/";
            localStorage.removeItem("docbench_return_url");
            navigate(returnUrl);
        }

        useEffect(lambda -> None { handleCallback(); }, []);

        return
            <div className="loading-container">
                <div className="spinner"></div>
                <span>{"Authenticating..."}</span>
            </div>;
    }

    def HomePage -> any {
        return
            <div style={{"maxWidth": "800px", "margin": "0 auto", "paddingTop": "3rem"}}>
                <div style={{"textAlign": "center", "marginBottom": "3rem"}}>
                    <h1 style={{"fontSize": "2.5rem", "fontWeight": "700", "marginBottom": "1rem"}}>
                        {"Jaseci "}<span style={{"color": "var(--accent)"}}>{"DocBench"}</span>
                    </h1>
                    <p style={{"color": "var(--text-secondary)", "fontSize": "1.1rem", "lineHeight": "1.6", "maxWidth": "600px", "margin": "0 auto"}}>
                        {"A benchmark suite for evaluating LLM performance on Jac language documentation."}
                    </p>
                </div>
                <div className="grid-2" style={{"marginBottom": "2rem"}}>
                    <Link to="/leaderboard" className="card" style={{"cursor": "pointer"}}>
                        <h2 style={{"fontSize": "1.25rem", "fontWeight": "600", "marginBottom": "0.5rem", "color": "var(--accent)"}}>{"Leaderboard"}</h2>
                        <p style={{"fontSize": "0.875rem", "color": "var(--text-muted)"}}>{"View ranked documentation submissions and compare performance."}</p>
                    </Link>
                    <Link to="/submit" className="card" style={{"cursor": "pointer"}}>
                        <h2 style={{"fontSize": "1.25rem", "fontWeight": "600", "marginBottom": "0.5rem", "color": "var(--accent)"}}>{"Submit"}</h2>
                        <p style={{"fontSize": "0.875rem", "color": "var(--text-muted)"}}>{"Run the benchmark on your documentation and submit results."}</p>
                    </Link>
                </div>
                <div className="card">
                    <h3 style={{"fontSize": "1.125rem", "fontWeight": "600", "marginBottom": "1rem"}}>{"How It Works"}</h3>
                    <div className="steps">
                        <div className="step"><div className="step-num">{"1"}</div><span>{"Provide your OpenRouter API key and documentation URL"}</span></div>
                        <div className="step"><div className="step-num">{"2"}</div><span>{"The benchmark runs Jac language tests against an LLM using your docs"}</span></div>
                        <div className="step"><div className="step-num">{"3"}</div><span>{"Results are evaluated and scored based on correctness"}</span></div>
                        <div className="step"><div className="step-num">{"4"}</div><span>{"Submit your score to the public leaderboard"}</span></div>
                    </div>
                </div>
            </div>;
    }

    def PodiumCard(entry: any, rank: int, cls: str) -> any {
        colors = {"gold": "#ffd700", "silver": "#c0c0c0", "bronze": "#cd7f32"};
        labels = {"gold": "1st", "silver": "2nd", "bronze": "3rd"};
        return
            <div className={"podium-entry " + cls}>
                <div className="podium-rank" style={{"color": colors[cls]}}>{labels[cls]}</div>
                <div className="podium-name">{entry["documentation_name"] or "Unnamed"}</div>
                <div className="podium-score" style={{"color": colors[cls]}}>{String(parseFloat(entry["percentage"]).toFixed(1)) + "%"}</div>
                <div style={{"fontSize": "0.75rem", "color": "var(--text-muted)", "marginTop": "0.25rem"}}>{entry["model_used"] or ""}</div>
            </div>;
    }

    def LeaderboardPage -> any {
        has entries: list = [];
        has total: int = 0;
        has offset: int = 0;
        has loading: bool = True;
        pageSize = 25;

        async def fetchData -> None {
            loading = True;
            result = await apiCall("GetLeaderboard", {"limit": pageSize, "offset": offset});
            if result {
                entries = result["entries"] or [];
                total = result["total"] or 0;
            }
            loading = False;
        }

        useEffect(lambda -> None { fetchData(); }, [offset]);

        def badgeCls(pct: any) -> str {
            n = parseFloat(pct) or 0;
            if n >= 80 { return "badge badge-green"; }
            if n >= 60 { return "badge badge-amber"; }
            return "badge badge-red";
        }

        return
            <div>
                <div className="section-header">
                    <div>
                        <h1 className="section-title">{"Leaderboard"}</h1>
                        <p className="section-subtitle">{String(total) + " submissions"}</p>
                    </div>
                    <button className="btn btn-secondary" onClick={lambda e: any -> None { fetchData(); }}>{"Refresh"}</button>
                </div>
                {(
                    <div className="loading-container"><div className="spinner"></div><span>{"Loading..."}</span></div>
                ) if loading else (
                    <div>
                        {(
                            <div className="podium">
                                {[
                                    <PodiumCard key={String(i)} entry={entries[i]} rank={i + 1} cls={["gold", "silver", "bronze"][i]} />
                                    for i in [1, 0, 2]
                                    if i < entries.length
                                ]}
                            </div>
                        ) if entries.length >= 3 else None}
                        {(
                            <div className="card" style={{"padding": "0"}}>
                                <div className="table-container">
                                    <table>
                                        <thead><tr><th>{"Rank"}</th><th>{"Documentation"}</th><th>{"Score"}</th><th>{"Model"}</th><th>{"Date"}</th></tr></thead>
                                        <tbody>
                                            {entries.map(lambda entry: any, idx: any -> any { return
                                                <tr key={String(idx)}>
                                                    <td style={{"fontWeight": "600"}}>{"#" + String(offset + idx + 1)}</td>
                                                    <td>{entry["documentation_name"] or "Unnamed"}</td>
                                                    <td><span className={badgeCls(entry["percentage"])}>{String(parseFloat(entry["percentage"]).toFixed(1)) + "%"}</span></td>
                                                    <td style={{"color": "var(--text-muted)", "fontSize": "0.8rem"}}>{entry["model_used"] or "-"}</td>
                                                    <td style={{"color": "var(--text-muted)", "fontSize": "0.8rem"}}>{Reflect.construct(Date, [entry["submitted_at"]]).toLocaleDateString() if entry["submitted_at"] else "-"}</td>
                                                </tr>; }
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) if entries.length > 0 else (
                            <div className="empty-state"><p className="empty-state-text">{"No entries yet. Be the first to submit!"}</p></div>
                        )}
                        {(
                            <div className="pagination">
                                <button className="btn btn-secondary btn-sm" disabled={offset == 0} onClick={lambda e: any -> None { offset = Math.max(0, offset - pageSize); }}>{"Previous"}</button>
                                <span className="page-info">{String(offset + 1) + "-" + String(Math.min(offset + pageSize, total)) + " of " + String(total)}</span>
                                <button className="btn btn-secondary btn-sm" disabled={offset + pageSize >= total} onClick={lambda e: any -> None { offset = offset + pageSize; }}>{"Next"}</button>
                            </div>
                        ) if total > pageSize else None}
                    </div>
                )}
            </div>;
    }

    def SubmitPage -> any {
        has apiKey: str = "";
        has docName: str = "";
        has docUrl: str = "";
        has docContent: str = "";
        has sourceType: str = "url";
        has urlValid: any = None;
        has validating: bool = False;
        has running: bool = False;
        has runId: str = "";
        has statusData: any = None;
        has errorMsg: str = "";
        has submitted: bool = False;
        has publicTests: list = [];
        has testsLoading: bool = True;

        async def fetchTests -> None {
            result = await apiCall("GetPublicTests");
            if result and result["tests"] {
                publicTests = result["tests"];
            }
            testsLoading = False;
        }

        useEffect(lambda -> None {
            fetchTests();
            savedKey = localStorage.getItem("docbench_api_key");
            if savedKey { apiKey = savedKey; }
        }, []);

        async def validateUrl -> None {
            if not docUrl or docUrl.length < 5 { urlValid = None; return; }
            validating = True;
            result = await apiCall("ValidateDocUrl", {"url": docUrl});
            if result { urlValid = result["valid"] or False; }
            validating = False;
        }

        async def startBenchmark -> None {
            if not apiKey { errorMsg = "API key is required"; return; }
            if sourceType == "url" and not docUrl { errorMsg = "Documentation URL is required"; return; }
            if sourceType == "content" and not docContent { errorMsg = "Documentation content is required"; return; }
            errorMsg = "";
            running = True;
            statusData = None;
            submitted = False;
            payload = {
                "documentation_name": docName or "Unnamed Documentation",
                "documentation_url": docUrl,
                "documentation_content": docContent,
                "max_tokens": 16000
            };
            payload["api_key"] = apiKey;
            result = await apiCall("RunPublicBenchmark", payload);
            if result and result["run_id"] {
                runId = result["run_id"];
                pollStatus();
            } elif result and result["error"] {
                errorMsg = result["error"];
                running = False;
            } else {
                errorMsg = "Failed to start benchmark";
                running = False;
            }
        }

        async def pollStatus -> None {
            if not runId { return; }
            result = await apiCall("GetPublicBenchmarkStatus", {"run_id": runId});
            if result {
                statusData = result;
                if result["status"] == "completed" or result["status"] == "failed" {
                    running = False;
                } else {
                    setTimeout(lambda -> None { pollStatus(); }, 3000);
                }
            }
        }

        async def submitToLeaderboard -> None {
            if not statusData or not statusData["result"] { return; }
            result = await apiCall("SubmitToLeaderboard", {
                "run_id": runId,
                "documentation_name": docName or "Unnamed Documentation",
                "documentation_url": docUrl
            });
            if result and result["success"] { submitted = True; }
        }

        return
            <div>
                <div className="section-header">
                    <div>
                        <h1 className="section-title">{"Submit Documentation"}</h1>
                        <p className="section-subtitle">{"Run the benchmark and submit results"}</p>
                    </div>
                </div>
                {(<div className="alert alert-error">{errorMsg}</div>) if errorMsg else None}
                <div className="grid-2">
                    <div>
                        <div className="card" style={{"marginBottom": "1.5rem"}}>
                            <h3 style={{"fontWeight": "600", "marginBottom": "1rem"}}>{"Configuration"}</h3>
                            <div className="form-group">
                                <label className="form-label">{"OpenRouter API Key"}</label>
                                <input type="password" className="form-input" placeholder="sk-or-..." value={apiKey}
                                    onChange={lambda e: any -> None { apiKey = e.target.value; localStorage.setItem("docbench_api_key", e.target.value); }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{"Documentation Name"}</label>
                                <input className="form-input" placeholder="My Jac Documentation" value={docName}
                                    onChange={lambda e: any -> None { docName = e.target.value; }} />
                            </div>
                            <div className="form-group">
                                <div className="tabs" style={{"marginBottom": "0.75rem"}}>
                                    <button className={"tab" + (" active" if sourceType == "url" else "")} onClick={lambda e: any -> None { sourceType = "url"; }}>{"URL"}</button>
                                    <button className={"tab" + (" active" if sourceType == "content" else "")} onClick={lambda e: any -> None { sourceType = "content"; }}>{"Paste Content"}</button>
                                </div>
                                {(
                                    <div>
                                        <input className="form-input" placeholder="https://example.com/docs.txt" value={docUrl}
                                            onChange={lambda e: any -> None { docUrl = e.target.value; }}
                                            onBlur={lambda e: any -> None { validateUrl(); }} />
                                        {(<div style={{"fontSize": "0.8rem", "color": "var(--text-muted)", "marginTop": "0.375rem"}}>{"Validating..."}</div>) if validating else None}
                                        {(<div style={{"fontSize": "0.8rem", "color": "var(--success)", "marginTop": "0.375rem"}}>{"URL is valid"}</div>) if urlValid == True and not validating else None}
                                        {(<div style={{"fontSize": "0.8rem", "color": "var(--error)", "marginTop": "0.375rem"}}>{"URL is not reachable"}</div>) if urlValid == False and not validating else None}
                                    </div>
                                ) if sourceType == "url" else (
                                    <textarea className="form-textarea" rows={8} placeholder="Paste documentation content..."
                                        value={docContent} onChange={lambda e: any -> None { docContent = e.target.value; }}></textarea>
                                )}
                            </div>
                            <button className="btn btn-primary" disabled={running} style={{"width": "100%", "justifyContent": "center"}}
                                onClick={lambda e: any -> None { startBenchmark(); }}>
                                {("Running...") if running else ("Run Benchmark")}
                            </button>
                        </div>
                    </div>
                    <div>
                        {(
                            <div className="card" style={{"marginBottom": "1.5rem"}}>
                                <h3 style={{"fontWeight": "600", "marginBottom": "1rem"}}>{"Results"}</h3>
                                <div style={{"display": "flex", "alignItems": "center", "gap": "0.5rem", "marginBottom": "0.75rem"}}>
                                    <span className={"status-dot " + ("status-completed" if statusData["status"] == "completed" else ("status-failed" if statusData["status"] == "failed" else "status-running"))}></span>
                                    <span style={{"fontWeight": "500", "textTransform": "capitalize"}}>{statusData["status"]}</span>
                                </div>
                                {(<p style={{"fontSize": "0.8rem", "color": "var(--text-muted)", "marginBottom": "0.75rem"}}>{statusData["progress"]}</p>) if statusData["progress"] else None}
                                {(
                                    <div>
                                        <div style={{"textAlign": "center", "marginBottom": "1rem"}}>
                                            <div className={"score-large " + ("score-green" if parseFloat(statusData["result"]["percentage"]) >= 80 else ("score-amber" if parseFloat(statusData["result"]["percentage"]) >= 60 else "score-red"))}>
                                                {String(parseFloat(statusData["result"]["percentage"]).toFixed(1)) + "%"}
                                            </div>
                                            <div style={{"fontSize": "0.8rem", "color": "var(--text-muted)"}}>
                                                {String(statusData["result"]["total_score"]) + " / " + String(statusData["result"]["max_score"]) + " points"}
                                            </div>
                                        </div>
                                        {(<button className="btn btn-primary" style={{"width": "100%", "justifyContent": "center"}} onClick={lambda e: any -> None { submitToLeaderboard(); }}>{"Submit to Leaderboard"}</button>) if not submitted else (<div className="alert alert-success">{"Submitted to leaderboard!"}</div>)}
                                    </div>
                                ) if statusData["status"] == "completed" and statusData["result"] else None}
                                {(<div className="alert alert-error">{statusData["error"] or "Benchmark failed"}</div>) if statusData["status"] == "failed" else None}
                            </div>
                        ) if statusData else None}
                        <div className="card">
                            <h3 style={{"fontWeight": "600", "marginBottom": "0.75rem"}}>
                                {"Public Test Suite"}
                                {(<span style={{"fontSize": "0.8rem", "fontWeight": "400", "color": "var(--text-muted)", "marginLeft": "0.5rem"}}>{"(" + String(publicTests.length) + " tests)"}</span>) if not testsLoading else None}
                            </h3>
                            {(
                                <div className="loading-container"><div className="spinner"></div></div>
                            ) if testsLoading else (
                                <div style={{"maxHeight": "300px", "overflowY": "auto"}}>
                                    {publicTests.map(lambda test: any -> any { return
                                        <div key={test["id"]} style={{"display": "flex", "justifyContent": "space-between", "padding": "0.375rem 0", "fontSize": "0.8rem", "borderBottom": "1px solid var(--border-primary)"}}>
                                            <span style={{"color": "var(--text-secondary)"}}>{test["id"]}</span>
                                            <div style={{"display": "flex", "gap": "0.5rem"}}>
                                                <span className="badge badge-blue">{"L" + String(test["level"])}</span>
                                                <span style={{"color": "var(--text-muted)"}}>{String(test["points"]) + "pts"}</span>
                                            </div>
                                        </div>; }
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>;
    }

    def BenchmarkPage(user: any) -> any {
        has apiKey: str = "";
        has model: str = "";
        has variant: str = "";
        has batchSize: int = 45;
        has models: list = [];
        has variants: list = [];
        has running: bool = False;
        has runId: str = "";
        has runStatus: any = None;
        has errorMsg: str = "";

        useEffect(lambda -> None {
            savedKey = localStorage.getItem("docbench_api_key");
            if savedKey { apiKey = savedKey; }
            savedModel = localStorage.getItem("docbench_model");
            if savedModel { model = savedModel; }
            savedVariant = localStorage.getItem("docbench_variant");
            if savedVariant { variant = savedVariant; }
            fetchVariants();
        }, []);

        async def fetchModels -> None {
            if not apiKey { return; }
            result = await apiCall("GetModels", {"api_key": apiKey}, {"X-API-Key": apiKey});
            if result and result["models"] { models = result["models"]; }
        }

        async def fetchVariants -> None {
            result = await apiCall("GetVariants");
            if result and result["variants"] { variants = result["variants"]; }
        }

        useEffect(lambda -> None { if apiKey { fetchModels(); } }, [apiKey]);

        async def startBenchmark -> None {
            if not apiKey or not model or not variant { errorMsg = "API key, model, and variant are required"; return; }
            errorMsg = "";
            running = True;
            result = await apiCall("RunBenchmark", {"model": model, "variant": variant, "batch_size": batchSize, "api_key": apiKey});
            if result and result["run_id"] { runId = result["run_id"]; pollRunning(); }
            elif result and result["error"] { errorMsg = result["error"]; running = False; }
            else { errorMsg = "Failed to start benchmark"; running = False; }
        }

        async def pollRunning -> None {
            result = await apiCall("GetRunning");
            if result and result["runs"] {
                runStatus = result;
                keys = Object.keys(result["runs"]);
                hasActive = keys.some(lambda k: any -> bool { return result["runs"][k]["status"] == "running"; });
                if hasActive { setTimeout(lambda -> None { pollRunning(); }, 3000); }
                else { running = False; }
            } else { running = False; }
        }

        if not user or not user["is_admin"] {
            return <div className="empty-state"><p className="empty-state-text">{"Admin access required"}</p></div>;
        }

        return
            <div>
                <div className="section-header">
                    <div><h1 className="section-title">{"Benchmark Runner"}</h1><p className="section-subtitle">{"Run benchmarks against LLM models"}</p></div>
                </div>
                {(<div className="alert alert-error">{errorMsg}</div>) if errorMsg else None}
                <div className="card" style={{"marginBottom": "1.5rem"}}>
                    <div className="controls-grid">
                        <div className="form-group">
                            <label className="form-label">{"API Key"}</label>
                            <input type="password" className="form-input" placeholder="sk-or-..." value={apiKey}
                                onChange={lambda e: any -> None { apiKey = e.target.value; localStorage.setItem("docbench_api_key", e.target.value); }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{"Model"}</label>
                            <select className="form-select" value={model}
                                onChange={lambda e: any -> None { model = e.target.value; localStorage.setItem("docbench_model", e.target.value); }}>
                                <option value="">{"Select model..."}</option>
                                {models.map(lambda m: any -> any { return <option key={m["id"]} value={m["id"]}>{m["name"] or m["id"]}</option>; })}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{"Variant"}</label>
                            <select className="form-select" value={variant}
                                onChange={lambda e: any -> None { variant = e.target.value; localStorage.setItem("docbench_variant", e.target.value); }}>
                                <option value="">{"Select variant..."}</option>
                                {variants.map(lambda v: any -> any { return <option key={v["name"]} value={v["name"]}>{v["name"] + " (" + String(v["size_kb"]) + " KB)"}</option>; })}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{"Batch Size"}</label>
                            <input type="number" className="form-input" value={batchSize}
                                onChange={lambda e: any -> None { batchSize = parseInt(e.target.value) or 45; }} />
                        </div>
                    </div>
                    <button className="btn btn-primary" disabled={running or not apiKey or not model or not variant}
                        onClick={lambda e: any -> None { startBenchmark(); }}>
                        {("Running...") if running else ("Run Benchmark")}
                    </button>
                </div>
                {(
                    <div className="card">
                        <h3 style={{"fontWeight": "600", "marginBottom": "1rem"}}>{"Active Runs"}</h3>
                        {Object.keys(runStatus["runs"]).map(lambda key: any -> any { return
                            <div key={key} style={{"padding": "0.75rem", "borderBottom": "1px solid var(--border-primary)", "display": "flex", "alignItems": "center", "justifyContent": "space-between"}}>
                                <div>
                                    <span style={{"fontWeight": "500", "fontSize": "0.875rem"}}>{key}</span>
                                    <div style={{"fontSize": "0.8rem", "color": "var(--text-muted)", "marginTop": "0.25rem"}}>{runStatus["runs"][key]["progress"] or ""}</div>
                                </div>
                                <span className={"status-dot " + ("status-running" if runStatus["runs"][key]["status"] == "running" else "status-completed")}></span>
                            </div>; }
                        )}
                    </div>
                ) if runStatus and runStatus["runs"] else None}
            </div>;
    }

    def FilesPage(user: any) -> any {
        has files: list = [];
        has stashes: list = [];
        has loading: bool = True;
        has activeTab: str = "files";
        has selectedStash: str = "";
        has stashFiles: list = [];

        async def fetchFiles -> None {
            loading = True;
            result = await apiCall("GetTestFiles", {"limit": 100});
            if result and result["files"] { files = result["files"]; }
            loading = False;
        }

        async def fetchStashes -> None {
            result = await apiCall("GetStashes");
            if result and result["stashes"] { stashes = result["stashes"]; }
        }

        async def fetchStashFiles(name: str) -> None {
            selectedStash = name;
            result = await apiCall("GetStashFiles", {"stash_name": name});
            if result and result["files"] { stashFiles = result["files"]; }
        }

        async def stashAll -> None {
            result = await apiCall("StashAll");
            if result and result["status"] == "success" { fetchFiles(); fetchStashes(); }
        }

        async def deleteFile(fp: str) -> None {
            result = await apiCall("DeleteFile", {"file_path": fp});
            if result { fetchFiles(); }
        }

        useEffect(lambda -> None { fetchFiles(); fetchStashes(); }, []);

        if not user or not user["is_admin"] {
            return <div className="empty-state"><p className="empty-state-text">{"Admin access required"}</p></div>;
        }

        return
            <div>
                <div className="section-header">
                    <div><h1 className="section-title">{"File Manager"}</h1><p className="section-subtitle">{"Manage benchmark results and collections"}</p></div>
                    <div style={{"display": "flex", "gap": "0.5rem"}}>
                        <button className="btn btn-primary" onClick={lambda e: any -> None { stashAll(); }}>{"Stash All"}</button>
                        <button className="btn btn-secondary" onClick={lambda e: any -> None { fetchFiles(); fetchStashes(); }}>{"Refresh"}</button>
                    </div>
                </div>
                <div className="tabs">
                    <button className={"tab" + (" active" if activeTab == "files" else "")} onClick={lambda e: any -> None { activeTab = "files"; }}>{"Test Files (" + String(files.length) + ")"}</button>
                    <button className={"tab" + (" active" if activeTab == "stashes" else "")} onClick={lambda e: any -> None { activeTab = "stashes"; }}>{"Collections (" + String(stashes.length) + ")"}</button>
                </div>
                {(<div className="loading-container"><div className="spinner"></div><span>{"Loading..."}</span></div>) if loading else None}
                {(
                    <div className="card" style={{"padding": "0.5rem"}}>
                        {(
                            <div className="file-list">
                                {files.map(lambda f: any, idx: any -> any { return
                                    <div key={String(idx)} className="file-item">
                                        <div>
                                            <span style={{"fontWeight": "500"}}>{f["run_id"] or f["file_path"] or "unknown"}</span>
                                            <div style={{"fontSize": "0.75rem", "color": "var(--text-muted)"}}>{(f["model"] or "") + " - " + (f["variant"] or "")}</div>
                                        </div>
                                        <div style={{"display": "flex", "alignItems": "center", "gap": "0.5rem"}}>
                                            {(<span className={"badge " + ("badge-green" if parseFloat(f["percentage"]) >= 80 else ("badge-amber" if parseFloat(f["percentage"]) >= 60 else "badge-red"))}>{String(parseFloat(f["percentage"]).toFixed(1)) + "%"}</span>) if f["percentage"] else None}
                                            <button className="btn btn-danger btn-sm" onClick={lambda e: any -> None { deleteFile(f["file_path"] or f["run_id"]); }}>{"x"}</button>
                                        </div>
                                    </div>; }
                                )}
                            </div>
                        ) if files.length > 0 else (
                            <div className="empty-state"><p className="empty-state-text">{"No test files"}</p></div>
                        )}
                    </div>
                ) if activeTab == "files" and not loading else None}
                {(
                    <div className="grid-2">
                        <div className="card" style={{"padding": "0.5rem"}}>
                            <div className="file-list">
                                {stashes.map(lambda stash: any -> any { return
                                    <div key={stash} className={"file-item" + (" active" if selectedStash == stash else "")} onClick={lambda e: any -> None { fetchStashFiles(stash); }}>
                                        <span>{stash}</span>
                                    </div>; }
                                )}
                            </div>
                        </div>
                        <div className="card">
                            {(
                                <div>
                                    <h4 style={{"fontWeight": "600", "marginBottom": "0.75rem"}}>{selectedStash}</h4>
                                    {stashFiles.map(lambda sf: any, idx: any -> any { return
                                        <div key={String(idx)} style={{"fontSize": "0.8rem", "padding": "0.375rem 0", "borderBottom": "1px solid var(--border-primary)"}}>
                                            {sf["run_id"] or sf["file_path"] or "file"}
                                        </div>; }
                                    )}
                                </div>
                            ) if selectedStash else (
                                <div className="empty-state"><p className="empty-state-text">{"Select a collection"}</p></div>
                            )}
                        </div>
                    </div>
                ) if activeTab == "stashes" and not loading else None}
            </div>;
    }

    def:pub app -> any {
        has user: any = None;
        has loading: bool = True;

        async def fetchUser -> None {
            token = localStorage.getItem("docbench_token");
            if token {
                result = await apiCall("GetCurrentUser");
                if result and result["user"] {
                    user = result["user"];
                } else {
                    localStorage.removeItem("docbench_token");
                }
            }
            loading = False;
        }

        def handleLogout -> None {
            localStorage.removeItem("docbench_token");
            user = None;
        }

        useEffect(lambda -> None { fetchUser(); }, []);

        return
            <Router>
                <div className="app-container">
                    <AppHeader user={user} onLogout={lambda -> None { handleLogout(); }} />
                    <div className="main-content">
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/leaderboard" element={<LeaderboardPage />} />
                            <Route path="/submit" element={<SubmitPage />} />
                            <Route path="/benchmark" element={<BenchmarkPage user={user} />} />
                            <Route path="/files" element={<FilesPage user={user} />} />
                            <Route path="/auth/callback" element={<AuthCallbackPage onLogin={lambda -> None { fetchUser(); }} />} />
                        </Routes>
                    </div>
                </div>
            </Router>;
    }
}
