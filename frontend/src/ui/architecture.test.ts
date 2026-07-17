import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const uiDirectory = join(process.cwd(), 'src', 'ui')
const bannedImports = ['react-router', 'antd-mobile', '../api', '../flows', '../../api', '../../flows']

describe('Moda UI package boundary', () => {
  it('depends on React and local UI files only', () => {
    const sources = readdirSync(uiDirectory).filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')).map((name) => readFileSync(join(uiDirectory, name), 'utf8')).join('\n')
    for (const dependency of bannedImports) expect(sources).not.toContain(dependency)
  })
})
