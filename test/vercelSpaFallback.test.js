import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const vercelConfig = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
)

test('Vercel 优先保留静态资源和 API，再将未知页面交给前端路由', () => {
  assert.deepEqual(vercelConfig.routes, [
    { handle: 'filesystem' },
    { src: '/.*', dest: '/index.html' },
  ])
})
