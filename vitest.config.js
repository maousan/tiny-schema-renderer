// web-erp: vitest 独立配置（不改动上游 vite.config.js），复用 @vitejs/plugin-vue 编译 builtin/*.vue 与 Loading.vue
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  define: {
    'process.env': {}
  },
  test: {
    environment: 'jsdom',
    include: ['renderer/__tests__/**/*.spec.js'],
    // web-erp: @opentiny 系包内部使用无扩展名相对导入，原生 Node ESM 无法解析，
    // 交给 vite 内联转换后可正常解析（vitest 默认 externalize node_modules）
    server: {
      deps: {
        inline: [/@opentiny\//]
      }
    }
  }
})
