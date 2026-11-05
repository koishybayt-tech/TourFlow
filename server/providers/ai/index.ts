import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { OfferDraftSchema, type OfferDraft } from '#shared/domain/offerImport'

/**
 * AI extraction of tour offers from screenshots/PDFs (Claude vision).
 * Enabled when ANTHROPIC_API_KEY is set; otherwise the mock asks the manager to fill the form.
 */
export interface OfferExtractor {
  name: string
  extract(file: { data: Buffer, mediaType: string }): Promise<OfferDraft | null>
}

const mock: OfferExtractor = {
  name: 'mock',
  async extract() {
    return null
  },
}

const PROMPT = `Это скриншот или PDF предложения туроператора для турагентства в Казахстане.
Извлеки поля предложения. Даты — в формате YYYY-MM-DD. Цена — за весь состав в тенге целым числом; если цена в другой валюте, верни null.
Если поля нет на изображении — верни null, не придумывай.`

let client: Anthropic | null = null

const claude: OfferExtractor = {
  name: 'claude',
  async extract({ data, mediaType }) {
    client ??= new Anthropic()
    const source = mediaType === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: data.toString('base64') } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: data.toString('base64') } }
    try {
      const response = await client.beta.messages.parse({
        model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: betaZodOutputFormat(OfferDraftSchema) },
        messages: [{ role: 'user', content: [source, { type: 'text', text: PROMPT }] }],
      })
      if (response.stop_reason === 'refusal') return null
      return response.parsed_output ?? null
    }
    catch (e) {
      if (e instanceof Anthropic.APIError) {
        console.error(`Claude API error ${e.status}: ${e.message}`)
        throw createError({ statusCode: 502, statusMessage: 'Не удалось распознать скриншот. Заполните форму вручную' })
      }
      throw e
    }
  },
}

export function offerExtractor(): OfferExtractor {
  return process.env.ANTHROPIC_API_KEY ? claude : mock
}
