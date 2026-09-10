import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  /**
   * 部署子路径。
   * 本地开发、Vercel、Netlify、Cloudflare Pages 都挂在域名根目录（`/`），保持默认即可；
   * GitHub Pages 的项目站点挂在 `https://<user>.github.io/<repo>/` 上，
   * 由部署工作流注入 `BASE_PATH=/<repo>/`——`import.meta.env.BASE_URL` 会同步变化，
   * 而路由用的是 `createWebHistory(import.meta.env.BASE_URL)`，所以子路径下路由依然正确。
   */
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    vue(),
    // Element Plus 按需自动导入：模板组件 + API（ElMessage 等）
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 避免 chokidar 监听被锁定的临时目录/文件导致 EBUSY 崩溃（如 .App.vue.<uuid>.tmpdir）
  // awaitWriteFinish：原子写入（先写 .tmp 再 rename）会产生多次变更事件，这里等待文件稳定后再触发
  // 一次 HMR，避免事件风暴导致进程被强杀（Windows 下 exit 4294967295）
  server: {
    watch: {
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/.DS_Store',
        '**/*.tmp',
        '**/*.tmpdir',
        '**/*.tmpdir/**',
      ],
      awaitWriteFinish: {
        stabilityThreshold: 120,
        pollInterval: 10,
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['src/test/setup.ts'],
    css: true,
    server: {
      deps: {
        inline: ['element-plus'],
      },
    },
  },
})
