<script setup lang="ts">
// 第一阶段占位视图：后续阶段将替换为 Dashboard/Settings
const techStack = ['Vue 3', 'TypeScript', 'Vite', 'Tailwind CSS', 'Element Plus']
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
    <h1 class="text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
      Vue 3 智能工作台
    </h1>
    <p class="text-slate-500 dark:text-slate-400">
      第一阶段：基础建设已完成 —— 工程骨架与代码规范就绪 ✅
    </p>
    <ul class="flex flex-wrap justify-center gap-2">
      <li
        v-for="item in techStack"
        :key="item"
        class="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-200"
      >
        {{ item }}
      </li>
    </ul>
  </main>
</template>
