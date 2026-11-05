import { parseOfferText } from '#shared/domain/offerImport'
import { accessibleDeal } from '../../../services/access'
import { offerExtractor } from '../../../providers/ai'

/** «Импорт варианта»: text/link (parsed locally) or a screenshot/PDF (Claude vision when configured). Returns a draft to check in the form. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'package')
  await accessibleDeal(ctx, getRouterParam(event, 'id')!)
  const ct = getRequestHeader(event, 'content-type') ?? ''
  if (ct.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const file = parts?.find(p => p.name === 'file' && p.filename)
    if (!file) throw createError({ statusCode: 422, statusMessage: 'Выберите скриншот или PDF' })
    const type = file.type ?? ''
    if (!/^image\/(png|jpeg|webp|gif)$/.test(type) && type !== 'application/pdf') throw createError({ statusCode: 422, statusMessage: 'Поддерживаются PNG, JPG, WEBP и PDF' })
    if (file.data.length > 10 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Файл больше 10 МБ' })
    const extractor = offerExtractor()
    const draft = await extractor.extract({ data: file.data, mediaType: type })
    return { draft, source: extractor.name, message: draft ? null : extractor.name === 'mock' ? 'Распознавание скриншотов включается ключом ANTHROPIC_API_KEY. Заполните поля вручную.' : 'Не удалось распознать — проверьте поля вручную.' }
  }
  const { text } = await readBody<{ text?: string }>(event)
  if (!text?.trim()) throw createError({ statusCode: 422, statusMessage: 'Вставьте текст или ссылку' })
  return { draft: parseOfferText(text), source: 'text', message: null }
})
