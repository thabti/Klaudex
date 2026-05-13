# Changelog

## [v1.10.1] - 2026-05-13

### Features

- pauseAndRedirect action + TodoWrite tool display + UX polish ([`d7b734f`](https://github.com/thabti/klaudex/commit/d7b734fa70e10459e19e73d17eefd5ec30886869))
- dynamic mid-turn steering injection ([`c2169c6`](https://github.com/thabti/klaudex/commit/c2169c6e56cf6560400f3814fb9d615a78a0f0d4))

### Bug fixes

- improve active item contrast for dark and light modes ([`ed11fd6`](https://github.com/thabti/klaudex/commit/ed11fd615f0121aac600fb56a1a6cb25bb688ff3))
- prevent steering message dropped on dying connection ([`61371bf`](https://github.com/thabti/klaudex/commit/61371bf9999a9ac33a557b41c3c513270a545c09))
- add missing SidebarTask fields to ProjectItem test mock ([`c8fc266`](https://github.com/thabti/klaudex/commit/c8fc266cf5407be6f0b5cb495c156ccbf6e51a1e))

## [v1.10.0] - 2026-05-13

No notable changes.

## [v1.8.1] - 2026-05-13

### Features

- gate debug panel and interceptors behind debugPanelEnabled setting ([`b3df3e8`](https://github.com/thabti/klaudex/commit/b3df3e883649a08e797eb16519bc61896c854e8a))

### Bug fixes

- read global MCP servers from ~/.claude/mcp.json ([`5fcdf6b`](https://github.com/thabti/klaudex/commit/5fcdf6bbc8b71b66908a1751230da07aef5360ba))
- remove inaccurate message-count fallback from ContextRing ([`2732a1e`](https://github.com/thabti/klaudex/commit/2732a1e04fb0458502f6d787d9ea3d5d44c49f70))

## [v1.8.0] - 2026-05-12

### Bug fixes

- add material-icon-theme to package.json ([`6e7d6d4`](https://github.com/thabti/klaudex/commit/6e7d6d455fa46e2c55d0ef1572a7447e67e1a3aa))
- inline material-icon-theme in vitest server deps ([`7079314`](https://github.com/thabti/klaudex/commit/70793144bed5a4779de149e1fb9b50def3c113e8))

## [v1.2.0] - 2026-05-12

### Features

- add 'Open File Tree' to project context menu ([`59de4f5`](https://github.com/thabti/klaudex/commit/59de4f5d77fd83bc10fa04bc57b67e4624d46b46))
- add persistUiState and auto-save UI state every 30s ([`86c063c`](https://github.com/thabti/klaudex/commit/86c063cb9e564eba3ac265e4051c682ab48dd643))
- show login errors and non-standard path hint ([`9988210`](https://github.com/thabti/klaudex/commit/9988210cde99f4b9f3bc5d0d4f85aa45c6cb7a70))
- add connection_lost system message variant ([`c5a2835`](https://github.com/thabti/klaudex/commit/c5a28356749ec52de80728fe59cfd9ce6554efe1))
- add delete button to memory section thread rows ([`9629584`](https://github.com/thabti/klaudex/commit/962958430aec9bd3593782d0778b7b0fcb8aa956))
- add unsaved changes confirmation dialog ([`1038b3a`](https://github.com/thabti/klaudex/commit/1038b3ae830d074f41b5c79362c746e26d6b7088))

### Bug fixes

- add missing required fields to settings-selectors test fixture ([`82c856b`](https://github.com/thabti/klaudex/commit/82c856bbdf0c75bfe744199d902e6c72b5f0ac95))
- preserve existing tool call fields during merge ([`285e96a`](https://github.com/thabti/klaudex/commit/285e96a88ef028f2bac8432ebecd216d2a39a453))
- support full paths in terminal command allowlist ([`0000f9e`](https://github.com/thabti/klaudex/commit/0000f9e1a81a5f41a33c804d2d1ccda9a6da45e7))
- render image preview overlay via portal ([`255bc88`](https://github.com/thabti/klaudex/commit/255bc88f65351b2772582c778bb4fd4aec404fdb))

### Styling

- refine divider grip dots and panel header layout ([`c2642cc`](https://github.com/thabti/klaudex/commit/c2642cc18b092d3420ffe10ca53791a60f5f02ec))
- restyle toolbar as connected button group ([`7f35507`](https://github.com/thabti/klaudex/commit/7f35507993fce96dc7adf488a3bcd789cb8776b8))
- sync kirodex v0.43.0 polish and dark mode fixes ([`235454a`](https://github.com/thabti/klaudex/commit/235454a26ab79758bb5e3de360c67604f696154c))

### Refactoring

- rename 'split view' to 'side-by-side' across UI ([`534c8a8`](https://github.com/thabti/klaudex/commit/534c8a822e534a70a273841161840badf9140cbb))

### Documentation

- add button consistency and light mode theme reviews (#6) ([`1824063`](https://github.com/thabti/klaudex/commit/18240638ce8f9b96f12232239c3f2d3acd062fd9))

### CI

- use repository name for base href (#7) ([`390d709`](https://github.com/thabti/klaudex/commit/390d70974a7119e5c74357be024124df9d595e71))

### Chores

- replace material-icon-theme with seti-file-icons ([`d659333`](https://github.com/thabti/klaudex/commit/d659333afcf981b83cceb6464e73158401199e1a))
- update downloads.json ([`a8a0903`](https://github.com/thabti/klaudex/commit/a8a09030f5da110a9aa4da0196c4e7912ddd095c))

## [v1.1.0] - 2026-05-12

### Features

- add 'Open File Tree' to project context menu ([`fb33c88`](https://github.com/thabti/klaudex/commit/fb33c8879327ea3c4fa692c3f69a41829f735b7e))
- add persistUiState and auto-save UI state every 30s ([`9e0d2e6`](https://github.com/thabti/klaudex/commit/9e0d2e64f7b0b41cd081026105fc215008693878))
- show login errors and non-standard path hint ([`51be652`](https://github.com/thabti/klaudex/commit/51be65241c7972edf494f456866a4dd182caae1f))
- add connection_lost system message variant ([`5fcc282`](https://github.com/thabti/klaudex/commit/5fcc28227e99f5bf2167c1df2095c00ce0f988ab))
- add delete button to memory section thread rows ([`9bdf38c`](https://github.com/thabti/klaudex/commit/9bdf38c5407da09d8f629b92c5bf641b06e38a1a))
- add unsaved changes confirmation dialog ([`1e444dd`](https://github.com/thabti/klaudex/commit/1e444ddb7748e946127a9281798264920fe3fd79))

### Bug fixes

- preserve existing tool call fields during merge ([`8cf289d`](https://github.com/thabti/klaudex/commit/8cf289d7b8c4a9c08f81ecdf1f48d0d26b9a23f4))
- support full paths in terminal command allowlist ([`d943aa1`](https://github.com/thabti/klaudex/commit/d943aa1d07d6ad540943267218a02c6f272666d1))
- render image preview overlay via portal ([`a204146`](https://github.com/thabti/klaudex/commit/a204146f12de807d358a8b87186adeab0baad369))

### Styling

- refine divider grip dots and panel header layout ([`93a6c00`](https://github.com/thabti/klaudex/commit/93a6c0074f6837fc5bec635e7243c741cae54f84))
- restyle toolbar as connected button group ([`a48cbc1`](https://github.com/thabti/klaudex/commit/a48cbc1da299197d79b1be9f5090ec22a74df4b3))
- sync kirodex v0.43.0 polish and dark mode fixes ([`de778f6`](https://github.com/thabti/klaudex/commit/de778f6225a89745b892f081181a3d466981d590))

### Refactoring

- rename 'split view' to 'side-by-side' across UI ([`695844c`](https://github.com/thabti/klaudex/commit/695844cb40ff39f4f5703d6e1974268c189471ba))

### Documentation

- add button consistency and light mode theme reviews (#6) ([`1824063`](https://github.com/thabti/klaudex/commit/18240638ce8f9b96f12232239c3f2d3acd062fd9))

### CI

- use repository name for base href ([`3b36d03`](https://github.com/thabti/klaudex/commit/3b36d03f7e7972080585670040ddbedc028d3949))

### Chores

- replace material-icon-theme with seti-file-icons ([`2ed4e30`](https://github.com/thabti/klaudex/commit/2ed4e30d03f57517db50ec690bb94d57fc1bb443))

## [v1.0.2] - 2026-05-12

### Features

- add KlaudexGhostIcon to ClaudeConfigPanel header

### Bug fixes

- fix clipped unmodified lines separator in diff viewer

### Styling

- restyle nav sidebar with full-height layout
- restyle toolbar as connected button group with dividers
- darken border color to near-invisible (#090909)

### Refactoring

- add memo, useCallback, and tooltips to all settings sections
- make sidebar full height, move header into content column
- remove chevron from ProjectItem
- restyle footer with inline buttons and user menu

### Performance

- wrap SettingRow and SettingsCard in memo

## [v0.2.0] - 2026-04-21

### Features

- add AcpSubagentDisplay, PermissionCard, StatsPanel, UserInputCard ([`7ac041b`](https://github.com/thabti/klaudex/commit/7ac041ba8088cc2b25df8513034fc1c1ce1c7cbf))

### Bug fixes

- address Amazon Q review findings on PR #2 ([`981382d`](https://github.com/thabti/klaudex/commit/981382dfae227ee1f7c5cca670744efb765979b3))

### Refactoring

- update taskStore, settingsStore, diffStore and tests ([`e320513`](https://github.com/thabti/klaudex/commit/e3205133f0c9c89be55b8caf7b73237a948c6ec2))
- update IPC layer, add debug-logger, update utilities ([`b7ee10e`](https://github.com/thabti/klaudex/commit/b7ee10e8ce979ee2ee3e3bc42ad821eb0d252ee3))
- update settings, onboarding, debug, and dashboard components ([`792f28b`](https://github.com/thabti/klaudex/commit/792f28be7c388dfb6a0717a71b1f8fa69c053d5c))
- update existing chat components and hooks for Claude CLI ([`7f03008`](https://github.com/thabti/klaudex/commit/7f030081d95dbf5b4317637bc2ee202a8d0e4595))
- rename Kiro sidebar components to Claude ([`24cf5ab`](https://github.com/thabti/klaudex/commit/24cf5ab6bf27fea37962522d005c3d84cf76fd9d))
- add Claude config store and update types ([`19552a0`](https://github.com/thabti/klaudex/commit/19552a06bbfd41bccc39ac6b055b74aca142f0ae))
- rename kiro_config to claude_config ([`9c59020`](https://github.com/thabti/klaudex/commit/9c590204e0d776c1131b6dc62e5ca42da7d384bf))
- replace ACP SDK with Claude CLI subprocess ([`2fe68da`](https://github.com/thabti/klaudex/commit/2fe68da1685bfaf34bb3f275330eaa9ade58da6e))
- rename Kirodex to Klaudex across codebase ([`06a259b`](https://github.com/thabti/klaudex/commit/06a259b511e7136ea8c786c773d09d8961d94aec))

### Documentation

- update activity log with security fix entry ([`1fbd474`](https://github.com/thabti/klaudex/commit/1fbd47405c2253ad9070a94cb8bb133e2cc258dd))
- update activity log with commit session entry ([`738d121`](https://github.com/thabti/klaudex/commit/738d1212ad819d93999232c3dcafb01f7557f6ed))

### Chores

- update activity log, downloads, agents-lock, and website ([`ce81251`](https://github.com/thabti/klaudex/commit/ce81251305638899f80044dbe6d3fcb342004f65))
- update app icons for Klaudex branding ([`81d69ba`](https://github.com/thabti/klaudex/commit/81d69ba06ca7070ad33f3b5555a9270be3e83412))
- rename Kirodex to Klaudex in config files ([`193aa86`](https://github.com/thabti/klaudex/commit/193aa86d44f3c5491a8eb4caef805d29929a2346))

### Other changes

- update docs ([`dfdd75f`](https://github.com/thabti/klaudex/commit/dfdd75fe487318f627268c1ce479b9e749835746))

## [v0.13.0] - 2026-04-18

### Features

- add local branch delete to branch selector ([`2ea4ced`](https://github.com/thabti/klaudex/commit/2ea4ced34c6656fb10e4ad5219fc5b38114e93d5))
- add emoji icon picker and improve btw overlay ([`d094b49`](https://github.com/thabti/klaudex/commit/d094b494e6894263d00f6808f1a1fa4da2779221))
- render strReplace tool calls as git-style diffs ([`ff4daca`](https://github.com/thabti/klaudex/commit/ff4dacaa6fe8a036e36afd2301205528d864482d))
- add tooltip to worktree icons in sidebar and header ([`3cbe1ed`](https://github.com/thabti/klaudex/commit/3cbe1ed4c22e2f89073f0d389e3fe14708732c4f))

### Bug fixes

- raise paste placeholder threshold to 100 words / 10 lines ([`efcea1c`](https://github.com/thabti/klaudex/commit/efcea1c02138e32ab086aeab14bdaa0f7643413e))
- improve Show more button visibility and increase collapse threshold ([`cdec0c2`](https://github.com/thabti/klaudex/commit/cdec0c26c58d9c4ccb3f3bc14750f8eeb21db164))
- add missing /fork command and fix restoreTask assertion ([`869aeea`](https://github.com/thabti/klaudex/commit/869aeea99055870438cdb5c9b9ef642a93a42b39))
- send images as proper ContentBlock::Image (#14) ([`0a2a5f9`](https://github.com/thabti/klaudex/commit/0a2a5f92e21a05783205c3bef5927cb60c48a6ab))
- ignore Escape key when terminal is focused ([`8934ec3`](https://github.com/thabti/klaudex/commit/8934ec32ad9e8b4e22f9f231b8c5e0d1b7a74e3a))
- show all project image files in file tab ([`4d437c8`](https://github.com/thabti/klaudex/commit/4d437c8cb3fad90915ffd40298cb715df1739863))
- include features.html in website deployment ([`de58e75`](https://github.com/thabti/klaudex/commit/de58e752ae9ffc357ee8eccf8991102fd722d246))
- render markdown links in changelog page ([`944ced6`](https://github.com/thabti/klaudex/commit/944ced6ce88e88b673723ff9c398ea95ae20e388))
- type ipcMock.setAutoApprove with explicit signature ([`98927c8`](https://github.com/thabti/klaudex/commit/98927c83946c595045f132b56859a5cd76aa259f))

### Styling

- improve delete button hover UX ([`f363a0d`](https://github.com/thabti/klaudex/commit/f363a0da6b3873d2c0ceb83ac42dbe2653c54d5c))

### CI

- flatten artifact paths to just .dmg and .exe ([`57f9337`](https://github.com/thabti/klaudex/commit/57f9337b2715f5d243b5fc9bc0d15a145286d172))
- add label-triggered PR build workflow (#16) ([`6d0faac`](https://github.com/thabti/klaudex/commit/6d0faac6d6b2b5f88c4e569d8ce474647b5b7c8a))
- add label-triggered PR build workflow for DMG and EXE ([`54e71a1`](https://github.com/thabti/klaudex/commit/54e71a191e9fa568ca2c671848cc48722c4a4010))

### Chores

- update downloads.json ([`5b05992`](https://github.com/thabti/klaudex/commit/5b05992ddc65f24b281d69c28535e43ac6f736b0))
- update downloads.json ([`72f21a4`](https://github.com/thabti/klaudex/commit/72f21a49ca68f77e23c2d2e38a78ee4539fc669e))

### Other changes

- merge: integrate remote changes with local CI workflow ([`4f94292`](https://github.com/thabti/klaudex/commit/4f9429247cc88d294068d38a9ab39e06ad16b14a))
- activity update ([`8a12288`](https://github.com/thabti/klaudex/commit/8a122885b0ef7becd6388ba63eb00494c1191670))
- erge branch 'main' of github.com:thabti/klaudex ([`78f9e81`](https://github.com/thabti/klaudex/commit/78f9e816cb54945a56ea50361f2afc7b08e818b9))

## [v0.12.0] - 2026-04-18

### Features

- link commit hashes to GitHub in release notes ([`8075333`](https://github.com/thabti/klaudex/commit/807533344773aa9434e2bf80030be656fe89f4ea))
- workspace diff support and commit input ([`abeaeb5`](https://github.com/thabti/klaudex/commit/abeaeb5d7e28299cb577b084b19b2b24a2df8fe4))
- add commit message generation utils with tests ([`dbd3341`](https://github.com/thabti/klaudex/commit/dbd334165e2a35af9b9e3c796dd2dfa82b2b4350))
- stage button icon swap feedback and staged count in toolbar ([`4197010`](https://github.com/thabti/klaudex/commit/4197010e9e7e77a48174bed1b897ac88d95b5fe7))
- add 'created' sort option as default ([`b8f33a3`](https://github.com/thabti/klaudex/commit/b8f33a369c6559408d1707f50bc9fc8dc4c1bfef))
- expand open_in_editor with terminal emulators and cross-platform support ([`852ee96`](https://github.com/thabti/klaudex/commit/852ee963a649137796ccc1083efb1e5baf1d6b5c))
- add useProjectIcon, extend useSlashAction and useChatInput ([`348536d`](https://github.com/thabti/klaudex/commit/348536d0515013470ba0b301ec7e833f0e5e9815))
- replace xterm.js with ghostty-web WASM terminal ([`72faa70`](https://github.com/thabti/klaudex/commit/72faa702858e24abeb61b85a206507b167b835d1))
- add Claude ghost logo and sponsored-by Lastline to hero ([`35b43fd`](https://github.com/thabti/klaudex/commit/35b43fddb19093897b56a8d1337fc9737949fd11))

### Bug fixes

- merge staged and unstaged diffs to avoid double-counting ([`1722664`](https://github.com/thabti/klaudex/commit/17226644222421ee593a9533f0e1a26f994d5610))

### Refactoring

- split taskStore into types, listeners, and core modules ([`4f81d87`](https://github.com/thabti/klaudex/commit/4f81d87434ff4c013484dff8f5eef6526de889b2))
- extract DiffViewer sub-components and utilities ([`896ad0d`](https://github.com/thabti/klaudex/commit/896ad0d3364e3af5ce0a59f139b669b3762f438c))
- extract claude config sub-components and add project icon picker ([`57c3250`](https://github.com/thabti/klaudex/commit/57c3250d2dc3fbfe5e932fa81226bba72d508e6e))
- extract settings sections into individual modules ([`d196e59`](https://github.com/thabti/klaudex/commit/d196e593f9e2227e707a98137781189b0dc94eec))
- extract onboarding step components from monolithic Onboarding.tsx ([`b464d8a`](https://github.com/thabti/klaudex/commit/b464d8ac8148daf6b44ea14c896df9000d0a7f34))
- split AppHeader into breadcrumb, toolbar, and user-menu modules ([`daec3c8`](https://github.com/thabti/klaudex/commit/daec3c894fc3fff5cfa0040d82d543116d1611ec))
- extract chat sub-components from monolithic files ([`1dd5e51`](https://github.com/thabti/klaudex/commit/1dd5e516ac36310c354e051349910b0783a0a21f))
- migrate std::sync::Mutex to parking_lot ([`039183c`](https://github.com/thabti/klaudex/commit/039183cecf9af8d15235a87f2dff2bf300030cb4))
- split monolithic acp.rs into modular subfiles ([`a4973fe`](https://github.com/thabti/klaudex/commit/a4973fe929ed33a79de41726de841e555a8557c7))

### Documentation

- update activity log with session entries ([`216eb40`](https://github.com/thabti/klaudex/commit/216eb401c956037e6a4eef7e5abc19dca5ac7ba1))
- add IPC reference, keyboard shortcuts, slash commands, and security audits ([`58a6fc4`](https://github.com/thabti/klaudex/commit/58a6fc4b1973e3e1e0b8dc9b8182eb25277ec2aa))
- update main screenshot ([`823b82b`](https://github.com/thabti/klaudex/commit/823b82bf895817f28d57d2400cd6720f2b204c7d))

### Chores

- update activity logs, plans, website, and build config ([`c3600d6`](https://github.com/thabti/klaudex/commit/c3600d63d1a50b669f38e38116608cdd6d4fe7ae))

## [v0.11.0] - 2026-04-16

### Features

- add features section and brew install terminal block
- adopt minimal website (#13)

### Bug fixes

- auto-retry on refusal and improved error display
- friendly error messages for model errors and filter agent-switch noise
- friendly error messages for model permission and access errors

### Documentation

- update activity log
- update activity log

### Chores

- update downloads.json

## [v0.10.1] - 2026-04-16

### Features

- add cross-platform support for Windows and Linux

### Styling

- unify system message rows to muted inline style

## [v0.10.0] - 2026-04-16

### Features

- overhaul title bar with native traffic light repositioning

### Bug fixes

- use bg-background instead of bg-card for dark mode consistency

### Styling

- change primary color from indigo to blue-500

## [v0.9.2] - 2026-04-16

### Features

- detect worktree-locked branches and add force checkout
- force checkout option and worktree branch locking
- show confirmation dialog before deleting worktree threads
- worktree-aware workspace sync and pink theme token
- worktree-aware sidebar grouping and input improvements
- worktree-aware components and terminal improvements
- workspace sandbox for ACP and worktree validation
- worktree-aware project identity and per-project config caching
- worktree support in utils, timeline, and history-store
- add projectId field to AgentTask
- support Cmd+Shift+V for raw paste without placeholder

### Bug fixes

- friendly errors, worktree lock UI, force checkout

### Documentation

- update activity log
- log worktree confirmation dialog session in activity.md
- log commit organization session in activity.md
- update activity logs
- add CLAUDE.md for analytics service

### Chores

- add slugify and xterm-addon-web-links
- remove klaudex-rules steering file

## [v0.9.1] - 2026-04-15

### Bug fixes

- remove error fallback, improve update dot, enable devtools (#12)

### Styling

- lighter palette, performance hero, blue icon branding
- bigger fonts, lighter palette, blue production icon

### Documentation

- add performance stats badges
- add 7 engineering learnings from session

## [v0.9.0] - 2026-04-15

### Features

- add threadName and projectName to JsDebugEntry
- add full landing page content, changelog, and deploy workflow
- add thread and project filtering to JS Debug tab
- add landing page with screenshots and Tailwind styling
- add git worktree support with /branch and /worktree commands
- add JS Debug tab with console, error, network, and Rust log capture
- plan-aware context compaction

### Bug fixes

- make local dev work and use blue production icon
- prevent bun test from running vitest files without jsdom
- stamp threadName/projectName on JS debug entries

### Documentation

- update activity log with website and changelog entries

### Tests

- suppress console.warn stderr noise in dismissVersion test

## [v0.8.15] - 2026-04-15

### Features

- add inline rename for project and thread breadcrumbs

## [v0.8.14] - 2026-04-15

### Features

- upgrade to onboarding v2 with privacy toggle
- add Recently Deleted section with soft-delete thread recovery
- combine completion report card with changed files summary
- add provider-specific icons to model picker
- redesign into 3-step flow with platform install commands
- rewrite notification system with queue and debounce
- add Cmd+F message search with highlighting
- add light/dark/system theme support
- add restart prompt dialog and sidebar update indicator

### Bug fixes

- make task_fork async and add parent_task_id to Task

### Styling

- improve light mode contrast and add dark mode color variants
- improve light/dark mode contrast for CSS tokens
- bump base font to 14px, light mode fixes, and UI polish

### Refactoring

- move RecentlyDeleted from sidebar to SettingsPanel

### Documentation

- update activity log with commit review session
- update README features and refresh screenshots

### CI

- add update-downloads workflow

### Tests

- improve frontend test coverage across stores, lib, hooks, and components
- add unit tests for 0.8.13 changes and About dialog

## [v0.8.13] - 2026-04-15

### Features

- wire up fork_session and add collapsible chat input
- forward compaction status notification to frontend
- add X close button to FileMentionPicker
- add X close button to SlashPanels dropdown
- add /usage slash command for token usage panel
- redesign plan mode question cards for better approachability

### Bug fixes

- improve X close button UX in dropdown panels
- resolve message list layout overlap from stale virtualizer measurements
- prevent empty tasks array from skipping completed_task_ids

### Styling

- improve answered questions UI

### Refactoring

- replace virtualizer with plain DOM flow in MessageList

### Documentation

- update activity log
- update activity log
- update activity log

## [v0.8.12] - 2026-04-14

### Features

- add empty thread splash screen with mid-sentence slash and mention support
- add fuzzy search to slash commands and agent/model panels
- extract fuzzy search util and apply to @ mention picker
- enhance agent mention pills with built-in agents and styled icons
- archive threads on /close and show .claude agents in /agent panel
- add archiveTask action to taskStore
- add built-in agent picker to /agent slash panel
- increase check frequency and add sidebar badge
- add plan agent handoff card
- extract question parser, harden edge cases, add plan-mode preprompt
- ChatInput UX improvements — focus ring, send transition, collapsible pills, tests
- add code viewer for read tool calls

### Bug fixes

- resolve unused variable warning and failing settings test
- refresh git branch name on window focus
- remove stale question_format placeholder from full_prompt
- send /agent command on mode switch and make plan mode per-thread
- require all questions answered before submit and default answers expanded
- check rawInput for completed_task_ids in task list aggregation
- last task in task list never shown as completed
- replace oklch and Tailwind color vars with concrete hex values
- remove inner focus ring from ChatInput textarea

### Styling

- improve ChatInput background color and border width
- use #2c2e35 background for chat input and user message bubble
- complete Linear/Codex-inspired colour overhaul and sidebar density upgrade
- color loading text by mode — blue default, teal planning

### Documentation

- update activity log with agent mention pill changes
- update activity log
- update activity log

## [v0.8.11] - 2026-04-14

### Features

- navigate to correct thread on notification click
- ChatInput UX improvements
- auto-generate grouped release notes from commits
- default analyticsEnabled to true
- ghost placeholders when no project is open, swap auth icon

### Bug fixes

- handle refusal stop reason and finalize tool calls on turn end
- prevent message area layout overlap with multiple messages
- harden layout, fix scroll-to-bottom positioning and hover, add word-break