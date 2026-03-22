import {
  type AppSettings,
  type BankCategoryGroup,
  type BankEntry,
  type ListQuestionLink,
  type MyList,
  type QuestionItem,
  type RecognitionRun,
} from '../types'
import { createId } from '../utils/id'
import { normalizeCategory, normalizeQuestionText } from '../utils/normalizer'
import { nowIso } from '../utils/time'
import { getAllFromStore, requestToPromise, runTransaction, STORES } from './db'

const SETTINGS_KEY = 'frontend_interview_settings'

const defaultSettings: AppSettings = {
  syncToCategoryBankByDefault: true,
}

export class SettingsRepository {
  get(): AppSettings {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return defaultSettings
    }

    try {
      return { ...defaultSettings, ...JSON.parse(raw) }
    } catch {
      return defaultSettings
    }
  }

  set(next: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }
}

export class QuestionRepository {
  async upsert(question: QuestionItem): Promise<void> {
    await runTransaction([STORES.questions], 'readwrite', async (tx) => {
      await requestToPromise(tx.objectStore(STORES.questions).put(question))
    })
  }

  async getById(id: string): Promise<QuestionItem | undefined> {
    return runTransaction([STORES.questions], 'readonly', async (tx) => {
      const result = await requestToPromise(tx.objectStore(STORES.questions).get(id))
      return result as QuestionItem | undefined
    })
  }

  async getByIds(ids: string[]): Promise<QuestionItem[]> {
    if (ids.length === 0) {
      return []
    }

    return runTransaction([STORES.questions], 'readonly', async (tx) => {
      const store = tx.objectStore(STORES.questions)
      const rows = await Promise.all(ids.map((id) => requestToPromise(store.get(id))))
      return rows.filter(Boolean) as QuestionItem[]
    })
  }

  async listAll(): Promise<QuestionItem[]> {
    return runTransaction([STORES.questions], 'readonly', async (tx) => {
      return getAllFromStore<QuestionItem>(tx, STORES.questions)
    })
  }

  async deleteById(id: string): Promise<void> {
    await runTransaction([STORES.questions], 'readwrite', async (tx) => {
      await requestToPromise(tx.objectStore(STORES.questions).delete(id))
    })
  }
}

export class ListRepository {
  async getLists(): Promise<MyList[]> {
    return runTransaction([STORES.lists], 'readonly', async (tx) => {
      const rows = await getAllFromStore<MyList>(tx, STORES.lists)
      return rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    })
  }

  async createList(name: string): Promise<MyList> {
    const list: MyList = {
      id: createId('list'),
      name: name.trim(),
      createdAt: nowIso(),
    }

    await runTransaction([STORES.lists], 'readwrite', async (tx) => {
      await requestToPromise(tx.objectStore(STORES.lists).add(list))
    })

    return list
  }

  async deleteList(listId: string): Promise<void> {
    await runTransaction([STORES.lists, STORES.listQuestionLinks], 'readwrite', async (tx) => {
      await requestToPromise(tx.objectStore(STORES.lists).delete(listId))

      const linksStore = tx.objectStore(STORES.listQuestionLinks)
      const links = await requestToPromise(
        linksStore.index('by_listId').getAll(IDBKeyRange.only(listId)),
      )

      await Promise.all(
        (links as ListQuestionLink[]).map((link) => requestToPromise(linksStore.delete(link.id))),
      )
    })
  }

  async getLinksForList(listId: string): Promise<ListQuestionLink[]> {
    return runTransaction([STORES.listQuestionLinks], 'readonly', async (tx) => {
      const links = await requestToPromise(
        tx.objectStore(STORES.listQuestionLinks).index('by_listId').getAll(IDBKeyRange.only(listId)),
      )
      return (links as ListQuestionLink[]).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    })
  }

  async getLinksByQuestion(questionId: string): Promise<ListQuestionLink[]> {
    return runTransaction([STORES.listQuestionLinks], 'readonly', async (tx) => {
      const links = await requestToPromise(
        tx
          .objectStore(STORES.listQuestionLinks)
          .index('by_questionId')
          .getAll(IDBKeyRange.only(questionId)),
      )
      return links as ListQuestionLink[]
    })
  }

