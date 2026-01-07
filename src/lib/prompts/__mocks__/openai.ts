// Mock openai module for testing
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

// Mock implementation that returns predictable responses for testing
export async function chatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<string> {
  // Return a mock response based on the last user message
  const lastUserMessage = messages.find(m => m.role === 'user')?.content || '';

  // For variant draft generation, return a marked draft
  if (lastUserMessage.includes('Rewrite the source')) {
    return 'Mock draft with state-specific content. [[KF:fact-1]]';
  }

  // For lightning bolt edits
  if (lastUserMessage.includes('INSTRUCTION:')) {
    return 'Mock edited content. [[KF:fact-1]]';
  }

  return 'Mock response';
}
