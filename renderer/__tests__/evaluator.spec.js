import { describe, it, expect } from 'vitest'
import { parseData } from '../render'

// web-erp: 求值器 context 契约 —— 表达式可见 state/methods/slotScope，this 绑定 ctx
describe('parseExpression context contract', () => {
  // methods 与 RenderMain.setMethods 一致：经 parseFunction 绑定到 ctx，方法内 this.state 可用
  const ctx = {
    state: { count: 1, title: 'erp' },
    methods: {}
  }
  ctx.methods.greet = function greet() {
    return `hi-${this.state.title}`
  }.bind(ctx)

  it('expression reads state via this binding', () => {
    const res = parseData({ type: 'JSExpression', value: 'this.state.count + 1' }, {}, ctx)
    expect(res).toBe(2)
  })

  it('expression calls methods via this binding', () => {
    const res = parseData({ type: 'JSExpression', value: 'this.methods.greet()' }, {}, ctx)
    expect(res).toBe('hi-erp')
  })

  it('expression reads scope entries bare (with semantics)', () => {
    const res = parseData({ type: 'JSExpression', value: 'count + item' }, { count: 10, item: 5 }, ctx)
    expect(res).toBe(15)
  })

  it('slotScope refers to the current scope object', () => {
    const res = parseData({ type: 'JSExpression', value: 'slotScope.item' }, { item: 7 }, ctx)
    expect(res).toBe(7)
  })

  it('JSFunction is bound to ctx (this.state readable)', () => {
    const fn = parseData({ type: 'JSFunction', value: 'function getTitle() { return this.state.title }' }, {}, ctx)
    expect(fn()).toBe('erp')
  })
})
