import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import BaseCheckbox from './BaseCheckbox.vue'

describe('BaseCheckbox', () => {
  it('渲染 label 且 v-model 双向绑定', async () => {
    const wrapper = mount(BaseCheckbox, { props: { modelValue: true, label: '完成' } })
    expect(wrapper.text()).toContain('完成')
    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).checked).toBe(true)

    await input.setValue(false)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('勾选变化时发射 change', async () => {
    const wrapper = mount(BaseCheckbox)
    await wrapper.find('input').setValue(true)
    expect(wrapper.emitted('change')?.[0]).toEqual([true])
  })

  it('disabled 禁用交互', () => {
    const wrapper = mount(BaseCheckbox, { props: { disabled: true } })
    expect(wrapper.find('input').attributes('disabled')).toBeDefined()
  })
})
