import { useState, useEffect } from 'react'
import type { Variant, VariantValidation } from '@/utils/types'
import { API_BASE } from '@/utils/types'
import { getAdminHeaders } from '@/utils/auth'

interface Props {
  variants: Variant[]
  onRefresh: () => void
}

export default function VariantsView({ variants, onRefresh }: Props) {
  const [isAddingVariant, setIsAddingVariant] = useState(false)
  const [formData, setFormData] = useState({ variant_name: '', url: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [validations, setValidations] = useState<Record<string, VariantValidation | null>>({})

  useEffect(() => {
    const fetchValidations = async () => {
      const results: Record<string, VariantValidation | null> = {}
      for (const variant of variants) {
        const validationUrl = variant.url.replace(/\.txt$/, '.validation.json')
        try {
          const res = await fetch(validationUrl)
          if (res.ok) {
            results[variant.name] = await res.json()
          } else {
            results[variant.name] = null
          }
        } catch {
          results[variant.name] = null
        }
      }
      setValidations(results)
    }
    if (variants.length > 0) {
      fetchValidations()
    }
  }, [variants])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setFormData({ variant_name: '', url: '' })
        setIsAddingVariant(false)
        onRefresh()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      alert('Failed to create variant')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (variantName: string) => {
    if (deleteConfirm !== variantName) {
      setDeleteConfirm(variantName)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/variants/${encodeURIComponent(variantName)}`, {
        method: 'DELETE',
        headers: { ...getAdminHeaders() }
      })

      if (response.ok) {
        onRefresh()
        setDeleteConfirm(null)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      alert('Failed to delete variant')
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Documentation Variants</h2>
          <p className="text-text-muted mt-1">Manage documentation sources for benchmarking</p>
        </div>
        <button
          onClick={() => setIsAddingVariant(!isAddingVariant)}
          className={`btn ${isAddingVariant ? 'btn-secondary' : 'btn-primary'}`}
        >
          {isAddingVariant ? 'Cancel' : 'Add Variant'}
        </button>
      </div>

      {isAddingVariant && (
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
          <h3 className="text-lg font-medium text-text-primary mb-4">Add New Variant</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label>
              <input
                type="text"
                required
                value={formData.variant_name}
                onChange={(e) => setFormData({ ...formData, variant_name: e.target.value })}
                className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                placeholder="e.g., jaseci-docs-v1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">URL</label>
              <input
                type="url"
                required
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 bg-terminal-elevated border border-terminal-border rounded text-text-primary text-sm focus:outline-none focus:border-terminal-accent"
                placeholder="https://example.com/docs.md"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Creating...' : 'Create Variant'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingVariant(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-terminal-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">URL</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Size</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Jac Check</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-terminal-border/50">
            {variants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  No variants found. Add your first variant to get started.
                </td>
              </tr>
            ) : (
              variants.map((variant) => {
                const validation = validations[variant.name]
                const jacCheck = validation?.jac_check
                return (
                  <tr key={variant.name} className="hover:bg-terminal-elevated/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-text-primary">{variant.name}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary max-w-md truncate">
                      <a href={variant.url} target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-terminal-accent transition-colors">
                        {variant.url}
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-text-muted">{variant.size_kb} KB</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {validation === undefined ? (
                        <span className="text-text-muted">Loading...</span>
                      ) : validation === null ? (
                        <span className="text-text-muted">No validation</span>
                      ) : jacCheck ? (
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${jacCheck.pass_rate >= 80 ? 'text-green-400' : jacCheck.pass_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {jacCheck.pass_rate.toFixed(0)}%
                          </span>
                          <span className="text-text-muted text-xs">
                            ({jacCheck.passed}/{jacCheck.passed + jacCheck.failed})
                          </span>
                          {jacCheck.failed > 0 && (
                            <span className="text-red-400 text-xs" title={jacCheck.errors?.map(e => `Block ${e.block}: ${e.error}`).join('\n')}>
                              {jacCheck.failed} failed
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className={validation.is_valid ? 'text-green-400' : 'text-red-400'}>
                          {validation.is_valid ? 'Valid' : 'Invalid'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleDelete(variant.name)}
                        className={`btn btn-sm ${deleteConfirm === variant.name ? 'btn-danger-solid' : 'btn-danger'}`}
                      >
                        {deleteConfirm === variant.name ? 'Confirm' : 'Delete'}
                      </button>
                      {deleteConfirm === variant.name && (
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="btn btn-secondary btn-sm ml-2"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
