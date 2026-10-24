export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  isError?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  isError?: boolean;
}

export interface LLMResponse {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ToolCall[];
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LLMProvider {
  chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;
}
