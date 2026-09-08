import { ref, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * localStorage 持久化 ref。
 * 读不到/解析失败时回退到 defaultValue；写入失败静默降级为内存态。
 * @param storage 可注入存储实现（默认 window.localStorage），便于测试
 */
export function useLocalStorage<T>(key: string, defaultValue: T, storage?: Storage | null): Ref<T> {
  const target: Storage | null | undefined = storage !== undefined ? storage : getDefaultStorage()

  function getDefaultStorage(): Storage | null {
    return typeof window !== 'undefined' ? window.localStorage : null
  }

  function read(): T {
    if (!target) return defaultValue
    try {
      const raw = target.getItem(key)
      return raw === null ? defaultValue : (JSON.parse(raw) as T)
    } catch {
      return defaultValue
    }
  }

  function write(value: T) {
    if (!target) return
    try {
      target.setItem(key, JSON.stringify(value))
    } catch {
      // 容量超限/隐私模式：静默降级，仅保留内存态
    }
  }

  const data = ref<T>(read()) as Ref<T>

  watch(
    data,
    (value) => {
      write(value)
    },
    { deep: true },
  )

  return data
}
