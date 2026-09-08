import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import BaseButton from './BaseButton.vue'

describe('BaseButton', () => {
  it('默认渲染 primary 按钮并发射 click', async () => {
    const wrapper = mount(BaseButton, { slots: { default: '保存' } })
    expect(wrapper.text()).toContain('保存')
    expect(wrapper.classes()).toContain('bg-indigo-600')

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('支持 variant/size/nativeType/block', () => {
    const wrapper = mount(BaseButton, {
      props: { variant: 'danger', size: 'sm', nativeType: 'submit', block: true },
    })
    expect(wrapper.classes()).toContain('bg-rose-600')
    expect(wrapper.attributes('type')).toBe('submit')
    expect(wrapper.classes()).toContain('w-full')
  })

  it('disabled 时不发射 click', async () => {
    const wrapper = mount(BaseButton, { props: { disabled: true } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})
