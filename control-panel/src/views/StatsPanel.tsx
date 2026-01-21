interface Props {
  stats: any
  apiKeyConfigured: boolean
}

export default function StatsPanel({ stats, apiKeyConfigured }: Props) {
  if (!stats) {
    return null
  }

  const topCategories = Object.entries(stats.categories || {})
    .sort((a: any, b: any) => b[1].points - a[1].points)
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary">System Status</h2>
        <p className="text-text-muted mt-1">Overview of benchmark configuration and statistics</p>
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
        <h3 className="text-text-primary font-medium mb-4">API Configuration</h3>
        <div className="flex gap-3">
          <div className={`flex items-center gap-2 px-4 py-3 rounded border text-sm ${
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
            <div className="text-3xl font-bold text-terminal-accent">{stats.total_tests}</div>
          </div>

          <div className="bg-terminal-elevated p-5 rounded-lg border border-terminal-border">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Total Points</div>
            <div className="text-3xl font-bold text-terminal-accent">{stats.total_points}</div>
          </div>

          <div className="bg-terminal-elevated p-5 rounded-lg border border-terminal-border">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Categories</div>
            <div className="text-3xl font-bold text-terminal-accent">{Object.keys(stats.categories || {}).length}</div>
          </div>

          <div className="bg-terminal-elevated p-5 rounded-lg border border-terminal-border">
            <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Difficulty Levels</div>
            <div className="text-3xl font-bold text-terminal-accent">10</div>
          </div>
        </div>
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
        <h3 className="text-text-primary font-medium mb-4">Top Categories (by points)</h3>
        <div className="space-y-3">
          {topCategories.map(([name, data]: [string, any], index) => (
            <div key={name} className="flex items-center gap-4 p-4 bg-terminal-elevated rounded-lg border border-terminal-border hover:border-terminal-border-accent transition-colors">
              <span className="w-8 h-8 flex items-center justify-center bg-terminal-accent/20 text-terminal-accent rounded font-bold text-sm">
                #{index + 1}
              </span>
              <div className="flex-1">
                <span className="text-text-primary font-medium">{name}</span>
                <div className="text-xs text-text-muted mt-0.5">
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
          {Object.entries(stats.levels || {})
            .sort((a, b) => {
              const levelA = parseInt(a[0].replace('level_', ''))
              const levelB = parseInt(b[0].replace('level_', ''))
              return levelA - levelB
            })
            .map(([level, data]: [string, any]) => {
              const levelNum = parseInt(level.replace('level_', ''))
              const percentage = (data.count / stats.total_tests) * 100
              return (
                <div key={level} className="grid grid-cols-[40px_1fr_50px] items-center gap-4">
                  <span className="text-sm text-text-secondary font-medium">L{levelNum}</span>
                  <div className="h-6 bg-terminal-border rounded overflow-hidden">
                    <div
                      className="h-full bg-terminal-accent transition-all duration-700"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-terminal-accent font-semibold text-right">{data.count}</span>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
