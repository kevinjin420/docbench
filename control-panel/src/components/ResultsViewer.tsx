import { useState } from 'react'
import './ResultsViewer.css'

interface Props {
  results: any
  onClose?: () => void
}

export default function ResultsViewer({ results, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'categories' | 'levels'>('summary')

  if (!results) return null

  const summary = results.summary
  const hasMultipleVariants = results.results !== undefined

  return (
    <div className="results-viewer">
      <div className="results-header">
        <h2>Evaluation Results</h2>
        {onClose && (
          <button onClick={onClose} className="close-btn">Close</button>
        )}
      </div>

      {!hasMultipleVariants && summary && (
        <>
          <div className="score-hero">
            <div className="score-circle">
              <svg viewBox="0 0 100 100">
                <circle
                  className="score-bg"
                  cx="50"
                  cy="50"
                  r="45"
                />
                <circle
                  className="score-fill"
                  cx="50"
                  cy="50"
                  r="45"
                  style={{
                    strokeDashoffset: 283 - (283 * summary.overall_percentage) / 100
                  }}
                />
              </svg>
              <div className="score-text">
                <span className="score-value">{summary.overall_percentage.toFixed(1)}%</span>
                <span className="score-label">Score</span>
              </div>
            </div>

            <div className="score-details">
              <div className="detail-item">
                <span className="detail-label">Total Score</span>
                <span className="detail-value">
                  {summary.total_score} / {summary.total_max}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tests Completed</span>
                <span className="detail-value">{summary.tests_completed}</span>
              </div>
              {summary.patched_count > 0 && (
                <div className="detail-item warning">
                  <span className="detail-label">Auto-Patched</span>
                  <span className="detail-value">{summary.patched_count}</span>
                </div>
              )}
            </div>
          </div>

          <div className="tabs">
            <button
              className={activeTab === 'summary' ? 'active' : ''}
              onClick={() => setActiveTab('summary')}
            >
              Summary
            </button>
            <button
              className={activeTab === 'categories' ? 'active' : ''}
              onClick={() => setActiveTab('categories')}
            >
              Categories
            </button>
            <button
              className={activeTab === 'levels' ? 'active' : ''}
              onClick={() => setActiveTab('levels')}
            >
              Difficulty Levels
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'summary' && (
              <div className="summary-grid">
                <div className="summary-card">
                  <h3>Top Performing Categories</h3>
                  <div className="top-list">
                    {Object.entries(summary.category_breakdown || {})
                      .map(([name, data]: [string, any]) => ({
                        name,
                        percentage: data.percentage
                      }))
                      .sort((a, b) => b.percentage - a.percentage)
                      .slice(0, 5)
                      .map(item => (
                        <div key={item.name} className="top-item">
                          <span className="top-name">{item.name}</span>
                          <span className="top-score">{item.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="summary-card">
                  <h3>Areas for Improvement</h3>
                  <div className="top-list">
                    {Object.entries(summary.category_breakdown || {})
                      .map(([name, data]: [string, any]) => ({
                        name,
                        percentage: data.percentage
                      }))
                      .sort((a, b) => a.percentage - b.percentage)
                      .slice(0, 5)
                      .map(item => (
                        <div key={item.name} className="top-item">
                          <span className="top-name">{item.name}</span>
                          <span className="top-score low">{item.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="breakdown-list">
                {Object.entries(summary.category_breakdown || {}).map(([name, data]: [string, any]) => (
                  <div key={name} className="breakdown-item">
                    <div className="breakdown-header">
                      <span className="breakdown-name">{name}</span>
                      <span className="breakdown-stats">
                        {data.score.toFixed(2)} / {data.max} ({data.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${data.percentage}%` }}
                      ></div>
                    </div>
                    <div className="breakdown-meta">
                      <span>{data.count} tests</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'levels' && (
              <div className="breakdown-list">
                {Object.entries(summary.level_breakdown || {})
                  .sort(([levelA], [levelB]) => {
                    const numA = parseInt(levelA.replace(/\D/g, ''))
                    const numB = parseInt(levelB.replace(/\D/g, ''))
                    return numA - numB
                  })
                  .map(([level, data]: [string, any]) => (
                  <div key={level} className="breakdown-item">
                    <div className="breakdown-header">
                      <span className="breakdown-name">{level}</span>
                      <span className="breakdown-stats">
                        {data.score.toFixed(2)} / {data.max} ({data.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${data.percentage}%` }}
                      ></div>
                    </div>
                    <div className="breakdown-meta">
                      <span>{data.count} tests</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {hasMultipleVariants && (
        <div className="multi-variant-results">
          <h3>Multi-Variant Comparison</h3>
          <div className="variant-grid">
            {Object.entries(results.results).map(([variant, data]: [string, any]) => (
              <div key={variant} className="variant-card">
                <div className="variant-name">{variant}</div>
                <div className="variant-score">
                  {data.summary.overall_percentage.toFixed(1)}%
                </div>
                <div className="variant-details">
                  <span>{data.summary.total_score} / {data.summary.total_max}</span>
                  <span>{data.file_size} bytes</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
