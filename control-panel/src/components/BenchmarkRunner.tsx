import { useState, useEffect } from 'react'
import './BenchmarkRunner.css'

interface Model {
  alias: string
  model_id: string
}

interface Variant {
  name: string
  file: string
  size: number
  size_kb: number
}

interface BenchmarkStatus {
  status: 'running' | 'completed' | 'failed'
  progress?: string
  result?: any
  error?: string
}

interface Props {
  models: Model[]
  variants: Variant[]
  onBenchmarkComplete: () => void
}

const API_BASE = 'http://localhost:5000/api'

export default function BenchmarkRunner({ models, variants, onBenchmarkComplete }: Props) {
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = localStorage.getItem('benchmarkModel')
    return saved || models[0]?.alias || ''
  })
  const [selectedVariant, setSelectedVariant] = useState(() => {
    const saved = localStorage.getItem('benchmarkVariant')
    return saved || variants[0]?.name || ''
  })
  const [temperature, setTemperature] = useState(() => {
    const saved = localStorage.getItem('benchmarkTemperature')
    return saved ? parseFloat(saved) : 0.1
  })
  const [maxTokens, setMaxTokens] = useState(() => {
    const saved = localStorage.getItem('benchmarkMaxTokens')
    return saved ? parseInt(saved) : 16000
  })
  const [status, setStatus] = useState<BenchmarkStatus | null>(() => {
    const saved = localStorage.getItem('benchmarkStatus')
    return saved ? JSON.parse(saved) : null
  })
  const [runId, setRunId] = useState<string | null>(() => {
    return localStorage.getItem('benchmarkRunId')
  })

  useEffect(() => {
    localStorage.setItem('benchmarkModel', selectedModel)
  }, [selectedModel])

  useEffect(() => {
    localStorage.setItem('benchmarkVariant', selectedVariant)
  }, [selectedVariant])

  useEffect(() => {
    localStorage.setItem('benchmarkTemperature', temperature.toString())
  }, [temperature])

  useEffect(() => {
    localStorage.setItem('benchmarkMaxTokens', maxTokens.toString())
  }, [maxTokens])

  useEffect(() => {
    if (status) {
      localStorage.setItem('benchmarkStatus', JSON.stringify(status))
    } else {
      localStorage.removeItem('benchmarkStatus')
    }
  }, [status])

  useEffect(() => {
    if (runId) {
      localStorage.setItem('benchmarkRunId', runId)
    } else {
      localStorage.removeItem('benchmarkRunId')
    }
  }, [runId])

  useEffect(() => {
    if (runId && status?.status === 'running') {
      const interval = setInterval(async () => {
        const statusRes = await fetch(`${API_BASE}/benchmark/status/${runId}`)
        const statusData = await statusRes.json()
        setStatus(statusData)

        if (statusData.status === 'completed' || statusData.status === 'failed') {
          clearInterval(interval)
          setRunId(null)
          if (statusData.status === 'completed') {
            onBenchmarkComplete()
          }
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [runId, status?.status, onBenchmarkComplete])

  const runBenchmark = async () => {
    setStatus({ status: 'running', progress: 'Starting...' })

    const res = await fetch(`${API_BASE}/benchmark/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        variant: selectedVariant,
        temperature,
        max_tokens: maxTokens
      })
    })

    const data = await res.json()
    setRunId(data.run_id)
  }

  const isRunning = status?.status === 'running'

  const groupedVariants = variants.reduce((groups: Record<string, Variant[]>, variant) => {
    const match = variant.name.match(/[_-]v(\d+)/)
    const version = match ? `v${match[1]}` : 'other'
    if (!groups[version]) groups[version] = []
    groups[version].push(variant)
    return groups
  }, {})

  const sortedVersions = Object.keys(groupedVariants).sort((a, b) => {
    if (a === 'other') return 1
    if (b === 'other') return -1
    const numA = parseInt(a.substring(1))
    const numB = parseInt(b.substring(1))
    return numB - numA
  })

  return (
    <div className="benchmark-runner">
      <h2>Run Benchmark</h2>

      <div className="config-section">
        <div className="form-grid">
          <div className="form-group">
            <label>Model</label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={isRunning}
            >
              {models.map(m => (
                <option key={m.alias} value={m.alias}>
                  {m.alias}
                </option>
              ))}
            </select>
            <span className="model-id">{models.find(m => m.alias === selectedModel)?.model_id}</span>
          </div>

          <div className="form-group">
            <label>Documentation Variant</label>
            <select
              value={selectedVariant}
              onChange={e => setSelectedVariant(e.target.value)}
              disabled={isRunning}
            >
              {sortedVersions.map(version => (
                <optgroup key={version} label={version.toUpperCase()}>
                  {groupedVariants[version].map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.size_kb} KB)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Temperature</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              disabled={isRunning}
            />
          </div>

          <div className="form-group">
            <label>Max Tokens</label>
            <input
              type="number"
              step="1000"
              value={maxTokens}
              onChange={e => setMaxTokens(parseInt(e.target.value))}
              disabled={isRunning}
            />
          </div>
        </div>

        <button
          onClick={runBenchmark}
          disabled={isRunning || !selectedModel || !selectedVariant}
          className={`run-button ${isRunning ? 'running' : ''}`}
        >
          {isRunning ? (
            <>
              <span className="spinner"></span>
              Running Benchmark...
            </>
          ) : (
            'Run Benchmark'
          )}
        </button>
      </div>

      {status && (
        <div className={`status-panel status-${status.status}`}>
          <div className="status-header">
            <span className="status-badge">{status.status}</span>
            {status.progress && <span className="status-progress">{status.progress}</span>}
          </div>

          {status.error && (
            <div className="status-error">
              <strong>Error:</strong>
              <pre>{status.error}</pre>
            </div>
          )}

          {status.result && (
            <div className="status-success">
              <div className="success-item">
                <span className="label">Generated:</span>
                <span className="value">{status.result.num_responses} test cases</span>
              </div>
              <div className="success-item">
                <span className="label">Output:</span>
                <span className="value">{status.result.output_file}</span>
              </div>
              <div className="success-item">
                <span className="label">Model:</span>
                <span className="value">{status.result.model}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
