package com.jorisjonkers.personalstack.agents.application.workspacerunner.events

data class RunnerReadinessEvent(
    val workspaceId: String,
    val state: String,
    val checkedAt: String,
)

data class RunnerKeepaliveEvent(
    val ts: String,
)
