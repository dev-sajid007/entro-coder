import type { ChatMessage, ToolCall } from '../providers/types.js';
import type { LLMProvider } from '../providers/types.js';
import type { ToolExecutor, ToolContext } from '../tools/registry.js';
import { CONFIG } from '../config.js';
import { buildRepoContext } from './context.js';
import { createSystemPrompt, createUserPrompt } from './prompts.js';

export interface OrchestratorOptions {
  provider: LLMProvider;
  tools: ToolExecutor[];
  context: ToolContext;
  maxSteps?: number;
}

export interface AgentStep {
  step: number;
  action: 'llm_call' | 'tool_use' | 'complete';
  messages: ChatMessage[];
  toolCalls?: ToolCall[];
  result?: string;
  error?: string;
}

export class AgentOrchestrator {
  private provider: LLMProvider;
  private tools: ToolExecutor[];
  private context: ToolContext;
  private maxSteps: number;
  private steps: AgentStep[] = [];

  constructor(options: OrchestratorOptions) {
    this.provider = options.provider;
    this.tools = options.tools;
    this.context = options.context;
    this.maxSteps = options.maxSteps ?? CONFIG.agent.maxSteps;
  }

  async run(task: string): Promise<AgentResult> {
    const repoContext = await buildRepoContext(this.context.projectRoot);

    let messages: ChatMessage[] = [
      { role: 'system', content: createSystemPrompt(repoContext) },
      { role: 'user', content: createUserPrompt(task) },
    ];

    let finalResult: AgentResult['finalResult'] = '';
    let completed = false;

    for (let step = 1; step <= this.maxSteps && !completed; step++) {
      const response = await this.callLLM(messages);

      if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
        messages.push(response.message as unknown as ChatMessage);
        completed = true;
        finalResult = response.message.content?.trim() || 'No output generated.';
        this.steps.push({
          step,
          action: 'complete',
          messages: [...messages],
          result: finalResult,
        });
        continue;
      }

      const toolResults: import('../providers/types.js').ChatMessage[] = [];

      for (const tc of response.message.tool_calls) {
        const toolMsg: AgentStep = {
          step,
          action: 'tool_use',
          messages: [...messages],
          toolCalls: [tc],
        };

        try {
          const executor = this.tools.find((t) => t.name === tc.name);
          if (!executor) {
            toolMsg.result = `Error: Unknown tool '${tc.name}'`;
            throw new Error(`Unknown tool: ${tc.name}`);
          }

          const result = await executor.execute(tc.arguments, this.context);
          toolMsg.result = result;
          toolResults.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          toolMsg.error = errorMsg;
          toolResults.push({
            role: 'tool',
            content: `Error: ${errorMsg}`,
            tool_call_id: tc.id,
            isError: true,
          });
        }

        this.steps.push(toolMsg);
      }

      messages = [...messages, ...toolResults];
    }

    return {
      task,
      steps: this.steps,
      finalResult,
      totalSteps: this.steps.length,
      errors: this.steps.filter((s) => s.error).length > 0,
    };
  }

  private async callLLM(messages: ChatMessage[]) {
    const toolsDef = this.tools.map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.parameters,
    }));

    return this.provider.chat(messages, toolsDef);
  }

  getHistory(): AgentStep[] {
    return this.steps;
  }
}

export interface AgentResult {
  task: string;
  steps: AgentStep[];
  finalResult: string;
  totalSteps: number;
  errors: boolean;
}
