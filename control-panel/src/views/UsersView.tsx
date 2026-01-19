import { useState, useEffect } from 'react'
import { API_BASE } from '@/utils/types'
import { getAdminHeaders } from '@/utils/auth'

interface User {
  id: number
  email: string
  name: string | null
  github_id: string
  is_admin: boolean
  created_at: number
  last_login_at: number | null
}

interface AdminEmail {
  id: number
  email: string
  added_at: number
  added_by: number | null
}

export default function UsersView() {
  const [users, setUsers] = useState<User[]>([])
  const [adminEmailsEnv, setAdminEmailsEnv] = useState<string[]>([])
  const [adminEmailsDb, setAdminEmailsDb] = useState<AdminEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [addingEmail, setAddingEmail] = useState(false)
  const [removingEmailId, setRemovingEmailId] = useState<number | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchAdminEmails()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: getAdminHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
        setAdminEmailsEnv(data.admin_emails_env || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAdminEmails = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/admin-emails`, {
        headers: getAdminHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setAdminEmailsDb(data.emails || [])
      }
    } catch (error) {
      console.error('Failed to fetch admin emails:', error)
    }
  }

  const addAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) return

    setAddingEmail(true)
    try {
      const res = await fetch(`${API_BASE}/admin/admin-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ email: newEmail.trim() })
      })
      if (res.ok) {
        setNewEmail('')
        fetchAdminEmails()
      }
    } catch (error) {
      console.error('Failed to add admin email:', error)
    } finally {
      setAddingEmail(false)
    }
  }

  const removeAdminEmail = async (emailId: number) => {
    setRemovingEmailId(emailId)
    try {
      const res = await fetch(`${API_BASE}/admin/admin-emails/${emailId}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      })
      if (res.ok) {
        setAdminEmailsDb(adminEmailsDb.filter(e => e.id !== emailId))
      }
    } catch (error) {
      console.error('Failed to remove admin email:', error)
    } finally {
      setRemovingEmailId(null)
    }
  }

  const toggleAdmin = async (userId: number, currentStatus: boolean) => {
    setUpdating(userId)
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ is_admin: !currentStatus })
      })
      if (res.ok) {
        setUsers(users.map(u =>
          u.id === userId ? { ...u, is_admin: !currentStatus } : u
        ))
      }
    } catch (error) {
      console.error('Failed to update user:', error)
    } finally {
      setUpdating(null)
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isEnvAdmin = (email: string) => {
    return adminEmailsEnv.includes(email.toLowerCase())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const adminUsers = users.filter(u => u.is_admin)
  const regularUsers = users.filter(u => !u.is_admin)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">User Management</h2>
        <p className="text-text-muted mt-1">Manage user access and admin privileges</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-terminal-border">
            <h3 className="text-text-primary font-medium">
              Environment Admin Emails ({adminEmailsEnv.length})
            </h3>
            <p className="text-text-muted text-xs mt-1">From ADMIN_EMAILS env variable (read-only)</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {adminEmailsEnv.length === 0 ? (
              <div className="p-4 text-text-muted text-sm">No env emails configured</div>
            ) : (
              <ul className="divide-y divide-terminal-border/50">
                {adminEmailsEnv.map(email => (
                  <li key={email} className="px-4 py-3 hover:bg-terminal-elevated/30">
                    <span className="text-text-secondary text-sm font-mono">{email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-terminal-border">
            <h3 className="text-text-primary font-medium">
              Database Admin Emails ({adminEmailsDb.length})
            </h3>
            <p className="text-text-muted text-xs mt-1">Managed via this panel</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {adminEmailsDb.length === 0 ? (
              <div className="p-4 text-text-muted text-sm">No database emails configured</div>
            ) : (
              <ul className="divide-y divide-terminal-border/50">
                {adminEmailsDb.map(email => (
                  <li key={email.id} className="px-4 py-3 flex items-center justify-between hover:bg-terminal-elevated/30">
                    <span className="text-text-secondary text-sm font-mono">{email.email}</span>
                    <button
                      onClick={() => removeAdminEmail(email.id)}
                      disabled={removingEmailId === email.id}
                      className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {removingEmailId === email.id ? 'Removing...' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-4 py-3 border-t border-terminal-border">
            <form onSubmit={addAdminEmail} className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-3 py-1.5 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm font-mono placeholder-text-muted focus:outline-none focus:border-terminal-accent"
              />
              <button
                type="submit"
                disabled={addingEmail || !newEmail.trim()}
                className="px-3 py-1.5 text-xs bg-terminal-accent/20 text-terminal-accent rounded hover:bg-terminal-accent/30 transition-colors disabled:opacity-50"
              >
                {addingEmail ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-terminal-border">
          <h3 className="text-text-primary font-medium">
            Admins ({adminUsers.length})
          </h3>
        </div>
        {adminUsers.length === 0 ? (
          <div className="p-4 text-text-muted text-sm">No admin users</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-muted text-xs border-b border-terminal-border">
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Last Login</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map(user => (
                <tr key={user.id} className="border-b border-terminal-border/50 hover:bg-terminal-elevated/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://avatars.githubusercontent.com/u/${user.github_id}`}
                        alt={user.name || 'User'}
                        className="w-8 h-8 rounded-full"
                      />
                      <div>
                        <p className="text-text-primary font-medium">{user.name || 'Unknown'}</p>
                        <p className="text-text-muted text-xs">ID: {user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text-secondary text-sm font-mono">{user.email}</span>
                    {isEnvAdmin(user.email) && (
                      <span className="ml-2 px-1.5 py-0.5 bg-terminal-accent/20 text-terminal-accent text-xs rounded">
                        env
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-sm">
                    {formatDate(user.last_login_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleAdmin(user.id, user.is_admin)}
                      disabled={updating === user.id}
                      className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {updating === user.id ? 'Updating...' : 'Remove Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-terminal-border">
          <h3 className="text-text-primary font-medium">
            Regular Users ({regularUsers.length})
          </h3>
        </div>
        {regularUsers.length === 0 ? (
          <div className="p-4 text-text-muted text-sm">No regular users</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-muted text-xs border-b border-terminal-border">
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Joined</th>
                <th className="px-4 py-2 font-medium">Last Login</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regularUsers.map(user => (
                <tr key={user.id} className="border-b border-terminal-border/50 hover:bg-terminal-elevated/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://avatars.githubusercontent.com/u/${user.github_id}`}
                        alt={user.name || 'User'}
                        className="w-8 h-8 rounded-full"
                      />
                      <div>
                        <p className="text-text-primary font-medium">{user.name || 'Unknown'}</p>
                        <p className="text-text-muted text-xs">ID: {user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text-secondary text-sm font-mono">{user.email}</span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-sm">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-sm">
                    {formatDate(user.last_login_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleAdmin(user.id, user.is_admin)}
                      disabled={updating === user.id}
                      className="px-3 py-1.5 text-xs bg-terminal-accent/20 text-terminal-accent rounded hover:bg-terminal-accent/30 transition-colors disabled:opacity-50"
                    >
                      {updating === user.id ? 'Updating...' : 'Make Admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
