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
import BaseButton from '@/components/atoms/BaseButton.vue'

const props = withDefaults(
  defineProps<{
    todo: Todo
    /** 是否展示截止日期徽章与逾期标红 */
    showDue?: boolean
    /** 完成时是否向左滑出（进行中视图下完成任务会从列表消失；全部视图下不滑出仅礼花） */
    completeSlide?: boolean
    /** 是否为刚撤销恢复的任务（从右滑入入场动画） */
    revealFromRight?: boolean
    /** 是否为刚新建的任务（从左滑入入场动画） */
    enterFromLeft?: boolean
    /** 是否展示子任务清单 */
    showSubtasks?: boolean
    /** 是否处于多选模式（展示选择框） */
    selectable?: boolean
    /** 是否被选中（多选） */
    selected?: boolean
    /** 是否可拖拽排序 */
    draggable?: boolean
  }>(),
  {
    showDue: false,
    completeSlide: false,
    revealFromRight: false,
    enterFromLeft: false,
    showSubtasks: true,
    selectable: false,
    selected: false,
    draggable: false,
  },
)

const emit = defineEmits<{
  (e: 'toggle', id: string): void
  (e: 'remove', id: string): void
  (e: 'toggle-subtask', todoId: string, subtaskId: string): void
  (e: 'add-subtask', todoId: string, title: string): void
  (e: 'remove-subtask', todoId: string, subtaskId: string): void
  (e: 'toggle-pin', id: string): void
  (e: 'toggle-select', id: string): void
  (e: 'drag-start', id: string): void
  (e: 'drop-on', id: string): void
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
const REVEAL_MS = 600
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

/** 从左滑入入场动画（新建任务） */
const entering = ref(false)
const ENTER_MS = 600
function enter() {
  entering.value = true
  setTimeout(() => {
    entering.value = false
  }, ENTER_MS)
}

// 新建任务：挂载时若已标记，播放一次；此后 enterFromLeft 变 true 也播放
onMounted(() => {
  if (props.enterFromLeft) enter()
})
watch(
  () => props.enterFromLeft,
  (val) => {
    if (val) enter()
  },
)

const COMPLETE_MS = 750
const REMOVE_MS = 600

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

// ---- 子任务清单 ----
const subtaskTotal = computed(() => props.todo.subtasks.length)
const subtaskDone = computed(() => props.todo.subtasks.filter((s) => s.completed).length)
const subtaskProgress = computed(() =>
  subtaskTotal.value === 0 ? 0 : Math.round((subtaskDone.value / subtaskTotal.value) * 100),
)
/** 是否展开子任务列表（默认折叠，仅展示进度） */
const expandSubtasks = ref(false)
const newSubtask = ref('')

function toggleExpandSubtask() {
  expandSubtasks.value = !expandSubtasks.value
}

function onToggleSubtask(subtaskId: string) {
  emit('toggle-subtask', props.todo.id, subtaskId)
}

function onRemoveSubtask(subtaskId: string) {
  emit('remove-subtask', props.todo.id, subtaskId)
}

function onAddSubtask() {
  const title = newSubtask.value.trim()
  if (!title) return
  emit('add-subtask', props.todo.id, title)
  newSubtask.value = ''
}

// ---- 拖拽排序 ----
function onDragStart(ev: DragEvent) {
  if (!props.draggable) return
  ev.dataTransfer?.setData('text/plain', props.todo.id)
  ev.dataTransfer!.effectAllowed = 'move'
  emit('drag-start', props.todo.id)
}

function onDrop(ev: DragEvent) {
  ev.preventDefault()
  emit('drop-on', props.todo.id)
}
</script>

<template>
  <li
    class="group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-600"
    :class="[
      overdue ? 'border-rose-300 dark:border-rose-700' : '',
      anim === 'complete' ? 'anim-slide-left' : '',
      anim === 'remove' ? 'anim-slide-right' : '',
      revealing ? 'anim-reveal-right' : '',
      entering ? 'anim-enter-left' : '',
    ]"
    :draggable="draggable"
    @dragstart="onDragStart"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <!-- 拖拽把手（可拖拽时 hover 显示） -->
    <span
      v-if="draggable"
      class="drag-handle select-none text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
      aria-hidden="true"
      @dragstart.stop
    >
      ⠿
    </span>
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

    <!-- 多选模式的复选框（数据流由父级连接 store） -->
    <button
      v-if="selectable"
      type="button"
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors"
      :class="
        selected
          ? 'border-indigo-500 bg-indigo-500 text-white'
          : 'border-slate-300 text-transparent hover:border-indigo-400 dark:border-slate-600'
      "
      :aria-label="selected ? '取消选中' : '选中'"
      @click="emit('toggle-select', todo.id)"
    >
      <svg class="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.5l3 3 6-7"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

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

      <!-- 子任务清单（可折叠） -->
      <div v-if="showSubtasks" class="mt-1.5 space-y-1.5">
        <button
          v-if="subtaskTotal > 0"
          type="button"
          class="group flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
          @click="toggleExpandSubtask"
        >
          <span class="transition-transform" :class="expandSubtasks ? 'rotate-90' : ''">▶</span>
          <span>子任务 {{ subtaskDone }}/{{ subtaskTotal }}</span>
        </button>

        <!-- 进度条 -->
        <template v-if="subtaskTotal > 0">
          <div
            class="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
            aria-hidden="true"
          >
            <div
              class="h-full rounded-full bg-indigo-500 transition-all"
              :style="{ width: `${subtaskProgress}%` }"
            ></div>
          </div>

          <ul v-if="expandSubtasks" class="space-y-1">
            <li v-for="st in todo.subtasks" :key="st.id" class="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                class="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors"
                :class="
                  st.completed
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 hover:border-emerald-400 dark:border-slate-600'
                "
                :aria-label="st.completed ? '标记子任务未完成' : '标记子任务完成'"
                @click="onToggleSubtask(st.id)"
              >
                <svg class="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <span
                class="flex-1 truncate"
                :class="st.completed ? 'text-slate-400 line-through dark:text-slate-500' : ''"
                >{{ st.title }}</span
              >
              <button
                type="button"
                class="text-slate-300 hover:text-rose-500 dark:text-slate-600"
                aria-label="删除子任务"
                @click="onRemoveSubtask(st.id)"
              >
                ×
              </button>
            </li>
          </ul>
        </template>

        <!-- 添加子任务 -->
        <div class="flex items-center gap-1">
          <input
            v-if="expandSubtasks || subtaskTotal === 0"
            v-model="newSubtask"
            type="text"
            placeholder="添加子任务，回车…"
            class="w-full rounded-md border border-slate-200 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-slate-400 focus:border-indigo-400 dark:border-slate-600"
            @keydown.enter.prevent="onAddSubtask"
          />
          <button
            v-else
            type="button"
            class="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
            @click="expandSubtasks = true"
          >
            + 子任务
          </button>
        </div>
      </div>
    </div>

    <BaseBadge :tone="priorityTone(todo.priority)" size="xs">
      {{ priorityLabel(todo.priority) }}优先级
    </BaseBadge>

    <!-- 置顶（今日聚焦） -->
    <button
      type="button"
      class="shrink-0 text-base leading-none transition-transform"
      :class="
        todo.pinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500 dark:text-slate-600'
      "
      :aria-label="todo.pinned ? '取消置顶' : '置顶到今日聚焦'"
      @click="emit('toggle-pin', todo.id)"
    >
      📌
    </button>

    <!-- 行尾圆形完成按钮：未完成空心圆，已完成实心对勾 -->
    <button
      type="button"
      class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
      :class="
        isDone
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-slate-300 text-transparent hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-600'
      "
      :aria-label="isDone ? '标记为未完成' : '标记为已完成'"
      @click="onToggle"
    >
      <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.5l3 3 6-7"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

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
/* 拖拽把手 */
.drag-handle {
  cursor: grab;
}
.drag-handle:active {
  cursor: grabbing;
}

/* 完成：向左滑出 + 渐隐 */
.anim-slide-left {
  animation: slide-out-left 0.75s cubic-bezier(0.4, 0, 0.2, 1) forwards;
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
  animation: slide-out-right 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
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
  animation: reveal-right 0.6s cubic-bezier(0.4, 0, 0.2, 1);
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

/* 新建任务：从左滑入 */
.anim-enter-left {
  animation: enter-left 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes enter-left {
  from {
    transform: translateX(-120%);
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
  animation: burst 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards;
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
