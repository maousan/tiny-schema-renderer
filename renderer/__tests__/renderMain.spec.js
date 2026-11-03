import { describe, it, expect, afterEach, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import RenderMain from '../RenderMain'
import { registerMaterials, setConfigure } from '../render'

// web-erp: 渲染级测试 —— RenderMain 挂载最小 schema（div + 文本 + 注册物料 + JSExpression prop）
// 注册物料用 render 函数定义，避免依赖 vue 运行时模板编译器；
// schema 取 pageSchema.children 一级（pageContext 在该层可达 —— 渲染器固有语义：ctx 透传至
// renderGroup 一层，更深层经 renderSlot -> renderComponent 的 parent 是父 schema 而非 pageContext）
const FakeButton = {
  name: 'FakeButton',
  props: {
    type: { type: String, default: '' }
  },
  render() {
    return h('button', { class: 'fake-button', 'data-type': this.type }, this.$slots.default?.())
  }
}

registerMaterials({ FakeButton })

const buildSchema = () => ({
  componentName: 'Page',
  children: [
    { componentName: 'div', props: { className: 'render-root' }, children: ['box-text'] },
    { componentName: 'span', children: ['hello-text'] },
    {
      componentName: 'FakeButton',
      props: { type: { type: 'JSExpression', value: 'this.state.size' } },
      children: ['submit']
    }
  ],
  state: { size: 'large' },
  methods: {},
  css: ''
})

const mountAndFlush = async () => {
  const wrapper = mount(RenderMain, { props: { schema: buildSchema() } })
  await flushPromises()
  await nextTick()
  await nextTick()
  return wrapper
}

describe('RenderMain minimal schema render', () => {
  it('renders builtin box and plain text children', async () => {
    const wrapper = await mountAndFlush()

    expect(wrapper.find('.render-root').exists()).toBe(true)
    expect(wrapper.find('.render-root').text()).toBe('box-text')
    expect(wrapper.find('span').text()).toBe('hello-text')
    wrapper.unmount()
  })

  it('renders registered material with JSExpression prop bound to page state', async () => {
    const wrapper = await mountAndFlush()

    const btn = wrapper.find('.fake-button')
    expect(btn.exists()).toBe(true)
    // JSExpression prop 经 pageContext 求值：this.state.size -> 'large'
    expect(btn.attributes('data-type')).toBe('large')
    expect(btn.text()).toBe('submit')
    wrapper.unmount()
  })
})

// web-erp: 深层 ctx 语义钉子 —— 上游语义，方言约束见 ADR-0038：
// pageContext 透传止于 renderGroup 一层，更深层节点经 renderSlot -> renderComponent 时
// parent 是父 schema 而非 pageContext，故深层 prop 表达式的 this.state 不可达，
// 走 onError 上报真实 TypeError（无静默失败），而非静默吞掉、也非 pageContext 可达
describe('deep-level ctx semantics (upstream behavior pin)', () => {
  afterEach(() => {
    setConfigure({ onError: undefined })
  })

  it('nested prop expression evaluates with parent schema as this, reporting real TypeError via onError', async () => {
    const onError = vi.fn()
    setConfigure({ onError })

    const wrapper = mount(RenderMain, {
      props: {
        schema: {
          componentName: 'Page',
          children: [
            {
              componentName: 'div',
              props: { className: 'outer' },
              children: [
                {
                  componentName: 'span',
                  props: { deep: { type: 'JSExpression', value: 'this.state.size' } },
                  children: []
                }
              ]
            }
          ],
          state: { size: 'large' },
          methods: {},
          css: ''
        }
      }
    })
    await flushPromises()
    await nextTick()
    await nextTick()

    expect(onError).toHaveBeenCalledTimes(1)
    const [error, context] = onError.mock.calls[0]
    expect(error).toBeInstanceOf(TypeError)
    expect(context.expression).toBe('this.state.size')
    expect(context.jsx).toBe(false)
    expect(context.message).toContain('size')
    wrapper.unmount()
  })
})

// web-erp: configure.globals 宿主全局注入规格 —— setSchema 先展开 globals 再置页面 state，
// methods 随后并（现有次序）；同名覆盖方向经下述用例实证钉死：
// 保留键 "state" 恒为页面 state 对象（覆盖 globals.state）；methods 键覆盖同名 globals 键；
// 页面 state 数据嵌套于 "state" 键之下，与 globals 其它键天然不同层、不构成同键冲突。
// 断言走 props 层 JSExpression（pageContext 在 renderGroup 一层对 props 可达，
// children 文本表达式走 renderSlot 链 this 不可达，见上方深层 ctx 语义钉子）
describe('configure.globals host injection', () => {
  afterEach(() => {
    setConfigure({ globals: undefined })
  })

  const mountWith = async (schema) => {
    const wrapper = mount(RenderMain, { props: { schema } })
    await flushPromises()
    await nextTick()
    await nextTick()
    return wrapper
  }

  it('globals handle reachable: expression reads this.app.name, page method calls this.app.call(...)', async () => {
    const app = { call: vi.fn(), name: 'lcp-sdk' }
    setConfigure({ globals: { app } })

    const wrapper = await mountWith({
      componentName: 'Page',
      children: [
        {
          componentName: 'span',
          props: { className: 'g-name', 'data-name': { type: 'JSExpression', value: 'this.app.name' } },
          children: []
        },
        {
          componentName: 'span',
          props: {
            className: 'g-call',
            // 渲染期触发页面方法，方法内 this.app.call 可达宿主通道
            'data-call': { type: 'JSExpression', value: 'this.fetchData() || "called"' }
          },
          children: []
        }
      ],
      state: {},
      // 方法值走渲染器正路 JSFunction 形态（同 evaluator.spec 契约；裸字符串经 isString 分支不转函数）
      methods: {
        fetchData: {
          type: 'JSFunction',
          value: 'function fetchData() { return this.app.call("order", "list", { page: 1 }) }'
        }
      },
      css: ''
    })

    expect(app.call).toHaveBeenCalledTimes(1)
    expect(app.call).toHaveBeenCalledWith('order', 'list', { page: 1 })
    expect(wrapper.find('.g-name').attributes('data-name')).toBe('lcp-sdk')
    expect(wrapper.find('.g-call').attributes('data-call')).toBe('called')
    wrapper.unmount()
  })

  it('same-name key on reserved "state": page state object overrides globals.state', async () => {
    setConfigure({ globals: { state: 'fake-global-state' } })

    const wrapper = await mountWith({
      componentName: 'Page',
      children: [
        {
          componentName: 'span',
          props: { className: 'g-state', 'data-size': { type: 'JSExpression', value: 'this.state.size' } },
          children: []
        }
      ],
      state: { size: 'large' },
      methods: {},
      css: ''
    })

    // 若被 globals.state 抢占，this.state.size 求值为 undefined
    expect(wrapper.find('.g-state').attributes('data-size')).toBe('large')
    wrapper.unmount()
  })

  it('same-name key on method: methods override globals handle', async () => {
    setConfigure({ globals: { shared: 'from-globals' } })

    const wrapper = await mountWith({
      componentName: 'Page',
      children: [
        {
          componentName: 'span',
          props: { className: 'g-shared', 'data-shared': { type: 'JSExpression', value: 'this.shared()' } },
          children: []
        }
      ],
      state: {},
      methods: { shared: { type: 'JSFunction', value: 'function shared() { return "from-methods" }' } },
      css: ''
    })

    expect(wrapper.find('.g-shared').attributes('data-shared')).toBe('from-methods')
    wrapper.unmount()
  })
})
