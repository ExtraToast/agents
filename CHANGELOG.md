# Changelog

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
