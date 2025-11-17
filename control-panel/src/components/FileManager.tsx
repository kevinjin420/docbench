import { useState, useEffect } from 'react'
import EvaluationModal from './EvaluationModal'
import CompareModal from './CompareModal'

interface TestFile {
  name: string
  path: string
  size: number
  modified: number
  stash?: string
}

interface Stash {
  name: string
  path: string
  file_count: number
  created: number
}

interface Props {
  files: TestFile[]
  stashes: Stash[]
  onEvaluate?: (filePath: string) => void
  onEvaluateAll?: () => void
  onStash: () => void
  onClean: () => void
  onRefresh: () => void
  onDelete?: (filePath: string) => void
}

const API_BASE = 'http://localhost:5000/api'

export default function FileManager({
  files,
  stashes,
  onEvaluate,
  onEvaluateAll,
  onStash,
  onClean,
  onRefresh,
  onDelete
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified'>('modified')
  const [expandedStashes, setExpandedStashes] = useState<Set<string>>(new Set())
  const [stashFiles, setStashFiles] = useState<Map<string, TestFile[]>>(new Map())
  const [showEvalModal, setShowEvalModal] = useState(false)
  const [evalResults, setEvalResults] = useState<any>(null)
  const [selectedStashForCompare, setSelectedStashForCompare] = useState<string | null>(null)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [compareResults, setCompareResults] = useState<any>(null)
  const [stashSummaries, setStashSummaries] = useState<Map<string, any>>(new Map())

  // Fetch summaries for all stashes on load
  useEffect(() => {
    stashes.forEach(stash => {
      if (!stashSummaries.has(stash.name)) {
        fetchStashSummary(stash.name)
      }
    })
  }, [stashes])

  const handleSelectFile = (path: string) => {
    setSelectedFiles(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    )
  }

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([])
    } else {
      setSelectedFiles(files.map(f => f.path))
    }
  }

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'size':
        return b.size - a.size
      case 'modified':
        return b.modified - a.modified
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
          const res = await fetch(`${API_BASE}/stash/${stashName}/files`)
          const data = await res.json()
          setStashFiles(new Map(stashFiles.set(stashName, data.files || [])))
        } catch (error) {
          console.error(`Failed to fetch stash files for ${stashName}:`, error)
        }
      }
    }

    setExpandedStashes(newExpanded)
  }

  const fetchStashSummary = async (stashName: string) => {
    try {
      const res = await fetch(`${API_BASE}/evaluate-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: stashName })
      })

      const data = await res.json()

      if (data.status === 'success') {
        setStashSummaries(prev => {
          const newSummaries = new Map(prev)
          newSummaries.set(stashName, data)
          return newSummaries
        })
      }
    } catch (error) {
      console.error(`Failed to fetch summary for ${stashName}:`, error)
    }
  }

  const deleteStash = async (stashName: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm(`Delete entire stash "${stashName}" and all its files?`)) return

    try {
      await fetch(`${API_BASE}/stash/${stashName}`, {
        method: 'DELETE'
      })
      onRefresh()
    } catch (error) {
      console.error(`Failed to delete stash ${stashName}:`, error)
      alert('Failed to delete stash')
    }
  }

  const evaluateStash = async (stashName: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const res = await fetch(`${API_BASE}/evaluate-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: stashName })
      })

      const data = await res.json()

      if (data.status === 'success') {
        setEvalResults({ ...data, stashName })
        setShowEvalModal(true)
      } else {
        alert(`Evaluation failed: ${data.error}`)
      }
    } catch (error) {
      console.error(`Failed to evaluate stash ${stashName}:`, error)
      alert('Failed to evaluate stash')
    }
  }

  const selectForCompare = (stashName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStashForCompare(stashName)
  }

  const compareWithSelected = async (stashName: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!selectedStashForCompare) {
      alert('Please select a stash to compare first')
      return
    }

    if (selectedStashForCompare === stashName) {
      alert('Cannot compare a stash with itself')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stash1: selectedStashForCompare,
          stash2: stashName
        })
      })

      const data = await res.json()

      if (data.status === 'success') {
        setCompareResults(data)
        setShowCompareModal(true)
      } else {
        alert(`Comparison failed: ${data.error}`)
      }
    } catch (error) {
      console.error(`Failed to compare stashes:`, error)
      alert('Failed to compare stashes')
    }
  }

  return (
    <div className="bg-terminal-surface border border-terminal-border rounded p-6">
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-terminal-border">
        <h2 className="text-terminal-accent text-xl m-0">Test Results</h2>
        <button onClick={onRefresh} className="px-3 py-2 bg-transparent border border-terminal-border rounded text-gray-400 text-sm hover:bg-zinc-800 hover:border-gray-600 hover:text-white cursor-pointer" title="Refresh">
          ↻
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center justify-between">
        <div className="flex gap-2">
          {onEvaluateAll && (
            <button onClick={onEvaluateAll} className="px-4 py-2.5 bg-terminal-accent text-black rounded text-sm font-semibold hover:bg-green-500 cursor-pointer">
              Evaluate All
            </button>
          )}
          <button onClick={onStash} className="px-4 py-2.5 bg-terminal-border text-gray-300 border border-gray-600 rounded text-sm font-semibold hover:bg-zinc-700 cursor-pointer">
            Stash Results
          </button>
          <button onClick={onClean} className="px-4 py-2.5 bg-red-900 text-white rounded text-sm font-semibold hover:bg-red-800 cursor-pointer">
            Clean All (tests/*.txt)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">Sort by:</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-2 py-1.5 bg-terminal-surface border border-terminal-border rounded text-gray-300 text-sm cursor-pointer focus:outline-none focus:border-terminal-accent">
            <option value="modified">Date Modified</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
          </select>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto mb-4">
        {sortedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-gray-500 text-center">
            <p className="text-base text-gray-400 mb-2">No test files found</p>
            <span className="text-sm text-gray-600">Run a benchmark to generate test results</span>
          </div>
        ) : (
          sortedFiles.map(file => (
            <div
              key={file.path}
              className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-3 mb-2 rounded border bg-zinc-900 border-terminal-border"
            >
              <div className="flex-1">
                <div className="text-gray-300 font-medium mb-1 text-sm">{file.name}</div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{formatSize(file.size)}</span>
                  <span>{formatDate(file.modified)}</span>
                </div>
              </div>

              {onEvaluate && (
                <button
                  onClick={() => onEvaluate(file.path)}
                  className="px-3 py-1.5 bg-terminal-border text-terminal-accent border border-terminal-accent rounded text-xs font-semibold hover:bg-terminal-accent hover:text-black cursor-pointer"
                >
                  Evaluate
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => onDelete(file.path)}
                  className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-950 border border-red-500 rounded transition-colors cursor-pointer"
                  title="Delete file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {files.length > 0 && (
        <div className="flex justify-between px-3 py-2.5 bg-zinc-900 rounded text-sm text-gray-400">
          <span>{files.length} file(s)</span>
          <span>
            Total: {formatSize(files.reduce((acc, f) => acc + f.size, 0))}
          </span>
        </div>
      )}

      {stashes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-terminal-accent text-lg mb-4 pb-2 border-b border-terminal-border">Stashed Results</h3>
          {stashes.map(stash => {
            const isExpanded = expandedStashes.has(stash.name)
            const files = stashFiles.get(stash.name) || []
            const summary = stashSummaries.get(stash.name)

            // Model display name mappings
            const modelDisplayNames: Record<string, string> = {
              'claude-sonnet': 'Claude Sonnet 4.5',
              'claude-opus': 'Claude Opus 4',
              'claude-haiku': 'Claude Haiku 3.5',
              'gemini-flash': 'Gemini 2.0 Flash',
              'gemini-pro': 'Gemini 2.5 Pro',
              'gpt-4': 'GPT-4o',
              'gpt-4-mini': 'GPT-4o Mini',
              'o1': 'O1',
              'o1-mini': 'O1 Mini'
            }

            // Parse metadata from stash files (if summary is loaded)
            let metadata: { model: string; variant: string; suite: string } | null = null
            if (summary?.results) {
              const firstFilename = Object.keys(summary.results)[0]
              if (firstFilename) {
                const nameWithoutExt = firstFilename.replace('.txt', '')
                const parts = nameWithoutExt.split('-')

                if (parts.length >= 4) {
                  const timestampIdx = parts.length - 1
                  if (parts[timestampIdx].includes('_')) {
                    const suite = parts[timestampIdx - 1]
                    const variant = parts[0]
                    const model = parts.slice(1, timestampIdx - 1).join('-')

                    // Format display names
                    const displayModel = modelDisplayNames[model] || model
                    const displayVariant = variant.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                    const displaySuite = suite.charAt(0).toUpperCase() + suite.slice(1)

                    metadata = { model: displayModel, variant: displayVariant, suite: displaySuite }
                  }
                }
              }
            }

            return (
              <div key={stash.name} className="mb-2">
                <div className="px-4 py-3 bg-zinc-900 border border-terminal-border rounded flex justify-between items-center">
                  <button
                    onClick={() => toggleStash(stash.name)}
                    className="flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer flex items-center gap-3"
                  >
                    <span className="text-gray-400 text-lg">{isExpanded ? '▼' : '▶'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-gray-300 font-medium text-sm">{stash.name}</div>
                        {metadata && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>-</span>
                            <span className="text-blue-400 font-semibold">{metadata.model}</span>
                            <span>-</span>
                            <span className="text-purple-400 font-semibold">{metadata.variant}</span>
                            <span>-</span>
                            <span className="text-orange-400 font-semibold">{metadata.suite}</span>
                            <span>-</span>
                            <span className="text-terminal-accent font-semibold">x{stash.file_count}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {stash.file_count} files • {formatDate(stash.created)}
                      </div>
                    </div>
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => selectForCompare(stash.name, e)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                        selectedStashForCompare === stash.name
                          ? 'bg-blue-600 text-white border border-blue-600'
                          : 'bg-transparent text-blue-400 border border-blue-600 hover:bg-blue-900'
                      }`}
                      title="Select this stash for comparison"
                    >
                      Select for Compare
                    </button>
                    <button
                      onClick={(e) => compareWithSelected(stash.name, e)}
                      className="px-3 py-1.5 bg-transparent text-purple-400 border border-purple-600 rounded text-xs font-semibold hover:bg-purple-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Compare with selected stash"
                      disabled={!selectedStashForCompare || selectedStashForCompare === stash.name}
                    >
                      Compare with Selected
                    </button>
                    <button
                      onClick={(e) => evaluateStash(stash.name, e)}
                      className="px-3 py-1.5 bg-terminal-border text-terminal-accent border border-terminal-accent rounded text-xs font-semibold hover:bg-terminal-accent hover:text-black cursor-pointer"
                      title="Evaluate all files in this stash"
                    >
                      Evaluate All
                    </button>
                    <button
                      onClick={(e) => deleteStash(stash.name, e)}
                      className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-950 border border-red-500 rounded transition-colors cursor-pointer"
                      title="Delete entire stash"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2 ml-4 pl-4 border-l-2 border-terminal-border">
                    {files.length === 0 ? (
                      <div className="p-3 text-gray-500 text-sm">Loading...</div>
                    ) : (
                      files.map(file => (
                        <div
                          key={file.path}
                          className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-3 mb-2 rounded border bg-zinc-900 border-terminal-border"
                        >
                          <div className="flex-1">
                            <div className="text-gray-300 font-medium mb-1 text-sm">{file.name}</div>
                            <div className="flex gap-4 text-xs text-gray-500">
                              <span>{formatSize(file.size)}</span>
                              <span>{formatDate(file.modified)}</span>
                            </div>
                          </div>

                          {onEvaluate && (
                            <button
                              onClick={() => onEvaluate(file.path)}
                              className="px-3 py-1.5 bg-terminal-border text-terminal-accent border border-terminal-accent rounded text-xs font-semibold hover:bg-terminal-accent hover:text-black cursor-pointer"
                            >
                              Evaluate
                            </button>
                          )}

                          {onDelete && (
                            <button
                              onClick={() => onDelete(file.path)}
                              className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-950 border border-red-500 rounded transition-colors cursor-pointer"
                              title="Delete file"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
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
