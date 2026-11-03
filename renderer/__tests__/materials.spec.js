import { describe, it, expect, afterEach } from 'vitest'
import { getComponent, registerMaterials, setConfigure } from '../render'
import { CanvasBox } from '../builtin'

const FakeA = { render: () => null }
const FakeB = { render: () => null }
const FakeC = { render: () => null }

// web-erp: 物料注册优先级规格 —— registerMaterials > 内置 Mapper > configure.tinyVue 兜底
describe('registerMaterials priority', () => {
  afterEach(() => {
    setConfigure({ tinyVue: undefined })
  })

  it('registered materials win over configure.tinyVue fallback', () => {
    registerMaterials({ TinyWinner: FakeA })
    setConfigure({ tinyVue: { TinyWinner: FakeB } })

    expect(getComponent('TinyWinner')).toBe(FakeA)
  })

  it('unregistered componentName falls back to configure.tinyVue', () => {
    setConfigure({ tinyVue: { TinyOnlyVue: FakeC } })

    expect(getComponent('TinyOnlyVue')).toBe(FakeC)
  })

  it('re-registration merges idempotently, later registration wins', () => {
    registerMaterials({ TinyWinner: FakeA })
    expect(getComponent('TinyWinner')).toBe(FakeA)

    registerMaterials({ TinyWinner: FakeB })
    expect(getComponent('TinyWinner')).toBe(FakeB)
  })

  it('no tinyVue injected: unknown componentName resolves null, native html tag branch preserved', () => {
    setConfigure({ tinyVue: undefined })

    expect(getComponent('TinyNeverRegistered')).toBeNull()
    expect(getComponent('span')).toBe('span')
  })

  it('builtin Mapper still wins over tinyVue (canvas builtins not overridable by native)', () => {
    setConfigure({ tinyVue: { div: FakeC } })

    expect(getComponent('div')).toBe(CanvasBox)
  })

  it('canvas layout containers are no longer builtin-mapped; host registers them to use', () => {
    // web-erp: CanvasRow/CanvasCol/CanvasRowColContainer/CanvasFlexBox/CanvasSection 已退出 Mapper，
    // 未注册且无兜底时走普通未注册分支（返回 null），注册后按最高优先级解析
    setConfigure({ tinyVue: undefined })

    expect(getComponent('CanvasFlexBox')).toBeNull()

    registerMaterials({ CanvasFlexBox: FakeA })
    expect(getComponent('CanvasFlexBox')).toBe(FakeA)
  })
})
