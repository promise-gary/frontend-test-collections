import { computed, reactive, readonly } from 'vue'
import { MockRecognitionProvider } from '../features/recognition/mockProvider'
import { RecognitionService } from '../features/recognition/recognitionService'
import {
  BankRepository,
  ListRepository,
  QuestionRepository,
  RecognitionRunRepository,
  SettingsRepository,
} from '../shared/storage/repositories'
import type {
  AppSettings,
  BankCategoryGroup,
  DeleteQuestionMode,
  MyList,
  QuestionDraft,
  QuestionItem,
} from '../shared/types'
import { createId } from '../shared/utils/id'
import { normalizeCategory, normalizeQuestionText } from '../shared/utils/normalizer'
import { nowIso } from '../shared/utils/time'

interface AppState {
  initialized: boolean
  loading: boolean
  isRecognizing: boolean
  myLists: MyList[]
  selectedListId: string | null
  selectedCategory: string | null
  currentListQuestions: QuestionItem[]
  bankGroups: BankCategoryGroup[]
  drafts: QuestionDraft[]
  pendingFile: File | null
  pendingPreviewUrl: string | null
  targetListId: string | null
  settings: AppSettings
  message: string
  error: string
}

const listRepository = new ListRepository()
const questionRepository = new QuestionRepository()
const bankRepository = new BankRepository()
const runRepository = new RecognitionRunRepository()
const settingsRepository = new SettingsRepository()
const recognitionService = new RecognitionService(new MockRecognitionProvider(), runRepository)

const state = reactive<AppState>({
  initialized: false,
  loading: false,
  isRecognizing: false,
  myLists: [],
  selectedListId: null,
  selectedCategory: null,
  currentListQuestions: [],
  bankGroups: [],
  drafts: [],
  pendingFile: null,
  pendingPreviewUrl: null,
  targetListId: null,
  settings: settingsRepository.get(),
  message: '',
  error: '',
})

const selectedList = computed(() => {
  if (!state.selectedListId) {
    return null
  }
  return state.myLists.find((list) => list.id === state.selectedListId) || null
})

const selectedBankGroup = computed(() => {
  if (!state.selectedCategory) {
    return null
  }
  return state.bankGroups.find((group) => group.category === state.selectedCategory) || null
})

const groupedDrafts = computed(() => {
  const grouped = new Map<string, QuestionDraft[]>()
  state.drafts.forEach((draft) => {
    const category = normalizeCategory(draft.category)
    const list = grouped.get(category) || []
    list.push({ ...draft, category })
    grouped.set(category, list)
  })

  return [...grouped.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category, 'zh-CN'))
})

function setMessage(message: string): void {
  state.message = message
  state.error = ''
}

function setError(message: string): void {
  state.error = message
  state.message = ''
}

function clearNotice(): void {
  state.error = ''
  state.message = ''
}

async function refreshListsAndViews(): Promise<void> {
  state.myLists = await listRepository.getLists()

  if (!state.selectedListId && state.myLists.length > 0) {
    state.selectedListId = state.myLists[0].id
  }

  if (state.selectedListId && !state.myLists.find((list) => list.id === state.selectedListId)) {
    state.selectedListId = state.myLists[0]?.id || null
  }

  await refreshCurrentListQuestions()
}

async function refreshCurrentListQuestions(): Promise<void> {
  if (!state.selectedListId) {
    state.currentListQuestions = []
    return
  }

  const links = await listRepository.getLinksForList(state.selectedListId)
  const questions = await questionRepository.getByIds(links.map((link) => link.questionId))
  const questionMap = new Map(questions.map((question) => [question.id, question]))

  state.currentListQuestions = links
    .map((link) => questionMap.get(link.questionId))
    .filter(Boolean) as QuestionItem[]
}

async function refreshBankGroups(): Promise<void> {
  state.bankGroups = await bankRepository.getGrouped()

  if (state.selectedCategory && !state.bankGroups.find((group) => group.category === state.selectedCategory)) {
    state.selectedCategory = null
  }
}

function setPendingImage(file: File): void {
  if (!file.type.startsWith('image/')) {
    setError('仅支持图片文件。')
    return
  }

  if (state.pendingPreviewUrl) {
    URL.revokeObjectURL(state.pendingPreviewUrl)
  }

  state.pendingFile = file
  state.pendingPreviewUrl = URL.createObjectURL(file)
  clearNotice()
}

function clearPendingImage(): void {
  if (state.pendingPreviewUrl) {
    URL.revokeObjectURL(state.pendingPreviewUrl)
  }

  state.pendingFile = null
  state.pendingPreviewUrl = null
}

async function init(): Promise<void> {
  if (state.initialized) {
    return
  }

  state.loading = true
  clearNotice()

  try {
    state.settings = settingsRepository.get()
    await refreshListsAndViews()
    await refreshBankGroups()

    const latestRun = await runRepository.getLatest()
    if (latestRun?.status === 'done') {
      state.drafts = latestRun.rawItems
    }

    state.initialized = true
  } catch {
    setError('初始化失败，请刷新页面重试。')
  } finally {
    state.loading = false
  }
}

