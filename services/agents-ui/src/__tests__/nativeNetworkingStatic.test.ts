import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../', import.meta.url))

const roots = [
  join(sourceRoot, 'features'),
  join(sourceRoot, 'lib'),
]

const excluded = new Set([
  'lib/runtimeOrigins.ts',
])

const forbidden = [
  { name: 'feature-owned api base', pattern: /['"`]\/api\/v1/ },
  { name: 'client user id header', pattern: /X-User-Id/ },
  { name: 'window location backend discovery', pattern: /window\.location\.(host|hostname|protocol)/ },
]

function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (entry !== '__tests__') found.push(...filesUnder(path))
    } else if (/\.(ts|vue)$/.test(entry)) {
      found.push(path)
    }
  }
  return found
}

describe('native networking static guard', () => {
  it('keeps backend URL and credential discovery centralized', () => {
    const violations: string[] = []
    for (const file of roots.flatMap(filesUnder)) {
      const rel = relative(sourceRoot, file)
      if (excluded.has(rel)) continue

      const source = readFileSync(file, 'utf8')
      for (const rule of forbidden) {
        if (rule.pattern.test(source)) violations.push(`${rel}: ${rule.name}`)
      }
    }

    expect(violations).toEqual([])
  })
})
