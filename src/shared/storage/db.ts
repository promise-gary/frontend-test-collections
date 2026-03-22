const DB_NAME = 'frontend-interview-db'
const DB_VERSION = 1

export const STORES = {
  questions: 'questions',
  lists: 'lists',
  listQuestionLinks: 'list_question_links',
  bankEntries: 'bank_entries',
  recognitionRuns: 'recognition_runs',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function createStores(db: IDBDatabase): void {
  const questionStore = db.createObjectStore(STORES.questions, { keyPath: 'id' })
  questionStore.createIndex('by_normalizedContent', 'normalizedContent', { unique: false })

  db.createObjectStore(STORES.lists, { keyPath: 'id' })

  const linksStore = db.createObjectStore(STORES.listQuestionLinks, { keyPath: 'id' })
  linksStore.createIndex('by_listId', 'listId', { unique: false })
  linksStore.createIndex('by_questionId', 'questionId', { unique: false })
  linksStore.createIndex('by_list_normalized', ['listId', 'normalizedContent'], { unique: true })

  const bankStore = db.createObjectStore(STORES.bankEntries, { keyPath: 'id' })
  bankStore.createIndex('by_category', 'category', { unique: false })
  bankStore.createIndex('by_questionId', 'questionId', { unique: false })
  bankStore.createIndex('by_category_normalized', ['category', 'normalizedContent'], { unique: true })

  db.createObjectStore(STORES.recognitionRuns, { keyPath: 'id' })
}

export async function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        createStores(db)
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  return dbPromise
}

export async function runTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await getDb()
  const tx = db.transaction(storeNames, mode)

  try {
    const result = await run(tx)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
      tx.onerror = () => reject(tx.error)
    })
    return result
  } catch (error) {
    tx.abort()
    throw error
  }
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllFromStore<T>(tx: IDBTransaction, storeName: string): Promise<T[]> {
  const store = tx.objectStore(storeName)
  return requestToPromise(store.getAll()) as Promise<T[]>
}
