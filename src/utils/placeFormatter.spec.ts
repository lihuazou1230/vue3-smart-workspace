import { describe, expect, it } from 'vitest'

import { buildPlaceLabel, joinPlaceParts, weatherPlaceLabel } from './placeFormatter'

describe('joinPlaceParts', () => {
  it('去掉空白项并用「 · 」连接', () => {
    expect(joinPlaceParts(['青山湖区', '南昌市', '江西省'])).toBe('青山湖区 · 南昌市 · 江西省')
    expect(joinPlaceParts(['东城区', undefined, '北京市'])).toBe('东城区 · 北京市')
    expect(joinPlaceParts([undefined, '', '  '])).toBe('')
  })

  it('仅后缀不同的项只保留第一次出现的（避免「北京市 · 北京」）', () => {
    expect(joinPlaceParts(['北京市', '北京'])).toBe('北京市')
    expect(joinPlaceParts(['江西省', '江西'])).toBe('江西省')
  })
})

describe('buildPlaceLabel', () => {
  it('普通城市：区 · 城市 · 省份', () => {
    expect(
      buildPlaceLabel({
        adcode: '360111',
        province: '江西省',
        city: '南昌市',
        district: '青山湖区',
      }),
    ).toBe('青山湖区 · 南昌市 · 江西省')
  })

  it('直辖市（city 为空）：区 · 城市（城市即省份）', () => {
    expect(buildPlaceLabel({ adcode: '310101', province: '上海市', district: '黄浦区' })).toBe(
      '黄浦区 · 上海市',
    )
    expect(buildPlaceLabel({ adcode: '500103', province: '重庆市', district: '渝中区' })).toBe(
      '渝中区 · 重庆市',
    )
  })

  it('city 为空字符串或空白也按直辖市规则处理', () => {
    expect(
      buildPlaceLabel({ adcode: '110101', province: '北京市', city: '  ', district: '东城区' }),
    ).toBe('东城区 · 北京市')
  })

  it('字段缺失时自动跳过，不产生多余分隔符', () => {
    expect(buildPlaceLabel({ adcode: '360111', city: '南昌市' })).toBe('南昌市')
    expect(buildPlaceLabel({ adcode: '360111' })).toBe('')
  })
})

describe('weatherPlaceLabel', () => {
  it('拼接天气接口返回的城市与省份，并自动去重', () => {
    expect(weatherPlaceLabel('杭州市', '浙江')).toBe('杭州市 · 浙江')
    // 直辖市：city 与 province 实为同一层级，去重后只留一个
    expect(weatherPlaceLabel('北京市', '北京')).toBe('北京市')
  })
})
