<script setup lang="ts">
import { onMounted } from 'vue'
import ListPanel from './features/lists/ListPanel.vue'
import ResultPanel from './features/recognition/ResultPanel.vue'
import UploadPanel from './features/recognition/UploadPanel.vue'
import { useAppStore } from './store/appStore'

const store = useAppStore()

onMounted(() => {
  void store.init()
})
</script>

<template>
  <main class="app-shell">
    <header class="app-header">
      <h1>整理前端面试题</h1>
      <p>图片识别（模拟）+ 去重 + 分类 + 本地题库管理</p>
    </header>

    <p v-if="store.state.message" class="notice success">{{ store.state.message }}</p>
    <p v-if="store.state.error" class="notice error">{{ store.state.error }}</p>

    <section class="layout">
      <ListPanel />
      <UploadPanel />
      <ResultPanel />
    </section>
  </main>
</template>
