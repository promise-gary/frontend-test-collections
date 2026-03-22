<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../../store/appStore'
import type { DeleteQuestionMode } from '../../shared/types'

const store = useAppStore()
const newListName = ref('')

async function onCreateList(): Promise<void> {
  await store.createMyList(newListName.value)
  newListName.value = ''
}

async function onDeleteList(listId: string): Promise<void> {
  const confirmed = window.confirm('确认删除该列表吗？仅会删除列表关联，不会清空分类题库。')
  if (!confirmed) {
    return
  }
  await store.deleteMyList(listId)
}

async function onRemoveQuestion(questionId: string): Promise<void> {
  const choice = window.prompt(
    '删除模式：输入 1 仅从当前列表移除；输入 2 同时尝试从分类题库移除（若该题被其他列表引用则保留）。',
    '1',
  )

  if (!choice) {
    return
  }

  const mode: DeleteQuestionMode = choice.trim() === '2' ? 'list_and_bank' : 'list_only'
  await store.removeQuestionFromCurrentList(questionId, mode)
}
</script>

<template>
  <section class="panel">
    <h2 class="panel-title">我的列表</h2>
    <div class="row">
      <input
        v-model="newListName"
        class="input"
        type="text"
        placeholder="新建列表名称"
        @keyup.enter="onCreateList"
      />
      <button class="button" @click="onCreateList">创建</button>
    </div>

    <ul class="list">
      <li v-for="list in store.state.myLists" :key="list.id" class="list-item">
        <button
          class="link-button"
          :class="{ active: store.state.selectedListId === list.id }"
          @click="store.selectList(list.id)"
        >
          {{ list.name }}
        </button>
        <button class="danger-text" @click="onDeleteList(list.id)">删除</button>
      </li>
    </ul>

    <h2 class="panel-title mt">分类列表（题库）</h2>
    <ul class="list">
      <li v-for="group in store.state.bankGroups" :key="group.category" class="list-item">
        <button
          class="link-button"
          :class="{ active: store.state.selectedCategory === group.category }"
          @click="store.selectCategory(group.category)"
        >
          {{ group.category }}（{{ group.count }}）
        </button>
      </li>
    </ul>

    <div v-if="store.state.selectedListId" class="detail">
      <h3 class="detail-title">
        当前列表题目（{{ store.state.currentListQuestions.length }}）
      </h3>
      <ul class="question-list">
        <li
          v-for="question in store.state.currentListQuestions"
          :key="question.id"
          class="question-item"
        >
          <div class="question-category">{{ question.category }}</div>
          <p class="question-text">{{ question.content }}</p>
          <button class="danger-text" @click="onRemoveQuestion(question.id)">移除</button>
        </li>
      </ul>
    </div>

    <div v-if="store.selectedBankGroup.value" class="detail">
      <h3 class="detail-title">
        题库分类：{{ store.selectedBankGroup.value.category }}
      </h3>
      <ul class="question-list">
        <li
          v-for="entry in store.selectedBankGroup.value.items"
          :key="entry.id"
          class="question-item"
        >
          <p class="question-text">{{ entry.contentSnapshot }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
