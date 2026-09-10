import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

import { DEFAULT_EARNINGS_CONFIG, EARNINGS_STORAGE_KEY } from '@/types/earnings'
import { quoteOfDay } from '@/utils/dailyQuote'
import App from './App.vue'

/** 2026-09-10 是周四 */
function freezeTime(hours: number, minutes = 0) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 10, hours, minutes, 0))
}

describe('App 集成', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('渲染标题与任务统计', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('Vue 3 智能工作台')
    expect(wrapper.text()).toContain('进行中 0')
  })

  it('通过表单添加任务后列表出现该任务', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, { global: { plugins: [pinia] } })

    await wrapper.find('input[placeholder*="添加新任务"]').setValue('集成测试任务')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('集成测试任务')
    expect(wrapper.text()).toContain('全部 1')
  })

  it('仪表板同时装配每日格言与赚钱秒表（第四阶段）', () => {
    freezeTime(10)
    localStorage.setItem(
      EARNINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_EARNINGS_CONFIG, monthlySalary: 21750 }),
    )
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(App, { global: { plugins: [pinia] } })

    // 每日格言：时段问候 + 当日那句
    expect(wrapper.text()).toContain('早上好')
    expect(wrapper.text()).toContain('9月10日 星期四')
    expect(wrapper.text()).toContain(quoteOfDay('2026-09-10').text)

    // 赚钱秒表：09:00-10:00 计薪 1 小时 => 125.00 元
    expect(wrapper.text()).toContain('💰 赚钱秒表')
    expect(wrapper.find('p.font-mono').text()).toContain('125.00')
  })
})
