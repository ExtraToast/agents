package com.jorisjonkers.personalstack.agentgateway.tmux

import tools.jackson.databind.ObjectMapper
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.Path

class ClaudeTranscriptLocator(
    private val projectsDir: Path = defaultClaudeProjectsDir(),
    private val objectMapper: ObjectMapper = ObjectMapper(),
) {
    data class Transcript(
        val path: Path,
        val cwd: String,
    )

    fun transcriptPath(
        cwd: String,
        sessionId: String,
    ): Path =
        projectsDir
            .resolve(encodeProjectPath(cwd))
            .resolve("$sessionId.jsonl")

    fun transcriptExists(
        cwd: String,
        sessionId: String,
    ): Boolean = findTranscript(cwd, sessionId) != null

    fun findTranscript(
        cwd: String,
        sessionId: String,
    ): Transcript? {
        val normalizedCwd = normalizeCwd(cwd)
        val exact = transcriptPath(normalizedCwd, sessionId)
        if (Files.isRegularFile(exact)) {
            return Transcript(exact, transcriptCwd(exact) ?: normalizedCwd)
        }
        if (!Files.isDirectory(projectsDir)) return null
        var match: Transcript? = null
        Files.list(projectsDir).use { projects ->
            val iterator = projects.iterator()
            while (match == null && iterator.hasNext()) {
                val candidate = iterator.next()
                if (!Files.isDirectory(candidate)) continue
                val transcript = candidate.resolve("$sessionId.jsonl")
                if (!Files.isRegularFile(transcript)) continue
                val cwdFromTranscript = transcriptCwd(transcript)?.let(::normalizeCwd) ?: continue
                match = Transcript(transcript, cwdFromTranscript)
            }
        }
        return match
    }

    private fun encodeProjectPath(cwd: String): String =
        normalizeCwd(cwd)
            .replace('/', '-')
            .replace('.', '-')

    private fun normalizeCwd(cwd: String): String =
        Path(cwd)
            .toAbsolutePath()
            .normalize()
            .toString()

    private fun transcriptCwd(path: Path): String? =
        Files
            .newBufferedReader(path)
            .useLines { lines ->
                lines.firstNotNullOfOrNull(::lineCwd)
            }

    private fun lineCwd(line: String): String? =
        runCatching {
            objectMapper
                .readTree(line)
                .get("cwd")
                ?.asText()
                ?.takeIf(String::isNotBlank)
        }.getOrNull()

    companion object {
        fun fromEnvironment(env: Map<String, String> = System.getenv()): ClaudeTranscriptLocator =
            ClaudeTranscriptLocator(defaultClaudeProjectsDir(env))
    }
}

private fun defaultClaudeProjectsDir(env: Map<String, String> = System.getenv()): Path {
    val configDir =
        env["CLAUDE_CONFIG_DIR"]
            ?.takeIf(String::isNotBlank)
            ?.let(::Path)
            ?: Path(env["HOME"]?.takeIf(String::isNotBlank) ?: System.getProperty("user.home")).resolve(".claude")
    return configDir.resolve("projects")
}
