import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

import App from './App.vue'

describe('App 集成', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
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
})
