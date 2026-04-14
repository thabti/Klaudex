/** Fuzzy match scoring: lower = better, null = no match */
export const fuzzyScore = (query: string, target: string): number | null => {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t === q) return 0
  if (t.startsWith(q)) return 1
  const containsIdx = t.indexOf(q)
  if (containsIdx >= 0) return 2 + containsIdx
  let qi = 0
  let firstMatch = -1
  let gaps = 0
  let lastMatch = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (firstMatch === -1) firstMatch = ti
      if (lastMatch >= 0 && ti - lastMatch > 1) gaps += ti - lastMatch - 1
      lastMatch = ti
      qi++
    }
  }
  if (qi < q.length) return null
  const span = lastMatch - firstMatch + 1
  return 100 + firstMatch * 2 + gaps * 3 + span
}
