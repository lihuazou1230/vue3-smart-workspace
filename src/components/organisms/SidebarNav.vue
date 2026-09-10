<script setup lang="ts">
/**
 * 有机体组件：桌面端左侧边栏
 *
 * - 头像区：点击唤起 AvatarUpload（未登录时用姓名首字母 + 主题色兜底）
 * - 导航区：4 个路由项，激活态跟随当前路由（胶囊/高亮条样式）
 * - 同步状态：离线/同步中的小提示（登录后才有意义）
 * - 底部：退出登录（未登录时换成「登录」入口）
 * - 折叠：收起成 64px 的 icon rail（状态由 DefaultLayout 持有，宽度要一起变）
 */

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseBadge from '@/components/atoms/BaseBadge.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import AvatarUpload from '@/components/organisms/AvatarUpload.vue'
import { NAV_ITEMS } from '@/components/organisms/navItems'
import { useAvatar } from '@/composables/useAvatar'
import { useAuthStore } from '@/stores/authStore'
import { useTodoStore } from '@/stores/todoStore'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ (e: 'toggle-collapse'): void }>()

const authStore = useAuthStore()
const todoStore = useTodoStore()
const router = useRouter()

const avatarOpen = ref(false)
const { displayUrl, fallbackInitial, markImageFailed, loadLocalAvatar } = useAvatar()

// 未登录时本地头像也要能显示（IndexedDB 里可能存过一张）
void loadLocalAvatar()

const NAV_ACTIVE_CLASS =
  'bg-[var(--el-color-primary)] text-white hover:bg-[var(--el-color-primary)]'

/** 同步状态角标（只在登录后展示） */
const syncBadge = computed<{ tone: 'info' | 'warning' | 'success'; text: string } | null>(() => {
  if (!todoStore.syncUserId) return null
  if (todoStore.syncState === 'offline') return { tone: 'warning', text: '离线' }
  if (todoStore.syncState === 'syncing') return { tone: 'info', text: '同步中' }
  return { tone: 'success', text: '已同步' }
})

const identityHint = computed(() => {
  if (authStore.isAuthed) return authStore.email || '已登录'
  return authStore.isLocalMode ? '未配置 Supabase · 本地模式' : '未登录'
})

async function handleSignOut() {
  await authStore.signOut()
  // 本地任务缓存由 App.vue 监听登录态变化统一清理（deactivateCloud）
  await router.push({ name: 'login' })
}
</script>

<template>
  <aside
    data-testid="sidebar"
    class="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-md transition-[width] lg:flex dark:border-slate-800 dark:bg-slate-900/80"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <!-- 品牌（折叠时只留 emoji） -->
    <div class="flex items-center gap-2 px-4 pt-4">
      <span class="text-base leading-none">🧭</span>
      <span
        v-if="!collapsed"
        class="truncate text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100"
      >
        Vue 3 智能工作台
      </span>
    </div>

    <!-- 头像区 -->
    <div class="flex items-center gap-3 p-3">
      <button
        type="button"
        data-testid="sidebar-avatar"
        class="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-[var(--el-color-primary)]/30 transition-transform hover:scale-105"
        :title="authStore.isAuthed ? '更换头像' : '设置本地头像'"
        aria-label="更换头像"
        @click="avatarOpen = true"
      >
        <img
          v-if="displayUrl"
          :src="displayUrl"
          alt="用户头像"
          class="h-full w-full object-cover"
          @error="markImageFailed"
        />
        <span
          v-else
          class="flex h-full w-full items-center justify-center bg-[var(--el-color-primary)] text-sm font-semibold text-white"
        >
          {{ fallbackInitial }}
        </span>
      </button>

      <div v-if="!collapsed" class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {{ authStore.displayName }}
        </p>
        <p class="truncate text-xs text-slate-400 dark:text-slate-500">{{ identityHint }}</p>
      </div>
    </div>

    <!-- 导航 -->
    <nav class="mt-2 flex-1 space-y-1 px-2" aria-label="主导航">
      <router-link
        v-for="item in NAV_ITEMS"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        :active-class="item.name === 'dashboard' ? '' : NAV_ACTIVE_CLASS"
        :exact-active-class="NAV_ACTIVE_CLASS"
        :title="item.label"
        :data-testid="`sidebar-nav-${item.name}`"
      >
        <span class="text-base leading-none">{{ item.icon }}</span>
        <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
      </router-link>
    </nav>

    <!-- 同步状态 -->
    <div v-if="!collapsed && syncBadge" class="px-3 pb-1">
      <BaseBadge :tone="syncBadge.tone" size="sm">云同步 · {{ syncBadge.text }}</BaseBadge>
    </div>

    <!-- 底部：退出 / 登录 / 折叠 -->
    <div class="space-y-1 border-t border-slate-200 p-2 dark:border-slate-800">
      <BaseButton
        v-if="authStore.isAuthed"
        data-testid="sidebar-sign-out"
        variant="ghost"
        size="sm"
        class="w-full justify-start"
        @click="handleSignOut"
      >
        <span class="text-base leading-none">🚪</span>
        <span v-if="!collapsed">退出登录</span>
      </BaseButton>
      <router-link
        v-else
        :to="{ name: 'login' }"
        data-testid="sidebar-sign-in"
        class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span class="text-base leading-none">🔑</span>
        <span v-if="!collapsed">登录 / 注册</span>
      </router-link>

      <BaseButton
        data-testid="sidebar-collapse"
        variant="ghost"
        size="sm"
        class="w-full justify-start"
        :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="emit('toggle-collapse')"
      >
        <span class="text-base leading-none">{{ collapsed ? '»' : '«' }}</span>
        <span v-if="!collapsed">收起</span>
      </BaseButton>
    </div>
  </aside>

  <!--
    头像弹窗必须放在 <aside> **外面**（同级根节点，Vue 3 支持多根）：
    aside 上有 `backdrop-blur-md`，而带 backdrop-filter 的元素会成为
    `position: fixed` 后代的包含块 —— 弹窗留在里面时，遮罩/弹窗会被限制在
    240px 宽的侧边栏内，看起来就是"弹窗出现在侧边栏里"而不是页面中央。

    （替代方案是给 el-dialog 加 append-to-body 把节点传送到 body，
    但那样弹窗内容会脱离组件树，测试里就查不到内部节点了。）
  -->
  <AvatarUpload v-model="avatarOpen" />
</template>
