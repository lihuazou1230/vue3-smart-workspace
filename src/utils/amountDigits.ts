/**
 * 金额逐位拆分（纯函数，供 odometer 数字滚动使用）。
 *
 * 把已格式化的金额串（如 `1,234.56`）拆成「位单元」列表，每个单元带一个稳定的 key。
 *
 * key 的设计是这版实现的关键——按**位序**而不是**字符下标**分配：
 * - 整数部分从右往左编号（个位 i0、十位 i1…），千分位逗号按其「右侧数字个数」编号（c3）
 * - 小数部分从左往右编号（十分位 f0、百分位 f1），小数点固定为 dot
 *
 * 于是 999.99 → 1,000.00 这种进位变长时，每一位仍对应同一列数字，视觉上是自然的进位连动；
 * 若用字符下标做 key，插入一个千分位逗号会让其后所有位"错位"，整行重滚一遍。
 */

export interface AmountCell {
  /** 稳定 key（同一位序在不同金额之间保持一致） */
  key: string
  /** 该位要显示的字符 */
  char: string
  /** 是否是可滚动数字位（分隔符为 false） */
  rolling: boolean
}

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9'

/** 金额串 -> 位单元列表（保持从左到右的显示顺序） */
export function toAmountCells(value: string): AmountCell[] {
  // 没有小数点时 fracPart 为 undefined，这里统一兜底成空串
  const [intPart = '', fracPart = ''] = value.split('.')
  const cells: AmountCell[] = []

  // 整数部分：digitsRight = 当前字符右侧的数字个数（= 它从个位起算的位序）
  let digitsRight = [...intPart].filter(isDigit).length
  for (const ch of intPart) {
    if (isDigit(ch)) {
      digitsRight -= 1
      cells.push({ key: `i${digitsRight}`, char: ch, rolling: true })
    } else {
      cells.push({ key: `c${digitsRight}`, char: ch, rolling: false })
    }
  }

  if (value.includes('.')) cells.push({ key: 'dot', char: '.', rolling: false })

  ;[...fracPart].forEach((ch, index) => {
    cells.push(
      isDigit(ch)
        ? { key: `f${index}`, char: ch, rolling: true }
        : { key: `fc${index}`, char: ch, rolling: false },
    )
  })

  return cells
}

/** 只取可滚动数字位（便于断言"哪些位真的会动"） */
export function rollingDigits(value: string): string[] {
  return toAmountCells(value)
    .filter((cell) => cell.rolling)
    .map((cell) => cell.char)
}

/**
 * 两个金额串之间**发生变化的位**（按位序对比，用于说明"只让变化的位滚动"）。
 * 返回变化的位序 key 列表；位数不同时，新出现的位也算变化。
 */
export function changedSlots(prev: string, next: string): string[] {
  const prevMap = new Map(toAmountCells(prev).map((cell) => [cell.key, cell.char]))
  const changed: string[] = []
  for (const cell of toAmountCells(next)) {
    if (!cell.rolling) continue
    if (prevMap.get(cell.key) !== cell.char) changed.push(cell.key)
  }
  return changed
}
