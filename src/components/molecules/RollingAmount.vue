<script setup lang="ts">
/**
 * 分子组件：逐位滚动的金额（odometer 效果）
 *
 * 把已格式化的金额串（如 `1,234.56`）按位拆开：数字位交给 DigitRoll 上滑滚动，
 * 千分位逗号与小数点原样静态显示；另附一份 sr-only 的完整金额供读屏（滚动列对读屏不友好）。
 *
 * 位序 key 的规则见 `utils/amountDigits.ts`。
 */

import { computed } from 'vue'

import DigitRoll from '@/components/atoms/DigitRoll.vue'
import { toAmountCells } from '@/utils/amountDigits'

const props = defineProps<{
  /** 已格式化的金额串（不含货币符号），如 '1,234.56' */
  value: string
}>()

const cells = computed(() => toAmountCells(props.value))
</script>

<template>
  <span class="inline-flex items-baseline">
    <template v-for="cell in cells" :key="cell.key">
      <DigitRoll v-if="cell.rolling" :digit="cell.char" />
      <span v-else>{{ cell.char }}</span>
    </template>
    <span class="sr-only">{{ value }}</span>
  </span>
</template>
