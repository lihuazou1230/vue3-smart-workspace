/**
 * 裁剪区的几何约束（纯函数，便于单测）
 *
 * 需求：**圆形裁剪区永远不能超出图片**。
 * 分两步保证：
 * 1. 初始与缩放：图片按 `cover` 铺满裁剪区，且 `min-fit="cover"` 禁止缩小到露白（cropperjs 配置）
 * 2. 拖动：只靠 1 还不够——图片可以被拖到边上，露出空白。
 *    所以拖动结束后算一个"拉回覆盖裁剪区"的位移，见 `clampOffset`。
 */

/** 矩形（视口坐标，避免引入 DOM 类型以便测试） */
export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** 一维约束：把图片区间 [imgStart, imgEnd] 调整到覆盖 [selStart, selEnd] */
function clampAxis(imgStart: number, imgEnd: number, selStart: number, selEnd: number): number {
  const imgSize = imgEnd - imgStart
  const selSize = selEnd - selStart

  // 图片在这个方向上比裁剪区还小（理论上被 min-fit 挡住了，兜底居中）
  if (imgSize <= selSize) {
    return (selStart + selEnd) / 2 - (imgStart + imgEnd) / 2
  }
  // 图片左/上边缘露出 → 往右/下推回
  if (imgStart > selStart) return selStart - imgStart
  // 图片右/下边缘露出 → 往左/上推回
  if (imgEnd < selEnd) return selEnd - imgEnd
  return 0
}

/**
 * 计算把图片拉回到「完全覆盖裁剪区」所需的最小位移（画布坐标）。
 * 已经覆盖时返回 `{ x: 0, y: 0 }`，调用方据此决定要不要真的移动（避免无意义抖动）。
 */
export function clampOffset(image: Rect, selection: Rect): { x: number; y: number } {
  return {
    x: clampAxis(image.left, image.right, selection.left, selection.right),
    y: clampAxis(image.top, image.bottom, selection.top, selection.bottom),
  }
}

/** 视口矩形是否有效（happy-dom 不做排版，全是 0，用来提前跳过几何计算） */
export function isUsableRect(rect: Rect): boolean {
  return rect.right - rect.left > 1 && rect.bottom - rect.top > 1
}
