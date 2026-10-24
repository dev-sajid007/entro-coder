import { config } from 'dotenv';

config();

export interface AgentConfig {
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  agent: {
    maxSteps: number;
    commandTimeoutMs: number;
  };
}

export function loadConfig(): AgentConfig {
  const env = process.env;

  return {
    llm: {
      baseUrl: env.LLM_BASE_URL || 'http://localhost:11434/v1',
      apiKey: env.LLM_API_KEY || 'local',
      model: env.LLM_MODEL || 'gpt-4o-mini',
    },
    agent: {
      maxSteps: parseInt(env.AGENT_MAX_STEPS || '8', 10),
      commandTimeoutMs: parseInt(env.AGENT_COMMAND_TIMEOUT_MS || '15000', 10),
    },
  };
}

export const CONFIG = loadConfig();
