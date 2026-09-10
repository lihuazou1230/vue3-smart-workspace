<script setup lang="ts">
/**
 * 原子组件：单个滚动数字位（odometer）
 *
 * 结构：`.digit-window`（高 1em + overflow:hidden）里放 0-9 纵向一列 `.digit-strip`，
 * 用 `translateY(-n × 1em)` 把第 n 个数字停在窗口里，位移变化由 CSS transition 完成上滑。
 *
 * 「只让变化的位滚动」是天然成立的：未变化的位 transform 目标值不变，CSS 过渡不会触发；
 * 因此不需要新旧的逐位对比逻辑。等宽与 reduced-motion 降级在 custom.css 里统一处理。
 */

import { computed } from 'vue'

const props = defineProps<{
  /** 要展示的数字字符 '0'~'9' */
  digit: string | number
}>()

const index = computed(() => {
  const n = Number(props.digit)
  return Number.isInteger(n) && n >= 0 && n <= 9 ? n : 0
})

const stripStyle = computed(() => ({ transform: `translateY(-${index.value}em)` }))
</script>

<template>
  <span class="digit-window" aria-hidden="true">
    <span class="digit-strip" :style="stripStyle">
      <span v-for="n in 10" :key="n" class="block h-[1em] leading-none">{{ n - 1 }}</span>
    </span>
  </span>
</template>
