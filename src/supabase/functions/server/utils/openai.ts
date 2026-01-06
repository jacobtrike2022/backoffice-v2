import OpenAI from 'npm:openai';

const apiKey = Deno.env.get('OPENAI_API_KEY');

if (!apiKey) {
  console.warn('OPENAI_API_KEY environment variable is not set');
}

export const openai = new OpenAI({
  apiKey: apiKey || '',
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

/**
 * Basic chat completion
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: CompletionOptions
): Promise<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Please configure OPENAI_API_KEY.');
  }

  const start = Date.now();
  const model = options?.model || 'gpt-4o';

  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      response_format: options?.response_format,
      stream: false,
    });

    const latency = Date.now() - start;
    const usage = response.usage;
    
    console.log(`[OpenAI] ${model} completion: ${latency}ms, tokens: ${usage?.total_tokens || 'unknown'}`);

    return response.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error(`[OpenAI] Error in chatCompletion:`, error);
    
    if (error.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key.');
    }
    
    throw error;
  }
}

/**
 * Streaming chat completion
 */
export async function* streamChatCompletion(
  messages: ChatMessage[],
  options?: CompletionOptions
): AsyncGenerator<string> {
  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Please configure OPENAI_API_KEY.');
  }

  const model = options?.model || 'gpt-4o';

  try {
    const stream = await openai.chat.completions.create({
      model: model,
      messages: messages as any,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error: any) {
    console.error(`[OpenAI] Error in streamChatCompletion:`, error);
    throw error;
  }
}

