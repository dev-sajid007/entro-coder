import { execFileSync } from 'node:child_process';

export interface GitDiffOptions {
  staged?: boolean;
  untracked?: boolean;
}

export interface GitStatusOptions {
  short?: boolean;
}

export interface GitResult {
  output: string;
  exitCode: number;
}

export function gitDiff(
  projectRoot: string,
  options: GitDiffOptions = {}
): GitResult {
  const flags: string[] = ['diff'];
  if (options.staged) flags.push('--staged');

  try {
    const output = execFileSync('git', flags, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 10,
    });

    return { output: output.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const errObj = err as Error & { status?: number; stderr?: string };
    return {
      output: errObj.stderr?.trim() || '',
      exitCode: errObj.status ?? 1,
    };
  }
}

export function gitStatus(
  projectRoot: string,
  options: GitStatusOptions = {}
): GitResult {
  const flags = ['status'];
  if (options.short) flags.push('-s');

  try {
    const output = execFileSync('git', flags, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 10,
    });

    return { output: output.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const errObj = err as Error & { status?: number; stderr?: string };
    return {
      output: errObj.stderr?.trim() || '',
      exitCode: errObj.status ?? 1,
    };
  }
}

export function gitInit(projectRoot: string): GitResult {
  try {
    const output = execFileSync('git', ['init'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });

    return { output: output.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const errObj = err as Error & { status?: number; stderr?: string };
    return {
      output: errObj.stderr?.trim() || '',
      exitCode: errObj.status ?? 1,
    };
  }
}
