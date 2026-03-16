/**
 * Epic color mapping utility.
 *
 * Maps Jira's `ghx-label-N` color values (and known hex colors) to
 * Tailwind CSS classes for epic badges. Falls back to deterministic
 * hash-based coloring for epics without a Jira color value.
 */

// ── Tailwind class sets for each Jira epic color ────────────────────────────

const COLOR_MAP: Record<string, string> = {
  // ghx-label-N names
  'ghx-label-1':  'bg-amber-100 text-amber-800 border-amber-300',
  'ghx-label-2':  'bg-orange-100 text-orange-800 border-orange-300',
  'ghx-label-3':  'bg-yellow-100 text-yellow-800 border-yellow-300',
  'ghx-label-4':  'bg-blue-100 text-blue-800 border-blue-300',
  'ghx-label-5':  'bg-slate-100 text-slate-800 border-slate-300',
  'ghx-label-6':  'bg-lime-100 text-lime-800 border-lime-300',
  'ghx-label-7':  'bg-pink-100 text-pink-800 border-pink-300',
  'ghx-label-8':  'bg-purple-100 text-purple-800 border-purple-300',
  'ghx-label-9':  'bg-indigo-100 text-indigo-800 border-indigo-300',
  'ghx-label-10': 'bg-teal-100 text-teal-800 border-teal-300',
  'ghx-label-11': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'ghx-label-12': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'ghx-label-13': 'bg-rose-100 text-rose-800 border-rose-300',
  'ghx-label-14': 'bg-violet-100 text-violet-800 border-violet-300',

  // Known hex equivalents
  '#815b3a': 'bg-amber-100 text-amber-800 border-amber-300',
  '#f79232': 'bg-orange-100 text-orange-800 border-orange-300',
  '#d39c3f': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  '#3b7fc4': 'bg-blue-100 text-blue-800 border-blue-300',
  '#4a6785': 'bg-slate-100 text-slate-800 border-slate-300',
  '#8eb021': 'bg-lime-100 text-lime-800 border-lime-300',
  '#ac707a': 'bg-pink-100 text-pink-800 border-pink-300',
  '#654982': 'bg-purple-100 text-purple-800 border-purple-300',
  '#0052cc': 'bg-indigo-100 text-indigo-800 border-indigo-300',
}

// ── Fallback hash-based colors (from the old BacklogRow approach) ───────────

const FALLBACK_COLORS = [
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-green-100 text-green-800 border-green-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-pink-100 text-pink-800 border-pink-300',
  'bg-teal-100 text-teal-800 border-teal-300',
] as const

function hashColor(epicKey: string): string {
  let hash = 0
  for (let i = 0; i < epicKey.length; i++) hash = (hash * 31 + epicKey.charCodeAt(i)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

// ── Result type ─────────────────────────────────────────────────────────────

export interface EpicColorResult {
  className: string
  style?: React.CSSProperties
}

/**
 * Convert a Jira epic color string to Tailwind classes (+ optional inline style).
 *
 * @param jiraColor - The raw Jira color value (e.g. "ghx-label-5", "#00875a")
 * @param epicKey   - The epic key, used as fallback seed for hash-based coloring
 * @returns className string and optional style object for unknown hex colors
 */
export function epicColorToTailwind(
  jiraColor: string | null | undefined,
  epicKey = '',
): EpicColorResult {
  if (!jiraColor) {
    return { className: epicKey ? hashColor(epicKey) : FALLBACK_COLORS[0] }
  }

  const normalized = jiraColor.trim().toLowerCase()
  const mapped = COLOR_MAP[normalized]
  if (mapped) {
    return { className: mapped }
  }

  // If it looks like a hex color, generate inline styles
  if (normalized.startsWith('#') && (normalized.length === 4 || normalized.length === 7)) {
    return {
      className: 'border',
      style: {
        backgroundColor: `${normalized}20`, // ~12% opacity bg
        color: normalized,
        borderColor: `${normalized}60`, // ~38% opacity border
      },
    }
  }

  // Unknown value — fall back to hash-based
  return { className: epicKey ? hashColor(epicKey) : FALLBACK_COLORS[0] }
}
