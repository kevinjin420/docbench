import { useState, useRef, useEffect } from 'react'
import type { Model } from '@/utils/types'

interface Props {
  models: Model[]
  selectedModel: string
  onSelect: (modelId: string) => void
  disabled?: boolean
}

export default function ModelSelector({ models, selectedModel, onSelect, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isImageModel = (m: Model) => {
    const id = m.id.toLowerCase()
    const name = m.name.toLowerCase()
    if (id.includes('image') || name.includes('image')) return true
    const outputs = m.architecture?.output_modalities || []
    return outputs.includes('image') && !outputs.includes('text')
  }

  const textModels = models.filter((m) => !isImageModel(m))

  const findModel = (patterns: string[], exclude: string[] = []) =>
    textModels.find((m) =>
      patterns.every((p) => m.id.includes(p)) &&
      exclude.every((e) => !m.id.includes(e))
    )

  const popular = [
    findModel(['claude', 'sonnet']),
    findModel(['claude', 'haiku']),
    findModel(['gemini', 'pro']),
    findModel(['gemini', 'flash']),
    findModel(['openai', 'gpt-5']),
    findModel(['openai', '4o-mini'], ['audio', 'search']),
    findModel(['openai', '4o'], ['mini', 'audio', 'search']),
  ].filter(Boolean) as Model[]

  const otherModels = textModels.filter((m) => !popular.includes(m))

  const filteredPopular = popular.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredOther = otherModels.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedModelObj = models.find((m) => m.id === selectedModel)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (modelId: string) => {
    onSelect(modelId)
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
        <span className="truncate">{selectedModelObj ? selectedModelObj.name : 'Select model...'}</span>
        <svg className="w-4 h-4 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-terminal-border rounded shadow-xl max-h-96 overflow-hidden">
          <div className="p-2 border-b border-terminal-border sticky top-0 bg-zinc-900">
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-terminal-border rounded text-gray-300 text-sm focus:outline-none focus:border-terminal-accent"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto max-h-80">
            {filteredPopular.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-terminal-accent bg-zinc-800/50">
                  POPULAR
                </div>
                {filteredPopular.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleSelect(model.id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
                      model.id === selectedModel ? 'bg-zinc-800 text-terminal-accent' : 'text-gray-300'
                    }`}
                  >
                    {model.name}
                  </button>
                ))}
              </>
            )}

            {filteredOther.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-semibold text-terminal-accent bg-zinc-800/50">
                  ALL MODELS
                </div>
                {filteredOther.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => handleSelect(model.id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
                      model.id === selectedModel ? 'bg-zinc-800 text-terminal-accent' : 'text-gray-300'
                    }`}
                  >
                    {model.name}
                  </button>
                ))}
              </>
            )}

            {filteredPopular.length === 0 && filteredOther.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-gray-500">
                No models found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
