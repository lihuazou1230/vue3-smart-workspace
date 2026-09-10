import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import RollingAmount from './RollingAmount.vue'

describe('RollingAmount', () => {
  it('数字位渲染为滚动窗口，分隔符原样静态显示', () => {
    const wrapper = mount(RollingAmount, { props: { value: '1,234.56' } })
    // 6 个数字位 -> 6 个滚动窗口
    expect(wrapper.findAll('.digit-window')).toHaveLength(6)
    expect(wrapper.text()).toContain(',')
    expect(wrapper.text()).toContain('.')
  })

  it('提供 sr-only 的完整金额（读屏友好，也便于断言）', () => {
    const wrapper = mount(RollingAmount, { props: { value: '1,234.56' } })
    const srOnly = wrapper.find('.sr-only')
    expect(srOnly.exists()).toBe(true)
    expect(srOnly.text()).toBe('1,234.56')
  })

  it('各位停在正确的数字上', () => {
    const wrapper = mount(RollingAmount, { props: { value: '250.00' } })
    const transforms = wrapper
      .findAll('.digit-strip')
      .map((strip) => /translateY\(([^)]+)\)/.exec(strip.attributes('style') ?? '')?.[1])
    expect(transforms).toEqual(['-2em', '-5em', '-0em', '-0em', '-0em'])
  })

  it('金额变化时只更新受影响位的位移目标（未变化的位 transform 不变）', async () => {
    const wrapper = mount(RollingAmount, { props: { value: '125.00' } })
    const before = wrapper.findAll('.digit-strip').map((s) => s.attributes('style'))

    await wrapper.setProps({ value: '125.01' })
    const after = wrapper.findAll('.digit-strip').map((s) => s.attributes('style'))

    // 只有最后一位（百分位）变化
    expect(after.slice(0, 4)).toEqual(before.slice(0, 4))
    expect(after[4]).not.toBe(before[4])
  })

  it('位数增加时新增高位并保持低位对应关系', async () => {
    const wrapper = mount(RollingAmount, { props: { value: '999.99' } })
    expect(wrapper.findAll('.digit-window')).toHaveLength(5)

    await wrapper.setProps({ value: '1,000.00' })
    // 1,000.00 => 6 个数字位（逗号不是数字位）
    expect(wrapper.findAll('.digit-window')).toHaveLength(6)
    expect(wrapper.find('.sr-only').text()).toBe('1,000.00')
  })
})
