<script setup lang="ts">
/**
 * 分子组件：单个任务行
 * - 勾选完成：向左滑出 + 礼花，再通知父级（toggle）
 * - 删除：向右滑出，再通知父级（remove）
 * - 逾期标红 + 今日到期/截止日期徽章（dateFormatter）
 */

import { computed, onMounted, ref, watch } from 'vue'

import type { Todo } from '@/types/todo'
import { formatDueLabel, isOverdue, isToday } from '@/utils/dateFormatter'
import { isValidDateKey } from '@/utils/validation'
import { priorityLabel, priorityTone } from '@/utils/priorityHelper'
import BaseBadge from '@/components/atoms/BaseBadge.vue'
import BaseCheckbox from '@/components/atoms/BaseCheckbox.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'

const props = defineProps<{
  todo: Todo
  /** 是否展示截止日期徽章与逾期标红 */
  showDue?: boolean
  /** 完成时是否向左滑出（进行中视图下完成任务会从列表消失；全部视图下不滑出仅礼花） */
  completeSlide?: boolean
  /** 是否为刚撤销恢复的任务（从右滑入入场动画） */
  revealFromRight?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle', id: string): void
  (e: 'remove', id: string): void
}>()

const isDone = computed(() => props.todo.status === 'completed')
/** 截止日期是否存在且格式合法（拦截 6 位年份等畸形值） */
const hasValidDue = computed(
  () => props.showDue === true && !!props.todo.dueDate && isValidDateKey(props.todo.dueDate),
)
const overdue = computed(() => hasValidDue.value && !isDone.value && isOverdue(props.todo.dueDate!))
const dueToday = computed(() => hasValidDue.value && !isDone.value && isToday(props.todo.dueDate!))
const dueLabel = computed(() => (hasValidDue.value ? formatDueLabel(props.todo.dueDate!) : ''))

/** 动画状态：none | complete（左滑+礼花）| remove（右滑） */
type Anim = 'none' | 'complete' | 'remove'
const anim = ref<Anim>('none')
const celebrate = ref(false)

/** 从右滑入入场动画（撤销恢复） */
const revealing = ref(false)
const REVEAL_MS = 380
function reveal() {
  revealing.value = true
  setTimeout(() => {
    revealing.value = false
  }, REVEAL_MS)
}

// 撤销恢复：组件挂载时若已标记，播放一次；此后 revealFromRight 变 true 也播放
onMounted(() => {
  if (props.revealFromRight) reveal()
})
watch(
  () => props.revealFromRight,
  (val) => {
    if (val) reveal()
  },
)

const COMPLETE_MS = 550
const REMOVE_MS = 350

/** 完成动画触发后延迟 emit toggle（让滑出与礼花播完再移除该项） */
function onToggle() {
  if (anim.value !== 'none') return
  // 只有 未完成 -> 完成 才触发礼花（+ 进行中视图左滑）；已完成取消勾选直接恢复
  if (!isDone.value) {
    celebrate.value = true
    if (props.completeSlide) {
      // 进行中/需移除的场景：左滑 + 礼花，播完再 emit
      anim.value = 'complete'
      setTimeout(() => {
        emit('toggle', props.todo.id)
        anim.value = 'none'
        celebrate.value = false
      }, COMPLETE_MS)
    } else {
      // 全部视图：任务不消失，仅礼花，立即 emit，礼花自行消退
      emit('toggle', props.todo.id)
      setTimeout(() => {
        celebrate.value = false
      }, COMPLETE_MS)
    }
  } else {
    emit('toggle', props.todo.id)
  }
}

/** 删除动画触发后延迟 emit remove */
function onRemove() {
  if (anim.value !== 'none') return
  anim.value = 'remove'
  setTimeout(() => {
    emit('remove', props.todo.id)
    anim.value = 'none'
  }, REMOVE_MS)
}

// 礼花粒子参数
const colors = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899']
const particles = computed(() =>
  Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2
    return {
      color: colors[i % colors.length],
      tx: `${Math.cos(angle) * (60 + (i % 4) * 14)}px`,
      ty: `${Math.sin(angle) * (46 + (i % 3) * 12)}px`,
      delay: `${(i % 5) * 20}ms`,
    }
  }),
)
</script>

