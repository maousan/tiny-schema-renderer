import { describe, it, expect } from 'vitest'
import { parseData } from '../render'

// web-erp: 原 getPlainProps 为无调用死代码已删除；本文件重定向为钉真实 props 路径 parseObjectData 的
// 键名契约 —— 键名一律原样透传（含 on[A-Z] 事件键不做 hyphenate），与宿主物料事件约定的咬合面
describe('parseObjectData props key contract', () => {
  it('on[A-Z] event keys are preserved verbatim, never hyphenated', () => {
    const props = parseData({ onClick: 'submit', 'onUpdate:modelValue': 'visible' }, {}, {})

    expect(props.onClick).toBe('submit')
    expect(props['onUpdate:modelValue']).toBe('visible')
    expect(props['on-click']).toBeUndefined()
    expect(props['on-update:modelValue']).toBeUndefined()
  })

  it('non-event camelCase keys are preserved verbatim, object/array values pass through', () => {
    const props = parseData({ myProp: 'x', someObj: { a: 1 }, list: [1, 2] }, {}, {})

    expect(props.myProp).toBe('x')
    expect(props['my-prop']).toBeUndefined()
    expect(props.someObj).toEqual({ a: 1 })
    expect(props.list).toEqual([1, 2])
  })

  it('function event handlers stay in place under their original key', () => {
    const handler = () => {}
    const props = parseData({ onClick: handler }, {}, {})

    // 函数值经 parseFunction 绑定 ctx 后原位保留，键名不转换
    expect(typeof props.onClick).toBe('function')
    expect(Object.keys(props)).toEqual(['onClick'])
  })

  it('slot option is flattened to its name (existing behavior)', () => {
    expect(parseData({ slot: { name: 'header' } }, {}, {})).toEqual({ slot: 'header' })
    expect(parseData({ slot: 'footer' }, {}, {})).toEqual({ slot: 'footer' })
  })
})