  async addQuestionToList(listId: string, questionId: string, questionContent: string): Promise<boolean> {
    const normalizedContent = normalizeQuestionText(questionContent)

    return runTransaction([STORES.listQuestionLinks], 'readwrite', async (tx) => {
      const linksStore = tx.objectStore(STORES.listQuestionLinks)
      const dupRequest = linksStore
        .index('by_list_normalized')
        .get(IDBKeyRange.only([listId, normalizedContent]))
      const existing = (await requestToPromise(dupRequest)) as ListQuestionLink | undefined
      if (existing) {
        return false
      }

      const link: ListQuestionLink = {
        id: createId('link'),
        listId,
        questionId,
        normalizedContent,
        createdAt: nowIso(),
      }

      await requestToPromise(linksStore.add(link))
      return true
    })
  }

  async removeQuestionFromList(listId: string, questionId: string): Promise<void> {
    await runTransaction([STORES.listQuestionLinks], 'readwrite', async (tx) => {
      const linksStore = tx.objectStore(STORES.listQuestionLinks)
      const links = (await requestToPromise(
        linksStore.index('by_listId').getAll(IDBKeyRange.only(listId)),
      )) as ListQuestionLink[]

      const target = links.find((link) => link.questionId === questionId)
      if (!target) {
        return
      }

      await requestToPromise(linksStore.delete(target.id))
    })
  }
}

export class BankRepository {
  async add(question: QuestionItem): Promise<void> {
    const normalizedCategory = normalizeCategory(question.category)

    await runTransaction([STORES.bankEntries], 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.bankEntries)
      const existing = (await requestToPromise(
        store.index('by_category_normalized').get([normalizedCategory, question.normalizedContent]),
      )) as BankEntry | undefined

      const now = nowIso()
      if (existing) {
        const updated: BankEntry = {
          ...existing,
          questionId: question.id,
          contentSnapshot: question.content,
          updatedAt: now,
        }
        await requestToPromise(store.put(updated))
        return
      }

      const entry: BankEntry = {
        id: createId('bank'),
        questionId: question.id,
        category: normalizedCategory,
        normalizedContent: question.normalizedContent,
        contentSnapshot: question.content,
        createdAt: now,
        updatedAt: now,
      }

      await requestToPromise(store.add(entry))
    })
  }

  async removeByQuestionId(questionId: string): Promise<void> {
    await runTransaction([STORES.bankEntries], 'readwrite', async (tx) => {
      const store = tx.objectStore(STORES.bankEntries)
      const entries = (await requestToPromise(
        store.index('by_questionId').getAll(IDBKeyRange.only(questionId)),
      )) as BankEntry[]

      await Promise.all(entries.map((entry) => requestToPromise(store.delete(entry.id))))
    })
  }

  async getGrouped(): Promise<BankCategoryGroup[]> {
    return runTransaction([STORES.bankEntries], 'readonly', async (tx) => {
      const rows = await getAllFromStore<BankEntry>(tx, STORES.bankEntries)
      const grouped = new Map<string, BankEntry[]>()

      rows.forEach((entry) => {
        const items = grouped.get(entry.category) || []
        items.push(entry)
        grouped.set(entry.category, items)
      })

      return [...grouped.entries()]
        .map(([category, items]) => ({ category, count: items.length, items }))
        .sort((a, b) => a.category.localeCompare(b.category, 'zh-CN'))
    })
  }
}

export class RecognitionRunRepository {
  async add(run: RecognitionRun): Promise<void> {
    await runTransaction([STORES.recognitionRuns], 'readwrite', async (tx) => {
      await requestToPromise(tx.objectStore(STORES.recognitionRuns).put(run))
    })
  }

  async getLatest(): Promise<RecognitionRun | undefined> {
    return runTransaction([STORES.recognitionRuns], 'readonly', async (tx) => {
      const rows = await getAllFromStore<RecognitionRun>(tx, STORES.recognitionRuns)
      if (rows.length === 0) {
        return undefined
      }
      return rows.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0]
    })
  }
}
