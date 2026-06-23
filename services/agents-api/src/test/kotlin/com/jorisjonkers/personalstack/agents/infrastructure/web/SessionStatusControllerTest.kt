package com.jorisjonkers.personalstack.agents.infrastructure.web

import com.jorisjonkers.personalstack.agents.application.sessionstatus.SessionStatusBroadcaster
import com.jorisjonkers.personalstack.common.identity.CredentialSource
import com.jorisjonkers.personalstack.common.identity.CurrentPrincipalArgumentResolver
import com.jorisjonkers.personalstack.common.identity.ForwardAuthPrincipal
import com.jorisjonkers.personalstack.common.web.GlobalExceptionHandler
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.request
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.UUID

class SessionStatusControllerTest {
    private val broadcaster = mockk<SessionStatusBroadcaster>()
    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc =
            MockMvcBuilders
                .standaloneSetup(SessionStatusController(broadcaster))
                .setCustomArgumentResolvers(CurrentPrincipalArgumentResolver())
                .setControllerAdvice(GlobalExceptionHandler())
                .build()
    }

    private fun principal(userId: UUID): ForwardAuthPrincipal =
        ForwardAuthPrincipal(
            userId = userId,
            roles = emptySet(),
            username = null,
            credentialSource = CredentialSource.EDGE_ASSERTION,
        )

    @Test
    fun `GET events returns SSE response headers`() {
        val userId = UUID.fromString("00000000-0000-0000-0000-000000000001")
        every { broadcaster.subscribe(userId.toString()) } returns SseEmitter()

        mockMvc
            .perform(
                get("/api/v1/sessions/events")
                    .requestAttr(ForwardAuthPrincipal::class.java.name, principal(userId)),
            ).andExpect(status().isOk)
            .andExpect(request().asyncStarted())
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
            .andExpect(header().string("X-Accel-Buffering", "no"))
            .andExpect(header().string("Cache-Control", "no-cache"))

        verify { broadcaster.subscribe(userId.toString()) }
    }
}
