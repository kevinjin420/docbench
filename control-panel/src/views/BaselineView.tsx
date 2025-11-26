import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import ModelSelector from '@/components/ModelSelector'
import DocumentationSelector from '@/components/DocumentationSelector'
import ProgressBar from '@/components/ProgressBar'
import TestFileList from '@/components/TestFileList'
import ResultsView from '@/components/ResultsView'
import { API_BASE, WS_BASE } from '@/utils/types'
import type { Model, Variant, TestFile, BenchmarkStatus, BatchStatus } from '@/utils/types'

interface BaselineViewProps {
  models: Model[]
  variants: Variant[]
  testFiles: TestFile[]
  onBenchmarkComplete: () => void
}

let socket: Socket | null = null

export default function BaselineView({ models, variants, testFiles, onBenchmarkComplete }: BaselineViewProps) {
  const [selectedModel, setSelectedModel] = useState(models[0]?.id || '')
  const [selectedVariant, setSelectedVariant] = useState(variants[0]?.name || '')
  const [status, setStatus] = useState<BenchmarkStatus | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    if (!socket) {
      socket = io(WS_BASE, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      socket.on('connect', () => {
        console.log('Socket connected for BaselineView')
      })

      socket.on('disconnect', () => {
        console.log('Socket disconnected')
      })
    }

    return () => {
      // Don't disconnect socket on unmount - let it persist
      // socket?.off('benchmark_update')
    }
  }, [])

  const runBaseline = async () => {
    console.log('=== Starting baseline runs ===')
    console.log('Model:', selectedModel)
    console.log('Variant:', selectedVariant)

    if (!socket) {
      console.error('Socket not initialized')
      return
    }

    // Ensure socket is connected
    if (!socket.connected) {
      console.log('Waiting for socket to connect...')
      await new Promise<void>((resolve) => {
        socket!.once('connect', () => {
          console.log('Socket connected!')
          resolve()
        })
        // If already connecting, give it a moment
        setTimeout(() => resolve(), 1000)
      })
    }

    console.log('Socket connected:', socket.connected)
    setStatus({ status: 'running', progress: 'Starting baseline runs...', completed: 0, total: 6 })

    // Queue 3 runs with batch=1, then 3 runs with batch=30
    const batch1Payload = { model: selectedModel, variant: selectedVariant, temperature: 0.1, batch_size: 1 }
    const batch30Payload = { model: selectedModel, variant: selectedVariant, temperature: 0.1, batch_size: 30 }

    const runIds: string[] = []
    const runState: Record<string, { batches: number; completed: number; done: boolean; failed: boolean; index: number }> = {}
    let totalBatches = 0
    let completedBatches = 0
    let runsCompleted = 0
    let runsFailed = 0

    // Start all 6 runs in parallel (3 with batch=1, 3 with batch=30)
    const startPromises = [
      ...Array.from({ length: 3 }, async (_, i) => {
        const res = await fetch(`${API_BASE}/benchmark/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch1Payload),
        })
        const data = await res.json()
        runIds[i] = data.run_id
        runState[data.run_id] = { batches: 0, completed: 0, done: false, failed: false, index: i }
        return data.run_id
      }),
      ...Array.from({ length: 3 }, async (_, i) => {
        const res = await fetch(`${API_BASE}/benchmark/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch30Payload),
        })
        const data = await res.json()
        runIds[i + 3] = data.run_id
        runState[data.run_id] = { batches: 0, completed: 0, done: false, failed: false, index: i + 3 }
        return data.run_id
      }),
    ]

    await Promise.all(startPromises)

    console.log('All 6 runs started. Run IDs:', runIds)
    console.log('Setting up socket listener...')

    await new Promise<void>((resolve) => {
      if (!socket) {
        resolve()
        return
      }

      const timeoutId = setTimeout(() => {
        cleanup()
        resolve()
      }, 1800000) // 30 minutes timeout

      let allBatchStatuses: Record<string, BatchStatus> = {}

      const prefixBatchStatuses = (statuses: Record<string, BatchStatus>, runIndex: number) => {
        const prefixed: Record<string, BatchStatus> = {}
        for (const [key, value] of Object.entries(statuses)) {
          prefixed[`${runIndex + 1}.${key}`] = value
        }
        return prefixed
      }

      const handleUpdate = (data: any) => {
        console.log('Received benchmark update:', data)

        if (!runIds.includes(data.run_id)) {
          console.log('Update not for our runs, ignoring')
          return
        }

        const state = runState[data.run_id]
        if (!state) {
          console.log('State not found for run_id:', data.run_id)
          return
        }
        if (state.done) {
          console.log('Run already done, ignoring')
          return
        }

        if (data.num_batches && state.batches === 0) {
          state.batches = data.num_batches
          totalBatches += data.num_batches
          console.log('Total batches updated:', totalBatches)
        }
        if (data.batch_num) {
          const delta = data.batch_num - state.completed
          if (delta > 0) {
            completedBatches += delta
            state.completed = data.batch_num
            console.log('Completed batches:', completedBatches, '/', totalBatches)
          }
        }
        if (data.batch_statuses) {
          allBatchStatuses = { ...allBatchStatuses, ...prefixBatchStatuses(data.batch_statuses, state.index) }
        }
        if (data.status === 'completed' || data.status === 'failed') {
          if (!state.done) {
            state.done = true
            runsCompleted++
            console.log('Run completed:', runsCompleted, '/', 6)
            if (data.status === 'failed') {
              state.failed = true
              runsFailed++
            }
            onBenchmarkComplete()
          }
        }

        const finalStatus = runsCompleted === 6 ? (runsFailed > 0 ? 'failed' : 'completed') : 'running'
        setStatus({
          status: finalStatus,
          progress: `${completedBatches}/${totalBatches || '?'}`,
          completed: runsCompleted,
          total: 6,
          batches_completed_global: completedBatches,
          batches_total_global: totalBatches || undefined,
          batch_statuses: allBatchStatuses,
        })

        if (runsCompleted === 6) {
          console.log('All runs completed!')
          cleanup()
          resolve()
        }
      }

      const cleanup = () => {
        console.log('Cleaning up socket listener')
        socket?.off('benchmark_update', handleUpdate)
        clearTimeout(timeoutId)
      }

      console.log('Attaching socket listener for benchmark_update')
      socket.on('benchmark_update', handleUpdate)
    })

    setStatus({
      status: runsFailed > 0 ? 'failed' : 'completed',
      progress: runsFailed > 0 ? `${runsFailed} run(s) failed` : 'All runs completed',
      completed: 6,
      total: 6,
      batches_completed_global: completedBatches,
      batches_total_global: totalBatches,
    })
  }

  const cancelBaseline = () => {
    socket?.off('benchmark_update')
    setStatus({ status: 'idle', progress: 'Idle', completed: 0, total: 0 })
  }

  const handleFileClick = async (filePath: string) => {
    console.log('=== File clicked ===')
    console.log('File path:', filePath)

    // Extract run_id from path (handle both db/run_id and run_id.txt formats)
    const runId = filePath.includes('/')
      ? filePath.split('/').pop()?.replace('.txt', '')
      : filePath.replace('.txt', '')

    console.log('Extracted run_id:', runId)

    setSelectedFile(filePath)
    setResults(null) // Clear previous results

    try {
      console.log('Fetching evaluation...')
      const res = await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId }), // Use run_id directly
      })

      console.log('Response status:', res.status)

      if (!res.ok) {
        const error = await res.json()
        console.error('Evaluation API error:', error)
        return
      }

      const data = await res.json()
      console.log('Evaluation data received!')
      console.log('- Has summary?', !!data.summary)
      console.log('- Overall percentage:', data.summary?.overall_percentage)
      console.log('- Total score:', data.summary?.total_score)

      setResults(data)
      console.log('✓ Results state updated')
    } catch (e) {
      console.error('Failed to evaluate file:', e)
    }
  }

  const handleDeleteFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`${API_BASE}/delete-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      })
      if (selectedFile === filePath) {
        setSelectedFile(null)
        setResults(null)
      }
      onBenchmarkComplete()
    } catch (e) {
      console.error('Failed to delete file:', e)
    }
  }

  const isRunning = status?.status === 'running'
  const statusDisplay = status || { status: 'idle', progress: 'Idle', completed: 0, total: 0 }

  console.log('BaselineView render - results:', results ? 'has data' : 'null')

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="bg-terminal-surface border border-terminal-border rounded p-6">
        <h2 className="text-terminal-accent text-2xl font-bold mb-2">Baseline Testing</h2>
        <p className="text-gray-400 text-sm">
          Runs 3 tests with batch=1 (baseline) and 3 tests with batch=30 (comparison) to measure documentation quality.
        </p>
      </div>

      {/* Controls */}
      <div className="p-4 bg-terminal-surface border border-terminal-border rounded">
        <div className="flex gap-3 items-center justify-between mb-4">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex-1 min-w-[400px]">
              <ModelSelector
                models={models}
                selectedModel={selectedModel}
                onSelect={setSelectedModel}
                disabled={isRunning}
              />
            </div>

            <div className="flex-1 min-w-[250px]">
              <DocumentationSelector
                variants={variants}
                selectedVariant={selectedVariant}
                onSelect={setSelectedVariant}
                disabled={isRunning}
              />
            </div>
          </div>

          <div className="flex gap-3 items-center">
            {!isRunning ? (
              <button
                onClick={runBaseline}
                disabled={!selectedModel || !selectedVariant}
                className="px-6 py-2 bg-terminal-accent text-black rounded text-sm font-semibold whitespace-nowrap hover:bg-green-500 disabled:bg-terminal-border disabled:text-gray-600 disabled:cursor-not-allowed cursor-pointer"
              >
                Run Baseline (6 tests)
              </button>
            ) : (
              <button
                onClick={cancelBaseline}
                className="px-6 py-2 bg-red-600 text-white rounded text-sm font-semibold whitespace-nowrap hover:bg-red-700 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <ProgressBar status={statusDisplay} rerunningBatches={new Set()} />
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-[280px_1fr] gap-6 min-h-[600px]">
        <TestFileList
          files={testFiles}
          selectedFile={selectedFile}
          onFileClick={handleFileClick}
          onFileDelete={handleDeleteFile}
        />
        <ResultsView results={results} />
      </div>
    </div>
  )
}
