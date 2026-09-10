/**
 * 地点文案格式化（纯函数，便于单测）
 *
 * 数据来源差异：
 * - 逆地理编码能拿到 province / city / district 三级，是展示「区 · 城市 · 省份」的唯一来源
 * - 天气接口按区级 adcode 查询时，返回的 city 其实是**区名**，province 是省名（无「省」字）
 */

import type { LocatedPlace } from '@/types/weather'

/** 去掉行政区后缀，用于判重（「北京市」与「北京」算同一个） */
function placeKey(name: string): string {
  return name.replace(/[省市县区]$/, '')
}

/**
 * 拼接地点片段：去空白、去重、以「 · 」连接。
 * 仅后缀不同的项（如「北京市」与「北京」）只保留先出现的那个。
 */
export function joinPlaceParts(parts: Array<string | undefined>): string {
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of parts) {
    const part = raw?.trim()
    if (!part) continue
    const key = placeKey(part)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(part)
  }

  return result.join(' · ')
}

/**
 * 生成定位地点文案：
 * - 普通城市：**区 · 城市 · 省份**（如「青山湖区 · 南昌市 · 江西省」）
 * - 直辖市（高德返回 city 为空）：**区 · 城市**（此时城市即 province，如「黄浦区 · 上海市」）
 * - 字段缺失自动跳过，不会出现多余的分隔符
 */
export function buildPlaceLabel(place: LocatedPlace): string {
  const hasCity = Boolean(place.city?.trim())
  return hasCity
    ? joinPlaceParts([place.district, place.city, place.province])
    : joinPlaceParts([place.district, place.province])
}

/** 天气接口返回的城市/省份拼接（回落到默认城市时使用，会自动去重避免「北京市 · 北京」） */
export function weatherPlaceLabel(city?: string, province?: string): string {
  return joinPlaceParts([city, province])
}
