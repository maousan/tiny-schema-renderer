import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

// web-erp: 产物导入面防回潮钉子（需先 pnpm build 生成 dist，无产物时自动跳过）：
// 渲染器构建产物不得重新引入 @opentiny/vue 全量桶 / @babel/* / 画布容器包（tiny-engine-builtin-component）；
// @opentiny/vue-icon 是 CanvasIcon 的正路运行时 dependencies，必须存在
const distPath = join(dirname(fileURLToPath(import.meta.url)), '../../dist/index.js')

// web-erp: 源码层钉子（恒跑，不依赖 dist）—— renderer/render.js 源码不得出现静态 import 语句
// 引入 @opentiny/vue 全量桶 / @babel/* / 画布容器包（tiny-engine-builtin-component）；
// 先剥离块注释与行注释再断言（web-erp 注释以文档形式提到这些包名，非真实导入）；
// @opentiny/vue-icon 是 CanvasIcon 的正路依赖，断言用带引号全名精确匹配 `from '@opentiny/vue'`，
// 不做后缀通配，避免误伤 `from '@opentiny/vue-icon'`
const sourcePath = join(dirname(fileURLToPath(import.meta.url)), '../render.js')
const code = readFileSync(sourcePath, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('source import face (always runs)', () => {
  it('render.js source (comments stripped) never statically imports @opentiny/vue barrel, @babel/* or tiny-engine-builtin-component', () => {
    expect(code).not.toContain("from '@opentiny/tiny-engine-builtin-component'")
    expect(code).not.toContain('from "@opentiny/tiny-engine-builtin-component"')
    expect(code).not.toContain("from '@babel/")
    expect(code).not.toContain('from "@babel/')
    expect(code).not.toContain("from '@opentiny/vue'")
    expect(code).not.toContain('from "@opentiny/vue"')
  })
})

describe.skipIf(!existsSync(distPath))('dist import face (run pnpm build first)', () => {
  it('never imports @opentiny/vue barrel, @babel/* or tiny-engine-builtin-component; keeps @opentiny/vue-icon', () => {
    const code = readFileSync(distPath, 'utf8')
    const specifiers = [...new Set([...code.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)].map((m) => m[1]))]

    expect(specifiers).not.toContain('@opentiny/vue')
    expect(specifiers.some((s) => s.startsWith('@babel/'))).toBe(false)
    expect(specifiers.some((s) => s.includes('tiny-engine-builtin-component'))).toBe(false)
    expect(specifiers).toContain('@opentiny/vue-icon')
  })
})
