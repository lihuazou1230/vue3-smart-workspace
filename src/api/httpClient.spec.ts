import { afterEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from './httpClient'

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('httpClient', () => {
  it('成功时解析 JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ value: 7 }),
      })),
    )
    const data = await httpClient<{ value: number }>('https://api.test/ok')
    expect(data).toEqual({ value: 7 })
  })

  it('非 2xx 时抛 http 错误并携带状态码', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })),
    )
    await expect(httpClient('https://api.test/missing')).rejects.toMatchObject({
      name: 'HttpError',
      kind: 'http',
      status: 404,
    })
  })

  it('fetch 抛出网络异常时抛 network 错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
    )
    await expect(httpClient('https://api.test/net')).rejects.toMatchObject({
      name: 'HttpError',
      kind: 'network',
    })
  })

  it('超时（AbortController 触发）时抛 timeout 错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal
            if (signal?.aborted) return reject(abortError())
            signal?.addEventListener('abort', () => reject(abortError()))
          }),
      ),
    )
    await expect(httpClient('https://api.test/slow', { timeoutMs: 10 })).rejects.toMatchObject({
      name: 'HttpError',
      kind: 'timeout',
    })
  })

  it('响应不是合法 JSON 时抛 json 错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => 'not-json',
      })),
    )
    await expect(httpClient('https://api.test/empty')).rejects.toMatchObject({
      name: 'HttpError',
      kind: 'json',
    })
  })
})
