"use client"

import { useMemo, useRef, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Institute } from "@/lib/types"

interface InstituteComboboxProps {
  institutes: Institute[]
  value: string
  onChange: (id: string) => void
  onBlur?: () => void
  isLoading?: boolean
  disabled?: boolean
  hasError?: boolean
}

export function InstituteCombobox({
  institutes,
  value,
  onChange,
  onBlur,
  isLoading = false,
  disabled = false,
  hasError = false,
}: InstituteComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selected = useMemo(
    () => institutes.find((inst) => inst.id === value) ?? null,
    [institutes, value]
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return institutes
    return institutes.filter((inst) =>
      [inst.name, inst.shortCode ?? ""].join(" ").toLowerCase().includes(normalized)
    )
  }, [institutes, query])

  function handleSelect(id: string) {
    onChange(id)
    setQuery("")
    setOpen(false)
    onBlur?.()
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setQuery("")
      // Focus search input after popover opens
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    } else {
      onBlur?.()
    }
  }

  const isDisabled = disabled || isLoading

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isDisabled}
          aria-invalid={hasError}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`brand-input flex w-full items-center justify-between text-left ${
            hasError ? "border-rose-500/50 ring-rose-500/20" : ""
          } ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <span
            className={selected ? "text-[#f0f0f0]" : "text-[#666666]"}
          >
            {isLoading
              ? "Loading institutes..."
              : selected
                ? selected.name
                : "Select an institute"}
          </span>
          <svg
            className={`ml-2 h-4 w-4 shrink-0 text-[#666666] transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] border-white/[0.10] bg-[#1a1a1a] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
      >
        {/* Search input */}
        <div className="relative mb-2">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search institutes..."
            className="brand-input w-full py-2 pl-9 pr-3 text-sm"
          />
        </div>

        {/* List */}
        <div role="listbox" className="max-h-60 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[#666666]">
              No institutes match
            </div>
          ) : (
            filtered.map((inst) => {
              const isSelected = inst.id === value
              return (
                <button
                  key={inst.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(inst.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/10 ${
                    isSelected ? "bg-white/[0.06]" : ""
                  }`}
                >
                  <span className="text-white">{inst.name}</span>
                  {inst.shortCode ? (
                    <span className="brand-chip shrink-0 px-2 py-0.5 text-[10px]">
                      {inst.shortCode}
                    </span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
