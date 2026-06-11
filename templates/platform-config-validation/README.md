# Platform Config Validation Template

This optional workflow validates platform/deploy YAML files against
`@extratoast/deploy-config-schema` by calling the reusable workflow in
`ExtraToast/github-workflows`.

It is not installed by default so a freshly templated repository with no
platform config keeps CI green.

## Enable

Copy the workflow template into the consuming repository:

```bash
mkdir -p .github/workflows
cp templates/platform-config-validation/platform-config-validate.yml.tmpl \
  .github/workflows/platform-config-validate.yml
```

The default template calls:

```yaml
uses: ExtraToast/github-workflows/.github/workflows/platform-config-validate.yml@main
with:
  config-paths: |
    platform/**/*.yml
    platform/**/*.yaml
    deploy/**/*.yml
    deploy/**/*.yaml
  schema-kind: auto
```

`@main` is intentional for the template while the reusable workflow is settling.
Pin it to a release tag when the validator has a stable release.

## What It Validates

- YAML files under `platform/` and `deploy/`.
- Schema kind autodetection via `schema-kind: auto`.
- Conformance with `@extratoast/deploy-config-schema`.

The workflow is guarded by `paths:` filters for the same config globs, so it
only runs on pull requests and pushes that touch platform/deploy config or the
workflow file itself. `workflow_dispatch` is available for manual validation.
