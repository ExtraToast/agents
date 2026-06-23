package com.jorisjonkers.personalstack.agents

import com.jorisjonkers.personalstack.common.web.ValidationProblemDetailsAdvice
import org.springframework.boot.autoconfigure.AutoConfigurationExcludeFilter
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.TypeExcludeFilter
import org.springframework.boot.runApplication
import org.springframework.context.annotation.ComponentScan
import org.springframework.context.annotation.FilterType

// The broad `com.jorisjonkers.personalstack` scan deliberately picks up
// commons web advice (e.g. GlobalExceptionHandler). It would also pick up
// `ValidationProblemDetailsAdvice` via its no-arg constructor, which defaults
// the validation status to 400 and — being `@ConditionalOnMissingBean` —
// suppresses the property-driven autoconfig bean. Excluding it here lets
// `WebUtilitiesAutoConfiguration` wire it from `extratoast.web.problem-details.*`
// (validation → 422) instead.
//
// The scan lives on an explicit `@ComponentScan` (not `scanBasePackages`) so the
// exclude is not undone by a second, unfiltered scan declaration. Because a
// hand-rolled `@ComponentScan` drops the two filters `@SpringBootApplication`
// normally contributes, they are re-declared here so test `@TestConfiguration`
// classes and nested `@SpringBootApplication` types stay out of the scan.
@SpringBootApplication
@ComponentScan(
    basePackages = ["com.jorisjonkers.personalstack"],
    excludeFilters = [
        ComponentScan.Filter(type = FilterType.CUSTOM, classes = [TypeExcludeFilter::class]),
        ComponentScan.Filter(type = FilterType.CUSTOM, classes = [AutoConfigurationExcludeFilter::class]),
        ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = [ValidationProblemDetailsAdvice::class]),
    ],
)
class AgentsApiApplication

fun main(args: Array<String>) {
    runApplication<AgentsApiApplication>(*args)
}
