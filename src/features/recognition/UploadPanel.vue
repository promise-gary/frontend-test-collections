<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '../../store/appStore'

const store = useAppStore()
const fileInputRef = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

function pickFirstImage(files: FileList | null): File | null {
  if (!files || files.length === 0) {
    return null
  }
  return Array.from(files).find((file) => file.type.startsWith('image/')) || null
}

function onFileChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = pickFirstImage(target.files)
  if (file) {
    store.setPendingImage(file)
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  dragOver.value = false
  const file = pickFirstImage(event.dataTransfer?.files || null)
  if (file) {
    store.setPendingImage(file)
  }
}

function onPaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items || []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        store.setPendingImage(file)
      }
      break
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
})
</script>

<template>
  <section class="panel">
    <h2 class="panel-title">上传区域</h2>
    <p class="helper">
      支持粘贴、拖拽、选择图片（单张主链路，结构已预留扩展）。
    </p>

    <div
      class="dropzone"
      :class="{ dragging: dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop="onDrop"
    >
      <p class="drop-text">拖拽图片到这里，或使用下方按钮选择文件</p>
      <button class="button" @click="fileInputRef?.click()">选择图片</button>
      <input
        ref="fileInputRef"
        class="hidden"
        type="file"
        accept="image/*"
        @change="onFileChange"
      />
    </div>

    <div v-if="store.state.pendingFile" class="preview">
      <p class="helper">
        当前图片：{{ store.state.pendingFile.name }}（{{ Math.round(store.state.pendingFile.size / 1024) }}KB）
      </p>
      <img
        v-if="store.state.pendingPreviewUrl"
        :src="store.state.pendingPreviewUrl"
        alt="preview"
        class="preview-image"
      />
      <div class="row">
        <button class="button strong" :disabled="store.state.isRecognizing" @click="store.recognizeCurrentImage">
          {{ store.state.isRecognizing ? '识别中...' : '开始识别' }}
        </button>
        <button class="button subtle" @click="store.clearPendingImage">清空</button>
      </div>
    </div>
  </section>
</template>
