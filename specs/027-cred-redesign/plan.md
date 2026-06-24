**Implementation Order**

1. Land the agents-api credential foundation: tri-state validity, hidden bearer-guarded ingest, Postgres-backed status, route-specific internal bearer, tests.
2. Add workspace ownership persistence and controller header handling.
3. In parallel where possible, implement runner Kubernetes injection, agent-runner boot rewrites, and 026 UI changes.
4. Regenerate browser contracts after backend DTO/controller changes settle.
5. Update agents-ui credential status against generated types.
6. Update personal-stack-2 worker and platform cleanup using the settled ingest contract.
7. Run final validation and secret-safety audit.

**Fixed Contracts**

Internal POST /api/v1/internal/credentials body: userId, provider, payload, updatedBy. Providers are CLAUDE and CODEX at the API boundary. Claude payload requires oauth_token. Codex payload requires auth_json and config_toml. The endpoint returns 204 or a non-secret acknowledgement and is hidden from browser OpenAPI.

Runner injection uses Secret keys claude_oauth_token, codex_auth_json, codex_config_toml; env CLAUDE_CODE_OAUTH_TOKEN; mount /var/run/secrets/agents/credentials; env AGENT_CODEX_AUTH_JSON_FILE and AGENT_CODEX_CONFIG_TOML_FILE.
