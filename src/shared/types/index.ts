export type ID = string

export interface QuestionItem {
  id: ID
  content: string
  category: string
  normalizedContent: string
  sourceRunId: ID
  createdAt: string
  updatedAt: string
}

export interface QuestionDraft {
  id: ID
  content: string
  category: string
}

export interface MyList {
  id: ID
  name: string
  createdAt: string
}

export interface ListQuestionLink {
  id: ID
  listId: ID
  questionId: ID
  normalizedContent: string
  createdAt: string
}

export interface BankEntry {
  id: ID
  questionId: ID
  category: string
  normalizedContent: string
  contentSnapshot: string
  createdAt: string
  updatedAt: string
}

export interface ImageMeta {
  name: string
  size: number
  type: string
  lastModified: number
}

export type RecognitionStatus = 'pending' | 'done' | 'failed'

export interface RecognitionRun {
  id: ID
  imageMeta: ImageMeta
  rawItems: QuestionDraft[]
  status: RecognitionStatus
  createdAt: string
}

export interface AppSettings {
  syncToCategoryBankByDefault: boolean
  preferredModelConfig?: {
    baseUrl?: string
    model?: string
    apiKey?: string
  }
}

export type DeleteQuestionMode = 'list_only' | 'list_and_bank'

export interface BankCategoryGroup {
  category: string
  count: number
  items: BankEntry[]
}
