import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import BaseInput from './BaseInput.vue'

describe('BaseInput', () => {
  it('v-model 双向绑定', async () => {
    const wrapper = mount(BaseInput, { props: { modelValue: 'hello' } })
    const input = wrapper.find('input')
    await input.setValue('world')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['world'])
  })

  it('回车触发 enter 事件', async () => {
    const wrapper = mount(BaseInput)
    await wrapper.find('input').setValue('写周报')
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('enter')?.[0]).toEqual(['写周报'])
  })

  it('clearable 出现清空按钮并触发 clear', async () => {
    const wrapper = mount(BaseInput, { props: { modelValue: 'abc', clearable: true } })
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('type=date 渲染 date 输入框', () => {
    const wrapper = mount(BaseInput, { props: { type: 'date' } })
    expect(wrapper.find('input').attributes('type')).toBe('date')
  })
})
