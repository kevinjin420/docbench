import:jac from walkers.models_variants, ListVariants, CreateVariant, DeleteVariant;

cl {
    def:pub VariantsView(props: dict) -> any {
        has variants: list = [];
        has new_name: str = "";
        has new_url: str = "";
        has is_loading: bool = True;
        has error_msg: str = "";

        async can with entry {
            await refresh();
        }

        async def refresh() -> None {
            is_loading = True;
            result: any = root spawn ListVariants();
            if result.reports {
                variants = result.reports[0].get("variants", []);
            }
            is_loading = False;
        }

        async def add_variant() -> None {
            if not new_name.strip() or not new_url.strip() {
                error_msg = "Name and URL are required.";
                return;
            }
            error_msg = "";
            result: any = root spawn CreateVariant(variant_name=new_name, url=new_url);
            if result.reports {
                data: dict = result.reports[0];
                if "error" in data {
                    error_msg = data["error"];
                    return;
                }
            }
            new_name = "";
            new_url = "";
            await refresh();
        }

        async def remove_variant(name: str) -> None {
            result: any = root spawn DeleteVariant(variant_name=name);
            await refresh();
        }

        if is_loading {
            return <div class="text-center py-20">
                <p class="text-text-secondary">Loading variants...</p>
            </div>;
        }

        return <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold text-text-primary mb-6">Documentation Variants</h1>

            <div class="bg-terminal-surface border border-terminal-border rounded-lg p-6 mb-6">
                <h2 class="text-lg font-semibold text-text-primary mb-4">Add New Variant</h2>
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm text-text-secondary mb-1">Name</label>
                        <input
                            type="text"
                            value={new_name}
                            onChange={lambda e: any -> None { new_name = e.target.value; }}
                            placeholder="e.g. official-v2"
                            class="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                        />
                    </div>
                    <div>
                        <label class="block text-sm text-text-secondary mb-1">Documentation URL</label>
                        <input
                            type="url"
                            value={new_url}
                            onChange={lambda e: any -> None { new_url = e.target.value; }}
                            placeholder="https://example.com/jac-docs.md"
                            class="w-full px-3 py-2 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                        />
                    </div>
                    {error_msg
                        ? <p class="text-red-400 text-xs">{error_msg}</p>
                        : <span></span>
                    }
                    <button
                        onClick={lambda e: any -> None { add_variant(); }}
                        class="btn btn-primary"
                    >
                        Add Variant
                    </button>
                </div>
            </div>

            <div class="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
                <div class="px-4 py-3 border-b border-terminal-border">
                    <h3 class="text-text-primary font-medium">Variants ({str(len(variants))})</h3>
                </div>
                {len(variants) > 0
                    ? <div>
                        {[<div key={v["variant_name"]} class="px-4 py-3 border-b border-terminal-border flex items-center justify-between">
                            <div>
                                <div class="text-text-primary font-medium">{v["variant_name"]}</div>
                                <div class="text-text-muted text-xs truncate max-w-md">{v.get("url", "")}</div>
                            </div>
                            <button
                                onClick={lambda e: any -> None { remove_variant(v["variant_name"]); }}
                                class="btn btn-danger btn-sm"
                            >
                                Delete
                            </button>
                          </div>
                          for v in variants
                        ]}
                      </div>
                    : <div class="p-8 text-center">
                        <p class="text-text-muted">No documentation variants configured.</p>
                      </div>
                }
            </div>
        </div>;
    }
}
