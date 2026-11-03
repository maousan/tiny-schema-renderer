import { describe, it, expect } from 'vitest'
import { h, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import RenderMain from '../RenderMain'
import { registerMaterials } from '../render'

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
