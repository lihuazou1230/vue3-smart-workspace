/**
 * 云同步提示：状态迁移 → 面向用户的即时反馈（纯函数，便于单测）
 *
 * 为什么不能只靠设置页里的常驻文案：
 * 断网是「此刻发生的事」，用户不会主动跑去设置页看状态——规划里明确要求
 * **Toast 提示「当前处于离线模式」**，以及**网络恢复后提示已同步**。
 *
 * 为什么要做成带状态的小状态机：
 * 恢复同步的路径是 `offline → syncing → synced`（补发前会先切成 syncing），
 * 只看「上一态是否为 offline」会漏掉这次恢复，所以用一个 wasOffline 标记跨过中间态。
 * 同时它保证**只在跨入离线时提示一次**，而不是每次推送失败都弹一个 Toast。
 */

import type { SyncState } from '@/utils/todoSync'

export type SyncNoticeTone = 'success' | 'warning'

export interface SyncNotice {
  tone: SyncNoticeTone
  text: string
}

export const OFFLINE_NOTICE_TEXT = '当前处于离线模式：改动已保存在本地，恢复网络后自动同步'
export const SYNC_RESTORED_NOTICE_TEXT = '网络已恢复，改动已同步到云端'

/** 跨事件携带的状态（只有「离线过但还没提示恢复」这一位） */
export interface SyncNoticeState {
  wasOffline: boolean
}

export const INITIAL_SYNC_NOTICE_STATE: SyncNoticeState = { wasOffline: false }

export interface SyncNoticeDecision {
  notice: SyncNotice | null
  state: SyncNoticeState
}

/**
 * 状态迁移 → 提示决策。
 * - 跨入 `offline`（此前不在离线）→ 警告一次
 * - 从离线路径回到 `synced`（中间可能经过 `syncing`）→ 成功提示一次
 * - 其余（local / syncing / 重复的 offline）→ 不打扰
 */
export function decideSyncNotice(next: SyncState, state: SyncNoticeState): SyncNoticeDecision {
  if (next === 'offline') {
    const notice: SyncNotice | null = state.wasOffline
      ? null
      : { tone: 'warning', text: OFFLINE_NOTICE_TEXT }
    return { notice, state: { wasOffline: true } }
  }

  if (next === 'synced') {
    const notice: SyncNotice | null = state.wasOffline
      ? { tone: 'success', text: SYNC_RESTORED_NOTICE_TEXT }
      : null
    return { notice, state: { wasOffline: false } }
  }

  // local：退出云同步（登出）——顺手复位，下次登录重新从「未离线」开始
  if (next === 'local') return { notice: null, state: { wasOffline: false } }

  // syncing：中间态，保持标记不变（否则会漏掉恢复提示）
  return { notice: null, state }
}

/**
 * 一次性事件类提示（按 store 的消息文本识别）：目前只有「旧数据迁移完成」。
 * 返回 null 表示这条消息不需要以 Toast 形式打扰用户（离线/报错等已有常驻文案展示）。
 */
export function describeSyncMessage(message: string): SyncNotice | null {
  if (/迁移到云端/.test(message)) return { tone: 'success', text: message }
  return null
}
