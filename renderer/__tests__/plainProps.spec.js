import { describe, it, expect } from 'vitest'
import { getPlainProps } from '../render'

// web-erp: 钉住 on[A-Z] 事件 props 不被 hyphenate 的契约（与宿主物料事件约定的咬合面）
describe('getPlainProps on[A-Z] contract', () => {
  it('event props (on[A-Z]) keep their original key, never hyphenated', () => {
    const handler = () => {}
    const props = getPlainProps({ onClick: handler, 'onUpdate:modelValue': handler })

    // 非 primitive 值走现有 .prop 形态传递，但 key 不做 kebab 转换
    expect(props['.onClick']).toBe(handler)
    expect(props['.onUpdate:modelValue']).toBe(handler)
    expect(props['on-click']).toBeUndefined()
  })

  it('primitive event props keep their original key', () => {
    const props = getPlainProps({ onClick: 'handleClick' })

    expect(props.onClick).toBe('handleClick')
    expect(props['on-click']).toBeUndefined()
  })

  it('non-event camelCase keys are hyphenated (existing behavior)', () => {
    const props = getPlainProps({ myProp: 1, someObj: { a: 1 } })

    expect(props['my-prop']).toBe(1)
    expect(props['.some-obj']).toEqual({ a: 1 })
    expect(props.myProp).toBeUndefined()
  })

  it('slot option is flattened to its name (existing behavior)', () => {
    expect(getPlainProps({ slot: { name: 'header' } })).toEqual({ slot: 'header' })
    expect(getPlainProps({ slot: 'footer' })).toEqual({ slot: 'footer' })
  })
})
