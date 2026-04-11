# Kirodex Tauri Activity Log

## 2026-04-12 03:03 GST (Dubai)

### App: Redesign EmptyState to minimal focused layout

Removed skeleton chat messages, ghost ChatInput, and absolute-positioned overlays from EmptyState. Replaced with a clean centered layout: primary icon, heading, subtitle, inline LoginBanner, and a single CTA button. No more fake UI elements.

**Modified:** src/renderer/App.tsx

## 2026-04-12 03:00 GST (Dubai)

### App: Add border radius to chat panel content area

Added `rounded-xl` to the main content container div in App.tsx that wraps ChatPanel, PendingChat, and EmptyState. This gives the chat/message area softer rounded corners for a more polished appearance.

**Modified:** src/renderer/App.tsx

## 2026-04-12 02:58 GST (Dubai)

### SettingsPanel: Slim down section headers and reduce bulk

Replaced bulky SectionHeader (icon box + long descriptions) with lightweight SectionLabel (uppercase text only). Shortened all setting descriptions to one-liners. Merged Connection + Model into a single card. Tightened row padding, button sizes, and input heights. Reduced section spacing from space-y-8 to space-y-6.

**Modified:** src/renderer/components/settings/SettingsPanel.tsx

## 2026-04-12 02:48 GST (Dubai)

### SettingsPanel: Redesign with improved UX and information hierarchy

Rewrote SettingsPanel with better UX flow inspired by Dribbble settings page patterns. Replaced custom Toggle with Radix Switch component, extracted reusable SettingRow/SectionHeader/SettingsCard/Divider components, improved section grouping with wrapping divs and descriptive headers, increased vertical rhythm (space-y-8), and consistent row layout with label+description on left and control on right.

**Modified:** src/renderer/components/settings/SettingsPanel.tsx

## 2026-04-12 02:46 GST (Dubai)

### Sidebar: Sort and time display by most recent message activity

Sort Recent now sorts threads and projects by the timestamp of the most recent message (not creation time). The elapsed time shown on each thread also reflects the last message, not the oldest. Added `lastActivityAt` to `SidebarTask`, derived from the last message's timestamp with a fallback to `createdAt`.

**Modified:** src/renderer/hooks/useSidebarTasks.ts, src/renderer/components/sidebar/ThreadItem.tsx

## 2026-04-12 02:43 GST (Dubai)

### Docs: Sync AGENTS.md with CLAUDE.md

Copied CLAUDE.md to AGENTS.md so both files have identical content. AGENTS.md was missing the project overview, tech stack, structure, conventions, and engineering learnings sections.

**Modified:** AGENTS.md

## 2026-04-12 02:16 (Dubai)

**Task:** Switch Kirodex from native titlebar overlay to custom traffic lights (Option B)

**Changes made:**
- **tauri.conf.json:** Removed `titleBarStyle: "Overlay"`, `hiddenTitle: true`, `macOSPrivateApi: true`
- **Cargo.toml:** Removed `cocoa` dependency and `macos-private-api` feature from tauri
- **lib.rs:** Replaced Sidebar vibrancy + cocoa NSColor hack with simple `HudWindow` vibrancy + 12px corner radius
- **tailwind.css:** Fixed `#root` to `100vh` with `border-radius: 12px`, added macOS traffic light CSS styles
- **Created 7 components** in `unified-title-bar/`: TrafficLights, WindowsControls, TitleBarToolbar, UnifiedTitleBarMacOS/Windows/Linux, index
- **AppHeader.tsx:** Removed `pl-[90px]` hack, wrapped content in `UnifiedTitleBar`
- **cargo check:** Passed cleanly

## 2026-04-12 02:19 (Dubai)

Removed macOS private API usage and custom title bar styling. Switched to standard window decorations with HudWindow vibrancy and 12px corner radius.

Changes made:
- `src-tauri/tauri.conf.json`: Removed `macOSPrivateApi: true`, `titleBarStyle: "Overlay"`, and `hiddenTitle: true` from window config
- `src-tauri/Cargo.toml`: Confirmed `tauri` features already empty (`[]`); removed `cocoa = "0.26.1"` macOS dependency
- `src-tauri/src/lib.rs`: Replaced Sidebar vibrancy + cocoa NSColor background hack with single `HudWindow` vibrancy call (corner radius 12.0)
- `src/tailwind.css`: Changed `#root` from `height: calc(100% - 28px)` to `100vh`/`100vw` with `border-radius: 12px`, `background: var(--background)`, and `border: 0.5px solid var(--border)`
