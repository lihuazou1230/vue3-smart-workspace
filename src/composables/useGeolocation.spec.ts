import { afterEach, describe, expect, it, vi } from 'vitest'

import { GeoError, geoErrorMessage, getCurrentCoords } from './useGeolocation'
import type { GeolocationLike } from './useGeolocation'

function fakeGeo(impl: GeolocationLike['getCurrentPosition']): GeolocationLike {
  return { getCurrentPosition: impl }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('geoErrorMessage', () => {
  it('把浏览器错误码映射为语义与中文提示', () => {
    expect(geoErrorMessage(1)).toEqual({ code: 'denied', message: '定位权限被拒绝' })
    expect(geoErrorMessage(2)).toEqual({ code: 'unavailable', message: '无法获取当前位置' })
    expect(geoErrorMessage(3)).toEqual({ code: 'timeout', message: '定位超时' })
    expect(geoErrorMessage(99)).toEqual({ code: 'unknown', message: '定位失败' })
  })
})

describe('getCurrentCoords', () => {
  it('浏览器不支持定位时抛 unsupported', async () => {
    await expect(getCurrentCoords({ geolocation: null })).rejects.toMatchObject({
      code: 'unsupported',
    })
  })

  it('成功时返回经纬度', async () => {
    const geo = fakeGeo((success) => success({ coords: { latitude: 30.246, longitude: 120.209 } }))
    await expect(getCurrentCoords({ geolocation: geo })).resolves.toEqual({
      latitude: 30.246,
      longitude: 120.209,
    })
  })

  it('权限被拒绝时抛 denied（GeoError 实例）', async () => {
    const geo = fakeGeo((_success, error) => error?.({ code: 1 }))
    await expect(getCurrentCoords({ geolocation: geo })).rejects.toBeInstanceOf(GeoError)
    await expect(getCurrentCoords({ geolocation: geo })).rejects.toMatchObject({ code: 'denied' })
  })

  it('浏览器报超时时抛 timeout', async () => {
    const geo = fakeGeo((_success, error) => error?.({ code: 3 }))
    await expect(getCurrentCoords({ geolocation: geo })).rejects.toMatchObject({ code: 'timeout' })
  })

  it('浏览器一个回调都不触发时，兜底定时器也会超时（不会永久挂起）', async () => {
    vi.useFakeTimers()
    const geo = fakeGeo(() => {
      // 故意不回调
    })
    const pending = getCurrentCoords({ geolocation: geo, timeout: 1000 })
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' })
    await vi.advanceTimersByTimeAsync(2100)
    await assertion
  })
})
