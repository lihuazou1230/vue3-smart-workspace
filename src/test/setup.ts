// Vitest 全局测试环境配置（happy-dom）
// 后续阶段可在此注入 Element Plus / Pinia 的全局测试插件
import { config } from '@vue/test-utils'

config.global.stubs = {
  transition: false,
  'router-link': true,
}
