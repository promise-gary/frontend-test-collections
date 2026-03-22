export function normalizeQuestionText(input: string): string {
  return input
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function normalizeCategory(input: string): string {
  const value = input.normalize('NFKC').trim().replace(/\s+/g, ' ')
  return value || '未分类'
}
