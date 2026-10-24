import { describe, it, expect } from 'vitest';
import { CONFIG, loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.keys(process.env).forEach((k) => delete process.env[k]);
    Object.assign(process.env, originalEnv);
  });

  it('uses defaults when no env vars are set', () => {
    const config = loadConfig();
    expect(config.llm.baseUrl).toBe('http://localhost:11434/v1');
    expect(config.llm.apiKey).toBe('local');
    expect(config.llm.model).toBe('gpt-4o-mini');
    expect(config.agent.maxSteps).toBe(8);
    expect(config.agent.commandTimeoutMs).toBe(15000);
  });

  it('reads values from environment variables', () => {
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    process.env.LLM_API_KEY = 'sk-test-123';
    process.env.LLM_MODEL = 'claude-3-opus';
    process.env.AGENT_MAX_STEPS = '15';
    process.env.AGENT_COMMAND_TIMEOUT_MS = '30000';

    const config = loadConfig();
    expect(config.llm.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.llm.apiKey).toBe('sk-test-123');
    expect(config.llm.model).toBe('claude-3-opus');
    expect(config.agent.maxSteps).toBe(15);
    expect(config.agent.commandTimeoutMs).toBe(30000);
  });
});

describe('CONFIG singleton', () => {
  it('exports a pre-loaded configuration', () => {
    expect(CONFIG).toBeDefined();
    expect(CONFIG.llm).toBeDefined();
    expect(CONFIG.agent).toBeDefined();
  });
});
