import { useState, useEffect, useMemo, useRef } from 'react'
import { API_BASE } from '@/utils/types'
import type { Model, TestDefinition } from '@/utils/types'
import { getAdminHeaders, getAuthHeaders } from '@/utils/auth'

type TabType = 'overview' | 'definitions' | 'public'
type TestType = 'generate' | 'debug' | 'complete' | 'refactor' | 'functional'

const TEST_TYPES: TestType[] = ['generate', 'debug', 'complete', 'refactor', 'functional']

interface BenchmarkModel {
  id: number
  model_id: string
  display_name: string
  is_active: boolean
  priority: number
  added_at: number
}

interface PublicTest {
  id: string
  level: number
  category: string
  task: string
  points: number
  is_public: boolean
}

interface PublicConfigData {
  public_test_ids: string[]
  public_count: number
  total_available: number
  total_points: number
  public_points: number
  tests: PublicTest[]
}

interface EditModalProps {
  test: TestDefinition | null
  isNew: boolean
  onClose: () => void
  onSave: (test: Partial<TestDefinition>) => Promise<void>
}

function EditModal({ test, isNew, onClose, onSave }: EditModalProps) {
  const [formData, setFormData] = useState<Partial<TestDefinition>>({
    id: '',
    level: 1,
    category: '',
    task: '',
    required_elements: [],
    points: 10,
    type: 'generate',
    forbidden_elements: [],
    broken_code: '',
    partial_code: '',
    python_code: '',
    test_harness: '',
    error_hint: '',
    completion_hint: ''
  })
  const [saving, setSaving] = useState(false)
  const [requiredElementsText, setRequiredElementsText] = useState('')
  const [forbiddenElementsText, setForbiddenElementsText] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (test) {
      setFormData({
        ...test,
        type: test.type || 'generate'
      })
      setRequiredElementsText((test.required_elements || []).join('\n'))
      setForbiddenElementsText((test.forbidden_elements || []).join('\n'))
    }
  }, [test])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const dataToSave = {
        ...formData,
        required_elements: requiredElementsText.split('\n').map(s => s.trim()).filter(Boolean),
        forbidden_elements: forbiddenElementsText ? forbiddenElementsText.split('\n').map(s => s.trim()).filter(Boolean) : undefined
      }
      await onSave(dataToSave)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const testType = formData.type || 'generate'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-terminal-surface border border-terminal-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-terminal-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">
            {isNew ? 'Create Test Definition' : `Edit: ${test?.id}`}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Test ID *</label>
              <input
                type="text"
                value={formData.id || ''}
                onChange={e => setFormData(prev => ({ ...prev, id: e.target.value }))}
                disabled={!isNew}
                required
                className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent disabled:opacity-50"
                placeholder="e.g., L1_basics_01"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm text-text-muted mb-1">Level *</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={formData.level || 1}
                  onChange={e => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) }))}
                  required
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Points</label>
                <input
                  type="number"
                  min={1}
                  value={formData.points || 10}
                  onChange={e => setFormData(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Type</label>
                <select
                  value={testType}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as TestType }))}
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                >
                  {TEST_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Category *</label>
            <input
              type="text"
              value={formData.category || ''}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
              required
              className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
              placeholder="e.g., Variables & Data Types"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Task Description *</label>
            <textarea
              value={formData.task || ''}
              onChange={e => setFormData(prev => ({ ...prev, task: e.target.value }))}
              required
              rows={3}
              className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent font-mono"
              placeholder="Describe what the LLM should generate..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Required Elements * (one per line)</label>
              <textarea
                value={requiredElementsText}
                onChange={e => setRequiredElementsText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent font-mono"
                placeholder="can func_name&#10;:int:&#10;with entry"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Forbidden Elements (one per line)</label>
              <textarea
                value={forbiddenElementsText}
                onChange={e => setForbiddenElementsText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent font-mono"
                placeholder="print&#10;import os"
              />
            </div>
          </div>

          {testType === 'debug' && (
            <div className="space-y-4 p-4 bg-terminal-elevated/50 rounded border border-terminal-border">
              <h4 className="text-text-primary font-medium">Debug Test Fields</h4>
              <div>
                <label className="block text-sm text-text-muted mb-1">Broken Code</label>
                <textarea
                  value={formData.broken_code || ''}
                  onChange={e => setFormData(prev => ({ ...prev, broken_code: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent font-mono"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Error Hint</label>
                <input
                  type="text"
                  value={formData.error_hint || ''}
                  onChange={e => setFormData(prev => ({ ...prev, error_hint: e.target.value }))}
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                />
              </div>
            </div>
          )}

          {testType === 'complete' && (
            <div className="space-y-4 p-4 bg-terminal-elevated/50 rounded border border-terminal-border">
              <h4 className="text-text-primary font-medium">Complete Test Fields</h4>
              <div>
                <label className="block text-sm text-text-muted mb-1">Partial Code</label>
                <textarea
                  value={formData.partial_code || ''}
                  onChange={e => setFormData(prev => ({ ...prev, partial_code: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent font-mono"
                  placeholder="Use ____ for blanks to fill"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Completion Hint</label>
                <input
                  type="text"
                  value={formData.completion_hint || ''}
                  onChange={e => setFormData(prev => ({ ...prev, completion_hint: e.target.value }))}
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                />
              </div>
            </div>
          )}

          {testType === 'refactor' && (
            <div className="space-y-4 p-4 bg-terminal-elevated/50 rounded border border-terminal-border">
              <h4 className="text-text-primary font-medium">Refactor Test Fields</h4>
              <div>
                <label className="block text-sm text-text-muted mb-1">Python Code to Convert</label>
                <textarea
                  value={formData.python_code || ''}
                  onChange={e => setFormData(prev => ({ ...prev, python_code: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent font-mono"
                />
              </div>
            </div>
          )}

          {testType === 'functional' && (
            <div className="space-y-4 p-4 bg-terminal-elevated/50 rounded border border-terminal-border">
              <h4 className="text-text-primary font-medium">Functional Test Fields</h4>
              <div>
                <label className="block text-sm text-text-muted mb-1">Test Harness Code</label>
                <textarea
                  value={formData.test_harness || ''}
                  onChange={e => setFormData(prev => ({ ...prev, test_harness: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent font-mono"
                  placeholder="Jac test code that will be appended"
                />
              </div>
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-terminal-border flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : isNew ? 'Create Test' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  apiKeyConfigured: boolean
}

export default function TestManagementView({ apiKeyConfigured }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Shared state
  const [tests, setTests] = useState<TestDefinition[]>([])
  const [loading, setLoading] = useState(true)

  // Definitions tab state
  const [filterLevel, setFilterLevel] = useState<number | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editingTest, setEditingTest] = useState<TestDefinition | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Public tab state
  const [publicConfig, setPublicConfig] = useState<PublicConfigData | null>(null)
  const [publicSelectedIds, setPublicSelectedIds] = useState<Set<string>>(new Set())
  const [publicHasChanges, setPublicHasChanges] = useState(false)
  const [publicSaving, setPublicSaving] = useState(false)
  const [publicFilterLevel, setPublicFilterLevel] = useState<number | 'all'>('all')
  const [publicFilterCategory, setPublicFilterCategory] = useState<string>('all')
  const [publicSearchQuery, setPublicSearchQuery] = useState('')

  // Models state
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
    fetchTests()
    fetchPublicConfig()
    fetchModels()
  }, [])

  useEffect(() => {
    if (activeTab === 'definitions') {
      fetchTests()
    }
  }, [includeInactive])

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

  const fetchTests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (includeInactive) params.set('include_inactive', 'true')

      const res = await fetch(`${API_BASE}/admin/tests?${params}`, {
        headers: getAdminHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setTests(data.tests || [])
      }
    } catch (error) {
      console.error('Failed to fetch tests:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPublicConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/public-tests`, {
        headers: getAdminHeaders()
      })
      if (res.ok) {
        const configData = await res.json()
        setPublicConfig(configData)
        setPublicSelectedIds(new Set(configData.public_test_ids))
      }
    } catch (error) {
      console.error('Failed to fetch public config:', error)
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

  const handleSaveTest = async (testData: Partial<TestDefinition>) => {
    const isNew = isCreating
    const endpoint = isNew ? `${API_BASE}/admin/tests` : `${API_BASE}/admin/tests/${testData.id}`
    const method = isNew ? 'POST' : 'PUT'

    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeaders()
      },
      body: JSON.stringify(testData)
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to save test')
    }

    fetchTests()
  }

  const handleDelete = async (testId: string, hard = false) => {
    const endpoint = hard
      ? `${API_BASE}/admin/tests/${testId}/hard-delete`
      : `${API_BASE}/admin/tests/${testId}`

    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: getAdminHeaders()
    })

    if (res.ok) {
      fetchTests()
    }
  }

  const handleRestore = async (testId: string) => {
    const res = await fetch(`${API_BASE}/admin/tests/${testId}/restore`, {
      method: 'POST',
      headers: getAdminHeaders()
    })

    if (res.ok) {
      fetchTests()
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/tests/export`, {
        headers: getAdminHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tests_export_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to export:', error)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch(`${API_BASE}/admin/tests/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        const result = await res.json()
        alert(`Import complete: ${result.created} created, ${result.updated} updated`)
        fetchTests()
      }
    } catch (error) {
      console.error('Failed to import:', error)
      alert('Failed to import: Invalid JSON file')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected tests?`)) return

    for (const id of selectedIds) {
      await handleDelete(id)
    }
    setSelectedIds(new Set())
  }

  const savePublicConfig = async () => {
    setPublicSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/public-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders()
        },
        body: JSON.stringify({ test_ids: Array.from(publicSelectedIds) })
      })
      if (res.ok) {
        setPublicHasChanges(false)
        fetchPublicConfig()
      }
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setPublicSaving(false)
    }
  }

  const togglePublicTest = (testId: string) => {
    setPublicSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(testId)) {
        next.delete(testId)
      } else {
        next.add(testId)
      }
      return next
    })
    setPublicHasChanges(true)
  }

  const toggleAllPublicTests = (testsToToggle: PublicTest[]) => {
    const allSelected = testsToToggle.every(t => publicSelectedIds.has(t.id))
    setPublicSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        testsToToggle.forEach(t => next.delete(t.id))
      } else {
        testsToToggle.forEach(t => next.add(t.id))
      }
      return next
    })
    setPublicHasChanges(true)
  }

  const selectByLevel = (level: number) => {
    if (!publicConfig) return
    const levelTests = publicConfig.tests.filter(t => t.level === level)
    setPublicSelectedIds(prev => {
      const next = new Set(prev)
      levelTests.forEach(t => next.add(t.id))
      return next
    })
    setPublicHasChanges(true)
  }

  const deselectByLevel = (level: number) => {
    if (!publicConfig) return
    const levelTests = publicConfig.tests.filter(t => t.level === level)
    setPublicSelectedIds(prev => {
      const next = new Set(prev)
      levelTests.forEach(t => next.delete(t.id))
      return next
    })
    setPublicHasChanges(true)
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

  // Use publicConfig.tests as fallback when admin tests are empty
  const effectiveTests = useMemo(() => {
    if (tests.length > 0) return tests
    if (!publicConfig) return []
    // Convert PublicTest to TestDefinition format for display
    return publicConfig.tests.map(t => ({
      id: t.id,
      level: t.level,
      category: t.category,
      task: t.task,
      points: t.points,
      required_elements: [],
      is_active: true,
      type: 'generate' as const
    }))
  }, [tests, publicConfig])

  const categories = useMemo(() => {
    return [...new Set(effectiveTests.map(t => t.category))].sort()
  }, [effectiveTests])

  const levels = useMemo(() => {
    return [...new Set(effectiveTests.map(t => t.level))].sort((a, b) => a - b)
  }, [effectiveTests])

  const filteredTests = useMemo(() => {
    return effectiveTests.filter(t => {
      if (filterLevel !== 'all' && t.level !== filterLevel) return false
      if (filterCategory !== 'all' && t.category !== filterCategory) return false
      if (filterType !== 'all' && (t.type || 'generate') !== filterType) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return t.id.toLowerCase().includes(query) ||
               t.task.toLowerCase().includes(query) ||
               t.category.toLowerCase().includes(query)
      }
      return true
    })
  }, [effectiveTests, filterLevel, filterCategory, filterType, searchQuery])

  const groupedTests = useMemo(() => {
    const groups: Record<string, TestDefinition[]> = {}
    filteredTests.forEach(t => {
      const key = t.category
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredTests])

  const publicCategories = useMemo(() => {
    if (!publicConfig) return []
    return [...new Set(publicConfig.tests.map(t => t.category))].sort()
  }, [publicConfig])

  const publicLevels = useMemo(() => {
    if (!publicConfig) return []
    return [...new Set(publicConfig.tests.map(t => t.level))].sort((a, b) => a - b)
  }, [publicConfig])

  const publicFilteredTests = useMemo(() => {
    if (!publicConfig) return []
    return publicConfig.tests.filter(t => {
      if (publicFilterLevel !== 'all' && t.level !== publicFilterLevel) return false
      if (publicFilterCategory !== 'all' && t.category !== publicFilterCategory) return false
      if (publicSearchQuery) {
        const query = publicSearchQuery.toLowerCase()
        return t.id.toLowerCase().includes(query) ||
               t.task.toLowerCase().includes(query) ||
               t.category.toLowerCase().includes(query)
      }
      return true
    })
  }, [publicConfig, publicFilterLevel, publicFilterCategory, publicSearchQuery])

  const publicGroupedTests = useMemo(() => {
    const groups: Record<string, PublicTest[]> = {}
    publicFilteredTests.forEach(t => {
      const key = t.category
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [publicFilteredTests])

  const publicSelectedPoints = useMemo(() => {
    if (!publicConfig) return 0
    return publicConfig.tests.filter(t => publicSelectedIds.has(t.id)).reduce((sum, t) => sum + t.points, 0)
  }, [publicConfig, publicSelectedIds])

  // Derive overview stats from publicConfig.tests (which is the reliable data source)
  const overviewStats = useMemo(() => {
    if (!publicConfig) return null

    const allTests = publicConfig.tests
    const byCategory: Record<string, { count: number; points: number }> = {}
    const byLevel: Record<number, { count: number; points: number }> = {}
    let totalPoints = 0

    allTests.forEach(t => {
      totalPoints += t.points

      if (!byCategory[t.category]) {
        byCategory[t.category] = { count: 0, points: 0 }
      }
      byCategory[t.category].count++
      byCategory[t.category].points += t.points

      if (!byLevel[t.level]) {
        byLevel[t.level] = { count: 0, points: 0 }
      }
      byLevel[t.level].count++
      byLevel[t.level].points += t.points
    })

    return {
      total_tests: allTests.length,
      total_points: totalPoints,
      by_category: byCategory,
      by_level: byLevel
    }
  }, [publicConfig])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const tabClass = (tab: TabType) => {
    const base = 'px-4 py-3 text-sm font-medium border-b-2 transition-colors'
    if (activeTab === tab) {
      return `${base} text-terminal-accent border-terminal-accent`
    }
    return `${base} text-text-muted border-transparent hover:text-text-primary hover:border-terminal-border`
  }

  const renderOverviewTab = () => {
    if (!overviewStats) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }

    const topCategories = Object.entries(overviewStats.by_category || {})
      .sort((a: any, b: any) => b[1].points - a[1].points)
      .slice(0, 3)

    return (
      <div className="space-y-6">
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
          <h3 className="text-text-primary font-medium mb-4">API Configuration</h3>
          <div className="flex gap-3">
            <div className={`flex items-center gap-2 px-4 py-3 rounded border text-sm font-mono ${
              apiKeyConfigured
                ? 'bg-green-950/50 border-green-600/50 text-green-400'
                : 'bg-red-950/50 border-red-600/50 text-red-400'
            }`}>
              <span className="font-medium">{apiKeyConfigured ? 'Configured' : 'Missing'}</span>
              <span className="text-text-muted">OpenRouter API Key</span>
            </div>
          </div>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
          <h3 className="text-text-primary font-medium mb-4">Benchmark Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-terminal-elevated p-5 rounded-lg border border-terminal-border">
              <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Total Tests</div>
              <div className="text-3xl font-bold text-terminal-accent font-mono">{overviewStats.total_tests}</div>
            </div>

            <div className="bg-terminal-elevated p-5 rounded-lg border border-terminal-border">
              <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Total Points</div>
              <div className="text-3xl font-bold text-terminal-accent font-mono">{overviewStats.total_points}</div>
            </div>

            <div className="bg-terminal-elevated p-5 rounded-lg border border-terminal-border">
              <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Categories</div>
              <div className="text-3xl font-bold text-terminal-accent font-mono">{Object.keys(overviewStats.by_category || {}).length}</div>
            </div>

            <div className="bg-terminal-elevated p-5 rounded-lg border border-terminal-border">
              <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Levels</div>
              <div className="text-3xl font-bold text-terminal-accent font-mono">{Object.keys(overviewStats.by_level || {}).length}</div>
            </div>
          </div>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
          <h3 className="text-text-primary font-medium mb-4">Top Categories (by points)</h3>
          <div className="space-y-3">
            {topCategories.map(([name, data]: [string, any], index) => (
              <div key={name} className="flex items-center gap-4 p-4 bg-terminal-elevated rounded-lg border border-terminal-border hover:border-terminal-border-accent transition-colors">
                <span className="w-8 h-8 flex items-center justify-center bg-terminal-accent/20 text-terminal-accent rounded font-bold text-sm font-mono">
                  #{index + 1}
                </span>
                <div className="flex-1">
                  <span className="text-text-primary font-medium">{name}</span>
                  <div className="text-xs text-text-muted mt-0.5 font-mono">
                    {data.count} tests | {data.points} points
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
          <h3 className="text-text-primary font-medium mb-4">Level Distribution</h3>
          <div className="space-y-3">
            {Object.entries(overviewStats.by_level || {})
              .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
              .map(([level, data]: [string, any]) => {
                const percentage = (data.count / overviewStats.total_tests) * 100
                return (
                  <div key={level} className="grid grid-cols-[40px_1fr_50px] items-center gap-4">
                    <span className="text-sm text-text-secondary font-medium font-mono">L{level}</span>
                    <div className="h-6 bg-terminal-border rounded overflow-hidden">
                      <div
                        className="h-full bg-terminal-accent transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-terminal-accent font-semibold text-right font-mono">{data.count}</span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    )
  }

  const renderDefinitionsTab = () => {
    if (loading && effectiveTests.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-text-muted text-sm">
            Manage benchmark test cases stored in the database
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary">
              Import JSON
            </button>
            <button onClick={handleExport} className="btn btn-secondary">
              Export JSON
            </button>
            <button onClick={() => { setIsCreating(true); setEditingTest({ id: '', level: 1, category: '', task: '', required_elements: [], points: 10 } as TestDefinition) }} className="btn btn-primary">
              + New Test
            </button>
          </div>
        </div>

        {overviewStats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
              <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Total Tests</div>
              <div className="text-2xl font-bold text-terminal-accent">{overviewStats.total_tests}</div>
            </div>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
              <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Total Points</div>
              <div className="text-2xl font-bold text-terminal-accent">{overviewStats.total_points}</div>
            </div>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
              <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Levels</div>
              <div className="text-2xl font-bold text-text-primary">{Object.keys(overviewStats.by_level).length}</div>
            </div>
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
              <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Categories</div>
              <div className="text-2xl font-bold text-text-primary">{Object.keys(overviewStats.by_category).length}</div>
            </div>
          </div>
        )}

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
            <div className="flex items-center gap-2">
              <label className="text-text-muted text-sm">Type:</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="px-2 py-1 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
              >
                <option value="all">All Types</option>
                {TEST_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
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
            <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={e => setIncludeInactive(e.target.checked)}
                className="w-4 h-4 accent-terminal-accent"
              />
              Show inactive
            </label>
            <div className="text-text-muted text-sm">
              {filteredTests.length} tests
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="px-4 py-2 bg-terminal-accent/10 border-b border-terminal-border flex items-center gap-4">
              <span className="text-sm text-text-primary">{selectedIds.size} selected</span>
              <button onClick={handleBulkDelete} className="btn btn-sm btn-danger">
                Delete Selected
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="btn btn-sm btn-secondary">
                Clear Selection
              </button>
            </div>
          )}

          <div className="max-h-[600px] overflow-y-auto">
            {groupedTests.length === 0 ? (
              <div className="px-4 py-12 text-center text-text-muted">
                {effectiveTests.length === 0 ? 'No tests available. Import tests or create new ones.' : 'No tests match the current filters.'}
              </div>
            ) : (
              groupedTests.map(([category, categoryTests]) => (
                <div key={category}>
                  <div className="px-4 py-2 bg-terminal-elevated border-b border-terminal-border flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={categoryTests.every(t => selectedIds.has(t.id))}
                        onChange={() => {
                          const allSelected = categoryTests.every(t => selectedIds.has(t.id))
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (allSelected) {
                              categoryTests.forEach(t => next.delete(t.id))
                            } else {
                              categoryTests.forEach(t => next.add(t.id))
                            }
                            return next
                          })
                        }}
                        className="w-4 h-4 cursor-pointer accent-terminal-accent"
                      />
                      <span className="text-text-primary font-medium">{category}</span>
                      <span className="text-text-muted text-xs">{categoryTests.length} tests</span>
                    </div>
                    <span className="text-text-muted text-xs">
                      {categoryTests.reduce((sum, t) => sum + t.points, 0)} pts
                    </span>
                  </div>
                  <div className="divide-y divide-terminal-border/30">
                    {categoryTests.map(test => (
                      <div
                        key={test.id}
                        className={`px-4 py-3 flex items-start gap-3 hover:bg-terminal-elevated/50 transition-colors ${
                          !test.is_active ? 'opacity-50' : ''
                        } ${selectedIds.has(test.id) ? 'bg-terminal-accent/5' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(test.id)}
                          onChange={() => toggleSelect(test.id)}
                          className="w-4 h-4 mt-0.5 cursor-pointer accent-terminal-accent"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-text-primary text-sm font-medium">{test.id}</span>
                            <span className="px-1.5 py-0.5 bg-terminal-accent/20 text-terminal-accent text-xs rounded">
                              L{test.level}
                            </span>
                            <span className="text-text-muted text-xs">{test.points} pts</span>
                            <span className="px-1.5 py-0.5 bg-terminal-border text-text-muted text-xs rounded">
                              {test.type || 'generate'}
                            </span>
                            {!test.is_active && (
                              <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                                inactive
                              </span>
                            )}
                          </div>
                          <p className="text-text-secondary text-sm mt-1 line-clamp-2">{test.task}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => { setIsCreating(false); setEditingTest(test) }}
                            className="btn btn-sm btn-secondary"
                          >
                            Edit
                          </button>
                          {test.is_active ? (
                            <button
                              onClick={() => handleDelete(test.id)}
                              className="btn btn-sm btn-danger"
                              title="Deactivate"
                            >
                              Del
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestore(test.id)}
                                className="btn btn-sm btn-info"
                                title="Restore"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => handleDelete(test.id, true)}
                                className="btn btn-sm btn-danger"
                                title="Permanently delete"
                              >
                                Perm
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {editingTest && (
          <EditModal
            test={editingTest}
            isNew={isCreating}
            onClose={() => { setEditingTest(null); setIsCreating(false) }}
            onSave={handleSaveTest}
          />
        )}
      </div>
    )
  }

  const renderPublicTab = () => {
    if (!publicConfig) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-text-muted text-sm">
            Configure which tests are included in the public benchmark
          </div>
          <button
            onClick={savePublicConfig}
            disabled={publicSaving || !publicHasChanges}
            className="btn btn-primary"
          >
            {publicSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Selected Tests</div>
            <div className="text-2xl font-bold text-terminal-accent">{publicSelectedIds.size}</div>
            <div className="text-xs text-text-muted">of {publicConfig.total_available} total</div>
          </div>
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Selected Points</div>
            <div className="text-2xl font-bold text-terminal-accent">{publicSelectedPoints}</div>
            <div className="text-xs text-text-muted">of {publicConfig.total_points} total</div>
          </div>
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-1">Categories</div>
            <div className="text-2xl font-bold text-text-primary">{publicCategories.length}</div>
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
            {publicLevels.map(level => {
              const levelTests = publicConfig.tests.filter(t => t.level === level)
              const selectedCount = levelTests.filter(t => publicSelectedIds.has(t.id)).length
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
                value={publicFilterLevel}
                onChange={e => setPublicFilterLevel(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="px-2 py-1 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
              >
                <option value="all">All Levels</option>
                {publicLevels.map(l => (
                  <option key={l} value={l}>Level {l}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-text-muted text-sm">Category:</label>
              <select
                value={publicFilterCategory}
                onChange={e => setPublicFilterCategory(e.target.value)}
                className="px-2 py-1 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
              >
                <option value="all">All Categories</option>
                {publicCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search tests..."
                value={publicSearchQuery}
                onChange={e => setPublicSearchQuery(e.target.value)}
                className="w-full max-w-xs px-3 py-1.5 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-terminal-accent"
              />
            </div>
            <div className="text-text-muted text-sm">
              Showing {publicFilteredTests.length} tests
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {publicGroupedTests.map(([category, testsInCategory]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-terminal-elevated border-b border-terminal-border flex items-center justify-between sticky top-0">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={testsInCategory.every(t => publicSelectedIds.has(t.id))}
                      onChange={() => toggleAllPublicTests(testsInCategory)}
                      className="w-4 h-4 cursor-pointer accent-terminal-accent"
                    />
                    <span className="text-text-primary font-medium">{category}</span>
                    <span className="text-text-muted text-xs">
                      {testsInCategory.filter(t => publicSelectedIds.has(t.id)).length}/{testsInCategory.length} selected
                    </span>
                  </div>
                  <span className="text-text-muted text-xs">
                    {testsInCategory.reduce((sum, t) => sum + t.points, 0)} pts
                  </span>
                </div>
                <div className="divide-y divide-terminal-border/30">
                  {testsInCategory.map(test => (
                    <div
                      key={test.id}
                      className={`px-4 py-3 flex items-start gap-3 hover:bg-terminal-elevated/50 transition-colors cursor-pointer ${
                        publicSelectedIds.has(test.id) ? 'bg-terminal-accent/5' : ''
                      }`}
                      onClick={() => togglePublicTest(test.id)}
                    >
                      <input
                        type="checkbox"
                        checked={publicSelectedIds.has(test.id)}
                        onChange={() => togglePublicTest(test.id)}
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

        {publicHasChanges && (
          <div className="fixed bottom-6 right-6 bg-terminal-surface border border-terminal-accent rounded-lg shadow-lg p-4 flex items-center gap-4">
            <span className="text-text-primary">You have unsaved changes</span>
            <button
              onClick={() => {
                setPublicSelectedIds(new Set(publicConfig.public_test_ids))
                setPublicHasChanges(false)
              }}
              className="btn btn-secondary btn-sm"
            >
              Discard
            </button>
            <button
              onClick={savePublicConfig}
              disabled={publicSaving}
              className="btn btn-primary btn-sm"
            >
              {publicSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">Test Management</h2>
        <p className="text-text-muted mt-1">Manage benchmark tests, definitions, and public suite configuration</p>
      </div>

      <div className="flex border-b border-terminal-border">
        <button onClick={() => setActiveTab('overview')} className={tabClass('overview')}>
          Overview
        </button>
        <button onClick={() => setActiveTab('definitions')} className={tabClass('definitions')}>
          Definitions
        </button>
        <button onClick={() => setActiveTab('public')} className={tabClass('public')}>
          Public Suite
        </button>
      </div>

      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'definitions' && renderDefinitionsTab()}
      {activeTab === 'public' && renderPublicTab()}
    </div>
  )
}
