package com.jorisjonkers.personalstack.agents.infrastructure.integration

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.jorisjonkers.personalstack.agents.config.ChatGenerationProperties
import com.jorisjonkers.personalstack.agents.domain.model.WorkspaceId
import com.jorisjonkers.personalstack.agents.domain.port.ChatGenerationPort
import com.jorisjonkers.personalstack.agents.domain.port.WorkspaceRepository
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.util.UUID

/**
 * [ChatGenerationPort] adapter that routes a chat prompt through a headless
 * agent job on the runner Pod.
 *
 * Flow:
 * 1. Resolve the target workspace via [ChatGenerationProperties.runnerPodWorkspaceId].
 * 2. POST `{gatewayEndpoint}/agents/headless` with `kind` + `prompt`; read
 *    back the job `id`.
 * 3. GET `{gatewayEndpoint}/agents/headless/{id}/stream` as text/event-stream;
 *    parse Spring SSE format (event:/data: pairs) and delegate each line to
 *    [parseStreamJsonLine] to extract assistant text chunks.
 *
 * Active only when `chat.generation.backend=runner-pod`.
 */
@Component
@ConditionalOnProperty(
    prefix = "chat.generation",
    name = ["backend"],
    havingValue = "runner-pod",
)
class RunnerPodChatGenerator(
    private val restClient: RestClient,
    private val workspaces: WorkspaceRepository,
    private val props: ChatGenerationProperties,
) : ChatGenerationPort {
    private val log = LoggerFactory.getLogger(RunnerPodChatGenerator::class.java)

    override fun generate(
        prompt: String,
        onChunk: (String) -> Unit,
    ): String {
        val gatewayEndpoint = resolveGatewayEndpoint() ?: return ""
        val jobId = startHeadlessJob(gatewayEndpoint, prompt) ?: return ""
        return streamJobOutput(gatewayEndpoint, jobId, onChunk)
    }

    private fun resolveGatewayEndpoint(): String? {
        val rawId = props.runnerPodWorkspaceId
        if (rawId.isNullOrBlank()) {
            log.warn("chat.generation.runner-pod-workspace-id is not configured — no answer produced")
            return null
        }
        var endpoint: String? = null
        runCatching {
            val workspaceId = WorkspaceId(UUID.fromString(rawId))
            val workspace = workspaces.findById(workspaceId)
            if (workspace == null) {
                log.warn("RunnerPodChatGenerator: workspace {} not found — no answer produced", rawId)
                return@runCatching
            }
            val ep = workspace.gatewayEndpoint
            if (ep.isNullOrBlank()) {
                log.warn(
                    "RunnerPodChatGenerator: workspace {} has no gateway endpoint — no answer produced",
                    rawId,
                )
                return@runCatching
            }
            endpoint = ep
        }.onFailure { ex ->
            log.warn("RunnerPodChatGenerator: failed to resolve workspace {}: {}", rawId, ex.message)
        }
        return endpoint
    }

    private fun startHeadlessJob(
        gatewayEndpoint: String,
        prompt: String,
    ): String? {
        var jobId: String? = null
        runCatching {
            val response =
                restClient
                    .post()
                    .uri("$gatewayEndpoint/agents/headless")
                    .body(
                        mapOf(
                            "kind" to props.runnerPodAgentKind,
                            "prompt" to prompt,
                        ),
                    ).retrieve()
                    .body(Map::class.java)
            @Suppress("UNCHECKED_CAST")
            jobId = (response as? Map<String, Any?>)?.get("id")?.toString()
            if (jobId.isNullOrBlank()) {
                log.warn("RunnerPodChatGenerator: gateway returned no job id")
                jobId = null
            }
        }.onFailure { ex ->
            log.warn("RunnerPodChatGenerator: failed to start headless job: {}", ex.message)
        }
        return jobId
    }

    private fun streamJobOutput(
        gatewayEndpoint: String,
        jobId: String,
        onChunk: (String) -> Unit,
    ): String {
        val answer = StringBuilder()
        var resultOverride: String? = null
        runCatching {
            restClient
                .get()
                .uri("$gatewayEndpoint/agents/headless/$jobId/stream")
                .accept(MediaType.TEXT_EVENT_STREAM)
                .exchange { _, response ->
                    response.body.bufferedReader(Charsets.UTF_8).use { reader ->
                        var currentEvent: String? = null
                        reader.forEachLine { line ->
                            when {
                                line.startsWith(SSE_EVENT_PREFIX) -> {
                                    currentEvent = line.removePrefix(SSE_EVENT_PREFIX).trim()
                                }
                                line.startsWith(SSE_DATA_PREFIX) -> {
                                    val data = line.removePrefix(SSE_DATA_PREFIX)
                                    val event = currentEvent
                                    when (event) {
                                        SSE_EVENT_LINE -> {
                                            val (text, result) = parseStreamJsonLine(data)
                                            text?.let {
                                                answer.append(it)
                                                onChunk(it)
                                            }
                                            result?.let { resultOverride = it }
                                        }
                                        SSE_EVENT_DONE -> {
                                            // done — stop consuming; forEachLine drains the rest but
                                            // the stream will close after the gateway sends this event
                                        }
                                        else -> {
                                            // unknown event type — skip
                                        }
                                    }
                                }
                                line.isBlank() -> {
                                    // blank separator line between SSE events — reset current event name
                                    currentEvent = null
                                }
                                else -> {
                                    // comment or unexpected line format — skip
                                }
                            }
                        }
                    }
                }
        }.onFailure { ex ->
            log.warn("RunnerPodChatGenerator: SSE stream for job {} failed: {}", jobId, ex.message)
        }
        return resultOverride ?: answer.toString()
    }

    private companion object {
        const val SSE_EVENT_PREFIX = "event:"
        const val SSE_DATA_PREFIX = "data:"
        const val SSE_EVENT_LINE = "line"
        const val SSE_EVENT_DONE = "done"
    }
}

/**
 * Parses one NDJSON line from the claude stream-json format.
 *
 * Returns a pair of:
 * - extracted assistant text chunk (non-null when the line is an
 *   `assistant` message event with text content), and
 * - a result override string (non-null when the line is a
 *   `result/success` event).
 *
 * Any malformed or unrecognised line returns `(null, null)`. Never throws.
 */
internal fun parseStreamJsonLine(
    line: String,
    objectMapper: ObjectMapper = jacksonObjectMapper(),
): Pair<String?, String?> {
    if (line.isBlank()) return null to null
    return runCatching {
        val parsed = objectMapper.readTree(line)
        // Tolerate a JSON-string-wrapped object (defensive against any SSE layer
        // that re-encodes the already-JSON line as a quoted string).
        val tree = if (parsed.isTextual) objectMapper.readTree(parsed.asText()) else parsed
        val type = tree.path("type").asText(null) ?: return@runCatching null to null

        when (type) {
            "assistant" -> {
                val contentArray = tree.path("message").path("content")
                if (!contentArray.isArray) return@runCatching null to null
                val text =
                    contentArray
                        .filter { it.path("type").asText(null) == "text" }
                        .mapNotNull { node ->
                            node.path("text").asText(null)?.takeIf { t -> t.isNotEmpty() }
                        }.joinToString("")
                        .takeIf { it.isNotEmpty() }
                text to null
            }
            "result" -> {
                val subtype = tree.path("subtype").asText(null)
                if (subtype == "success") {
                    val result = tree.path("result").asText(null)?.takeIf { it.isNotEmpty() }
                    null to result
                } else {
                    null to null
                }
            }
            else -> null to null
        }
    }.getOrElse { null to null }
}
