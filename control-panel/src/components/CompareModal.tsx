interface CompareResult {
  status: string
  stash1: {
    name: string
    average_score: number
    scores: number[]
    file_count: number
    category_averages: { [key: string]: number }
    filenames: string[]
  }
  stash2: {
    name: string
    average_score: number
    scores: number[]
    file_count: number
    category_averages: { [key: string]: number }
    filenames: string[]
  }
  all_categories: string[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  results: CompareResult | null
}

export default function CompareModal({ isOpen, onClose, results }: Props) {
  if (!isOpen || !results) return null

  const { stash1, stash2, all_categories } = results

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

  // Parse metadata from filenames
  const parseMetadata = (filenames: string[]) => {
    if (!filenames || filenames.length === 0) return null

    const filename = filenames[0]
    const nameWithoutExt = filename.replace('.txt', '')
    const parts = nameWithoutExt.split('-')

    if (parts.length >= 4) {
      const timestampIdx = parts.length - 1
      if (parts[timestampIdx].includes('_')) {
        const suite = parts[timestampIdx - 1]
        const variant = parts[0]
        const model = parts.slice(1, timestampIdx - 1).join('-')

        const displayModel = modelDisplayNames[model] || model
        const displayVariant = variant.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        const displaySuite = suite.charAt(0).toUpperCase() + suite.slice(1)

        return { model: displayModel, variant: displayVariant, suite: displaySuite }
      }
    }
    return null
  }

  const metadata1 = parseMetadata(stash1.filenames)
  const metadata2 = parseMetadata(stash2.filenames)

  const scoreDiff = stash2.average_score - stash1.average_score
  const percentDiff = stash1.average_score > 0
    ? ((scoreDiff / stash1.average_score) * 100)
    : 0

  // Find categories with biggest differences
  const categoryDifferences = all_categories.map(cat => {
    const score1 = stash1.category_averages[cat] || 0
    const score2 = stash2.category_averages[cat] || 0
    const diff = score2 - score1
    return { category: cat, score1, score2, diff }
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  const topDifferences = categoryDifferences.slice(0, 5)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8" onClick={onClose}>
      <div className="bg-terminal-surface border-2 border-terminal-accent rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-terminal-surface border-b border-terminal-border p-6 flex justify-between items-center">
          <div>
            <h2 className="text-terminal-accent text-2xl font-bold m-0">Comparison Results</h2>
            <p className="text-gray-400 text-sm mt-1">
              {stash1.name} vs {stash2.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="p-6 bg-zinc-900 border border-terminal-border rounded">
              <div className="mb-3">
                <div className="text-gray-400 text-sm mb-1">{stash1.name}</div>
                {metadata1 && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    <span className="text-blue-400 font-semibold">{metadata1.model}</span>
                    <span>-</span>
                    <span className="text-purple-400 font-semibold">{metadata1.variant}</span>
                    <span>-</span>
                    <span className="text-orange-400 font-semibold">{metadata1.suite}</span>
                    <span>-</span>
                    <span className="text-terminal-accent font-semibold">x{stash1.file_count}</span>
                  </div>
                )}
              </div>
              <div className="text-terminal-accent text-4xl font-bold">
                {stash1.average_score.toFixed(1)}%
              </div>
            </div>

            <div className="p-6 bg-zinc-900 border border-terminal-border rounded">
              <div className="mb-3">
                <div className="text-gray-400 text-sm mb-1">{stash2.name}</div>
                {metadata2 && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                    <span className="text-blue-400 font-semibold">{metadata2.model}</span>
                    <span>-</span>
                    <span className="text-purple-400 font-semibold">{metadata2.variant}</span>
                    <span>-</span>
                    <span className="text-orange-400 font-semibold">{metadata2.suite}</span>
                    <span>-</span>
                    <span className="text-terminal-accent font-semibold">x{stash2.file_count}</span>
                  </div>
                )}
              </div>
              <div className="text-terminal-accent text-4xl font-bold">
                {stash2.average_score.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="mb-8 p-6 bg-gradient-to-r from-zinc-800 to-zinc-900 border-2 border-terminal-accent rounded-lg">
            <h3 className="text-terminal-accent text-xl font-bold mb-4">Difference</h3>
            <div className="flex items-baseline gap-3">
              <div className={`text-4xl font-bold ${scoreDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {scoreDiff >= 0 ? '+' : ''}{scoreDiff.toFixed(1)}%
              </div>
              <div className="text-gray-400 text-lg">
                ({percentDiff >= 0 ? '+' : ''}{percentDiff.toFixed(1)}% change)
              </div>
            </div>
            <div className="mt-2 text-gray-400 text-sm">
              {scoreDiff >= 0
                ? `${stash2.name} performs better than ${stash1.name}`
                : `${stash1.name} performs better than ${stash2.name}`
              }
            </div>
          </div>

          {topDifferences.length > 0 && (
            <div className="mb-8">
              <h4 className="text-terminal-accent text-lg font-bold mb-4">Top Category Differences</h4>
              <div className="space-y-3">
                {topDifferences.map(cat => (
                  <div key={cat.category} className="p-4 bg-zinc-900 border border-terminal-border rounded">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-300 font-medium">{cat.category}</span>
                      <span className={`font-bold ${cat.diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {cat.diff >= 0 ? '+' : ''}{cat.diff.toFixed(1)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">{stash1.name}</div>
                        <div className="text-gray-300 font-semibold">{cat.score1.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-gray-500">{stash2.name}</div>
                        <div className="text-gray-300 font-semibold">{cat.score2.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-terminal-accent text-lg font-bold mb-4">All Categories</h4>
            <div className="grid grid-cols-2 gap-3">
              {all_categories.map(cat => {
                const score1 = stash1.category_averages[cat] || 0
                const score2 = stash2.category_averages[cat] || 0
                const diff = score2 - score1
                return (
                  <div key={cat} className="p-3 bg-zinc-900 border border-terminal-border rounded text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">{cat}</span>
                      <span className={`font-semibold ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500">
                      <span>{score1.toFixed(1)}%</span>
                      <span>→</span>
                      <span>{score2.toFixed(1)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
