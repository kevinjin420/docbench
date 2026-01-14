import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import BenchmarkView from '@/views/BenchmarkView'
import FileManager from '@/views/FileManager'
import StatsPanel from '@/views/StatsPanel'
import VariantsView from '@/views/VariantsView'
import LeaderboardView from '@/views/LeaderboardView'
import PublicBenchmarkView from '@/views/PublicBenchmarkView'
import HomeView from '@/views/HomeView'
import type { Model, Variant, TestFile, Stash } from '@/utils/types'
import { API_BASE } from '@/utils/types'

function AdminLoginModal({ isOpen, onClose, onTokenChange }: {
  isOpen: boolean
  onClose: () => void
  onTokenChange: (token: string) => Promise<boolean>
}) {
  const [tokenInput, setTokenInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTokenInput('')
      setError('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenInput.trim()) return
    setLoading(true)
    setError('')
    const success = await onTokenChange(tokenInput)
    setLoading(false)
    if (success) {
      onClose()
    } else {
      setError('Invalid access token')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 w-96" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={tokenInput}
            onChange={e => { setTokenInput(e.target.value); setError('') }}
            placeholder="Enter access token"
            className={`w-full px-3 py-2 bg-zinc-900 border rounded text-sm text-gray-300 focus:outline-none mb-2 ${
              error ? 'border-red-500' : 'border-terminal-border focus:border-terminal-accent'
            }`}
            autoFocus
            disabled={loading}
          />
          {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading || !tokenInput.trim()}
            >
              {loading ? 'Validating...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdminDropdown({
  isAuthenticated,
  onLoginClick,
  onLogout,
  testFilesCount,
  variantsCount
}: {
  isAuthenticated: boolean
  onLoginClick: () => void
  onLogout: () => void
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

  const isAdminRoute = ['/benchmark', '/files', '/variants', '/statistics'].includes(location.pathname)

  if (!isAuthenticated) {
    return (
      <button
        onClick={onLoginClick}
        className="btn btn-secondary flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        Admin
      </button>
    )
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
          </div>
          <div className="border-t border-terminal-border py-1">
            <button
              onClick={onLogout}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-950 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </button>
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
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken') || '')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const location = useLocation()

  const handleAccessTokenChange = async (token: string): Promise<boolean> => {
    if (!token) {
      setAccessToken('')
      localStorage.removeItem('accessToken')
      setIsAuthenticated(false)
      return false
    }
    const valid = await validateToken(token)
    if (valid) {
      setAccessToken(token)
      localStorage.setItem('accessToken', token)
    }
    return valid
  }

  const handleLogout = () => {
    setAccessToken('')
    localStorage.removeItem('accessToken')
    setIsAuthenticated(false)
    setShowAdminModal(false)
  }

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

  const validateToken = async (token: string) => {
    if (!token) {
      setIsAuthenticated(false)
      return false
    }
    try {
      const res = await fetch(`${API_BASE}/auth/validate`, {
        method: 'POST',
        headers: { 'X-Access-Token': token }
      })
      const valid = res.ok
      setIsAuthenticated(valid)
      return valid
    } catch {
      setIsAuthenticated(false)
      return false
    }
  }

  useEffect(() => {
    const savedKey = localStorage.getItem('openRouterApiKey') || ''
    const savedToken = localStorage.getItem('accessToken') || ''
    const initializeApp = async () => {
      await Promise.all([
        fetchModels(savedKey),
        fetchVariants()
      ])
      if (savedToken) {
        const valid = await validateToken(savedToken)
        if (valid) {
          await Promise.all([fetchTestFiles(), fetchStashes(), fetchStats()])
        } else {
          setAccessToken('')
          localStorage.removeItem('accessToken')
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
    if (accessToken && isAuthenticated) {
      fetchTestFiles()
      fetchStashes()
      fetchStats()
    }
  }, [isAuthenticated])

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
    if (!accessToken) return
    try {
      const res = await fetch(`${API_BASE}/test-files`, {
        headers: { 'X-Access-Token': accessToken }
      })
      if (res.ok) {
        const data = await res.json()
        setTestFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch test files:', error)
    }
  }

  const fetchStashes = async () => {
    if (!accessToken) return
    try {
      const res = await fetch(`${API_BASE}/stashes`, {
        headers: { 'X-Access-Token': accessToken }
      })
      if (res.ok) {
        const data = await res.json()
        setStashes(data.stashes || [])
      }
    } catch (error) {
      console.error('Failed to fetch stashes:', error)
    }
  }

  const fetchStats = async () => {
    if (!accessToken) return
    try {
      const res = await fetch(`${API_BASE}/stats`, {
        headers: { 'X-Access-Token': accessToken }
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const stashResults = async () => {
    if (!accessToken) return
    try {
      await fetch(`${API_BASE}/stash`, {
        method: 'POST',
        headers: { 'X-Access-Token': accessToken }
      })
      await fetchTestFiles()
      await fetchStashes()
    } catch (error) {
      console.error('Failed to stash results:', error)
    }
  }

  const cleanResults = async () => {
    if (!accessToken) return
    try {
      await fetch(`${API_BASE}/clean`, {
        method: 'POST',
        headers: { 'X-Access-Token': accessToken }
      })
      await fetchTestFiles()
      await fetchStashes()
    } catch (error) {
      console.error('Failed to clean results:', error)
    }
  }

  const clearDatabase = async () => {
    if (!accessToken) return
    try {
      await fetch(`${API_BASE}/clear-db`, {
        method: 'POST',
        headers: { 'X-Access-Token': accessToken }
      })
      await fetchTestFiles()
      await fetchStashes()
    } catch (error) {
      console.error('Failed to clear database:', error)
    }
  }

  const deleteFile = async (filePath: string) => {
    if (!accessToken) return
    try {
      await fetch(`${API_BASE}/delete-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Token': accessToken
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
            <AdminDropdown
              isAuthenticated={isAuthenticated}
              onLoginClick={() => setShowAdminModal(true)}
              onLogout={handleLogout}
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
                  accessToken={accessToken}
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
                    accessToken={accessToken}
                  />
                ) : (
                  <div className="bg-terminal-surface border border-terminal-border rounded p-12 text-center">
                    <h3 className="text-gray-300 text-xl mb-2">Authentication Required</h3>
                    <p className="text-gray-500">Please enter a valid access token to view this page.</p>
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
                    accessToken={accessToken}
                  />
                ) : (
                  <div className="bg-terminal-surface border border-terminal-border rounded p-12 text-center">
                    <h3 className="text-gray-300 text-xl mb-2">Authentication Required</h3>
                    <p className="text-gray-500">Please enter a valid access token to view this page.</p>
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
                    <p className="text-gray-500">Please enter a valid access token to view this page.</p>
                  </div>
                )
              }
            />
          </Routes>
        </div>
      </main>

      <footer className="bg-terminal-surface border-t border-terminal-border px-8 py-4">
        <div className="max-w-screen-2xl mx-auto flex justify-between items-center text-sm">
          <span className="text-text-muted">Jac Language LLM Documentation Benchmark</span>
          <span className="text-text-muted">API: <span className="text-terminal-accent">{window.location.hostname}:5050</span></span>
        </div>
      </footer>

      <AdminLoginModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onTokenChange={handleAccessTokenChange}
      />
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
