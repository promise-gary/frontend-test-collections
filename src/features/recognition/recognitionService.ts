import { createId } from '../../shared/utils/id'
import { nowIso } from '../../shared/utils/time'
import { RecognitionRunRepository } from '../../shared/storage/repositories'
import type { ImageMeta, QuestionDraft, RecognitionRun } from '../../shared/types'
import type { RecognitionInput, RecognitionProvider } from './recognitionProvider'

export class RecognitionService {
  private readonly provider: RecognitionProvider
  private readonly runRepository: RecognitionRunRepository

  constructor(provider: RecognitionProvider, runRepository: RecognitionRunRepository) {
    this.provider = provider
    this.runRepository = runRepository
  }

  async recognize(file: File): Promise<{ run: RecognitionRun; drafts: QuestionDraft[] }> {
    const imageMeta: ImageMeta = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    }

    const pendingRun: RecognitionRun = {
      id: createId('run'),
      imageMeta,
      rawItems: [],
      status: 'pending',
      createdAt: nowIso(),
    }

    await this.runRepository.add(pendingRun)

    try {
      const drafts = await this.provider.recognize({ file, imageMeta } as RecognitionInput)
      const doneRun: RecognitionRun = {
        ...pendingRun,
        rawItems: drafts,
        status: 'done',
      }
      await this.runRepository.add(doneRun)
      return { run: doneRun, drafts }
    } catch (error) {
      const failedRun: RecognitionRun = {
        ...pendingRun,
        status: 'failed',
      }
      await this.runRepository.add(failedRun)
      throw error
    }
  }
}
