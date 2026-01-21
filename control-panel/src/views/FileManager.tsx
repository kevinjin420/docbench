import { useState } from 'react'
import EvaluationModal from '@/components/EvaluationModal'
import CompareModal from '@/components/CompareModal'
import type { TestFile, Stash } from '@/utils/types'
import { API_BASE, MODEL_DISPLAY_NAMES } from '@/utils/types'
import { getAdminHeaders } from '@/utils/auth'

interface Props {
  files: TestFile[]
  stashes: Stash[]
  onStash: () => void
  onClean: () => void
  onClearDb: () => void
  onRefresh: () => void
  onDelete?: (filePath: string) => void
}

export default function FileManager({
  files,
  stashes,
  onStash,
  onClean,
  onClearDb,
  onRefresh,
  onDelete
}: Props) {
  const [sortBy, setSortBy] = useState<'size' | 'modified' | 'model-variant'>(() => {
    const saved = localStorage.getItem('fileManager_sortBy')
    return (saved as any) || 'modified'
  })

  const handleSortChange = (newSort: 'size' | 'modified' | 'model-variant') => {
    setSortBy(newSort)
    localStorage.setItem('fileManager_sortBy', newSort)
  }

  const [stashSortBy, setStashSortBy] = useState<'created' | 'model-variant'>(() => {
    const saved = localStorage.getItem('fileManager_stashSortBy')
    return (saved as any) || 'created'
  })

  const handleStashSortChange = (newSort: 'created' | 'model-variant') => {
    setStashSortBy(newSort)
    localStorage.setItem('fileManager_stashSortBy', newSort)
  }

  const [expandedStashes, setExpandedStashes] = useState<Set<string>>(new Set())
  const [stashFiles, setStashFiles] = useState<Map<string, TestFile[]>>(new Map())
  const [showEvalModal, setShowEvalModal] = useState(false)
  const [evalResults, setEvalResults] = useState<any>(null)
  const [selectedStashForCompare, setSelectedStashForCompare] = useState<string | null>(null)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [compareResults, setCompareResults] = useState<any>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set())

  const toggleFileSelection = (runId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.name)))
    }
  }

  const stashSelected = async () => {
    if (selectedFiles.size === 0) return
    try {
      const res = await fetch(`${API_BASE}/stash-selected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ run_ids: Array.from(selectedFiles) })
      })
      if (res.ok) {
        setSelectedFiles(new Set())
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to stash selected files:', error)
    }
  }

  const toggleCollectionSelection = (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCollections(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const exportCollectionsCSV = async () => {
    if (selectedCollections.size === 0) return
    try {
      const res = await fetch(`${API_BASE}/export-collections-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ collections: Array.from(selectedCollections) })
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `collections-export-${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to export collections CSV:', error)
    }
  }

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortBy) {
      case 'size':
        return b.size - a.size
      case 'modified':
        return b.modified - a.modified
      case 'model-variant': {
        const hasMetaA = a.metadata && a.metadata.model && a.metadata.variant
        const hasMetaB = b.metadata && b.metadata.model && b.metadata.variant

        if (!hasMetaA && !hasMetaB) {
          return a.name.localeCompare(b.name)
        }

        if (!hasMetaA) return 1
        if (!hasMetaB) return -1

        const modelCompare = a.metadata!.model.localeCompare(b.metadata!.model)
        if (modelCompare !== 0) return modelCompare

        return a.metadata!.variant.localeCompare(b.metadata!.variant)
      }
      default:
        return 0
    }
  })

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const toggleStash = async (stashName: string) => {
    const newExpanded = new Set(expandedStashes)

    if (newExpanded.has(stashName)) {
      newExpanded.delete(stashName)
    } else {
      newExpanded.add(stashName)

      if (!stashFiles.has(stashName)) {
        try {
          const res = await fetch(`${API_BASE}/stash/${stashName}/files`, {
            headers: { ...getAdminHeaders() }
          })
          const data = await res.json()
          setStashFiles(new Map(stashFiles.set(stashName, data.files || [])))
        } catch (error) {
          console.error(`Failed to fetch stash files for ${stashName}:`, error)
        }
      }
    }

    setExpandedStashes(newExpanded)
  }

  const deleteStash = async (stashName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`${API_BASE}/stash/${stashName}`, {
        method: 'DELETE',
        headers: { ...getAdminHeaders() }
      })
      onRefresh()
    } catch (error) {
      console.error(`Failed to delete stash ${stashName}:`, error)
    }
  }

  const evaluateStash = async (stashName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`${API_BASE}/evaluate-collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ collection: stashName })
      })
      const data = await res.json()
      if (data.status === 'success') {
        setEvalResults({ ...data, stashName })
        setShowEvalModal(true)
      }
    } catch (error) {
      console.error(`Failed to evaluate stash ${stashName}:`, error)
    }
  }

  const selectForCompare = (stashName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStashForCompare(stashName)
  }

  const compareWithSelected = async (stashName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!selectedStashForCompare || selectedStashForCompare === stashName) return
    try {
      const res = await fetch(`${API_BASE}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify({ stash1: selectedStashForCompare, stash2: stashName })
      })
      const data = await res.json()
      if (data.status === 'success') {
        setCompareResults(data)
        setShowCompareModal(true)
      }
    } catch (error) {
      console.error(`Failed to compare stashes:`, error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Test Results</h2>
          <p className="text-text-muted mt-1">Manage benchmark results and collections</p>
        </div>
        <button onClick={onRefresh} className="btn btn-secondary btn-icon" title="Refresh">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button onClick={onStash} className="btn btn-secondary">
            Stash All
          </button>
          {selectedFiles.size > 0 && (
            <button onClick={stashSelected} className="btn btn-info">
              Stash Selected ({selectedFiles.size})
            </button>
          )}
          <button onClick={onClean} className="btn btn-danger">
            Delete Uncategorized
          </button>
          <button onClick={() => {
            if (window.confirm('Are you sure you want to nuke the database? This will delete all benchmark results and cannot be undone.')) {
              onClearDb()
            }
          }} className="btn btn-danger-solid">
            Nuke Database
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-text-muted text-sm">Sort by:</label>
          <select
            value={sortBy}
            onChange={e => handleSortChange(e.target.value as any)}
            className="px-3 py-1.5 bg-terminal-surface border border-terminal-border rounded text-text-primary text-sm cursor-pointer focus:outline-none focus:border-terminal-accent"
          >
            <option value="modified">Date Modified</option>
            <option value="model-variant">Model + Variant</option>
            <option value="size">Size</option>
          </select>
        </div>
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          {sortedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-text-secondary text-base mb-2">No uncategorized test files found</p>
              <span className="text-text-muted text-sm">Run a benchmark to generate test results</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 bg-terminal-elevated border-b border-terminal-border">
                <input
                  type="checkbox"
                  checked={selectedFiles.size === files.length && files.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer accent-terminal-accent"
                />
                <span className="text-text-muted text-sm">Select All ({files.length} files)</span>
              </div>
              <div className="divide-y divide-terminal-border/50">
                {sortedFiles.map(file => (
                  <div
                    key={file.path}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-terminal-elevated/50 transition-colors ${
                      selectedFiles.has(file.name) ? 'bg-terminal-accent/10' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.name)}
                      onChange={() => toggleFileSelection(file.name)}
                      className="w-4 h-4 cursor-pointer accent-terminal-accent"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary font-medium text-sm truncate">{file.name}</div>
                      <div className="flex gap-4 text-xs text-text-muted mt-0.5">
                        <span>{formatSize(file.size)}</span>
                        <span>{formatDate(file.modified)}</span>
                      </div>
                    </div>

                    {onDelete && (
                      <button
                        onClick={() => onDelete(file.path)}
                        className="btn btn-danger btn-sm btn-icon"
                        title="Delete file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {files.length > 0 && (
          <div className="flex justify-between px-4 py-3 bg-terminal-elevated border-t border-terminal-border text-sm text-text-muted">
            <span>{files.length} file(s)</span>
            <span>
              Total: {formatSize(files.reduce((acc, f) => acc + f.size, 0))}
            </span>
          </div>
        )}
      </div>

      {stashes.length > 0 && (
        <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-terminal-border">
            <h3 className="text-text-primary font-medium">Collections ({stashes.length})</h3>
            <div className="flex items-center gap-4">
              {selectedCollections.size > 0 && (
                <button
                  onClick={exportCollectionsCSV}
                  className="btn btn-success btn-sm"
                >
                  Export CSV ({selectedCollections.size})
                </button>
              )}
              <div className="flex items-center gap-2">
                <label className="text-text-muted text-sm">Sort:</label>
                <select
                  value={stashSortBy}
                  onChange={e => handleStashSortChange(e.target.value as any)}
                  className="px-2 py-1 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm cursor-pointer focus:outline-none focus:border-terminal-accent"
                >
                  <option value="created">Time Stashed</option>
                  <option value="model-variant">Model + Variant</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-terminal-border/50">
            {[...stashes].sort((a, b) => {
              switch (stashSortBy) {
                case 'created':
                  return b.created - a.created
                case 'model-variant': {
                  const hasMetaA = a.metadata && a.metadata.model && a.metadata.variant
                  const hasMetaB = b.metadata && b.metadata.model && b.metadata.variant

                  if (!hasMetaA && !hasMetaB) {
                    return a.name.localeCompare(b.name)
                  }

                  if (!hasMetaA) return 1
                  if (!hasMetaB) return -1

                  const modelCompare = a.metadata!.model.localeCompare(b.metadata!.model)
                  if (modelCompare !== 0) return modelCompare

                  return a.metadata!.variant.localeCompare(b.metadata!.variant)
                }
                default:
                  return 0
              }
            }).map(stash => {
              const isExpanded = expandedStashes.has(stash.name)
              const files = stashFiles.get(stash.name) || []

              let metadata: { model: string; variant: string; tests: string; batchSize?: number } | null = null
              if (stash.metadata) {
                const displayModel = MODEL_DISPLAY_NAMES[stash.metadata.model] || stash.metadata.model
                const displayVariant = stash.metadata.variant.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

                metadata = {
                  model: displayModel,
                  variant: displayVariant,
                  tests: stash.metadata.total_tests,
                  batchSize: stash.metadata.batch_size
                }
              }

              return (
                <div key={stash.name}>
                  <div className={`px-4 py-3 flex justify-between items-center hover:bg-terminal-elevated/50 transition-colors ${
                    selectedCollections.has(stash.name) ? 'bg-terminal-accent/10' : ''
                  }`}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedCollections.has(stash.name)}
                        onClick={(e) => toggleCollectionSelection(stash.name, e)}
                        onChange={() => {}}
                        className="w-4 h-4 cursor-pointer accent-terminal-accent"
                      />
                      <button
                        onClick={() => toggleStash(stash.name)}
                        className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer min-w-0"
                      >
                        <span className="text-text-muted">{isExpanded ? '▼' : '▶'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-text-primary font-medium text-sm">{stash.name}</span>
                            {metadata && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-blue-400 font-medium">{metadata.model}</span>
                                <span className="text-text-muted">|</span>
                                <span className="text-purple-400 font-medium">{metadata.variant}</span>
                                {metadata.batchSize && (
                                  <>
                                    <span className="text-text-muted">|</span>
                                    <span className="text-cyan-400 font-medium">batch {metadata.batchSize}</span>
                                  </>
                                )}
                                <span className="text-text-muted">|</span>
                                <span className="text-terminal-accent font-medium">x{stash.file_count}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-text-muted text-xs mt-0.5">
                            {stash.file_count} files | {formatDate(stash.created)}
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => selectForCompare(stash.name, e)}
                        className={`btn btn-sm ${selectedStashForCompare === stash.name ? 'btn-primary' : 'btn-info'}`}
                        title="Select this stash for comparison"
                      >
                        Select
                      </button>
                      <button
                        onClick={(e) => compareWithSelected(stash.name, e)}
                        className="btn btn-secondary btn-sm"
                        title="Compare with selected stash"
                        disabled={!selectedStashForCompare || selectedStashForCompare === stash.name}
                      >
                        Compare
                      </button>
                      <button
                        onClick={(e) => evaluateStash(stash.name, e)}
                        className="btn btn-accent btn-sm"
                        title="Evaluate all files in this stash"
                      >
                        Evaluate
                      </button>
                      <button
                        onClick={(e) => deleteStash(stash.name, e)}
                        className="btn btn-danger btn-sm btn-icon"
                        title="Delete entire stash"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-terminal-bg border-t border-terminal-border/50">
                      {files.length === 0 ? (
                        <div className="px-8 py-4 text-text-muted text-sm">Loading...</div>
                      ) : (
                        <div className="divide-y divide-terminal-border/30">
                          {files.map(file => (
                            <div
                              key={file.path}
                              className="flex items-center gap-4 px-8 py-3 hover:bg-terminal-surface/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-text-secondary font-medium text-sm truncate">{file.name}</div>
                                <div className="flex gap-4 text-xs text-text-muted mt-0.5">
                                  <span>{formatSize(file.size)}</span>
                                  <span>{formatDate(file.modified)}</span>
                                </div>
                              </div>

                              {onDelete && (
                                <button
                                  onClick={() => onDelete(file.path)}
                                  className="btn btn-danger btn-sm btn-icon"
                                  title="Delete file"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <EvaluationModal
        isOpen={showEvalModal}
        onClose={() => setShowEvalModal(false)}
        results={evalResults}
      />
      <CompareModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        results={compareResults}
      />
    </div>
  )
}
