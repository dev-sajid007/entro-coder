import { execFileSync } from 'node:child_process';
import { validateCommand } from '../security.js';

export interface RunCommandOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export async function runCommand(
  command: string,
  options: RunCommandOptions = {}
): Promise<CommandResult> {
  const securityError = validateCommand(command);
  if (securityError) {
    throw new Error(`Security: ${securityError}`);
  }

  const timeoutMs = options.timeoutMs ?? 15000;

  try {
    const stdout = execFileSync('bash', ['-c', command], {
      cwd: options.cwd,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 10, // 10MB
      env: { ...process.env, ...options.env },
      encoding: 'utf-8',
    });

    return {
      stdout: stdout.trim(),
      stderr: '',
      exitCode: 0,
      timedOut: false,
    };
  } catch (err: unknown) {
    if (err instanceof Error && 'status' in err) {
      const childErr = err as Error & { status?: number; stdout?: string; stderr?: string };
      return {
        stdout: (childErr.stdout || '').trim(),
        stderr: (childErr.stderr || '').trim(),
        exitCode: childErr.status ?? 1,
        timedOut: false,
      };
    }

    return {
      stdout: '',
      stderr: String(err),
      exitCode: 1,
      timedOut: false,
    };
  }
}
