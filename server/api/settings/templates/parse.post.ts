import { randomUUID } from 'node:crypto'
import { bindVariables } from '#shared/domain/templates'
import { docxText } from '../../../services/documents'

/** Step 4 of the template wizard: finds {variables} in an uploaded DOCX (or pasted text) and auto-binds them. */
export default defineEventHandler(async (event) => {
  const ctx = await requireAuth(event, 'settings')
  const ct = getRequestHeader(event, 'content-type') ?? ''
  if (ct.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const file = parts?.find(p => p.name === 'file' && p.filename)
    if (!file) throw createError({ statusCode: 422, statusMessage: 'Выберите файл DOCX' })
    const name = Buffer.from(file.filename!, 'latin1').toString('utf8')
    if (!name.toLowerCase().endsWith('.docx')) throw createError({ statusCode: 422, statusMessage: 'Загрузите файл DOCX. PDF можно вставить текстом — переменные в PDF не подставляются.' })
    let text: string
    try {
      text = docxText(file.data)
    }
    catch {
      throw createError({ statusCode: 422, statusMessage: 'Не удалось прочитать DOCX. Проверьте, что переменные записаны как {Имя} без форматирования внутри скобок.' })
    }
    const key = `org/${ctx.organizationId}/templates/${randomUUID()}.docx`
    await putFile(key, file.data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return { fileKey: key, fileName: name, text, variables: bindVariables(text) }
  }
  const { text } = await readBody<{ text?: string }>(event)
  if (!text?.trim()) throw createError({ statusCode: 422, statusMessage: 'Вставьте текст шаблона' })
  return { fileKey: null, fileName: null, text, variables: bindVariables(text) }
})
