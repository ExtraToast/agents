# Changelog

## [0.14.7](https://github.com/ExtraToast/agents/compare/v0.14.6...v0.14.7) (2026-06-27)


### Bug Fixes

* **agents-ui:** single status chip — Running (green) wins, else Connected (orange) ([#126](https://github.com/ExtraToast/agents/issues/126)) ([12eb591](https://github.com/ExtraToast/agents/commit/12eb591924863d66566fbb33eaa6cff7af98255a))

## [0.14.6](https://github.com/ExtraToast/agents/compare/v0.14.5...v0.14.6) (2026-06-27)


### Bug Fixes

* **agent-gateway:** fall back to a fresh session when a Claude transcript is gone on revival ([#124](https://github.com/ExtraToast/agents/issues/124)) ([68dcf0a](https://github.com/ExtraToast/agents/commit/68dcf0a2fe22f92b4ca3d1775ae53f16c03d827e))
* **agents-ui:** declutter the workspace status rail ([#123](https://github.com/ExtraToast/agents/issues/123)) ([602a698](https://github.com/ExtraToast/agents/commit/602a698ec864513c62ff15494a57d7bba20ebb3f))

## [0.14.5](https://github.com/ExtraToast/agents/compare/v0.14.4...v0.14.5) (2026-06-26)


### Bug Fixes

* **agents:** inject full Claude subscription credential into runners ([#121](https://github.com/ExtraToast/agents/issues/121)) ([fb0287c](https://github.com/ExtraToast/agents/commit/fb0287c2d2b43bc13bee26ba1f0b57f228b9bf2a))

## [0.14.4](https://github.com/ExtraToast/agents/compare/v0.14.3...v0.14.4) (2026-06-26)


### Bug Fixes

* **agents-api:** derive credential updatedBy from the owner, not the request body ([#119](https://github.com/ExtraToast/agents/issues/119)) ([206e3cd](https://github.com/ExtraToast/agents/commit/206e3cd8403e534f71b7b5d612ee3972d4a65f7a))

## [0.14.3](https://github.com/ExtraToast/agents/compare/v0.14.2...v0.14.3) (2026-06-26)


### Bug Fixes

* **agents-ui:** real OpenAI Codex mark, sign-in on the title line, neutral cancel hover ([#117](https://github.com/ExtraToast/agents/issues/117)) ([31a7d0d](https://github.com/ExtraToast/agents/commit/31a7d0d920d7ef5ae5e60548ea7686437580a9e9))

## [0.14.2](https://github.com/ExtraToast/agents/compare/v0.14.1...v0.14.2) (2026-06-26)


### Bug Fixes

* **agents-ui:** declutter the credentials cards and fix the Codex icon ([#115](https://github.com/ExtraToast/agents/issues/115)) ([152d8b3](https://github.com/ExtraToast/agents/commit/152d8b35eeb218a54470653ec24cdf3059ee9322))

## [0.14.1](https://github.com/ExtraToast/agents/compare/v0.14.0...v0.14.1) (2026-06-25)


### Bug Fixes

* **agents-ui:** credentials page submit-once, status refresh, icons, styling ([#112](https://github.com/ExtraToast/agents/issues/112)) ([2382396](https://github.com/ExtraToast/agents/commit/2382396785ceb5ad13c598cda70507db45028676))
* **agents-ui:** polish credentials sign-in (padding, buttons, spinner, OpenAI icon) ([#114](https://github.com/ExtraToast/agents/issues/114)) ([3422fb9](https://github.com/ExtraToast/agents/commit/3422fb9f454fe20e003a88942689c0f819bb9399))

## [0.14.0](https://github.com/ExtraToast/agents/compare/v0.13.2...v0.14.0) (2026-06-24)


### Features

* **agents:** GitHub App-only repository access (spec 025) ([#103](https://github.com/ExtraToast/agents/issues/103)) ([7e3a0ac](https://github.com/ExtraToast/agents/commit/7e3a0ac901fb13426022d99d149d38e5a69a1625))

## [0.13.2](https://github.com/ExtraToast/agents/compare/v0.13.1...v0.13.2) (2026-06-24)


### Bug Fixes

* **agents:** resume the session on attach when a reprovisioned runner is still booting ([#101](https://github.com/ExtraToast/agents/issues/101)) ([aa34939](https://github.com/ExtraToast/agents/commit/aa349394f8e85bf6e96d6ab6bbdf7ed6a4b09f4d))

## [0.13.1](https://github.com/ExtraToast/agents/compare/v0.13.0...v0.13.1) (2026-06-24)


### Bug Fixes

* **agents:** wait for the old runner pod to terminate before reprovision ([#99](https://github.com/ExtraToast/agents/issues/99)) ([a6ca5b3](https://github.com/ExtraToast/agents/commit/a6ca5b35fff9a310d4a87c5604deba80588d7047))

## [0.13.0](https://github.com/ExtraToast/agents/compare/v0.12.0...v0.13.0) (2026-06-24)


### Features

* **agents:** report runner image by release version, not digest ([#97](https://github.com/ExtraToast/agents/issues/97)) ([3742ff9](https://github.com/ExtraToast/agents/commit/3742ff9707b890e49594053a268755490c87a04b))

## [0.12.0](https://github.com/ExtraToast/agents/compare/v0.11.0...v0.12.0) (2026-06-24)


### Features

* **agents:** continue a workspace onto an updated agent-runner image (spec 024) ([#95](https://github.com/ExtraToast/agents/issues/95)) ([d712805](https://github.com/ExtraToast/agents/commit/d71280599acfe2593e92c44c82d446dc0d9e71db))

## [0.11.0](https://github.com/ExtraToast/agents/compare/v0.10.0...v0.11.0) (2026-06-23)


### Features

* **agent-runner:** inject CLAUDE_CODE_OAUTH_TOKEN from the portal-managed Secret ([#92](https://github.com/ExtraToast/agents/issues/92)) ([d3d4b55](https://github.com/ExtraToast/agents/commit/d3d4b5549f09f4ab6ab1d8e0281a816811675a69))

## [0.10.0](https://github.com/ExtraToast/agents/compare/v0.9.2...v0.10.0) (2026-06-23)


### Features

* **credentials:** redesign sign-in cards, add a stored-credential check, surface success ([#90](https://github.com/ExtraToast/agents/issues/90)) ([947a454](https://github.com/ExtraToast/agents/commit/947a4548dc6623adb474db3096606bc4b660b78e))

## [0.9.2](https://github.com/ExtraToast/agents/compare/v0.9.1...v0.9.2) (2026-06-23)


### Bug Fixes

* **agents-api:** relay credential-worker errors as problem+json ([#88](https://github.com/ExtraToast/agents/issues/88)) ([99cfe63](https://github.com/ExtraToast/agents/commit/99cfe6311371340615db8e08af4b9423969c274a))

## [0.9.1](https://github.com/ExtraToast/agents/compare/v0.9.0...v0.9.1) (2026-06-22)


### Bug Fixes

* **agents-ui:** label the credential paste-back as the authorization code ([#86](https://github.com/ExtraToast/agents/issues/86)) ([39a81d4](https://github.com/ExtraToast/agents/commit/39a81d49320e3f881cc30845b0b12d881205fcbd))

## [0.9.0](https://github.com/ExtraToast/agents/compare/v0.8.1...v0.9.0) (2026-06-22)


### Features

* **agents-ui:** remove the admin users-management page ([#84](https://github.com/ExtraToast/agents/issues/84)) ([dcccf19](https://github.com/ExtraToast/agents/commit/dcccf19b4d6bd1b94e06a5b36df9ecd562080c14))
* **agents:** add the Credentials page for CLI re-authentication ([#83](https://github.com/ExtraToast/agents/issues/83)) ([e323b33](https://github.com/ExtraToast/agents/commit/e323b331004617fa0911437219f36b70115d7e4b))


### Bug Fixes

* **app:** allow in-WebView navigation to jorisjonkers.dev subdomains ([#80](https://github.com/ExtraToast/agents/issues/80)) ([2a338ec](https://github.com/ExtraToast/agents/commit/2a338ec6698310b48068c107a0c9211a2a7cd9d2))
* **app:** opt out of Android forced edge-to-edge so the status bar doesn't overlap ([#82](https://github.com/ExtraToast/agents/issues/82)) ([bb97988](https://github.com/ExtraToast/agents/commit/bb9798853af6bac4cd6b5918ce9edb044a4bed41))

## [0.8.1](https://github.com/ExtraToast/agents/compare/v0.8.0...v0.8.1) (2026-06-19)


### Bug Fixes

* **agents-ui:** delegate sign-in to auth-ui (fixes cross-origin 400) + move logout into rail bottom ([#76](https://github.com/ExtraToast/agents/issues/76)) ([e048599](https://github.com/ExtraToast/agents/commit/e04859965de326e90418e352373670b01646fff1))
* **sessions:** resume the prior Claude & Codex conversation on revival ([#78](https://github.com/ExtraToast/agents/issues/78)) ([3aab4a3](https://github.com/ExtraToast/agents/commit/3aab4a379758eee9a728d93989078320e90abfcd))

## [0.8.0](https://github.com/ExtraToast/agents/compare/v0.7.1...v0.8.0) (2026-06-18)


### Features

* **015:** decouple RAG retrieval/capture seam ([#62](https://github.com/ExtraToast/agents/issues/62)) ([bd83103](https://github.com/ExtraToast/agents/commit/bd8310370156e4c2dee0a510e377745bd6e49ffe))
* **023:** decouple chat generation behind a port + multi-turn history ([#63](https://github.com/ExtraToast/agents/issues/63)) ([4b9b0de](https://github.com/ExtraToast/agents/commit/4b9b0de3391b6888ff852f83bd4fa74377fe90d3))
* **024a:** stream headless job output incrementally over SSE ([#65](https://github.com/ExtraToast/agents/issues/65)) ([e17155a](https://github.com/ExtraToast/agents/commit/e17155a8d5e8e2cdc75ee7ce5df2402fdb09ecc8))
* **024b:** runner-Pod chat generation backend (flag-gated, default off) ([#67](https://github.com/ExtraToast/agents/issues/67)) ([65416ad](https://github.com/ExtraToast/agents/commit/65416ad4f59804e7d6552d76aea8aca506c23761))
* **024c:** true token-level streaming for runner-Pod chat ([#68](https://github.com/ExtraToast/agents/issues/68)) ([295365f](https://github.com/ExtraToast/agents/commit/295365f1a7ed0321a23eaef569b55d164df73bdc))
* **native-app:** admin user-management feature ([#70](https://github.com/ExtraToast/agents/issues/70)) ([50d7660](https://github.com/ExtraToast/agents/commit/50d76608c3d87905f3e2200acbf043a363ed5c63))
* **native-app:** auth-api client + account self-service feature ([#69](https://github.com/ExtraToast/agents/issues/69)) ([e700ec1](https://github.com/ExtraToast/agents/commit/e700ec1c3d15247f7babf03b7cb6e9519aea6459))
* **native-app:** Capacitor scaffold for agents-ui (spec 016) ([#53](https://github.com/ExtraToast/agents/issues/53)) ([46cb3b7](https://github.com/ExtraToast/agents/commit/46cb3b7796d87dc8d25ed3b0c933fa2c22c2bac7))
* **native-app:** env-driven runtime origins + credentials policy (spec 018) ([#61](https://github.com/ExtraToast/agents/issues/61)) ([6f78172](https://github.com/ExtraToast/agents/commit/6f78172977c22d6819b02f3bbf53f6ca8405b38f))
* **native-app:** in-app login/TOTP + shell nav + guard to in-app login ([#72](https://github.com/ExtraToast/agents/issues/72)) ([8567fad](https://github.com/ExtraToast/agents/commit/8567fadf59495a71d025ae66e0cbd235230d9565))
* **native-app:** native auth-session core — PKCE + secure token bridge (spec 021, gated) ([#66](https://github.com/ExtraToast/agents/issues/66)) ([90ddcc3](https://github.com/ExtraToast/agents/commit/90ddcc365399c1c0de8111bda497eb005d79ff47))
* **native-app:** native build/release pipeline + mobile polish (spec 020) ([#73](https://github.com/ExtraToast/agents/issues/73)) ([ca5410b](https://github.com/ExtraToast/agents/commit/ca5410b0e31f2b18c8020cbcf4543a43d5acfd0e))
* **native-app:** route-shell foundation (spec 022) ([#64](https://github.com/ExtraToast/agents/issues/64)) ([8a25188](https://github.com/ExtraToast/agents/commit/8a251883a0073b35aa836ad9bc1d7b4db0c8c255))
* **native-app:** signup + account recovery (register/confirm/forgot/reset) ([#71](https://github.com/ExtraToast/agents/issues/71)) ([f42c4e9](https://github.com/ExtraToast/agents/commit/f42c4e9138ad53980f552c1ddc7c4339e2afc56a))

## [0.7.1](https://github.com/ExtraToast/agents/compare/v0.7.0...v0.7.1) (2026-06-18)


### Bug Fixes

* **agents-api:** eliminate 409 session-generation-conflict on new-session create ([#59](https://github.com/ExtraToast/agents/issues/59)) ([7237e5d](https://github.com/ExtraToast/agents/commit/7237e5d7432e5768780f6f081f33efed2a1b7378))
* **agents-ui:** re-fit terminal when console layout changes ([#50](https://github.com/ExtraToast/agents/issues/50)) ([9898436](https://github.com/ExtraToast/agents/commit/9898436d8491b6e7b51a5f33830129989b0b0b83))

## [0.7.0](https://github.com/ExtraToast/agents/compare/v0.6.0...v0.7.0) (2026-06-16)


### Features

* only recycle a stale runner once its agent has gone idle ([#47](https://github.com/ExtraToast/agents/issues/47)) ([704cebd](https://github.com/ExtraToast/agents/commit/704cebd6e6aafff3828cbcb5e476e94d62511bc0))

## [0.6.0](https://github.com/ExtraToast/agents/compare/v0.5.1...v0.6.0) (2026-06-16)


### Features

* **agents-api:** auto-recycle disconnected runners onto new releases ([#45](https://github.com/ExtraToast/agents/issues/45)) ([2003f69](https://github.com/ExtraToast/agents/commit/2003f694ffc460235a67cbbd2995a3c3a8d6dd29))

## [0.5.1](https://github.com/ExtraToast/agents/compare/v0.5.0...v0.5.1) (2026-06-16)


### Bug Fixes

* **agents-ui:** stop reselecting session tab name on every keystroke ([#41](https://github.com/ExtraToast/agents/issues/41)) ([016990b](https://github.com/ExtraToast/agents/commit/016990bbb7b9926109c3da2ef65e463fed9c5e4d))


### Performance Improvements

* **gateway:** bound cold-attach transcript replay to a recent tail ([#44](https://github.com/ExtraToast/agents/issues/44)) ([152c33f](https://github.com/ExtraToast/agents/commit/152c33f865fe5f2eff13eec72c22ac6ba302a61a))
* **terminal:** cut scrollback to 2000 and debounce resize relay ([#42](https://github.com/ExtraToast/agents/issues/42)) ([1f311c6](https://github.com/ExtraToast/agents/commit/1f311c64a3653585181edb10040b599c41bdfee1))

## [0.5.0](https://github.com/ExtraToast/agents/compare/v0.4.0...v0.5.0) (2026-06-16)


### Features

* **012:** attach active tab to terminal, declutter console chrome ([#32](https://github.com/ExtraToast/agents/issues/32)) ([96c8c49](https://github.com/ExtraToast/agents/commit/96c8c49b4868dfc0dc624d6a761286a70838a12f))
* **012:** folder-style session tabs with live dot on the kind icon ([#35](https://github.com/ExtraToast/agents/issues/35)) ([80fc3a3](https://github.com/ExtraToast/agents/commit/80fc3a366f976dde4f4c273d1080d1b050dbd67a))
* **012:** minimal underline tabs flush to a borderless terminal ([#34](https://github.com/ExtraToast/agents/issues/34)) ([605d34e](https://github.com/ExtraToast/agents/commit/605d34ea04a358b0d26d03dcb1d62e7dc07edc42))


### Bug Fixes

* **agents-api:** don't 502 session launch when nodes:list is denied ([#36](https://github.com/ExtraToast/agents/issues/36)) ([4f33fb4](https://github.com/ExtraToast/agents/commit/4f33fb4a1e12c1e9a66b163a961e8fc703d04299))
* **agents-api:** pin runner node-selector to personal-stack/* labels ([#37](https://github.com/ExtraToast/agents/issues/37)) ([119ed4c](https://github.com/ExtraToast/agents/commit/119ed4c2a845b0857a2ac47ca22adab9983d5e21))
* **agents-api:** reap stale runner-setup leases so a crash mid-provision can't wedge a workspace ([#38](https://github.com/ExtraToast/agents/issues/38)) ([c58e7e7](https://github.com/ExtraToast/agents/commit/c58e7e7a68ceaf4776d16e29969fa1db8f2f22d7))


### Performance Improvements

* **agents-ui:** render the terminal with the WebGL addon ([#39](https://github.com/ExtraToast/agents/issues/39)) ([323f0b3](https://github.com/ExtraToast/agents/commit/323f0b3b124a3b47d0eeac6d87456cb84d9164b9))
* **terminal:** coalesce output writes and ship fewer, larger frames ([#40](https://github.com/ExtraToast/agents/issues/40)) ([033edcc](https://github.com/ExtraToast/agents/commit/033edcc3bd11664236da82cd5839280f0373efed))

## [0.4.0](https://github.com/ExtraToast/agents/compare/v0.3.0...v0.4.0) (2026-06-13)


### Features

* **012:** bigger header title with repo beneath; tab kind icons + claude-N names ([#31](https://github.com/ExtraToast/agents/issues/31)) ([9b01350](https://github.com/ExtraToast/agents/commit/9b013504325483dc0d11fa91f518b43ad212c02e))
* **012:** session delete, controls rail with edge arrow, mobile fullscreen ([#29](https://github.com/ExtraToast/agents/issues/29)) ([3831724](https://github.com/ExtraToast/agents/commit/38317243b0d654545066bb150aa30f04d50c358e))

## [0.3.0](https://github.com/ExtraToast/agents/compare/v0.2.2...v0.3.0) (2026-06-13)


### Features

* **002:** durable sessions — restart with full history ([#17](https://github.com/ExtraToast/agents/issues/17)) ([b7219db](https://github.com/ExtraToast/agents/commit/b7219db6c5ee973d0e4c6c82120a24f7525591eb))
* **003:** agent console redesign + live session-status SSE ([#18](https://github.com/ExtraToast/agents/issues/18)) ([6b3230e](https://github.com/ExtraToast/agents/commit/6b3230eea5dcd38bf078d33ae94f8ff3fe4068eb))
* **008:** emitted telemetry contract for agents observability ([#20](https://github.com/ExtraToast/agents/issues/20)) ([0f85e03](https://github.com/ExtraToast/agents/commit/0f85e03936e6c1f1ed68d28f3bbc5a5af5eb4f71))
* **010:** versioned agent setup management with restart-into-setup ([#19](https://github.com/ExtraToast/agents/issues/19)) ([abf47ee](https://github.com/ExtraToast/agents/commit/abf47ee074ac80ea0d489f572950749eab8a25d7))
* **012:** declutter the workspace console ([#27](https://github.com/ExtraToast/agents/issues/27)) ([0e7e9a2](https://github.com/ExtraToast/agents/commit/0e7e9a2153f6acc86cea66b55575c8828d5c74fc))
* **012:** full-screen mobile terminal with keyboard-aware focus ([#21](https://github.com/ExtraToast/agents/issues/21)) ([48cae94](https://github.com/ExtraToast/agents/commit/48cae9480ca3bb57d4c68d26540d4f9000d10b4c))
* **012:** jump-to-latest control for the terminal ([#23](https://github.com/ExtraToast/agents/issues/23)) ([72ec4c2](https://github.com/ExtraToast/agents/commit/72ec4c2c5bf8a7bcc10123239becc298254fcdc3))
* **012:** mobile terminal compose bar + larger touch font ([#22](https://github.com/ExtraToast/agents/issues/22)) ([74898d6](https://github.com/ExtraToast/agents/commit/74898d6969c739b2d37b8159ee60a7b90d146054))
* **012:** remove compose bar, fix terminal input desync, declutter tabs, mobile scroll ([#28](https://github.com/ExtraToast/agents/issues/28)) ([2bce2b5](https://github.com/ExtraToast/agents/commit/2bce2b57c28f7559f76011abfe15b22954942d7f))
* **012:** tighten workspace header on mobile for more terminal space ([#24](https://github.com/ExtraToast/agents/issues/24)) ([ba4c6b6](https://github.com/ExtraToast/agents/commit/ba4c6b690babdd3e50f283d40036eedd0d5d2a7d))


### Bug Fixes

* **012:** make mobile console layout robust CSS-only ([#25](https://github.com/ExtraToast/agents/issues/25)) ([3570d6b](https://github.com/ExtraToast/agents/commit/3570d6b8400963cb48aa59a986c2f21c0857e26b))
* author release-please PRs with a GitHub App token ([#13](https://github.com/ExtraToast/agents/issues/13)) ([5a66e52](https://github.com/ExtraToast/agents/commit/5a66e520e40d4f0627009b9ca975f82ac482adf9))

## [0.2.2](https://github.com/ExtraToast/agents/compare/v0.2.1...v0.2.2) (2026-06-12)


### Bug Fixes

* build agents-ui multi-arch (amd64+arm64) ([#11](https://github.com/ExtraToast/agents/issues/11)) ([08b8a39](https://github.com/ExtraToast/agents/commit/08b8a39ef7a6fcf68c6008fa4f7d28d2bba8588c))

## [0.2.1](https://github.com/ExtraToast/agents/compare/v0.2.0...v0.2.1) (2026-06-11)


### Bug Fixes

* publish :latest alongside the version tag ([#9](https://github.com/ExtraToast/agents/issues/9)) ([8eedbd2](https://github.com/ExtraToast/agents/commit/8eedbd229267ad135d5e1aeb6416b6967851ea54))

## [0.2.0](https://github.com/ExtraToast/agents/compare/v0.1.0...v0.2.0) (2026-06-11)


### Features

* extract + rename the agent stack into ExtraToast/agents (spec 001) ([#2](https://github.com/ExtraToast/agents/issues/2)) ([7d2fc2a](https://github.com/ExtraToast/agents/commit/7d2fc2a03f0e2f675835084ac112cecb0593f2d9))

## 1.0.0 (2026-06-09)


### Features

* complete docker/entrypoint pattern templates + validation (round 4) ([#6](https://github.com/ExtraToast/repo-template/issues/6)) ([0243ac8](https://github.com/ExtraToast/repo-template/commit/0243ac8bd27ba44ff505855d867297d766bbcfcf))
* dependency policy + dev-tooling/docs presets + docker pattern skeletons (round 3) ([#5](https://github.com/ExtraToast/repo-template/issues/5)) ([1da52dd](https://github.com/ExtraToast/repo-template/commit/1da52ddccc522993217a7a3c7bdf3a6be35fc39f))
