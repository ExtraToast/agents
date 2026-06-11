#!/usr/bin/env bash
# Validate repo-template static assets without network access.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  echo "validate-templates: $*" >&2
  exit 1
}

log() {
  echo "validate-templates: $*"
}

json_files=(
  renovate.json
  templates/dependency-policy/renovate.json.tmpl
  templates/root-tooling/package/pnpm-package.json
  templates/root-tooling/package/yarn-package.json
  templates/root-tooling/hooks/lintstagedrc.json.tmpl
  templates/root-tooling/prettierrc.json.tmpl
)

log "checking JSON syntax"
python3 - "$ROOT" "${json_files[@]}" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
for rel in sys.argv[2:]:
    path = root / rel
    with path.open("r", encoding="utf-8") as fh:
        json.load(fh)
PY

yaml_files=(
  .github/dependabot.yml
  templates/dependency-policy/dependabot.yml.tmpl
  templates/dependency-policy/dependency-review.yml.tmpl
  templates/dependency-policy/scorecard.yml.tmpl
  templates/dependency-policy/codeql.yml.tmpl
  templates/dependency-policy/codeql-config.yml.tmpl
  templates/platform-config-validation/platform-config-validate.yml.tmpl
)

log "checking YAML syntax when a local parser is available"
python3 - "$ROOT" "${yaml_files[@]}" <<'PY'
import importlib.util
import pathlib
import sys

if importlib.util.find_spec("yaml") is None:
    print("validate-templates: PyYAML unavailable; skipped YAML parser check")
    raise SystemExit(0)

import yaml

root = pathlib.Path(sys.argv[1])
for rel in sys.argv[2:]:
    path = root / rel
    with path.open("r", encoding="utf-8") as fh:
        yaml.safe_load(fh)
PY

log "checking dependency policy invariants"
grep -R "default-days: 7" .github/dependabot.yml templates/dependency-policy/dependabot.yml.tmpl >/dev/null \
  || fail "Dependabot policy must include 7-day cooldown"
grep -R "\"minimumReleaseAge\": \"7 days\"" renovate.json templates/dependency-policy/renovate.json.tmpl >/dev/null \
  || fail "Renovate policy must include 7-day minimum release age"
grep -R "update-types: \\[minor, patch\\]" templates/dependency-policy/dependabot.yml.tmpl >/dev/null \
  || fail "Dependabot template must group minor and patch updates"
grep -R "\"matchUpdateTypes\": \\[\"minor\", \"patch\"\\]" renovate.json templates/dependency-policy/renovate.json.tmpl >/dev/null \
  || fail "Renovate policy must group minor and patch updates"
grep -R "security-updates" templates/dependency-policy/dependabot.yml.tmpl .github/dependabot.yml >/dev/null \
  || fail "Dependabot policy must group security updates"
grep -R "vulnerabilityAlerts" templates/dependency-policy/renovate.json.tmpl >/dev/null \
  || fail "Renovate template must enable vulnerability alerts"
grep -R "extratoast shared artifacts" renovate.json templates/dependency-policy/renovate.json.tmpl >/dev/null \
  || fail "Optional ExtraToast shared-artifact grouping missing"

log "checking root tooling invariants"
grep -R "config/detekt/detekt.yml" templates/root-tooling >/dev/null \
  || fail "Detekt default path must align with gradle-conventions"
grep -R "lint-staged" templates/root-tooling/hooks templates/root-tooling/package >/dev/null \
  || fail "lint-staged preset missing"
grep -R "prettier --check" templates/root-tooling/package templates/root-tooling/hooks >/dev/null \
  || fail "format check preset missing"

log "checking platform config validation template"
grep -F "uses: ExtraToast/github-workflows/.github/workflows/platform-config-validate.yml@main" templates/platform-config-validation/platform-config-validate.yml.tmpl >/dev/null \
  || fail "platform config validation template must call the reusable workflow by ref"
grep -F "schema-kind: auto" templates/platform-config-validation/platform-config-validate.yml.tmpl >/dev/null \
  || fail "platform config validation template must default schema-kind to auto"
grep -F "platform/**/*.yaml" templates/platform-config-validation/platform-config-validate.yml.tmpl >/dev/null \
  || fail "platform config validation template must include platform YAML globs"
grep -F "deploy/**/*.yaml" templates/platform-config-validation/platform-config-validate.yml.tmpl >/dev/null \
  || fail "platform config validation template must include deploy YAML globs"

