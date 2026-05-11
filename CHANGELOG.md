# Changelog

## [v1.0.0] - 2026-05-11

### Features

- add bundle size budget tooling ([`8e5e2a0`](https://github.com/thabti/klaudex/commit/8e5e2a0514c574f899b6357267eee2a5a8aec03a))
- add ClaudeIcon and KlaudexGhostIcon components ([`668a7ad`](https://github.com/thabti/klaudex/commit/668a7adbb082df094271aac7df7b5cdc71f57443))
- remaining performance improvements and new features ([`a619a9f`](https://github.com/thabti/klaudex/commit/a619a9f555eda0557673785fb14c45130df37943))
- performance improvements and new commands ([`405c78c`](https://github.com/thabti/klaudex/commit/405c78c520df866aef0802be8db5958ffd5466d4))
- file tree panel, MCP server management, drag-drop to chat ([`0a728c8`](https://github.com/thabti/klaudex/commit/0a728c853ec7eb7e9470bd0bb88c6b3b90ef9c2e))
- add GLM, Qwen, and MiniMax model provider icons ([`ff6e36e`](https://github.com/thabti/klaudex/commit/ff6e36e890d61ec305f009e95e84d3cb618fabc6))
- persistent sidebar badges until thread visited ([`358e7d6`](https://github.com/thabti/klaudex/commit/358e7d6285c791be790e01ed918f598d1dc3d300))
- wire zoom limit, What's New, and Clone dialogs into App ([`5e7e698`](https://github.com/thabti/klaudex/commit/5e7e698c2f1470777978c2f84d361465f74673d5))
- add cleaning review card component ([`dd08a9b`](https://github.com/thabti/klaudex/commit/dd08a9b82414856c9c664220467c9e9ca5e7e4ab))
- add clone from GitHub dialog and git_clone command ([`fa40e23`](https://github.com/thabti/klaudex/commit/fa40e23cb98d0783782eb6ca02e557302ad22099))
- add blue dot indicator for pending questions ([`4890f8c`](https://github.com/thabti/klaudex/commit/4890f8c26c6d4acfdf1c5b0798f00e136db9436b))
- per-panel state, fix split close, thread ordering, perf audit ([`b901c19`](https://github.com/thabti/klaudex/commit/b901c1976202d8dfda9936226a6d77985a701e8d))
- add slash command mode tracking and estimated token cost ([`4934fae`](https://github.com/thabti/klaudex/commit/4934faef48352bcdc0490b4fa3d0ddd497e139d7))
- add always-visible close button on right split panel ([`733a4eb`](https://github.com/thabti/klaudex/commit/733a4ebc9b94b2f5193ce825cd3fd1f8de903568))
- pin threads, focus isolation, scroll fix, steer dedup ([`62e5494`](https://github.com/thabti/klaudex/commit/62e5494f19bf539339ed9e38968b10e00678975c))
- persistent split views with sidebar entries and Cmd+\ shortcut ([`cdd4c48`](https://github.com/thabti/klaudex/commit/cdd4c48386e2098a20a55984b109c2e8e3828ec4))
- add Cmd+\ split toggle, Cmd+Shift+D debug, Cmd+1-9 thread jump ([`553cce1`](https://github.com/thabti/klaudex/commit/553cce152ad866f340610f9db27cd673fcbc2714))
- add toolbar toggle, thread picker, and context menu split options ([`cc12d5f`](https://github.com/thabti/klaudex/commit/cc12d5fb6653ae291a051240979e7f99a4df751f))
- add split-screen core with store state, ChatPanel refactor, and layout components ([`0c9c598`](https://github.com/thabti/klaudex/commit/0c9c5986d3d23c116638710f81a741d2d0d69db2))
- drag-to-reorder projects and Cmd+N project jumping ([`baf3770`](https://github.com/thabti/klaudex/commit/baf3770e18b422c000957f90c4c6f74dfaabea0b))
- add custom app icon and compact two-column layout ([`f8c4024`](https://github.com/thabti/klaudex/commit/f8c4024262cf6f56841b74c0a4e69f510f8ae8c1))
- add error state with shake animation and retry button ([`a2fc1f5`](https://github.com/thabti/klaudex/commit/a2fc1f5c171e10f98e560dfa0a8c7b274d3804a6))
- replace /btw lightning bolt with message-circle-question icon ([`df7871d`](https://github.com/thabti/klaudex/commit/df7871df915f74d5255425a5779762bd7195ba25))
- replace wrench icon with zap for skills and show "skill: Name" in pills ([`7609c82`](https://github.com/thabti/klaudex/commit/7609c823ffbcab29938f574a0f6294ea369b3e56))
- wire folder drag-drop pills through ChatInput and PillsRow ([`d6e511d`](https://github.com/thabti/klaudex/commit/d6e511d3eb10e953d349b4071d4e27e2f52189b4))
- folder drop support, working row streaming indicator, dev/prod icon split, and CLAUDE.md refresh ([`f6ac6b1`](https://github.com/thabti/klaudex/commit/f6ac6b13f5c5a35965325b14cb13dc9b96784cba))
- crash recovery UI and corrupted store detection ([`f65589c`](https://github.com/thabti/klaudex/commit/f65589cde45e28bc43f2f87a8895d8630fe94595))
- improve project item and task sidebar ([`fd60e9e`](https://github.com/thabti/klaudex/commit/fd60e9ef7a9d1f5f7d93982435af78baeef6c403))
- overhaul settings panel UI/UX ([`10bdbc1`](https://github.com/thabti/klaudex/commit/10bdbc1106647f25990fa3fa2b3a7bf563851eb7))
- add Copy Path to project context menu ([`eb3f27f`](https://github.com/thabti/klaudex/commit/eb3f27f4998d1fba029f027968961b446f3e940b))
- add multi-window support and native File menu commands ([`73d6b48`](https://github.com/thabti/klaudex/commit/73d6b48aaf102fd5993989fb1039fc9c645e8a6b))
- open external links in OS default browser ([`3316cf3`](https://github.com/thabti/klaudex/commit/3316cf33762b96cf320a1133ac7207d3b43ffd50))
- add active project focus indicator ([`fbde5a0`](https://github.com/thabti/klaudex/commit/fbde5a0b2ff35958eefe75968424ede35b3cf42a))
- coverage validation + 5min watcher + clean-worktree contract ([`edd5c14`](https://github.com/thabti/klaudex/commit/edd5c14622a0b38bcc8a9c647026cf9bce2af83c))
- icon overrides, auth fallback, collapsible removal, history backup, subagent display ([`791425f`](https://github.com/thabti/klaudex/commit/791425f8e19cdd9d05d79e667e5b9be67f4c08dd))
- add analytics dashboard with redb backend and recharts ([`246e569`](https://github.com/thabti/klaudex/commit/246e569651bd84d835baa480e57dc8bbd46942d0))
- ralph cherry-pick loop for kirodex → klaudex commit porting ([`0d992ea`](https://github.com/thabti/klaudex/commit/0d992ea4176c687b1aa9e2276220f78fa8d8893d))
- Kirodex → Klaudex migration + Claude Code feature parity (#3) ([`317825c`](https://github.com/thabti/klaudex/commit/317825cdf82269a4e1828b67236ede5551da5f67))

### Bug fixes

- preserve tool call title and kind on update events ([`823b7b6`](https://github.com/thabti/klaudex/commit/823b7b6ba8f06878f663cc0cdbb4b4d590b22b64))
- remove borders and hover backgrounds from resize handle ([`a955f8b`](https://github.com/thabti/klaudex/commit/a955f8b944a249d5e3d17569d181d7cb7c37e16e))
- add focus-visible rings, improve button sizing, and fix text ([`23da6d7`](https://github.com/thabti/klaudex/commit/23da6d782f5ee714eb020d1005b2df427ae7f5cb))
- improve claude_config parsing, fs_ops, and serde_utils ([`81391bb`](https://github.com/thabti/klaudex/commit/81391bb2a68b778b3ec2af71fb01a4075afd02bd))
- update SidebarFooter test for icon-only Debug button ([`faddde1`](https://github.com/thabti/klaudex/commit/faddde159fd70d31d4bc7e1f6a17a137f70ddd5c))
- fix clipped unmodified lines separator ([`38f4099`](https://github.com/thabti/klaudex/commit/38f4099563e139737b8496e3e5805d87ec03e369))
- hide archived banner when message is initiated ([`d53b7bc`](https://github.com/thabti/klaudex/commit/d53b7bc24292b15b95bb19b9d38daad437f854fe))
- improve chat UX and fix git diff output ([`3611eef`](https://github.com/thabti/klaudex/commit/3611eef1911146eeebe4d99b4db3656f70d495a8))
- make commands module public and add generate_for_smoke ([`72b907c`](https://github.com/thabti/klaudex/commit/72b907c1175bb54e30486d148c146988910281dc))
- prevent PTY cwd bypass via unset HOME on Windows ([`2644838`](https://github.com/thabti/klaudex/commit/2644838724b55ac95b1588cb23660554b3f78fd9))
- path traversal, SSRF, AppleScript injection, and NSOpenPanel crash ([`952a001`](https://github.com/thabti/klaudex/commit/952a001dbb736bc2ce959dbc0ba0f41c91ffa817))
- robust JSON parsing for kiro-cli warnings and improve persistence ([`079b9f1`](https://github.com/thabti/klaudex/commit/079b9f10b432da3fd0c9ed1e96054ddcde65a875))
- address code review issues ([`dfa4810`](https://github.com/thabti/klaudex/commit/dfa4810774832affecdd9efb2e0bafa54cf0ae10))
- update mocks for claudeStore, taskStore, and SidebarFooter tests ([`4dbb44c`](https://github.com/thabti/klaudex/commit/4dbb44c8acc882bf59bc29ef1ea03c6cda726b16))
- skip redundant flush on relaunch to prevent hang ([`1b9aae5`](https://github.com/thabti/klaudex/commit/1b9aae5d8c1fd60fd40bffffc5ac2f529c2caf76))
- add missing AgentTask fields to BtwOverlay fixtures ([`65a843b`](https://github.com/thabti/klaudex/commit/65a843bb97506df3b40550b3fa41824d9fb34f02))
- move question cards to bottom of message for visibility ([`2632e21`](https://github.com/thabti/klaudex/commit/2632e210ed9d669f133c753bddd286df658a39b4))
- clear notification badges on focus without switching threads ([`423f8d2`](https://github.com/thabti/klaudex/commit/423f8d20a8d3dca67d2b1ff57a8cbe103749daa4))
- protect icons / screenshots / public from cherry-pick LLM ([`3226328`](https://github.com/thabti/klaudex/commit/32263285c11119b6461d38dcc1e47f369d0107ec))
- fix z-index conflict with settings panel ([`5166d05`](https://github.com/thabti/klaudex/commit/5166d05094c953b4435f60ad5e94783e2d492ac6))
- show permission requests inside btw overlay ([`3624c1a`](https://github.com/thabti/klaudex/commit/3624c1a65a072e5a1dfa6d3b36d42446f5b1ad9c))
- deactivate split on thread click and set 50:50 ratio ([`06634be`](https://github.com/thabti/klaudex/commit/06634be6a39083671be3b329bc7c3e0fa6fce949))
- deduplicate update notification and style Sonner toasts ([`cd0e217`](https://github.com/thabti/klaudex/commit/cd0e217fb7aa03876c0aba2f2adcd3120ee255cc))
- detect fullscreen mode and adjust traffic light padding ([`3b2037f`](https://github.com/thabti/klaudex/commit/3b2037fd866a090f6dfa26b7a9f4a92b83645856))
- fix ToolCallDisplay layout for nested TaskList/Subagent cards ([`01130a6`](https://github.com/thabti/klaudex/commit/01130a6698690d8b1953b4a26f4a5a7c7bfeca2c))
- move working indicator dot above tool calls in timeline ([`db73205`](https://github.com/thabti/klaudex/commit/db7320551ff656f44608e881dda86f2d45cab3c6))
- resize squircle to Apple HIG 824×824 standard ([`ee4ba32`](https://github.com/thabti/klaudex/commit/ee4ba3237887984cbb91c96523ea565c5b4556b5))
- match dev and prod icon sizing and spacing ([`e0aff0d`](https://github.com/thabti/klaudex/commit/e0aff0d4e5dac9965b04301ec680e2971a2c5288))
- reconnect restored threads after soft-delete ([`0c2c51b`](https://github.com/thabti/klaudex/commit/0c2c51b8112c10f9c74e33eeac0200d999515a83))
- improve crash fallback with close button and timer cleanup ([`b1090b8`](https://github.com/thabti/klaudex/commit/b1090b89fe994c92dc6073651e3305539f601919))
- remove overflow-hidden that clipped question card options ([`8ba1b9a`](https://github.com/thabti/klaudex/commit/8ba1b9a2f1961da520f9d122f3ddfd4620e33be1))
- improve skill mention pill text contrast ([`a6fd660`](https://github.com/thabti/klaudex/commit/a6fd660eb0f30ed4912ab68855d13a1f07ba2d65))
- show working indicator during long tool calls ([`be81b3f`](https://github.com/thabti/klaudex/commit/be81b3fef4953499681a673a9bb13db4a916b957))
- remove openssl dynamic linking dependency ([`79847d3`](https://github.com/thabti/klaudex/commit/79847d357ac2864227d847f65d2b15b3215eb60a))
- add missing persistHistory calls, ack-based quit flush, warn on failures ([`e145f51`](https://github.com/thabti/klaudex/commit/e145f51697efc1ffa7dc59ff5e7e6a0a2a16ef08))
- persist history after removeProject/archiveThreads and fix merge mutation ([`7961157`](https://github.com/thabti/klaudex/commit/7961157653e603e78bab70ccbdc1bbfc00208188))
- preserve live tasks when loadTasks is called mid-session ([`71c7f4d`](https://github.com/thabti/klaudex/commit/71c7f4d52c4fccdd86d7c53ba28f2ac33b3b58b5))
- use live task check instead of document.hasFocus for sync guard ([`339bb09`](https://github.com/thabti/klaudex/commit/339bb09977a3b4c3519ec6fce9d07b4f2e965fd6))
- preserve image attachments in steering queue ([`6773ed0`](https://github.com/thabti/klaudex/commit/6773ed0ec77e5fded7dbd8bb08ab0ffdd651962f))
- resolve orphaned UUID project entries on re-add ([`0aa873d`](https://github.com/thabti/klaudex/commit/0aa873d73ebfa66261f566d7a2392ca90f900a57))
- align tests with history persistence changes ([`d09608a`](https://github.com/thabti/klaudex/commit/d09608ad77b4d46fd75d7fbb374c40e4d2be78de))
- fix state not persisting across restarts ([`0f22a98`](https://github.com/thabti/klaudex/commit/0f22a980c57e942db6715b7b85615ed35859a5d9))
- fix "Restart now" button silently failing ([`56c465c`](https://github.com/thabti/klaudex/commit/56c465cf6103c74a4f0ea3513c62e61d8a6bf711))
- use separate store file for dev builds ([`0b0787e`](https://github.com/thabti/klaudex/commit/0b0787e09fa5298693cc5b78bb3e5f9646af791b))
- render completion card for all valid reports, not just file changes ([`ba6fab6`](https://github.com/thabti/klaudex/commit/ba6fab66f3f3cabc68fadefad29f063f312d628e))
- bypass quit confirmation dialog on relaunch ([`15375bd`](https://github.com/thabti/klaudex/commit/15375bd97a4e3beea740e0e28cc03d7a6aa13d96))
- remove redundant file header from diff panel ([`418c761`](https://github.com/thabti/klaudex/commit/418c761a98cb14b0f33d1dc35a93b5bb16207209))
- retain file/agent/skill mentions in draft threads on switch ([`831fb6b`](https://github.com/thabti/klaudex/commit/831fb6b4a08d36cd94d92682f8c1d4af514e8b51))
- persist draft attachments and pasted chunks across thread switches ([`cfb43ea`](https://github.com/thabti/klaudex/commit/cfb43ea82de81f60d7b76241aaec239b4bf31c8f))
- align applyTurnEnd and timeline tests with implementation [skip ci] ([`c5220ba`](https://github.com/thabti/klaudex/commit/c5220bac973fb7f9a901d201eaca52a0cb27f797))
- resolve whitespace gaps, scroll jank, and steering duplication ([`d6a7bea`](https://github.com/thabti/klaudex/commit/d6a7beabee83d4001ee1cdddf39c0d278049c5a8))
- teach validator about Kiro→Claude component renames ([`e1a4d08`](https://github.com/thabti/klaudex/commit/e1a4d0817f292c5702e0cfb2a9cbcca1799e2396))
- restore soft-deleted threads when re-importing project (#18) ([`43b695d`](https://github.com/thabti/klaudex/commit/43b695dc1dea95125492709d0119db1c661062bb))

### Styling

- replace blue accent with brand color across components ([`ed6ceae`](https://github.com/thabti/klaudex/commit/ed6ceae6d6faee54da62b8db379088d54ab467ba))
- update splash screen with brand color glow and font preload ([`e61bcca`](https://github.com/thabti/klaudex/commit/e61bcca00373be08d07809e1d24c4bf9e1f2e3d3))
- overhaul color system with hex values and brand token ([`ad82c42`](https://github.com/thabti/klaudex/commit/ad82c42ecaa86ef3d313fd20acdd30a0ac289c52))
- restyle nav sidebar ([`428f873`](https://github.com/thabti/klaudex/commit/428f8731f9a19ee9711c39f4d189823ef311e3bd))
- restyle toolbar as connected button group ([`398f33e`](https://github.com/thabti/klaudex/commit/398f33e6b45c9ba650a24874c1cea629e3c9c5a2))
- darken border and sidebar colors ([`7e5a710`](https://github.com/thabti/klaudex/commit/7e5a710e4ee9750bf626932736d32f4908a1814c))
- add container queries for compact toolbar and polish spacing ([`4c181a4`](https://github.com/thabti/klaudex/commit/4c181a48fe73ef20a66aa8a6ccd3c440e7b2c6ab))
- improve queue reorder chevron UX ([`a243d05`](https://github.com/thabti/klaudex/commit/a243d0520360038062dcc1cb538fe7ab2e1c9b40))
- consistent kbd styling in header breadcrumb and settings ([`6694b47`](https://github.com/thabti/klaudex/commit/6694b47ce198887b6e0cec2f1f439e281c88bbc2))
- consistent kbd styling across chat components ([`27dd208`](https://github.com/thabti/klaudex/commit/27dd208f888bfe5e37356a77b76ba6afdcd0b6ed))
- add shake animation keyframes ([`15b4113`](https://github.com/thabti/klaudex/commit/15b4113fad4fdadbf02ee419924104965affa609))
- redesign app icons from square to squircle shape ([`2e08686`](https://github.com/thabti/klaudex/commit/2e0868678ac6ffa8626b94fa14de71abb2bcf1c3))

### Refactoring

- move recent_projects into AppSettings and rename commands ([`00f7a4c`](https://github.com/thabti/klaudex/commit/00f7a4cbe8e692833d29397b85e3077a9437b822))
- remove client.rs and simplify connection layer ([`74f95bb`](https://github.com/thabti/klaudex/commit/74f95bb346849c66c66802252be64b407d542ab9))
- add memo, useCallback, and tooltips to all sections ([`30ca0ef`](https://github.com/thabti/klaudex/commit/30ca0ef7d8892e72d389f7f75a23a9a6450d7fc2))
- make sidebar full height, move header into content column ([`f7db55e`](https://github.com/thabti/klaudex/commit/f7db55eff4fd3dff754706baa8baa79de773b6ef))
- remove chevron from ProjectItem ([`c09c999`](https://github.com/thabti/klaudex/commit/c09c9996c0e1d3489af9a06abb9fd5f3810b0e8d))
- restyle footer with inline buttons and user menu ([`b446b10`](https://github.com/thabti/klaudex/commit/b446b1075b0e9bacc6c7b6b8cea3ead59a9e75e5))
- simplify terminal toggle to use selectedTaskId ([`4879dd1`](https://github.com/thabti/klaudex/commit/4879dd1f1016336577a543b01b1b23767012570c))
- replace toast notification with Radix Dialog modal ([`73e6d2c`](https://github.com/thabti/klaudex/commit/73e6d2c2ad08956168ab1cbbd9b216c5e2428881))
- replace drag-to-reorder with Move Up/Down context menu ([`fc838f2`](https://github.com/thabti/klaudex/commit/fc838f2502003a9aba581f5220d176e72e27017e))
- upgrade Kbd component with KbdGroup and tooltip-aware styling ([`51b48c3`](https://github.com/thabti/klaudex/commit/51b48c3a3c90d720125c4c13d2c27b3f01b78a86))
- replace plan toggle button with explicit mode dropdown ([`2979282`](https://github.com/thabti/klaudex/commit/29792820d3b36f1065824c47afa7ae3513171d4b))
- rewrite AutoApproveToggle as dropdown with explicit labels ([`f0a8b05`](https://github.com/thabti/klaudex/commit/f0a8b0581424ff688e3b36b3c59045028cd5273b))
- replace git2 remote callbacks with git CLI for network ops ([`0273baa`](https://github.com/thabti/klaudex/commit/0273baa6e2967a682adaa33dd67f0e6aacd13a89))

### Performance

- use useShallow selectors, stable keys, and narrower store access ([`9f691c1`](https://github.com/thabti/klaudex/commit/9f691c1e52e280a4fc501b8502aa453399761ec7))
- wrap SettingRow and SettingsCard in memo ([`d45a849`](https://github.com/thabti/klaudex/commit/d45a849d18fba1df730e56f8f8c519b0e4ad1950))
- extend backend commands and refactor chat/file tree UI ([`fbe28ec`](https://github.com/thabti/klaudex/commit/fbe28ecd31555c262c7f1bc54150229d1d86f786))
- lazy Shiki, inline tool calls, sticky task list, connection state ([`a45dccc`](https://github.com/thabti/klaudex/commit/a45dccc981986b9f7c313ffd3ed2212fbb4abf02))
- connection health monitor with exponential backoff ([`d4dc1c0`](https://github.com/thabti/klaudex/commit/d4dc1c0edea47b5adb2f2634e7ce1becd6bf1c90))
- normalized selectors, dual-stream sidebar pattern, oxlint ([`01b0a30`](https://github.com/thabti/klaudex/commit/01b0a30075a54d9cc06e3bb7e30b8245872a8d57))
- stable timeline rows, logic/UI separation, structural equality, tool call collapsing ([`04eab39`](https://github.com/thabti/klaudex/commit/04eab39e1b0f05fa3569bcc5a1146182ab437adc))

### Documentation

- update activity log with commit split session ([`ec2bc61`](https://github.com/thabti/klaudex/commit/ec2bc6186d27807546ad287273dae0188b5d9998))
- update README terminal description and fix shortcut/command docs ([`a615dd9`](https://github.com/thabti/klaudex/commit/a615dd982e5fb142eb5b2596c92c408e4814c5dc))

### CI

- update workflows, scripts, and build config ([`efbffd7`](https://github.com/thabti/klaudex/commit/efbffd73d84987a674dc865a16e1779c76ff1e66))

### Tests

- add settings-selectors test and update useSidebarTasks test ([`44b59b5`](https://github.com/thabti/klaudex/commit/44b59b5a1445be7e74c6d03b17ff8494d5266f94))
- remove obsolete analytics and hook test files ([`3944c33`](https://github.com/thabti/klaudex/commit/3944c33ebf1b8f77f56005d11cb9731b55263ea8))
- comprehensive test coverage for performance modules ([`8ba45ab`](https://github.com/thabti/klaudex/commit/8ba45ab36d7e50db1aa3e06ff523aa8c747697e4))
- add BtwOverlay component tests ([`07500b9`](https://github.com/thabti/klaudex/commit/07500b9d6228d67cc52e5ad21b1f64e6cf272d66))
- add reorder and custom sort tests ([`77312d5`](https://github.com/thabti/klaudex/commit/77312d54aa684b08874cfb9b01c60e522850ea9b))
- fix 3 tests to match current deriveTimeline behavior ([`4a2fd4b`](https://github.com/thabti/klaudex/commit/4a2fd4bbeda8c29ad1aa866e22a7ecb323236b81))
- add tests for live task preservation during loadTasks ([`2eecabf`](https://github.com/thabti/klaudex/commit/2eecabf43f50e44c7f7aafed0734bd88523cc517))

### Chores

- merge catch-up branch ([`189a8ed`](https://github.com/thabti/klaudex/commit/189a8ed87ef83d6a1e45e923ecd4b1789dca15c0))
- update CLAUDE.md, activity log, and resize app icons ([`f7b14bb`](https://github.com/thabti/klaudex/commit/f7b14bb6316d8c30fa1ebb2301a0392db76c7efc))
- rename homebrew cask from kirodex to klaudex ([`b99e22f`](https://github.com/thabti/klaudex/commit/b99e22f1b75cff30bb4cd94a2903ca2019365556))
- add tauri dev config and audit script ([`fdd714c`](https://github.com/thabti/klaudex/commit/fdd714c89a7a1231e7fe77733568641201ef3562))
- remove T3 Code/Zed attribution comments from codebase ([`9d75b81`](https://github.com/thabti/klaudex/commit/9d75b81862026e51564e9c7a1cfa9a3a0a661c36))
- remove unused CleaningReviewCard component ([`31d5dae`](https://github.com/thabti/klaudex/commit/31d5daefdacd8759ab6f4af0ac1a054a767213ba))
- regenerate prod icons from k-logo.png ([`ef18646`](https://github.com/thabti/klaudex/commit/ef1864632207e9398743604140cefe93381e6ed8))
- update dev icons with new dev logo ([`f3f1cb7`](https://github.com/thabti/klaudex/commit/f3f1cb7d8dc3dfed6afa5c7ba43531e7c8cb61a4))
- update prod.png with new logo ([`e88c3ea`](https://github.com/thabti/klaudex/commit/e88c3eab71da92cc2dd4ffeb9ed2f41285967a9e))
- regenerate dev and prod icons from new logos ([`91ce445`](https://github.com/thabti/klaudex/commit/91ce4450d5c50373b8e64ae7b233192d5f9e6785))
- reduce release artifacts from 20 to 11 ([`e830c61`](https://github.com/thabti/klaudex/commit/e830c6161639372e1263ec562f1c45d4936c4ff8))
- update downloads.json ([`592fabd`](https://github.com/thabti/klaudex/commit/592fabda0006ac3794d3f8b0681a497eb349d883))
- update downloads.json ([`9fb15cc`](https://github.com/thabti/klaudex/commit/9fb15cc9ee49b19fcebcc59d1b7b36b9056ff291))
- update downloads.json ([`3cb7bd4`](https://github.com/thabti/klaudex/commit/3cb7bd4ec5ee3d75a3826a059b7452d61d0ee52e))
- update downloads.json ([`d4fd456`](https://github.com/thabti/klaudex/commit/d4fd4563665015a23e90bad49aa0adb6d35287ad))
- update downloads.json ([`966c8ca`](https://github.com/thabti/klaudex/commit/966c8caddcad1eb50b7930c03e3648b94bdc207c))
- update downloads.json ([`2f4d2a3`](https://github.com/thabti/klaudex/commit/2f4d2a3cdacee2b5e80129b64c919ed2940080c0))
- update downloads.json ([`ff3113a`](https://github.com/thabti/klaudex/commit/ff3113a15d7d5b96a5e50a05f20320f72b18a1e8))
- update downloads.json ([`3bf453f`](https://github.com/thabti/klaudex/commit/3bf453f97a0a2423ac64b9762fe68a88888474ec))
- update downloads.json ([`ef5e768`](https://github.com/thabti/klaudex/commit/ef5e7685b4e5799bef35d7a0c7173ff5f23aba80))
- update downloads.json ([`07fe404`](https://github.com/thabti/klaudex/commit/07fe40408d9cf147464a475a6acff85897cb87a4))
- update downloads.json ([`5674333`](https://github.com/thabti/klaudex/commit/56743332a17fcd7c37c9d05181c21e5b536f16b0))
- update downloads.json ([`cab86db`](https://github.com/thabti/klaudex/commit/cab86db7fad54120c1f92b156d250c83b0773314))
- update downloads.json ([`d62f143`](https://github.com/thabti/klaudex/commit/d62f1430b5bb206593179f747ea43dde50ee2ed5))
- update downloads.json ([`c92854f`](https://github.com/thabti/klaudex/commit/c92854f69158b3e85ace43d3799d45fe9628be77))
- update downloads.json ([`994868a`](https://github.com/thabti/klaudex/commit/994868a623c8085233f9f3c8e93cc6b46ba51bd4))
- update downloads.json ([`3de115c`](https://github.com/thabti/klaudex/commit/3de115c35e3c1be8419b57311f416a2c3fa49487))
- update downloads.json ([`f41cd4f`](https://github.com/thabti/klaudex/commit/f41cd4f0cbeb8fdcd6fe5e77af074c9d201c5594))
- update downloads.json ([`766be9d`](https://github.com/thabti/klaudex/commit/766be9d611fbb4cb1c2715d7ae968ca1f5372f7b))
- update downloads.json ([`c924a92`](https://github.com/thabti/klaudex/commit/c924a92874c6e2a6a69f9e29b4d951e98eba12d8))
- update downloads.json ([`92a12c0`](https://github.com/thabti/klaudex/commit/92a12c0f391ddc1a9863b4508d88b494dd4aea11))

### Other changes

- Add memory monitoring and lazy-load archived threads (#20) ([`0e6efdb`](https://github.com/thabti/klaudex/commit/0e6efdb9cba9db32000c6ba69b4e065f1780ef08))

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