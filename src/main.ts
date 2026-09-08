import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import '@/assets/styles/main.css'
import '@/assets/styles/element-theme.css'
import '@/assets/styles/custom.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
