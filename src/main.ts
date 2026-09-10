import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/authStore'
import '@/assets/styles/main.css'
import '@/assets/styles/element-theme.css'
import '@/assets/styles/custom.css'

async function bootstrap() {
  const app = createApp(App)

  app.use(createPinia())
  app.use(router)

  // 先恢复会话再挂载：否则已登录用户会先看到登录页（守卫闪跳）。
  // getSession 读的是本地存储，不发网络请求，所以这一步几乎无成本。
  await useAuthStore().init()

  await router.isReady()
  app.mount('#app')
}

void bootstrap()
