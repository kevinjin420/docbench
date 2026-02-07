import:jac from walkers.admin, AdminListUsers, AdminSetAdmin, AdminListEmails, AdminAddEmail, AdminRemoveEmail;

cl {
    def:pub UsersView() -> any {
        has users: list = [];
        has admin_emails: list = [];
        has new_email: str = "";
        has is_loading: bool = True;

        async can with entry {
            await refresh();
        }

        async def refresh() -> None {
            is_loading = True;
            user_result: any = root spawn AdminListUsers();
            if user_result.reports {
                users = user_result.reports[0].get("users", []);
            }
            email_result: any = root spawn AdminListEmails();
            if email_result.reports {
                admin_emails = email_result.reports[0].get("emails", []);
            }
            is_loading = False;
        }

        async def toggle_admin(user_id: str, make_admin: bool) -> None {
            result: any = root spawn AdminSetAdmin(user_id=user_id, is_admin=make_admin);
            await refresh();
        }

        async def add_email() -> None {
            if not new_email.strip() {
                return;
            }
            result: any = root spawn AdminAddEmail(email=new_email);
            new_email = "";
            await refresh();
        }

        async def remove_email(email: str) -> None {
            result: any = root spawn AdminRemoveEmail(email=email);
            await refresh();
        }

        if is_loading {
            return <div class="text-center py-20">
                <p class="text-text-secondary">Loading...</p>
            </div>;
        }

        return <div class="max-w-6xl mx-auto">
            <h1 class="text-3xl font-bold text-text-primary mb-6">User Management</h1>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2">
                    <div class="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
                        <div class="px-4 py-3 border-b border-terminal-border">
                            <h3 class="text-text-primary font-medium">Users ({str(len(users))})</h3>
                        </div>
                        <table class="w-full">
                            <thead>
                                <tr class="border-b border-terminal-border">
                                    <th class="px-4 py-2 text-left text-xs text-text-muted uppercase">User</th>
                                    <th class="px-4 py-2 text-left text-xs text-text-muted uppercase">Email</th>
                                    <th class="px-4 py-2 text-center text-xs text-text-muted uppercase">Admin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[<tr key={u.get("id", str(i))} class="border-b border-terminal-border">
                                    <td class="px-4 py-3">
                                        <div class="flex items-center gap-3">
                                            {u.get("avatar_url", "")
                                                ? <img src={u["avatar_url"]} class="w-8 h-8 rounded-full" />
                                                : <div class="w-8 h-8 rounded-full bg-terminal-accent-muted"></div>
                                            }
                                            <span class="text-text-primary text-sm">{u.get("username", "")}</span>
                                        </div>
                                    </td>
                                    <td class="px-4 py-3 text-text-secondary text-sm">{u.get("email", "")}</td>
                                    <td class="px-4 py-3 text-center">
                                        <button
                                            onClick={lambda e: any -> None { toggle_admin(u.get("id", ""), not u.get("is_admin", False)); }}
                                            class={u.get("is_admin", False)
                                                ? "px-2 py-1 text-xs rounded bg-terminal-accent text-white"
                                                : "px-2 py-1 text-xs rounded bg-terminal-bg text-text-muted border border-terminal-border"
                                            }
                                        >
                                            {u.get("is_admin", False) ? "Admin" : "User"}
                                        </button>
                                    </td>
                                  </tr>
                                  for (i, u) in enumerate(users)
                                ]}
                            </tbody>
                        </table>
                        {len(users) == 0
                            ? <div class="p-8 text-center">
                                <p class="text-text-muted text-sm">No users registered.</p>
                              </div>
                            : <span></span>
                        }
                    </div>
                </div>

                <div>
                    <div class="bg-terminal-surface border border-terminal-border rounded-lg p-4">
                        <h3 class="text-text-primary font-medium mb-4">Admin Emails</h3>
                        <p class="text-text-muted text-xs mb-3">
                            Users with these emails get admin access on login.
                        </p>
                        <div class="flex gap-2 mb-4">
                            <input
                                type="email"
                                value={new_email}
                                onChange={lambda e: any -> None { new_email = e.target.value; }}
                                placeholder="user@example.com"
                                class="flex-1 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                            />
                            <button
                                onClick={lambda e: any -> None { add_email(); }}
                                class="btn btn-primary btn-sm"
                            >
                                Add
                            </button>
                        </div>
                        <div class="space-y-2">
                            {[<div key={em} class="flex items-center justify-between py-1">
                                <span class="text-text-secondary text-sm truncate">{em}</span>
                                <button
                                    onClick={lambda e: any -> None { remove_email(em); }}
                                    class="text-red-400 text-xs hover:text-red-300"
                                >
                                    Remove
                                </button>
                              </div>
                              for em in admin_emails
                            ]}
                            {len(admin_emails) == 0
                                ? <p class="text-text-muted text-xs text-center py-2">No admin emails configured.</p>
                                : <span></span>
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>;
    }
}
