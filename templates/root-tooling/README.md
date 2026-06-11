# Root Tooling and Docs Presets

Copy these files into a target repository after choosing the relevant package
manager and frontend style.

Recommended order:

1. Copy shared root hygiene files (`editorconfig.tmpl`, `prettierrc.json.tmpl`,
   `gitleaks.toml.tmpl`).
2. Choose one package preset from `package/`.
3. Choose one ESLint preset from `eslint/`.
4. Enable `hooks/husky-pre-commit.tmpl` and `hooks/lintstagedrc.json.tmpl` if
   the repository has Node tooling.
5. Enable `hooks/strict-pre-commit-check.sh.tmpl` only after the repository has
   the referenced Gradle and frontend tasks.
6. Copy the docs/ADR layout that matches the repository shape.

Detekt defaults align with gradle-conventions: `config/detekt/detekt.yml`.
