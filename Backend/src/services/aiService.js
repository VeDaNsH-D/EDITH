import OpenAI from 'openai'
import { env } from '../config/env.js'

const client = env.openAiApiKey
  ? new OpenAI({ apiKey: env.openAiApiKey })
  : null

export const askEdiAssistant = async ({ question, context }) => {
  if (!client) {
    return {
      answer:
        'edith AI copilot is running in fallback mode. Add OPENAI_API_KEY in Render env to enable contextual LLM explanations.',
    }
  }

  const systemPrompt = `You are edith, a healthcare X12 EDI copilot. Explain 837/835/834 validation issues in plain English.
Always mention segment IDs and element positions when available.
Keep guidance actionable and concise.`

  const response = await client.responses.create({
    model: env.openAiModel,
    input: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Question: ${question}\n\nContext JSON:\n${JSON.stringify(context).slice(0, 12000)}`,
      },
    ],
  })

  return {
    answer: response.output_text || 'No response generated.',
  }
}
