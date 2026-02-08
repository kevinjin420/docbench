import from react { useEffect }
sv import from walkers.admin { AdminListUsers, AdminSetAdmin, AdminListEmails, AdminAddEmail, AdminRemoveEmail }

def:pub UsersView() -> any {
    has users: list = [];
    has admin_emails: list = [];
    has new_email: str = "";
    has is_loading: bool = True;

    useEffect(lambda -> None {
        refresh();
    }, []);

    async def refresh() -> None {
        is_loading = True;
        user_result: any = root spawn AdminListUsers();
        if user_result.reports {
            users = (user_result.reports[0]["users"] or []);
        }
        email_result: any = root spawn AdminListEmails();
        if email_result.reports {
            admin_emails = (email_result.reports[0]["emails"] or []);
        }
        is_loading = False;
    }

    async def toggle_admin(user_id: str, make_admin: bool) -> None {
        result: any = root spawn AdminSetAdmin(user_id=user_id, is_admin=make_admin);
        await refresh();
    }

    async def add_email() -> None {
        if not new_email.trim() {
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
        return <div className="text-center py-20">
            <p className="text-text-secondary">Loading...</p>
        </div>;
    }

    return <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-6">User Management</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-terminal-border">
                        <h3 className="text-text-primary font-medium">Users ({String(users.length)})</h3>
                    </div>
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-terminal-border">
                                <th className="px-4 py-2 text-left text-xs text-text-muted uppercase">User</th>
                                <th className="px-4 py-2 text-left text-xs text-text-muted uppercase">Email</th>
                                <th className="px-4 py-2 text-center text-xs text-text-muted uppercase">Admin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[<tr key={(u["id"] or String(users.indexOf(u)))} className="border-b border-terminal-border">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {(<img src={u["avatar_url"]} className="w-8 h-8 rounded-full" />) if (u["avatar_url"] or "") else (<div className="w-8 h-8 rounded-full bg-terminal-accent-muted"></div>)}
                                        <span className="text-text-primary text-sm">{(u["username"] or "")}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-text-secondary text-sm">{(u["email"] or "")}</td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={lambda e: any -> None { toggle_admin((u["id"] or ""), not (u["is_admin"] or False)); }}
                                        className={("px-2 py-1 text-xs rounded bg-terminal-accent text-white") if (u["is_admin"] or False) else ("px-2 py-1 text-xs rounded bg-terminal-bg text-text-muted border border-terminal-border")}
                                    >
                                        {("Admin") if (u["is_admin"] or False) else ("User")}
                                    </button>
                                </td>
                              </tr>
                              for u in users
                            ]}
                        </tbody>
                    </table>
                    {(<div className="p-8 text-center">
                        <p className="text-text-muted text-sm">No users registered.</p>
                      </div>)
                    if users.length == 0
                    else (<span></span>)
                    }
                </div>
            </div>

            <div>
                <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
                    <h3 className="text-text-primary font-medium mb-4">Admin Emails</h3>
                    <p className="text-text-muted text-xs mb-3">
                        Users with these emails get admin access on login.
                    </p>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="email"
                            value={new_email}
                            onChange={lambda e: any -> None { new_email = e.target.value; }}
                            placeholder="user@example.com"
                            className="flex-1 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-text-primary text-sm"
                        />
                        <button
                            onClick={lambda e: any -> None { add_email(); }}
                            className="btn btn-primary btn-sm"
                        >
                            Add
                        </button>
                    </div>
                    <div className="space-y-2">
                        {[<div key={em} className="flex items-center justify-between py-1">
                            <span className="text-text-secondary text-sm truncate">{em}</span>
                            <button
                                onClick={lambda e: any -> None { remove_email(em); }}
                                className="text-red-400 text-xs hover:text-red-300"
                            >
                                Remove
                            </button>
                          </div>
                          for em in admin_emails
                        ]}
                        {(<p className="text-text-muted text-xs text-center py-2">No admin emails configured.</p>) if admin_emails.length == 0 else (<span></span>)}
                    </div>
                </div>
            </div>
        </div>
    </div>;
}
