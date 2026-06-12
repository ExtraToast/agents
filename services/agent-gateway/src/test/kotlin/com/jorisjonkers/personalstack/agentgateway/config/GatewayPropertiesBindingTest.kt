package com.jorisjonkers.personalstack.agentgateway.config

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.context.properties.bind.Binder
import org.springframework.boot.context.properties.source.ConfigurationPropertySources
import org.springframework.core.env.SystemEnvironmentPropertySource

class GatewayPropertiesBindingTest {
    @Test
    fun `runner identity binds from injected pod environment`() {
        val props =
            bindEnvironment(
                mapOf(
                    "AGENT_GATEWAY_WORKSPACE_ROOT" to "/workspace",
                    "AGENT_GATEWAY_TMUX_SOCKET_NAME" to "agent-gw",
                    "AGENT_GATEWAY_TMUX_STATE_DIR" to "/tmp/agent-gateway",
                    "AGENT_GATEWAY_CLI_CLAUDE" to "claude",
                    "AGENT_GATEWAY_CLI_CODEX" to "codex",
                    "AGENT_GATEWAY_GIT_DEPLOY_KEY_DIR" to "/var/run/secrets/agents/github-deploy-key",
                    "AGENT_GATEWAY_RUNNER_SETUP_ID" to "gpu",
                    "AGENT_GATEWAY_RUNNER_SETUP_VERSION" to "7",
                    "AGENT_GATEWAY_RUNNER_SETUP_HASH" to "abc123",
                    "AGENT_GATEWAY_RUNNER_GENERATION" to "42",
                ),
            )

        assertThat(props.runner.setupId).isEqualTo("gpu")
        assertThat(props.runner.setupVersion).isEqualTo(7L)
        assertThat(props.runner.setupHash).isEqualTo("abc123")
        assertThat(props.runner.generation).isEqualTo(42L)
    }

    private fun bindEnvironment(properties: Map<String, Any>): GatewayProperties {
        val source = SystemEnvironmentPropertySource("test-env", properties)
        // from(...) is a platform-typed Iterable with nullable elements; drop the
        // nulls so the Binder(Iterable<ConfigurationPropertySource>) overload resolves.
        val sources = ConfigurationPropertySources.from(source).filterNotNull()
        return Binder(sources)
            .bind("agent-gateway", GatewayProperties::class.java)
            .get()
    }
}
