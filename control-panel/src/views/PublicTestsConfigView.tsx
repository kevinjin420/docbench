import { useState, useEffect, useMemo, useRef } from 'react'
import { API_BASE } from '@/utils/types'
import type { Model } from '@/utils/types'
import { getAdminHeaders, getAuthHeaders } from '@/utils/auth'

interface Test {
  id: string
  level: number
  category: string
  task: string
  points: number
  is_public: boolean
}

interface ConfigData {
  public_test_ids: string[]
  public_count: number
  total_available: number
  total_points: number
  public_points: number
  tests: Test[]
}

interface BenchmarkModel {
  id: number
  model_id: string
  display_name: string
  is_active: boolean
  priority: number
  added_at: number
}

export default function PublicTestsConfigView() {
  const [data, setData] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterLevel, setFilterLevel] = useState<number | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const [models, setModels] = useState<BenchmarkModel[]>([])
  const [newModelId, setNewModelId] = useState('')
  const [addingModel, setAddingModel] = useState(false)
  const [availableModels, setAvailableModels] = useState<Model[]>([])
  const [modelSearchQuery, setModelSearchQuery] = useState('')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [loadingAvailableModels, setLoadingAvailableModels] = useState(false)
  const modelInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConfig()
    fetchModels()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          modelInputRef.current && !modelInputRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/public-tests`, {
        headers: getAdminHeaders()
      })
      if (res.ok) {
        const configData = await res.json()
        setData(configData)
        setSelectedIds(new Set(configData.public_test_ids))
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/benchmark-models`, {
        headers: getAdminHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setModels(data.models || [])
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
    }
  }

  const fetchAvailableModels = async (apiKey: string) => {
    if (availableModels.length > 0) return
    setLoadingAvailableModels(true)
    try {
      const res = await fetch(`${API_BASE}/models`, {
        headers: {
          'X-API-Key': apiKey,
          ...getAuthHeaders()
        }
      })
      if (res.ok) {
        const data = await res.json()
        setAvailableModels(data.models || [])
      }
    } catch (error) {
      console.error('Failed to fetch available models:', error)
    } finally {
      setLoadingAvailableModels(false)
    }
  }

  const filteredAvailableModels = useMemo(() => {
    if (!modelSearchQuery.trim()) return availableModels.slice(0, 50)
    const query = modelSearchQuery.toLowerCase()
    return availableModels
      .filter(m =>
        m.id.toLowerCase().includes(query) ||
        m.name?.toLowerCase().includes(query)
      )
      .slice(0, 50)
  }, [availableModels, modelSearchQuery])

  const addModel = async (modelId?: string) => {
    const idToAdd = modelId || newModelId.trim()
    if (!idToAdd) return
    setAddingModel(true)
    try {
      const res = await fetch(`${API_BASE}/admin/benchmark-models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ model_id: idToAdd })
      })
      if (res.ok) {
        setNewModelId('')
        setModelSearchQuery('')
        setShowModelDropdown(false)
        fetchModels()
      }
    } catch (error) {
      console.error('Failed to add model:', error)
    } finally {
      setAddingModel(false)
    }
  }

  const removeModel = async (modelId: number) => {
    try {
      const res = await fetch(`${API_BASE}/admin/benchmark-models/${modelId}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      })
      if (res.ok) {
        fetchModels()
      }
    } catch (error) {
      console.error('Failed to remove model:', error)
    }
  }

  const toggleModelActive = async (modelId: number, isActive: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/admin/benchmark-models/${modelId}/active`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ is_active: isActive })
      })
      if (res.ok) {
        fetchModels()
      }
    } catch (error) {
      console.error('Failed to toggle model:', error)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/public-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ test_ids: Array.from(selectedIds) })
      })
      if (res.ok) {
        setHasChanges(false)
        fetchConfig()
      }
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleTest = (testId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(testId)) {
        next.delete(testId)
      } else {
        next.add(testId)
      }
      return next
    })
    setHasChanges(true)
  }

  const toggleAll = (tests: Test[]) => {
    const allSelected = tests.every(t => selectedIds.has(t.id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        tests.forEach(t => next.delete(t.id))
      } else {
        tests.forEach(t => next.add(t.id))
      }
      return next
    })
    setHasChanges(true)
  }

  const selectByLevel = (level: number) => {
    if (!data) return
    const levelTests = data.tests.filter(t => t.level === level)
    setSelectedIds(prev => {
      const next = new Set(prev)
      levelTests.forEach(t => next.add(t.id))
      return next
    })
    setHasChanges(true)
  }

  const deselectByLevel = (level: number) => {
    if (!data) return
    const levelTests = data.tests.filter(t => t.level === level)
    setSelectedIds(prev => {
      const next = new Set(prev)
      levelTests.forEach(t => next.delete(t.id))
      return next
    })
    setHasChanges(true)
  }

  const categories = useMemo(() => {
    if (!data) return []
    return [...new Set(data.tests.map(t => t.category))].sort()
  }, [data])

  const levels = useMemo(() => {
    if (!data) return []
    return [...new Set(data.tests.map(t => t.level))].sort((a, b) => a - b)
  }, [data])

  const filteredTests = useMemo(() => {
    if (!data) return []
    return data.tests.filter(t => {
      if (filterLevel !== 'all' && t.level !== filterLevel) return false
      if (filterCategory !== 'all' && t.category !== filterCategory) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return t.id.toLowerCase().includes(query) ||
               t.task.toLowerCase().includes(query) ||
               t.category.toLowerCase().includes(query)
      }
      return true
    })
  }, [data, filterLevel, filterCategory, searchQuery])

  const groupedTests = useMemo(() => {
    const groups: Record<string, Test[]> = {}
    filteredTests.forEach(t => {
      const key = t.category
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredTests])

  const selectedPoints = useMemo(() => {
    if (!data) return 0
    return data.tests.filter(t => selectedIds.has(t.id)).reduce((sum, t) => sum + t.points, 0)
  }, [data, selectedIds])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-text-muted">
        Failed to load configuration
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Public Test Suite Configuration</h2>
          <p className="text-text-muted mt-1">Configure which tests are included in the public benchmark</p>
        </div>
        <button
          onClick={saveConfig}
          disabled={saving || !hasChanges}
          className="btn btn-primary"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Selected Tests</div>
          <div className="text-2xl font-bold text-terminal-accent">{selectedIds.size}</div>
          <div className="text-xs text-text-muted">of {data.total_available} total</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Selected Points</div>
          <div className="text-2xl font-bold text-terminal-accent">{selectedPoints}</div>
          <div className="text-xs text-text-muted">of {data.total_points} total</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Categories</div>
          <div className="text-2xl font-bold text-text-primary">{categories.length}</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
          <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Active Models</div>
          <div className="text-2xl font-bold text-text-primary">{models.filter(m => m.is_active).length}</div>
          <div className="text-xs text-text-muted">for averaging scores</div>
        </div>
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
        <h3 className="text-text-primary font-medium mb-3">Benchmark Models</h3>
        <p className="text-text-muted text-sm mb-4">
          Configure which models are used for public benchmarks. Scores will be averaged across all active models.
        </p>

        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              ref={modelInputRef}
              type="text"
              value={modelSearchQuery || newModelId}
              onChange={(e) => {
                const value = e.target.value
                setModelSearchQuery(value)
                setNewModelId(value)
                if (value && !showModelDropdown) {
                  setShowModelDropdown(true)
                }
              }}
              onFocus={() => {
                setShowModelDropdown(true)
                const apiKey = localStorage.getItem('openRouterApiKey')
                if (apiKey) {
                  fetchAvailableModels(apiKey)
                }
              }}
              placeholder="Search models or enter model ID..."
              className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addModel()
                } else if (e.key === 'Escape') {
                  setShowModelDropdown(false)
                }
              }}
            />
            {showModelDropdown && (
              <div
                ref={dropdownRef}
                className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-terminal-elevated border border-terminal-border rounded shadow-lg"
              >
                {loadingAvailableModels ? (
                  <div className="px-3 py-4 text-center text-text-muted text-sm">
                    Loading models...
                  </div>
                ) : availableModels.length === 0 ? (
                  <div className="px-3 py-4 text-center text-text-muted text-sm">
                    <p>Enter your OpenRouter API key in the benchmark page to load available models.</p>
                    <p className="mt-2">Or type a model ID directly and press Enter.</p>
                  </div>
                ) : filteredAvailableModels.length === 0 ? (
                  <div className="px-3 py-4 text-center text-text-muted text-sm">
                    No models match "{modelSearchQuery}"
                  </div>
                ) : (
                  filteredAvailableModels.map(model => {
                    const isAdded = models.some(m => m.model_id === model.id)
                    return (
                      <div
                        key={model.id}
                        onClick={() => !isAdded && addModel(model.id)}
                        className={`px-3 py-2 cursor-pointer border-b border-terminal-border/30 last:border-b-0 ${
                          isAdded
                            ? 'opacity-50 cursor-not-allowed bg-terminal-surface'
                            : 'hover:bg-terminal-accent/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-text-primary text-sm font-medium truncate">{model.id}</div>
                          {isAdded && (
                            <span className="text-xs text-text-muted ml-2">Added</span>
                          )}
                        </div>
                        {model.name && model.name !== model.id && (
                          <div className="text-text-muted text-xs truncate">{model.name}</div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => addModel()}
            disabled={addingModel || !newModelId.trim()}
            className="btn btn-primary"
          >
            {addingModel ? 'Adding...' : 'Add'}
          </button>
        </div>

        {models.length === 0 ? (
          <div className="text-text-muted text-sm py-4 text-center">
            No models configured. Add models to enable multi-model benchmarking.
          </div>
        ) : (
          <div className="space-y-2">
            {models.map(model => (
              <div
                key={model.id}
                className={`flex items-center justify-between px-3 py-2 rounded border ${
                  model.is_active
                    ? 'bg-terminal-accent/10 border-terminal-accent/30'
                    : 'bg-terminal-elevated border-terminal-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={model.is_active}
                    onChange={(e) => toggleModelActive(model.id, e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-terminal-accent"
                  />
                  <div>
                    <div className="text-text-primary text-sm font-medium">{model.model_id}</div>
                    {model.display_name !== model.model_id && (
                      <div className="text-text-muted text-xs">{model.display_name}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeModel(model.id)}
                  className="btn btn-sm btn-danger"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
        <h3 className="text-text-primary font-medium mb-3">Quick Actions by Level</h3>
        <div className="flex flex-wrap gap-2">
          {levels.map(level => {
            const levelTests = data.tests.filter(t => t.level === level)
            const selectedCount = levelTests.filter(t => selectedIds.has(t.id)).length
            return (
              <div key={level} className="flex items-center gap-1">
                <button
                  onClick={() => selectByLevel(level)}
                  className="btn btn-sm btn-info"
                  title={`Select all Level ${level} tests`}
                >
                  L{level}
                </button>
                <button
                  onClick={() => deselectByLevel(level)}
                  className="btn btn-sm btn-secondary"
                  title={`Deselect all Level ${level} tests`}
                >
                  x
                </button>
                <span className="text-xs text-text-muted ml-1">
                  {selectedCount}/{levelTests.length}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-terminal-border flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-text-muted text-sm">Level:</label>
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-2 py-1 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
            >
              <option value="all">All Levels</option>
              {levels.map(l => (
                <option key={l} value={l}>Level {l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-text-muted text-sm">Category:</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-2 py-1 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search tests..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full max-w-xs px-3 py-1.5 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-terminal-accent"
            />
          </div>
          <div className="text-text-muted text-sm">
            Showing {filteredTests.length} tests
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {groupedTests.map(([category, tests]) => (
            <div key={category}>
              <div className="px-4 py-2 bg-terminal-elevated border-b border-terminal-border flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={tests.every(t => selectedIds.has(t.id))}
                    onChange={() => toggleAll(tests)}
                    className="w-4 h-4 cursor-pointer accent-terminal-accent"
                  />
                  <span className="text-text-primary font-medium">{category}</span>
                  <span className="text-text-muted text-xs">
                    {tests.filter(t => selectedIds.has(t.id)).length}/{tests.length} selected
                  </span>
                </div>
                <span className="text-text-muted text-xs">
                  {tests.reduce((sum, t) => sum + t.points, 0)} pts
                </span>
              </div>
              <div className="divide-y divide-terminal-border/30">
                {tests.map(test => (
                  <div
                    key={test.id}
                    className={`px-4 py-3 flex items-start gap-3 hover:bg-terminal-elevated/50 transition-colors cursor-pointer ${
                      selectedIds.has(test.id) ? 'bg-terminal-accent/5' : ''
                    }`}
                    onClick={() => toggleTest(test.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(test.id)}
                      onChange={() => toggleTest(test.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 mt-0.5 cursor-pointer accent-terminal-accent"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary text-sm font-medium">{test.id}</span>
                        <span className="px-1.5 py-0.5 bg-terminal-accent/20 text-terminal-accent text-xs rounded">
                          L{test.level}
                        </span>
                        <span className="text-text-muted text-xs">{test.points} pts</span>
                      </div>
                      <p className="text-text-secondary text-sm mt-1 line-clamp-2">{test.task}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {hasChanges && (
        <div className="fixed bottom-6 right-6 bg-terminal-surface border border-terminal-accent rounded-lg shadow-lg p-4 flex items-center gap-4">
          <span className="text-text-primary">You have unsaved changes</span>
          <button
            onClick={() => {
              setSelectedIds(new Set(data.public_test_ids))
              setHasChanges(false)
            }}
            className="btn btn-secondary btn-sm"
          >
            Discard
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="btn btn-primary btn-sm"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
