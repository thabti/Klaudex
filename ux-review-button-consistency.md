# UX Review: Button Consistency & Usability — Klaudex Desktop App

**Date:** 2026-05-11  
**Reviewer:** UX Expert  
**Scope:** All interactive buttons across the Klaudex desktop app (Tauri v2 + React 19 + Tailwind CSS 4)  
**Design System:** CVA-based `<Button>` component with 8 variants × 11 sizes

---

## Executive Summary

The app has a well-designed `Button` component with proper focus states (`focus-visible:ring-2`), disabled states, and hover/active transitions. However, **~60% of buttons bypass this component** using raw `<button>` elements with inline Tailwind. This creates:

1. Inconsistent focus ring behavior (some raw buttons lack `focus-visible` styles entirely)
2. Divergent border-radius values (`rounded-xl` vs the component's `rounded-lg`)
3. Missing `aria-label` attributes on several icon-only buttons
4. Inconsistent copy casing ("New Thread" vs "New thread")

---

## Prioritized Issues

### P0 — Critical (Accessibility Violations)

| # | Location | Issue | Impact |
|---|----------|-------|--------|
| 1 | **PermissionBanner** — all option buttons | No `aria-label` on buttons that may render icon-only when `opt.name` is empty. No `role="group"` or `aria-label` on the container. | Screen reader users cannot identify permission actions. WCAG 4.1.2 violation. |
| 2 | **OnboardingSetupStep** — "Skip sign-in for now" | No visible focus indicator. Raw `<button>` with only `text-muted-foreground` styling — no `focus-visible` ring. | Keyboard-only users cannot see where focus is. WCAG 2.4.7 violation. |
| 3 | **OnboardingSetupStep** — "Launch Klaudex" | No `focus-visible` ring styles. | Same as above — critical because this is the primary onboarding CTA. |
| 4 | **LoginBanner** — "Sign in" button | No `focus-visible` ring. Touch target is `py-1.5` (~30px height) — below 44px minimum for touch and below 32px desktop minimum. | Fails Fitts's Law for touch; fails WCAG 2.5.8 (Target Size). |
| 5 | **GitActionsGroup** — "GitHub" menu item button | No `aria-label`. Opens external link but has no indication (`aria-describedby`, external link icon, or `target` attribute). | Users don't know this navigates away. WCAG 3.2.5. |

### P1 — High (Usability & Consistency)

| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|
| 6 | **EmptyState (App.tsx)** — main CTA | Uses `rounded-xl` while Button component uses `rounded-lg`. No focus ring. | Migrate to `<Button size="lg">` or `<Button size="xl">`. This is the first button new users see — it must be accessible. |
| 7 | **Dashboard** — casing inconsistency | Header: "New Thread" (title case). Empty state: "New thread" (sentence case). Sidebar tooltip: "New thread". | Standardize to **"New thread"** (sentence case) everywhere. Sentence case is more conversational and aligns with Apple HIG / modern desktop conventions. |
| 8 | **CommitDialog** — "Generate" button | Raw `<button>` with `border border-input bg-background` — visually identical to an input field, not a button. Low affordance. | Migrate to `<Button variant="outline" size="xs">`. The sparkle icon helps, but the styling undermines clickability. |
| 9 | **CommitDialog** — "Edit" toggle | `rounded-md px-2 py-0.5` — extremely small hit target (~22px height). | Migrate to `<Button variant="ghost" size="xs">` (h-7 = 28px). Still compact but meets minimum. |
| 10 | **PendingChat** — "Sign in to Claude" | Uses `rounded-xl border border-border bg-card` — looks like a card, not a button. Low affordance per Von Restorff effect (doesn't stand out as actionable). | Migrate to `<Button variant="default" size="lg">` to make the primary auth CTA unmistakable. |
| 11 | **PermissionCard** — Allow/Deny buttons | Custom green/red styling is semantically correct but lacks focus rings. `py-1.5` gives ~30px height. | Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` and increase to `py-2` for 36px minimum height. |

### P2 — Medium (Design System Debt)

| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|
| 12 | **OnboardingSetupStep** — "Launch Klaudex" | Duplicates `bg-primary hover:bg-primary/90` logic already in Button component. Uses `px-8 py-3 rounded-xl` (non-standard sizing). | Migrate to `<Button size="xl" className="rounded-xl px-8">` or add an `onboarding` size variant. |
| 13 | **EmptyState** — button radius | `rounded-xl` used for "hero" CTAs vs `rounded-lg` in the design system. This is intentional for visual warmth but undocumented. | Either: (a) add a `rounded` prop to Button (`"default" | "xl"`), or (b) document that `className="rounded-xl"` is acceptable for hero CTAs. |
| 14 | **CommitDialog** — "Commit on new refName" label | Label says "refName" — this is a code variable name leaked into UI copy. | Change to "Commit on new branch". |
| 15 | **GitActionsGroup** — menu items | All menu items are raw `<button>` with custom styling. These should use a shared `MenuItem` component or the Button `ghost` variant. | Create a `MenuItem` atom or use `<Button variant="ghost" size="xs" className="w-full justify-start">`. |
| 16 | **SearchBar** — nav buttons | `p-0.5` gives ~20px hit target. No `aria-label`. | Add `aria-label="Previous match"` / `"Next match"`. Increase to `p-1` minimum. |

### P3 — Low (Polish & Refinement)

| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|
| 17 | **WhatsNewDialog** — close X button | Has proper `aria-label="Close"` and focus ring ✓. But uses `size-8` while the Button `icon-sm` variant is also `size-8`. | Migrate to `<Button variant="ghost" size="icon-sm" aria-label="Close">` for consistency. No functional issue. |
| 18 | **ChatToolbar** — Send button | `h-8 w-8` is 32px — adequate for desktop but below 44px touch target. | Acceptable for desktop-first app. Document as intentional. If tablet support is planned, increase to `size-10`. |
| 19 | **HeaderToolbar** — all toggle buttons | `size-7` (28px) — below 44px touch but acceptable for dense desktop toolbar. Proper `aria-label` and `aria-pressed` ✓. | No change needed. Well-implemented for context. |
| 20 | **CommitDialog** — footer button order | "Cancel" is leftmost, "Commit" (primary) is rightmost. Correct per platform convention (macOS: destructive left, confirm right). | No change needed. ✓ |

---

## Migration Recommendations

### Should Migrate to `<Button>` Component

| Component | Current | Recommended |
|-----------|---------|-------------|
| EmptyState CTA | Raw `<button>` | `<Button size="xl" className="rounded-xl">` |
| OnboardingSetupStep "Launch" | Raw `<button>` | `<Button size="xl" className="rounded-xl px-8">` |
| OnboardingSetupStep "Skip" | Raw `<button>` | `<Button variant="link" size="sm">` |
| LoginBanner "Sign in" | Raw `<button>` | `<Button variant="secondary" size="sm">` with amber color override |
| PendingChat "Sign in to Claude" | Raw `<button>` | `<Button size="lg">` |
| CommitDialog "Generate" | Raw `<button>` | `<Button variant="outline" size="xs">` |
| CommitDialog "Edit" | Raw `<button>` | `<Button variant="ghost" size="xs">` |
| WhatsNewDialog close X | Raw `<button>` | `<Button variant="ghost" size="icon-sm">` |

### Appropriately Custom (Keep As-Is)

| Component | Reason |
|-----------|--------|
| ChatToolbar Send/Pause | Round shape, conditional color, animation — unique affordance for primary chat action |
| ChatToolbar Attach | Minimal icon button in dense toolbar — appropriate |
| HeaderToolbar toggles | Dense toolbar with `aria-pressed` state — cohesive group styling |
| PermissionCard Allow/Deny | Semantic green/red coloring tied to permission semantics — but add focus rings |
| PermissionBanner options | Dynamic KIND_STYLES mapping — but add aria-labels |
| QuestionCards options | Card-shaped radio alternatives — appropriate |
| PlanHandoffCard | Card-style interactive element — appropriate |
| EmptyThreadSplash commands | List-item styled — appropriate |
| GitActionsGroup menu items | Dropdown menu items — appropriate pattern (but extract shared component) |

---

## Copy Improvements

| Current | Recommended | Rationale |
|---------|-------------|-----------|
| "New Thread" (mixed casing) | "New thread" | Sentence case per Apple HIG, consistent with tooltips |
| "Commit on new refName" | "Commit on new branch" | "refName" is developer jargon leaked into UI |
| "Skip sign-in for now" | "Skip for now" | Shorter, less cognitive load (Hick's Law) |
| "Sign in to Claude" | "Sign in" | The context already explains Claude; redundant |
| "Import Project" | "Open folder" | More accurate — users aren't "importing", they're pointing to a folder. Matches ⌘O hint below. |
| "Got it" | "Got it" ✓ | Good — casual, low-commitment dismissal |

---

## Accessibility Gaps Summary

1. **Missing focus-visible rings** on 5 raw buttons (P0/P1)
2. **Missing aria-labels** on 3 icon-only or ambiguous buttons (P0)
3. **Undersized touch targets** on 3 buttons below 32px height (P1)
4. **No external link indication** on GitHub button (P0)
5. **No role="group"** on PermissionBanner button container (P0)

### Recommended Global Fix

Add a project-wide lint rule (eslint-plugin-jsx-a11y) to catch:
- `<button>` without `aria-label` when no text content
- `<button>` without `focus-visible` classes
- Interactive elements below minimum size

---

## Self-Critique

**Assumptions checked:**
- I assumed desktop-first (Tauri app) — confirmed by 28px toolbar buttons being acceptable
- I assumed macOS primary target — confirmed by `IS_MAC` detection and ⌘ shortcuts

**Bias detection:**
- I may be over-indexing on migration to the Button component. Some raw buttons (like menu items) follow different interaction patterns where the Button component's padding/sizing would be wrong. I've accounted for this in the "Appropriately Custom" section.

**Alternative approaches considered:**
1. Create new Button variants (`permission`, `menu-item`) instead of keeping raw buttons — rejected because it bloats the component API for niche cases
2. Use Radix `DropdownMenu.Item` for GitActionsGroup — would be ideal but is a larger refactor beyond button review scope

**Trade-offs:**
- Migrating to `<Button>` adds bundle weight (CVA class computation) for buttons that render frequently (permission banners during active sessions). Impact is negligible given CVA's efficiency.
- Changing "Import Project" to "Open folder" may confuse users who think of it as "adding a project to Klaudex" — but the ⌘O hint and folder picker UX make "Open" more accurate.

---

## References

- [WCAG 2.2 — 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG 2.2 — 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [Apple HIG — Writing](https://developer.apple.com/design/human-interface-guidelines/writing)
- [Fitts's Law](https://lawsofux.com/fittss-law/)
- [Von Restorff Effect](https://lawsofux.com/von-restorff-effect/)
- [Hick's Law](https://lawsofux.com/hicks-law/)
- [Nielsen Norman Group — Button UX](https://www.nngroup.com/articles/clickable-elements/)
