import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentOrchestrator, type AgentResult } from '../src/agent/orchestrator.js';
import type { LLMProvider, LLMResponse, ChatMessage, ToolCall } from '../src/providers/types.js';
import type { ToolExecutor, ToolContext } from '../src/tools/registry.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('AgentOrchestrator', () => {
  let mockFsDir: string;

  beforeEach(() => {
    mockFsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entro-orch-'));
    fs.writeFileSync(path.join(mockFsDir, 'test.txt'), 'hello world\n');
  });

  afterAll(() => {
    if (mockFsDir && fs.existsSync(mockFsDir)) {
      fs.rmSync(mockFsDir, { recursive: true, force: true });
    }
  });

  function createMockProvider(responseFn: (msgs: ChatMessage[]) => Promise<LLMResponse>): LLMProvider {
    return { chat: responseFn };
  }

  function createMockTool(executor: Omit<ToolExecutor, 'definition'>): ToolExecutor {
    return {
      name: executor.name,
      definition: {
        name: executor.name,
        description: '',
        parameters: { type: 'object', properties: {} },
      },
      execute: executor.execute,
    };
  }

  function createContext(): ToolContext {
    return { projectRoot: mockFsDir };
  }

  it('completes without tool calls when LLM returns plain text', async () => {
    const provider = createMockProvider(async (msgs) => ({
      message: { role: 'assistant', content: 'Task complete. Done.' },
    }));

    const orchestrator = new AgentOrchestrator({
      provider,
      tools: [],
      context: createContext(),
      maxSteps: 3,
    });

    const result: AgentResult = await orchestrator.run('test task');

    expect(result.finalResult).toBe('Task complete. Done.');
    expect(result.totalSteps).toBeGreaterThan(0);
    expect(result.steps[result.steps.length - 1].action).toBe('complete');
  });

  it('respects max step limit', async () => {
    const provider = createMockProvider(async (msgs) => {
      return {
        message: { role: 'assistant', content: 'still going...' },
      };
    });

    const orchestrator = new AgentOrchestrator({
      provider,
      tools: [],
      context: createContext(),
      maxSteps: 2,
    });

    await orchestrator.run('bounded task');
    expect(orchestrator.getHistory().filter(s => s.action === 'complete').length).toBeLessThanOrEqual(2);
  });

  it('handles tool calls correctly', async () => {
    const toolName = 'test_tool';
    const toolCallsReceived: ToolCall[] = [];

    const provider = createMockProvider(async (msgs) => {
      if (msgs.filter((m) => m.role === 'tool').length === 0) {
        return {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'tc1', name: toolName, arguments: { value: 42 } }],
          },
        };
      }
      return {
        message: { role: 'assistant', content: 'Done with tools' },
      };
    });

    const tool = createMockTool({
      name: toolName,
      execute: async (args) => {
        const { value } = args as { value: number };
        toolCallsReceived.push({ id: 'tc1', name: toolName, arguments: { value } });
        return `Value is ${value}`;
      },
    });

    const orchestrator = new AgentOrchestrator({
      provider,
      tools: [tool],
      context: createContext(),
      maxSteps: 3,
    });

    await orchestrator.run('use tools');
    expect(toolCallsReceived).toHaveLength(1);
    expect(toolCallsReceived[0].arguments).toEqual({ value: 42 });
  });
});
