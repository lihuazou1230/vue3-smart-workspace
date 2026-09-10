import { describe, expect, it } from 'vitest'

import { clampOffset, isUsableRect } from './avatarCropFit'
import type { Rect } from './avatarCropFit'

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({
  left,
  top,
  right,
  bottom,
})

/** 裁剪区：画布 300×300 里居中的 240×240 */
const SELECTION = rect(30, 30, 270, 270)

describe('裁剪区几何约束（圆不超出图片）', () => {
  it('图片完全覆盖裁剪区：不需要移动', () => {
    expect(clampOffset(rect(0, 0, 300, 300), SELECTION)).toEqual({ x: 0, y: 0 })
    // 刚好贴边也算覆盖
    expect(clampOffset(rect(30, 30, 270, 270), SELECTION)).toEqual({ x: 0, y: 0 })
  })

  it('图片被拖到左边露出空白：往右推回', () => {
    // 图片左边缘在 60（选区左边在 30）→ 右移 30 补上
    expect(clampOffset(rect(60, 0, 360, 300), SELECTION)).toEqual({ x: -30, y: 0 })
  })

  it('图片被拖到右边露出空白：往左推回', () => {
    // 图片右边缘只到 220（选区右边 270）→ 左移 50 补上
    expect(clampOffset(rect(-80, 0, 220, 300), SELECTION)).toEqual({ x: 50, y: 0 })
  })

  it('图片被拖到上/下露出空白：纵向推回', () => {
    expect(clampOffset(rect(0, 50, 300, 350), SELECTION)).toEqual({ x: 0, y: -20 })
    expect(clampOffset(rect(0, -60, 300, 240), SELECTION)).toEqual({ x: 0, y: 30 })
  })

  it('两个方向同时露出：返回组合位移', () => {
    expect(clampOffset(rect(70, 70, 370, 370), SELECTION)).toEqual({ x: -40, y: -40 })
  })

  it('图片比裁剪区还小（兜底）：居中放置', () => {
    // 宽 100 的图片在 30..270 的选区里 → 居中到 100..200
    expect(clampOffset(rect(0, 0, 100, 300), SELECTION)).toEqual({ x: 100, y: 0 })
  })

  it('isUsableRect：过滤掉没有排版的环境（happy-dom 全 0）', () => {
    expect(isUsableRect(rect(0, 0, 0, 0))).toBe(false)
    expect(isUsableRect(rect(0, 0, 1, 1))).toBe(false)
    expect(isUsableRect(rect(0, 0, 200, 200))).toBe(true)
  })
})
