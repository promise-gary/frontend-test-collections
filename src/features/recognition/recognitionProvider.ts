import type { ImageMeta, QuestionDraft } from '../../shared/types'

export interface RecognitionInput {
  file: File
  imageMeta: ImageMeta
}

export interface RecognitionProvider {
  recognize(input: RecognitionInput): Promise<QuestionDraft[]>
}
