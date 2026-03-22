import type { QuestionDraft } from '../../shared/types'
import { createId } from '../../shared/utils/id'
import { normalizeCategory } from '../../shared/utils/normalizer'
import type { RecognitionInput, RecognitionProvider } from './recognitionProvider'

const SAMPLE_BANK: Array<Array<{ content: string; category: string }>> = [
  [
    { content: '谈谈事件循环（Event Loop）在浏览器中的执行顺序。', category: 'JavaScript' },
    { content: 'Promise、async/await 的错误处理方式有哪些？', category: 'JavaScript' },
    { content: '闭包在业务中的典型使用场景和风险是什么？', category: 'JavaScript' },
  ],
  [
    { content: 'BFC 是什么？如何触发？解决了哪些布局问题？', category: 'CSS' },
    { content: 'Flex 与 Grid 的适用场景如何取舍？', category: 'CSS' },
    { content: '如何实现移动端 1px 细线方案？', category: 'CSS' },
  ],
  [
    { content: 'Vue3 响应式系统与 Vue2 的核心差异是什么？', category: 'Vue' },
    { content: '你如何设计一个可复用的组合式函数（Composable）？', category: 'Vue' },
    { content: '组件通信方案在复杂页面中的选型依据是什么？', category: '工程化' },
  ],
]

function pickSampleIndex(fileName: string): number {
  let hash = 0
  for (const char of fileName) {
    hash += char.charCodeAt(0)
  }
  return hash % SAMPLE_BANK.length
}

export class MockRecognitionProvider implements RecognitionProvider {
  async recognize(input: RecognitionInput): Promise<QuestionDraft[]> {
    await new Promise((resolve) => setTimeout(resolve, 500))

    const index = pickSampleIndex(input.imageMeta.name || input.file.name || 'default')
    return SAMPLE_BANK[index].map((item) => ({
      id: createId('draft'),
      content: item.content,
      category: normalizeCategory(item.category),
    }))
  }
}