async function createMyList(name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) {
    setError('列表名称不能为空。')
    return
  }

  await listRepository.createList(trimmed)
  await refreshListsAndViews()
  state.targetListId = state.selectedListId
  setMessage('列表已创建。')
}

async function deleteMyList(listId: string): Promise<void> {
  await listRepository.deleteList(listId)
  if (state.targetListId === listId) {
    state.targetListId = null
  }
  await refreshListsAndViews()
  setMessage('列表已删除。')
}

async function selectList(listId: string): Promise<void> {
  state.selectedListId = listId
  state.selectedCategory = null
  await refreshCurrentListQuestions()
}

function selectCategory(category: string): void {
  state.selectedCategory = category
}

function updateDraft(draftId: string, patch: Partial<Pick<QuestionDraft, 'content' | 'category'>>): void {
  state.drafts = state.drafts.map((draft) => {
    if (draft.id !== draftId) {
      return draft
    }

    return {
      ...draft,
      ...patch,
      category: patch.category ? normalizeCategory(patch.category) : draft.category,
    }
  })
}

function removeDraft(draftId: string): void {
  state.drafts = state.drafts.filter((draft) => draft.id !== draftId)
}

function addEmptyDraft(category = '未分类'): void {
  state.drafts = [
    ...state.drafts,
    {
      id: createId('draft'),
      content: '',
      category,
    },
  ]
}

async function recognizeCurrentImage(): Promise<void> {
  if (!state.pendingFile) {
    setError('请先上传一张图片。')
    return
  }

  state.isRecognizing = true
  clearNotice()

  try {
    const result = await recognitionService.recognize(state.pendingFile)
    state.drafts = result.drafts
    setMessage(`识别完成，共 ${result.drafts.length} 条题目。`)
  } catch {
    setError('识别失败，请稍后重试。')
  } finally {
    state.isRecognizing = false
  }
}

async function saveDraftsToList(listId: string): Promise<void> {
  if (!listId) {
    setError('请选择要加入的列表。')
    return
  }

  const validDrafts = state.drafts
    .map((draft) => ({
      ...draft,
      content: draft.content.trim(),
      category: normalizeCategory(draft.category),
    }))
    .filter((draft) => draft.content)

  if (validDrafts.length === 0) {
    setError('没有可保存的题目。')
    return
  }

  const existingLinks = await listRepository.getLinksForList(listId)
  const existedSet = new Set(existingLinks.map((link) => link.normalizedContent))

  let addedCount = 0
  for (const draft of validDrafts) {
    const normalizedContent = normalizeQuestionText(draft.content)
    if (existedSet.has(normalizedContent)) {
      continue
    }

    const now = nowIso()
    const question: QuestionItem = {
      id: createId('question'),
      content: draft.content,
      category: draft.category,
      normalizedContent,
      sourceRunId: 'local-run',
      createdAt: now,
      updatedAt: now,
    }

    await questionRepository.upsert(question)
    const linked = await listRepository.addQuestionToList(listId, question.id, question.content)

    if (!linked) {
      continue
    }

    existedSet.add(normalizedContent)
    addedCount += 1

    if (state.settings.syncToCategoryBankByDefault) {
      await bankRepository.add(question)
    }
  }

  state.targetListId = listId
  await refreshCurrentListQuestions()
  await refreshBankGroups()

  if (addedCount === 0) {
    setMessage('未新增题目（目标列表内已存在重复项）。')
  } else {
    setMessage(`已加入 ${addedCount} 条题目。`)
  }
}

async function removeQuestionFromCurrentList(questionId: string, mode: DeleteQuestionMode): Promise<void> {
  if (!state.selectedListId) {
    return
  }

  await listRepository.removeQuestionFromList(state.selectedListId, questionId)

  if (mode === 'list_and_bank') {
    const remainingLinks = await listRepository.getLinksByQuestion(questionId)
    if (remainingLinks.length === 0) {
      await bankRepository.removeByQuestionId(questionId)
      await questionRepository.deleteById(questionId)
    }
  }

  await refreshCurrentListQuestions()
  await refreshBankGroups()
  setMessage('题目已移除。')
}

function updateSyncToBankByDefault(next: boolean): void {
  state.settings = {
    ...state.settings,
    syncToCategoryBankByDefault: next,
  }
  settingsRepository.set(state.settings)
  setMessage('已更新默认入库设置。')
}

export function useAppStore() {
  return {
    state: readonly(state),
    selectedList,
    selectedBankGroup,
    groupedDrafts,
    init,
    createMyList,
    deleteMyList,
    selectList,
    selectCategory,
    setPendingImage,
    clearPendingImage,
    recognizeCurrentImage,
    updateDraft,
    removeDraft,
    addEmptyDraft,
    saveDraftsToList,
    removeQuestionFromCurrentList,
    updateSyncToBankByDefault,
    clearNotice,
  }
}
