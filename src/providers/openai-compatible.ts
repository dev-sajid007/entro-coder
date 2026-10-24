import OpenAI from 'openai';
import type {
  ChatMessage,
  LLMResponse,
  LLMProvider,
  ToolCall,
  ToolDefinition,
} from './types.js';

export class OpenAICompatibleProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey,
      defaultHeaders: {
        'Content-Type': 'application/json',
      },
    });
    this.model = model;
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    const openAIMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
      ...(msg.name ? { name: msg.name } : {}),
    })) as unknown as OpenAI.ChatCompletionMessageParam[];

    const toolParams: Record<string, unknown> = {};
    if (tools && tools.length > 0) {
      toolParams.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      toolParams.tool_choice = 'auto';
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openAIMessages,
      ...toolParams,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response from LLM provider');
    }

    const message = choice.message;

    const toolCalls: ToolCall[] | undefined = message.tool_calls?.map(
      (tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })
    );

    return {
      message: {
        role: 'assistant',
        content: message.content,
        tool_calls: toolCalls,
      },
    };
  }
}
