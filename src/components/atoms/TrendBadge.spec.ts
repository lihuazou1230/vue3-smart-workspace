import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import TrendBadge from './TrendBadge.vue'

describe('TrendBadge', () => {
  it('正数：向上箭头 + 绿色 + 带 + 号', () => {
    const wrapper = mount(TrendBadge, { props: { value: 8 } })
    expect(wrapper.text()).toContain('↑')
    expect(wrapper.text()).toContain('+8%')
    expect(wrapper.classes().join(' ')).toContain('emerald')
  })

  it('负数：向下箭头 + 红色', () => {
    const wrapper = mount(TrendBadge, { props: { value: -12.5 } })
    expect(wrapper.text()).toContain('↓')
    expect(wrapper.text()).toContain('-12.5%')
    expect(wrapper.classes().join(' ')).toContain('rose')
  })

  it('0 与非法值：持平（灰色横线）', () => {
    for (const value of [0, Number.NaN]) {
      const wrapper = mount(TrendBadge, { props: { value } })
      expect(wrapper.text()).toContain('—')
      expect(wrapper.classes().join(' ')).toContain('slate')
    }
  })

  it('保留一位小数并去掉多余的 .0', () => {
    expect(mount(TrendBadge, { props: { value: 2.34 } }).text()).toContain('+2.3%')
    expect(mount(TrendBadge, { props: { value: 8.0 } }).text()).toContain('+8%')
  })

  it('四舍五入到 0 的极小值按持平处理（不出现「↓0%」这种别扭结果）', () => {
    const wrapper = mount(TrendBadge, { props: { value: -0.04 } })
    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).toContain('0%')
    expect(wrapper.text()).not.toContain('↓')
  })

  it('支持自定义后缀与无障碍描述', () => {
    const wrapper = mount(TrendBadge, { props: { value: 3, suffix: ' 项', label: '较昨日' } })
    expect(wrapper.text()).toContain('+3 项')
    expect(wrapper.attributes('aria-label')).toBe('较昨日 +3 项')
  })
})
