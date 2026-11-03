import { createApp } from 'vue'
import App from './App.vue'
import TinyVue from '@opentiny/vue'
// web-erp: 渲染器不再静态依赖 @opentiny/vue，demo 侧自行注入 tinyVue，
// 保持 mock schema 里的 native 物料（TinyCarousel/TinyTabs）可解析
import { setConfigure } from '../index.js'

setConfigure({ tinyVue: TinyVue })

createApp(App).mount('#app')
