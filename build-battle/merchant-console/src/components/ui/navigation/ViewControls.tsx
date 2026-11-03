"use client"

import { cx, focusRing } from "@/lib/utils"
import { Minus, Moon, Plus, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

/**
 * Header controls for how the console is read rather than what it shows.
 *
 * The text scale drives the root font size, and the whole layout is in rem,
 * so one control resizes everything together instead of the table drifting
 * away from its header.
 */

const SCALES = [87.5, 100, 112.5, 125] as const
const DEFAULT_SCALE = 1
const STORAGE_KEY = "nwp-text-scale"

const iconButton = cx(
  "inline-flex size-8 items-center justify-center rounded-md",
  "text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900",
  "dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-50",
  "disabled:pointer-events-none disabled:opacity-40",
  focusRing,
)

export function ViewControls() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [scale, setScale] = useState(DEFAULT_SCALE)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY))
      const index = SCALES.indexOf(saved as (typeof SCALES)[number])
      if (index >= 0) setScale(index)
    } catch {
      // blocked storage just means the default scale stands
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const percent = SCALES[scale]
    document.documentElement.style.fontSize =
      percent === 100 ? "" : `${percent}%`
    try {
      localStorage.setItem(STORAGE_KEY, String(percent))
    } catch {
      // nothing to do: the choice simply will not be remembered
    }
  }, [scale, mounted])

  const isDark = resolvedTheme === "dark"

  return (
    <div className="ml-auto flex items-center gap-1">
      <div
        className="flex items-center gap-0.5"
        role="group"
        aria-label="Text size"
      >
        <button
          type="button"
          className={iconButton}
          onClick={() => setScale((s) => Math.max(0, s - 1))}
          disabled={mounted && scale === 0}
          aria-label="Smaller text"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cx(
            "min-w-10 rounded-md px-1 py-1 text-center text-xs tabular-nums",
            "text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900",
            "dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-50",
            focusRing,
          )}
          onClick={() => setScale(DEFAULT_SCALE)}
          aria-label="Reset text size"
          title="Reset text size"
        >
          {mounted ? `${SCALES[scale]}%` : "100%"}
        </button>
        <button
          type="button"
          className={iconButton}
          onClick={() => setScale((s) => Math.min(SCALES.length - 1, s + 1))}
          disabled={mounted && scale === SCALES.length - 1}
          aria-label="Larger text"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-800" />

      <button
        type="button"
        className={iconButton}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}
      >
        {mounted && isDark ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
