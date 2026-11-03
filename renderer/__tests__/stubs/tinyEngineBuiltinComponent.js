// web-erp: 测试桩 —— @opentiny/tiny-engine-builtin-component 的 dist 从 @opentiny/vue 全量桶具名导入，
// 桶内组件（如 vue-mind-map）在 jsdom 模块求值期执行 DOM 代码会崩溃；单测不渲染这些画布容器，
// 以空组件桩替换，保持渲染器主链路可测（本地 ./builtin/*.vue 仍是真实实现）
import { defineComponent } from 'vue'

const stubComponent = (name) => defineComponent({ name, render: () => null })

export const CanvasRow = stubComponent('CanvasRow')
export const CanvasCol = stubComponent('CanvasCol')
export const CanvasRowColContainer = stubComponent('CanvasRowColContainer')
export const CanvasFlexBox = stubComponent('CanvasFlexBox')
export const CanvasSection = stubComponent('CanvasSection')

export default {
  CanvasRow,
  CanvasCol,
  CanvasRowColContainer,
  CanvasFlexBox,
  CanvasSection
}
