/**
 * 云同步提示接线：监听 todoStore 的同步状态，按规划要求弹出 Toast。
 *
 * 提示器由调用方注入（App.vue 传 ElMessage），这样：
 * - 组合式函数本身不依赖 Element Plus，单测可注入假实现，断言「弹了什么」而不是「弹没弹」
 * - 组件层决定用哪种 UI（Toast / 其他），关注点分开
 */

import { watch } from 'vue'

import { useTodoStore } from '@/stores/todoStore'
import {
  INITIAL_SYNC_NOTICE_STATE,
  decideSyncNotice,
  describeSyncMessage,
} from '@/utils/syncNotice'
import type { SyncNotice, SyncNoticeState } from '@/utils/syncNotice'
import type { SyncState } from '@/utils/todoSync'

/** 提示器：由调用方提供具体实现（Toast / 控制台 / 测试替身） */
export interface SyncNotifier {
  success: (text: string) => void
  warning: (text: string) => void
}

export interface UseSyncNotificationsReturn {
  /** 仅测试用：当前是否处于「离线过、还没提示恢复」的状态 */
  state: SyncNoticeState
}

export function useSyncNotifications(notify: SyncNotifier): UseSyncNotificationsReturn {
  const store = useTodoStore()

  const state: SyncNoticeState = { ...INITIAL_SYNC_NOTICE_STATE }
  /** 上一条已提示过的消息（迁移类事件只提示一次） */
  let lastNotifiedMessage = ''

  function show(notice: SyncNotice) {
    // Toast 是锦上添花：UI 层万一抛错（组件库异常、宿主环境缺 API），
    // 也不能让它冒泡回同步流程把补发链路一起带崩
    try {
      if (notice.tone === 'success') notify.success(notice.text)
      else notify.warning(notice.text)
    } catch {
      // 静默降级：状态本身已经同步到界面（侧边栏/设置页仍有常驻文案）
    }
  }

  // 状态迁移：断网 → 警告；恢复 → 成功
  watch(
    () => store.syncState as SyncState,
    (next) => {
      const decision = decideSyncNotice(next, state)
      state.wasOffline = decision.state.wasOffline
      if (decision.notice) show(decision.notice)
    },
  )

  // 一次性事件：旧数据迁移完成（同一条消息只提示一次）
  watch(
    () => store.syncMessage,
    (message) => {
      if (!message || message === lastNotifiedMessage) return
      const notice = describeSyncMessage(message)
      if (!notice) return
      lastNotifiedMessage = message
      show(notice)
    },
  )

  return { state }
}
