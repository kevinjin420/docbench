import { useState, useRef, useEffect } from 'react'
import type { Variant } from '@/utils/types'

interface Props {
  variants: Variant[]
  selectedVariant: string
  onSelect: (variantName: string) => void
  disabled?: boolean
}

export default function DocumentationSelector({ variants, selectedVariant, onSelect, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const groupedVariants = variants.reduce(
    (groups: Record<string, Variant[]>, variant) => {
      const match = variant.name.match(/[_-]v(\d+)/)
      const version = match ? `v${match[1]}` : 'other'
      if (!groups[version]) groups[version] = []
      groups[version].push(variant)
      return groups
    },
    {}
  )

  const sortedVersions = Object.keys(groupedVariants).sort((a, b) => {
    if (a === 'other') return 1
    if (b === 'other') return -1
    return parseInt(b.substring(1)) - parseInt(a.substring(1))
  })

  const filteredGroups = sortedVersions.reduce((acc, version) => {
    const filtered = groupedVariants[version].filter((v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[version] = filtered
    }
    return acc
  }, {} as Record<string, Variant[]>)

  const selectedVariantObj = variants.find((v) => v.name === selectedVariant)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (variantName: string) => {
    onSelect(variantName)
    setIsOpen(false)
    setSearchQuery('')
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-zinc-900 border border-terminal-border rounded text-gray-300 text-sm text-left focus:outline-none focus:border-terminal-accent disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center"
      >
        <span className="truncate">
          {selectedVariantObj ? selectedVariantObj.name : 'Select documentation...'}
        </span>
        <svg className="w-4 h-4 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-terminal-border rounded shadow-xl max-h-96 overflow-hidden">
          <div className="p-2 border-b border-terminal-border sticky top-0 bg-zinc-900">
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-terminal-border rounded text-gray-300 text-sm focus:outline-none focus:border-terminal-accent"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto max-h-80">
            {Object.keys(filteredGroups).length > 0 ? (
              Object.keys(filteredGroups).map((version) => (
                <div key={version}>
                  <div className="px-3 py-2 text-xs font-semibold text-terminal-accent bg-zinc-800/50">
                    {version.toUpperCase()}
                  </div>
                  {filteredGroups[version].map((variant) => (
                    <button
                      key={variant.name}
                      type="button"
                      onClick={() => handleSelect(variant.name)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
                        variant.name === selectedVariant ? 'bg-zinc-800 text-terminal-accent' : 'text-gray-300'
                      }`}
                    >
                      {variant.name} ({variant.size_kb} KB)
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No documentation found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