log "checking Docker pattern template structure"
python3 - "$ROOT" <<'PY'
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
required_files = {
    "templates/docker-patterns/jvm/Dockerfile.jvm.tmpl": [
        "FROM ${JVM_BUILD_IMAGE} AS build",
        "FROM ${JVM_RUNTIME_IMAGE} AS runtime",
        "{{jvm_dependency_resolution_command}}",
        "{{jvm_build_command}}",
        "{{runtime_user_create_command}}",
        "COPY --from=build",
        "USER ${APP_UID}:${APP_GID}",
        "HEALTHCHECK",
        "ENTRYPOINT",
        "CMD",
    ],
    "templates/docker-patterns/jvm/Dockerfile.crac-jvm.tmpl": [
        "FROM ${JVM_BUILD_IMAGE} AS build",
        "FROM ${CRAC_RUNTIME_IMAGE} AS crac-base",
        "FROM crac-base AS train",
        "FROM crac-base AS runtime",
        "{{checkpoint_dir}}",
        "CRAC_MODE",
        "VOLUME",
        "HEALTHCHECK",
    ],
    "templates/docker-patterns/vue/Dockerfile.vue-build-runtime.tmpl": [
        "FROM ${NODE_BUILD_IMAGE} AS deps",
        "FROM deps AS build",
        "FROM ${NGINX_RUNTIME_IMAGE} AS runtime",
        "{{package_manager_install_command}}",
        "{{frontend_build_command}}",
        "COPY --from=build",
        "HEALTHCHECK",
    ],
    "templates/docker-patterns/vue/Dockerfile.pnpm-build.tmpl": [
        "FROM ${NODE_BUILD_IMAGE} AS deps",
        "FROM deps AS build",
        "FROM ${NGINX_RUNTIME_IMAGE} AS runtime",
        "{{pnpm_bootstrap_command}}",
        "pnpm install --frozen-lockfile",
        "pnpm {{pnpm_build_filter}} {{frontend_build_script}}",
        "COPY --from=build",
        "HEALTHCHECK",
    ],
    "templates/docker-patterns/vue/Dockerfile.yarn-build.tmpl": [
        "FROM ${NODE_BUILD_IMAGE} AS deps",
        "FROM deps AS build",
        "FROM ${NGINX_RUNTIME_IMAGE} AS runtime",
        "corepack enable",
        "yarn install --immutable",
        "yarn {{frontend_build_script}}",
        "COPY --from=build",
        "HEALTHCHECK",
    ],
    "templates/docker-patterns/nginx/Dockerfile.privileged-nginx.tmpl": [
        "FROM ${NGINX_RUNTIME_IMAGE} AS runtime",
        "COPY {{nginx_config_path}}",
        "COPY {{static_assets_dir}}",
        "EXPOSE {{privileged_listen_port}}",
        "HEALTHCHECK",
        "CMD",
    ],
    "templates/docker-patterns/nginx/Dockerfile.unprivileged-nginx.tmpl": [
        "FROM ${NGINX_RUNTIME_IMAGE} AS runtime",
        "COPY --chown=${NGINX_UID}:${NGINX_GID}",
        "USER ${NGINX_UID}:${NGINX_GID}",
        "EXPOSE {{unprivileged_listen_port}}",
        "HEALTHCHECK",
        "CMD",
    ],
    "templates/docker-patterns/entrypoints/otel-entrypoint.sh.tmpl": [
        "#!/usr/bin/env sh",
        "set -eu",
        "OTEL_RESOURCE_ATTRIBUTES",
        "otel_agent_arg",
        "exec \"$@\"",
    ],
    "templates/docker-patterns/entrypoints/crac-entrypoint.sh.tmpl": [
        "#!/usr/bin/env sh",
        "set -eu",
        "case \"${mode}\" in",
        "train)",
        "restore)",
        "run)",
        "exec java",
    ],
}

for rel, markers in required_files.items():
    path = root / rel
    if not path.exists():
        raise SystemExit(f"missing Docker pattern template: {rel}")
    text = path.read_text(encoding="utf-8")
    if "DESIGN-ONLY SKELETON" in text:
        raise SystemExit(f"Docker pattern template is still design-only: {rel}")
    missing = [marker for marker in markers if marker not in text]
    if missing:
        raise SystemExit(f"{rel} missing structural markers: {', '.join(missing)}")

template_count = len(list((root / "templates/docker-patterns").glob("**/*.tmpl")))
if template_count < len(required_files):
    raise SystemExit("expected all Docker pattern templates to be present")
if (root / "templates/docker-patterns/Dockerfile.tmpl").exists():
    raise SystemExit("single shared Dockerfile template is not allowed")

placeholder_re = re.compile(r"\{\{[a-zA-Z0-9_]+\}\}")
placeholders = set()
for path in (root / "templates/docker-patterns").glob("**/*.tmpl"):
    placeholders.update(placeholder_re.findall(path.read_text(encoding="utf-8")))

docs = [
    root / "templates/docker-patterns/README.md",
    root / "specs/002-round4-docker-pattern-templates/data-model.md",
]
for doc in docs:
    text = doc.read_text(encoding="utf-8")
    missing = sorted(ph for ph in placeholders if ph not in text)
    if missing:
        raise SystemExit(f"{doc.relative_to(root)} missing placeholder docs: {', '.join(missing)}")
PY

log "checking Docker entrypoint shell syntax"
for entrypoint_template in templates/docker-patterns/entrypoints/*.tmpl; do
  sh -n "$entrypoint_template"
done

log "checking for source-specific values in templates"
forbidden_pattern='jorisjonkers|esa-blueshell|blueshell|personal-stack|frankfurt-contabo|enschede|167\.86\.79\.203|130\.89\.174\.190|192\.168\.0\.99|auth-system|assistant-system|knowledge-system|media-system|utility-system|data-system|secret/data/platform|secret/platform|secret/agents|auth-api|assistant-api|knowledge-api|uptime-kuma|stalwart|rabbitmq|valkey|postgres'
if rg -n -i "$forbidden_pattern" templates; then
  fail "source-specific value found in templates"
fi

log "all checks passed"
