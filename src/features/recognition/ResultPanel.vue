<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppStore } from '../../store/appStore'

const store = useAppStore()
const selectedListId = ref<string>('')

watch(
  () => store.state.targetListId,
  (next) => {
    selectedListId.value = next || store.state.myLists[0]?.id || ''
  },
  { immediate: true },
)

watch(
  () => store.state.myLists,
  (lists) => {
    if (!selectedListId.value && lists.length > 0) {
      selectedListId.value = lists[0].id
    }
  },
  { immediate: true },
)

async function onSave(): Promise<void> {
  await store.saveDraftsToList(selectedListId.value)
}
</script>

<template>
  <section class="panel">
    <h2 class="panel-title">识别结果</h2>
    <div class="row">
      <label class="check">
        <input
          type="checkbox"
          :checked="store.state.settings.syncToCategoryBankByDefault"
          @change="store.updateSyncToBankByDefault(($event.target as HTMLInputElement).checked)"
        />
        加入我的列表时默认同步到分类题库
      </label>
    </div>

    <div class="row">
      <select v-model="selectedListId" class="input">
        <option disabled value="">选择要加入的我的列表</option>
        <option v-for="list in store.state.myLists" :key="list.id" :value="list.id">
          {{ list.name }}
        </option>
      </select>
      <button class="button strong" @click="onSave">加入到我的列表</button>
      <button class="button subtle" @click="store.addEmptyDraft()">新增题目</button>
    </div>

    <div v-if="store.state.drafts.length === 0" class="empty">
      还没有识别结果，上传并识别后会在这里按分类展示。
    </div>

    <div v-for="group in store.groupedDrafts.value" :key="group.category" class="group">
      <h3 class="group-title">{{ group.category }}（{{ group.items.length }}）</h3>

      <article v-for="draft in group.items" :key="draft.id" class="draft-card">
        <textarea
          class="textarea"
          :value="draft.content"
          placeholder="输入或修改题目内容"
          @input="store.updateDraft(draft.id, { content: ($event.target as HTMLTextAreaElement).value })"
        />

        <div class="row">
          <input
            class="input"
            :value="draft.category"
            placeholder="分类"
            @input="store.updateDraft(draft.id, { category: ($event.target as HTMLInputElement).value })"
          />
          <button class="danger-text" @click="store.removeDraft(draft.id)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
