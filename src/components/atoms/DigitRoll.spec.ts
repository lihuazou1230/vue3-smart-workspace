import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import DigitRoll from './DigitRoll.vue'

/** 读取滚动列的 translateY（-n em 表示窗口里停在第 n 个数字） */
function stripTransform(wrapper: ReturnType<typeof mount>): string {
  const style = wrapper.find('.digit-strip').attributes('style') ?? ''
  return /translateY\(([^)]+)\)/.exec(style)?.[1] ?? ''
}

describe('DigitRoll', () => {
  it('窗口内是 0-9 一整列，共 10 行', () => {
    const wrapper = mount(DigitRoll, { props: { digit: '3' } })
    expect(wrapper.find('.digit-window').exists()).toBe(true)
    const rows = wrapper.findAll('.digit-strip > span')
    expect(rows).toHaveLength(10)
    expect(rows.map((r) => r.text()).join('')).toBe('0123456789')
  })

  it('按数字设置位移：第 n 个数字停在窗口里', () => {
    expect(stripTransform(mount(DigitRoll, { props: { digit: '0' } }))).toBe('-0em')
    expect(stripTransform(mount(DigitRoll, { props: { digit: '3' } }))).toBe('-3em')
    expect(stripTransform(mount(DigitRoll, { props: { digit: '9' } }))).toBe('-9em')
  })

  it('接受数字类型', () => {
    expect(stripTransform(mount(DigitRoll, { props: { digit: 7 } }))).toBe('-7em')
  })

  it('非法输入回退到 0，不产生 NaN', () => {
    expect(stripTransform(mount(DigitRoll, { props: { digit: 'x' } }))).toBe('-0em')
    expect(stripTransform(mount(DigitRoll, { props: { digit: 12 } }))).toBe('-0em')
  })

  it('数字变化时位移随之变化（CSS 过渡负责上滑动画）', async () => {
    const wrapper = mount(DigitRoll, { props: { digit: '2' } })
    expect(stripTransform(wrapper)).toBe('-2em')
    await wrapper.setProps({ digit: '6' })
    expect(stripTransform(wrapper)).toBe('-6em')
  })

  it('滚动列对读屏隐藏（完整金额由 RollingAmount 的 sr-only 提供）', () => {
    const wrapper = mount(DigitRoll, { props: { digit: '5' } })
    expect(wrapper.find('.digit-window').attributes('aria-hidden')).toBe('true')
  })
})
