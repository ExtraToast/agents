import { describe, expect, it } from 'vitest'

// Load feature + lib sources as raw strings via Vite so the guard needs no
// Node filesystem types at typecheck time.
const featureSources = import.meta.glob<string>('../features/**/*.{ts,vue}', { query: '?raw', import: 'default', eager: true })
const libSources = import.meta.glob<string>('../lib/**/*.{ts,vue}', { query: '?raw', import: 'default', eager: true })
const sources: Record<string, string> = { ...featureSources, ...libSources }

const excluded = [
  '../lib/runtimeOrigins.ts',
]

const forbidden = [
  { name: 'feature-owned api base', pattern: /['"`]\/api\/v1/ },
  { name: 'client user id header', pattern: /X-User-Id/ },
  { name: 'window location backend discovery', pattern: /window\.location\.(?:host|hostname|protocol)/ },
]

describe('native networking static guard', () => {
  it('keeps backend URL and credential discovery centralized', () => {
    const violations: string[] = []
    for (const [path, source] of Object.entries(sources)) {
      if (path.includes('/__tests__/')) continue
      if (excluded.includes(path)) continue
      for (const rule of forbidden) {
        if (rule.pattern.test(source)) violations.push(`${path}: ${rule.name}`)
      }
    }

    expect(violations).toEqual([])
  })
})
