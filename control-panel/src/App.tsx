import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import BenchmarkView from '@/views/BenchmarkView'
import FileManager from '@/views/FileManager'
import StatsPanel from '@/views/StatsPanel'
import VariantsView from '@/views/VariantsView'
import UsersView from '@/views/UsersView'
import LeaderboardView from '@/views/LeaderboardView'
import PublicBenchmarkView from '@/views/PublicBenchmarkView'
import HomeView from '@/views/HomeView'
import AuthCallback from '@/views/AuthCallback'
import UserMenu from '@/components/UserMenu'
import LoginButton from '@/components/LoginButton'
import type { Model, Variant, TestFile, Stash, User } from '@/utils/types'
import { API_BASE } from '@/utils/types'
import { getStoredToken, fetchCurrentUser, clearStoredToken, getAdminHeaders } from '@/utils/auth'

function AdminDropdown({
  isAuthenticated,
  testFilesCount,
  variantsCount
}: {
  isAuthenticated: boolean
  testFilesCount: number
  variantsCount: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  const isAdminRoute = ['/benchmark', '/files', '/variants', '/statistics', '/users'].includes(location.pathname)

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`btn flex items-center gap-2 ${isAdminRoute ? 'btn-primary' : 'btn-accent'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        Admin
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-terminal-border">
            <span className="text-xs text-gray-500 uppercase tracking-wide px-2">Admin Panel</span>
          </div>
          <div className="py-1">
            <Link
              to="/benchmark"
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                location.pathname === '/benchmark'
                  ? 'bg-zinc-800 text-terminal-accent'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10"></path>
                <path d="M18 20V4"></path>
                <path d="M6 20v-4"></path>
              </svg>
              Benchmark
            </Link>
            <Link
              to="/files"
              className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                location.pathname === '/files'
                  ? 'bg-zinc-800 text-terminal-accent'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                Files
              </span>
              {testFilesCount > 0 && (
                <span className="bg-terminal-accent text-black px-1.5 py-0.5 rounded text-xs font-semibold">
                  {testFilesCount}
                </span>
              )}
            </Link>
            <Link
              to="/variants"
              className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                location.pathname === '/variants'
                  ? 'bg-zinc-800 text-terminal-accent'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                Variants
              </span>
              {variantsCount > 0 && (
                <span className="bg-terminal-accent text-black px-1.5 py-0.5 rounded text-xs font-semibold">
                  {variantsCount}
                </span>
              )}
            </Link>
            <Link
              to="/statistics"
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                location.pathname === '/statistics'
                  ? 'bg-zinc-800 text-terminal-accent'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Statistics
            </Link>
            <Link
              to="/users"
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                location.pathname === '/users'
                  ? 'bg-zinc-800 text-terminal-accent'
                  : 'text-gray-300 hover:bg-zinc-800'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Users
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function AppContent() {
  const [models, setModels] = useState<Model[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [testFiles, setTestFiles] = useState<TestFile[]>([])
  const [stashes, setStashes] = useState<Stash[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [openRouterKey, setOpenRouterKey] = useState(() => localStorage.getItem('openRouterApiKey') || '')
  const [keyError, setKeyError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const location = useLocation()

  const isAuthenticated = user?.is_admin || false

  const handleUserLogin = useCallback((loggedInUser: User, token: string) => {
    setUser(loggedInUser)
  }, [])

  const handleUserLogout = useCallback(() => {
    clearStoredToken()
    setUser(null)
  }, [])

  const handleApiKeyChange = (key: string) => {
    setOpenRouterKey(key)
    if (key) {
      localStorage.setItem('openRouterApiKey', key)
    } else {
      localStorage.removeItem('openRouterApiKey')
    }
    setKeyError('')
  }

  const fetchModels = async (apiKey?: string) => {
    const key = apiKey ?? openRouterKey
    if (!key) {
      setModels([])
      return
    }
    try {
      const res = await fetch(`${API_BASE}/models`, { headers: { 'X-API-Key': key } })
      const data = await res.json()
      if (data.error) {
        setKeyError(data.error)
        setModels([])
      } else {
        setKeyError('')
        setModels(data.models || [])
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
    }
  }

  useEffect(() => {
    const savedKey = localStorage.getItem('openRouterApiKey') || ''
    const initializeApp = async () => {
      const userPromise = getStoredToken() ? fetchCurrentUser() : Promise.resolve(null)

      await Promise.all([
        fetchModels(savedKey),
        fetchVariants()
      ])

      const fetchedUser = await userPromise
      if (fetchedUser) {
        setUser(fetchedUser)
        if (fetchedUser.is_admin) {
          await Promise.all([fetchTestFiles(), fetchStashes(), fetchStats()])
        }
      }

      setIsLoading(false)
    }
    initializeApp()
  }, [])

  useEffect(() => {
    if (openRouterKey) {
      fetchModels(openRouterKey)
    }
  }, [openRouterKey])

  useEffect(() => {
    if (user?.is_admin) {
      fetchTestFiles()
      fetchStashes()
      fetchStats()
    }
  }, [user])

  const fetchVariants = async () => {
    try {
      const res = await fetch(`${API_BASE}/variants`)
      const data = await res.json()
      setVariants(data.variants || [])
    } catch (error) {
      console.error('Failed to fetch variants:', error)
    }
  }

  const fetchTestFiles = async () => {
    const headers = getAdminHeaders()
    if (!Object.keys(headers).length) return
    try {
      const res = await fetch(`${API_BASE}/test-files`, { headers })
      if (res.ok) {
        const data = await res.json()
        setTestFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch test files:', error)
    }
  }

  const fetchStashes = async () => {
    const headers = getAdminHeaders()
    if (!Object.keys(headers).length) return
    try {
      const res = await fetch(`${API_BASE}/stashes`, { headers })
      if (res.ok) {
        const data = await res.json()
        setStashes(data.stashes || [])
      }
    } catch (error) {
      console.error('Failed to fetch stashes:', error)
    }
  }

  const fetchStats = async () => {
    const headers = getAdminHeaders()
    if (!Object.keys(headers).length) return
    try {
      const res = await fetch(`${API_BASE}/stats`, { headers })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const stashResults = async () => {
    const headers = getAdminHeaders()
    if (!Object.keys(headers).length) return
    try {
      await fetch(`${API_BASE}/stash`, {
        method: 'POST',
        headers
      })
      await fetchTestFiles()
      await fetchStashes()
    } catch (error) {
      console.error('Failed to stash results:', error)
    }
  }

  const cleanResults = async () => {
    const headers = getAdminHeaders()
    if (!Object.keys(headers).length) return
    try {
      await fetch(`${API_BASE}/clean`, {
        method: 'POST',
        headers
      })
      await fetchTestFiles()
      await fetchStashes()
    } catch (error) {
      console.error('Failed to clean results:', error)
    }
  }

  const clearDatabase = async () => {
    const headers = getAdminHeaders()
    if (!Object.keys(headers).length) return
    try {
      await fetch(`${API_BASE}/clear-db`, {
        method: 'POST',
        headers
      })
      await fetchTestFiles()
      await fetchStashes()
    } catch (error) {
      console.error('Failed to clear database:', error)
    }
  }

  const deleteFile = async (filePath: string) => {
    const headers = getAdminHeaders()
    if (!Object.keys(headers).length) return
    try {
      await fetch(`${API_BASE}/delete-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ file_path: filePath })
      })
      await fetchTestFiles()
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  const handleBenchmarkComplete = () => {
    fetchTestFiles()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-terminal-bg">
        <div className="text-center">
          <img src="/jaseci-logo.png" alt="Jaseci" className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-text-secondary">Loading DocBench...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-terminal-bg text-text-primary">
      <header className="bg-terminal-surface border-b border-terminal-border px-8 py-5">
        <div className="max-w-screen-2xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/jaseci-logo.png" alt="Jaseci" className="w-9 h-9" />
            <h1 className="text-text-primary text-xl font-semibold tracking-tight">Jaseci <span className="text-terminal-accent">DocBench</span></h1>
          </Link>

          <nav className="flex gap-2 items-center">
            <Link
              to="/leaderboard"
              className={`btn ${location.pathname === '/leaderboard' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Leaderboard
            </Link>
            <Link
              to="/submit"
              className={`btn ${location.pathname === '/submit' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Submit
            </Link>
            <span className="border-l border-terminal-border mx-2 h-6"></span>
            {user ? (
              <UserMenu user={user} onLogout={handleUserLogout} />
            ) : (
              <LoginButton />
            )}
            <span className="border-l border-terminal-border mx-2 h-6"></span>
            <AdminDropdown
              isAuthenticated={user?.is_admin || false}
              testFilesCount={testFiles.length}
              variantsCount={variants.length}
            />
          </nav>
        </div>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-screen-2xl mx-auto">
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/leaderboard" element={<LeaderboardView />} />
            <Route path="/submit" element={<PublicBenchmarkView />} />
            <Route path="/auth/callback" element={<AuthCallback onLogin={handleUserLogin} />} />
            <Route
              path="/benchmark"
              element={
                <BenchmarkView
                  models={models}
                  variants={variants}
                  testFiles={testFiles}
                  onBenchmarkComplete={handleBenchmarkComplete}
                  apiKey={openRouterKey}
                  onApiKeyChange={handleApiKeyChange}
                  keyError={keyError}
                />
              }
            />
            <Route
              path="/files"
              element={
                isAuthenticated ? (
                  <FileManager
                    files={testFiles}
                    stashes={stashes}
                    onStash={stashResults}
                    onClean={cleanResults}
                    onClearDb={clearDatabase}
                    onRefresh={() => {
                      fetchTestFiles()
                      fetchStashes()
                    }}
                    onDelete={deleteFile}
                  />
                ) : (
                  <div className="bg-terminal-surface border border-terminal-border rounded p-12 text-center">
                    <h3 className="text-gray-300 text-xl mb-2">Authentication Required</h3>
                    <p className="text-gray-500">Please sign in with GitHub to access this page.</p>
                  </div>
                )
              }
            />
            <Route
              path="/variants"
              element={
                isAuthenticated ? (
                  <VariantsView
                    variants={variants}
                    onRefresh={fetchVariants}
                  />
                ) : (
                  <div className="bg-terminal-surface border border-terminal-border rounded p-12 text-center">
                    <h3 className="text-gray-300 text-xl mb-2">Authentication Required</h3>
                    <p className="text-gray-500">Please sign in with GitHub to access this page.</p>
                  </div>
                )
              }
            />
            <Route
              path="/statistics"
              element={
                isAuthenticated ? (
                  stats ? (
                    <StatsPanel stats={stats} apiKeyConfigured={!!openRouterKey && models.length > 0} />
                  ) : (
                    <div className="bg-terminal-surface border border-terminal-border rounded p-12 text-center">
                      <h3 className="text-gray-300 text-xl mb-2">Loading Statistics...</h3>
                    </div>
                  )
                ) : (
                  <div className="bg-terminal-surface border border-terminal-border rounded p-12 text-center">
                    <h3 className="text-gray-300 text-xl mb-2">Authentication Required</h3>
                    <p className="text-gray-500">Please sign in with GitHub to access this page.</p>
                  </div>
                )
              }
            />
            <Route
              path="/users"
              element={
                isAuthenticated ? (
                  <UsersView />
                ) : (
                  <div className="bg-terminal-surface border border-terminal-border rounded p-12 text-center">
                    <h3 className="text-gray-300 text-xl mb-2">Authentication Required</h3>
                    <p className="text-gray-500">Please sign in with GitHub to access this page.</p>
                  </div>
                )
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
