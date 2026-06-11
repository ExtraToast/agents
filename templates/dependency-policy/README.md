# Dependency Policy Templates

These templates are copied into target repositories during onboarding. Replace
`{{...}}` placeholders with repo-specific values before committing them.

Policy invariants:

- Wait 7 days before proposing newly published versions.
- Group minor and patch version updates.
- Keep major version updates isolated.
- Group security updates separately.
- Optionally group ExtraToast shared artifacts into one coherent platform bump.

`renovate.json.tmpl` is the default ExtraToast policy. `dependabot.yml.tmpl` is
available for repos that use Dependabot directly or as a fallback.