<template>
  <li
    class="group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-600"
    :class="[
      overdue ? 'border-rose-300 dark:border-rose-700' : '',
      anim === 'complete' ? 'anim-slide-left' : '',
      anim === 'remove' ? 'anim-slide-right' : '',
      revealing ? 'anim-reveal-right' : '',
    ]"
  >
    <!-- 礼花（完成时爆发） -->
    <span v-if="celebrate" class="popper" aria-hidden="true">
      <span
        v-for="(p, i) in particles"
        :key="i"
        class="particle"
        :style="{
          '--p-color': p.color,
          '--p-tx': p.tx,
          '--p-ty': p.ty,
          animationDelay: p.delay,
        }"
      />
    </span>

    <BaseCheckbox :model-value="isDone" aria-label="切换完成状态" @change="onToggle" />

    <div class="min-w-0 flex-1">
      <p
        class="truncate text-sm font-medium"
        :class="[
          isDone
            ? 'text-slate-400 line-through dark:text-slate-500'
            : 'text-slate-800 dark:text-slate-100',
          overdue ? 'text-rose-600 dark:text-rose-400' : '',
        ]"
      >
        {{ todo.title }}
      </p>
      <p v-if="hasValidDue" class="mt-0.5 flex items-center gap-1 text-xs">
        <BaseBadge :tone="overdue ? 'danger' : dueToday ? 'warning' : 'info'" size="xs">
          <template v-if="dueToday">📌 今日到期</template>
          <template v-else-if="overdue">⏰ 已逾期（{{ dueLabel }}）</template>
          <template v-else>{{ dueLabel }}</template>
        </BaseBadge>
      </p>
    </div>

    <BaseBadge :tone="priorityTone(todo.priority)" size="xs">
      {{ priorityLabel(todo.priority) }}优先级
    </BaseBadge>

    <BaseButton
      variant="ghost"
      size="sm"
      class="opacity-0 transition-opacity group-hover:opacity-100"
      aria-label="删除任务"
      @click="onRemove"
    >
      <svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path
          d="M6 1.75h4a.25.25 0 0 1 .25.25v1h-4.5V2a.25.25 0 0 1 .25-.25zM4.25 3v-.75A1.75 1.75 0 0 1 6 .5h4a1.75 1.75 0 0 1 1.75 1.75V3h2.75a.75.75 0 0 1 0 1.5h-.583L13.4 13a1.75 1.75 0 0 1-1.744 1.6H4.344A1.75 1.75 0 0 1 2.6 13L2.333 4.5h-.583a.75.75 0 0 1 0-1.5h2.5zm.836 1.5-.292 8.5a.25.25 0 0 0 .25.266h6.312a.25.25 0 0 0 .25-.266l-.292-8.5H5.086z"
        />
      </svg>
    </BaseButton>
  </li>
</template>

<style scoped>
/* 完成：向左滑出 + 渐隐 */
.anim-slide-left {
  animation: slide-out-left 0.55s ease-in forwards;
}
@keyframes slide-out-left {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-120%);
    opacity: 0;
  }
}

/* 删除：向右滑出 + 渐隐 */
.anim-slide-right {
  animation: slide-out-right 0.35s ease-in forwards;
}
@keyframes slide-out-right {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(120%);
    opacity: 0;
  }
}

/* 撤销恢复：从右滑入 */
.anim-reveal-right {
  animation: reveal-right 0.38s ease-out;
}
@keyframes reveal-right {
  from {
    transform: translateX(120%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 礼花容器与粒子 */
.popper {
  position: absolute;
  left: 50%;
  top: 50%;
  pointer-events: none;
}
.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: var(--p-color);
  animation: burst 0.55s ease-out forwards;
}
@keyframes burst {
  from {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  to {
    transform: translate(var(--p-tx), var(--p-ty)) scale(0.2);
    opacity: 0;
  }
}
</style>
