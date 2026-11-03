import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseData, generateFn, setConfigure } from '../render'

// web-erp: 无静默失败规格 —— 坏表达式/JSX/函数解析失败必须有上报出口
describe('no silent failure', () => {
  afterEach(() => {
    setConfigure({ onError: undefined, onWarn: undefined })
    vi.restoreAllMocks()
  })

  it('bad expression reports onError with expression source, message and scope keys, returns undefined', () => {
    const onError = vi.fn()
    setConfigure({ onError })

    const res = parseData({ type: 'JSExpression', value: 'state.missing.deep' }, { loopItem: 1 }, { state: {} })

    expect(res).toBeUndefined()
    expect(onError).toHaveBeenCalledTimes(1)
    const [error, context] = onError.mock.calls[0]
    expect(context.expression).toBe('state.missing.deep')
    expect(typeof context.message).toBe('string')
    expect(context.message.length).toBeGreaterThan(0)
    expect(context.scopeKeys).toEqual(['loopItem'])
    expect(context.jsx).toBe(false)
    expect(error).toBeDefined()
  })

  it('console.error is the fallback when onError is not configured (still not silent)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = parseData({ type: 'JSExpression', value: 'notDefinedVariable' }, {}, {})

    expect(res).toBeUndefined()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('JSX expression is not transformed: reports unsupported JSX via onError and returns undefined', () => {
    const onError = vi.fn()
    setConfigure({ onError })

    const res = parseData({ type: 'JSExpression', value: '(<div>hello</div>)' }, {}, {})

    expect(res).toBeUndefined()
    const [, context] = onError.mock.calls[0]
    expect(context.jsx).toBe(true)
    expect(context.message).toContain('不支持 JSX')
    expect(context.expression).toBe('(<div>hello</div>)')
  })

  it('JSX JSFunction is not transformed: reports unsupported JSX and returns undefined', () => {
    const onError = vi.fn()
    setConfigure({ onError })

    const fn = parseData({ type: 'JSFunction', value: 'function renderCell() { return <span>cell</span> }' }, {}, {})

    expect(fn).toBeUndefined()
    const [, context] = onError.mock.calls[0]
    expect(context.jsx).toBe(true)
    expect(context.message).toContain('不支持 JSX')
  })

  it('non-JSX JSFunction syntax error reports the parser message', () => {
    const onError = vi.fn()
    setConfigure({ onError })

    const fn = parseData({ type: 'JSFunction', value: 'function broken( { return 1 }' }, {}, {})

    expect(fn).toBeUndefined()
    const [, context] = onError.mock.calls[0]
    expect(context.jsx).toBe(false)
    expect(context.message.length).toBeGreaterThan(0)
  })
})

// web-erp: generateFn 原 Notify 改 configure.onWarn；表格空行兜底保留
describe('generateFn uses onWarn and keeps table fallback', () => {
  afterEach(() => {
    setConfigure({ onError: undefined, onWarn: undefined })
    vi.restoreAllMocks()
  })

  it('sync throw reports onWarn and returns null', () => {
    const onWarn = vi.fn()
    setConfigure({ onWarn })

    const boom = function boomFn() {
      throw new Error('sync-kaboom')
    }
    const wrapped = generateFn(boom, {})

    expect(wrapped()).toBeNull()
    const [error, context] = onWarn.mock.calls[0]
    expect(context.title).toContain('boomFn')
    expect(context.message).toBe('sync-kaboom')
    expect(error).toBeInstanceOf(Error)
  })

  it('rejected promise reports onWarn and resolves with one empty table row', async () => {
    const onWarn = vi.fn()
    setConfigure({ onWarn })

    const failing = function loadTable() {
      return Promise.reject(new Error('async-kaboom'))
    }
    const wrapped = generateFn(failing, {})

    await expect(wrapped()).resolves.toEqual({ result: [{}], page: { total: 1 } })
    expect(onWarn).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ message: 'async-kaboom' }))
  })

  it('console.warn is the fallback when onWarn is not configured', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const boom = function boomFn() {
      throw new Error('kaboom')
    }
    generateFn(boom, {})()

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
