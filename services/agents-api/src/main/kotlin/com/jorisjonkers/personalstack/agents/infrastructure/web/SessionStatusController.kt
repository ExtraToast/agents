package com.jorisjonkers.personalstack.agents.infrastructure.web

import com.jorisjonkers.personalstack.agents.application.sessionstatus.SessionStatusBroadcaster
import com.jorisjonkers.personalstack.common.identity.CurrentPrincipal
import com.jorisjonkers.personalstack.common.identity.ForwardAuthPrincipal
import io.swagger.v3.oas.annotations.Hidden
import io.swagger.v3.oas.annotations.Parameter
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter

@Hidden
@RestController
@RequestMapping("/api/v1/sessions")
class SessionStatusController(
    private val broadcaster: SessionStatusBroadcaster,
) {
    @GetMapping("/events", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun events(
        @Parameter(hidden = true) @CurrentPrincipal principal: ForwardAuthPrincipal,
    ): ResponseEntity<SseEmitter> =
        ResponseEntity
            .ok()
            .contentType(MediaType.TEXT_EVENT_STREAM)
            .header("Cache-Control", "no-cache")
            .header("X-Accel-Buffering", "no")
            .body(broadcaster.subscribe(principal.userId.toString()))
}
