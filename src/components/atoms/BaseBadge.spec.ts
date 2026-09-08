import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import BaseBadge from './BaseBadge.vue'

describe('BaseBadge', () => {
  it('渲染插槽内容与默认样式', () => {
    const wrapper = mount(BaseBadge, { slots: { default: '高' } })
    expect(wrapper.text()).toBe('高')
    expect(wrapper.classes()).toContain('bg-slate-200')
  })

  it('支持 tone 与 size', () => {
    const danger = mount(BaseBadge, { props: { tone: 'danger', size: 'xs' } })
    expect(danger.classes()).toContain('bg-rose-100')
    expect(danger.classes()).toContain('text-[10px]')
  })
})
