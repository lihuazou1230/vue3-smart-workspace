// Vitest 全局测试环境配置（happy-dom）
import { config } from '@vue/test-utils'

config.global.stubs = {
  // 过渡动画在测试里没有意义，关掉避免断言中间态
  transition: false,
}

// 注意：这里**不要** stub `router-link`。
// 第五阶段启用真实路由后，导航项的 href 与激活态都是断言对象，
// stub 掉只会得到一个没有 href、没有插槽内容的空壳（踩过一次）。
