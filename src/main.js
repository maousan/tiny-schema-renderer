import { createApp } from 'vue'
import App from './App.vue'
import TinyVue from '@opentiny/vue'
// web-erp: 渲染器不再静态依赖 @opentiny/vue 与画布容器包，demo 侧自行注入/注册，保持 mock schema 里的
// web-erp: native 物料（TinyCarousel/TinyTabs）与画布布局容器（CanvasFlexBox 等）可解析
import { registerMaterials, setConfigure } from '../index.js'
import {
  CanvasRow,
  CanvasCol,
  CanvasRowColContainer,
  CanvasFlexBox,
  CanvasSection
} from '@opentiny/tiny-engine-builtin-component'

registerMaterials({
  CanvasRow,
  CanvasCol,
  CanvasRowColContainer,
  CanvasFlexBox,
  CanvasSection
})

setConfigure({ tinyVue: TinyVue })

createApp(App).mount('#app')
