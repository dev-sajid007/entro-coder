import { execFileSync } from 'node:child_process';

export interface HunkInfo {
  oldStart: number;
  newStart: number;
  offset: number;
  addedLines: string[];
  removedLines: string[];
}

export interface DiffResult {
  hunks: HunkInfo[];
  targetFile: string;
  success: boolean;
  error?: string;
}

export function generateDiff(
  originalContent: string,
  newContent: string,
  filePath: string = 'file'
): string {
  const origLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  // Compute lines changed using simple LCS-based approach
  const { added, removed } = computeLcsHunks(origLines, newLines);

  const header = `--- a/${filePath}\n+++ b/${filePath}\n`;
  let output = header;

  for (const hunk of [...added, ...removed]) {
    if (hunk.lines.length > 0) {
      const prefix = hunk.added ? '+' : '-';
      for (const line of hunk.lines) {
        output += `${prefix}${escapeDiffLine(line)}\n`;
      }
    }
  }

  return trimTrailingNewlines(output);
}

function escapeDiffLine(line: string): string {
  // Escape lines that start with special diff characters
  if (line.startsWith('no ')) return '\\\\' + line;
  return line;
}

function trimTrailingNewlines(s: string): string {
  return s.replace(/\n+$/, '');
}

interface LcsHunk {
  type: 'common' | 'add' | 'remove';
  index: number;
  lines: string[];
  added?: boolean;
}

function computeLcsHunks(
  orig: string[],
  updated: string[]
): { added: LcsHunk[]; removed: LcsHunk[] } {
  const result: LcsHunk[] = [];

  const m = orig.length;
  const n = updated.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (orig[i - 1] === updated[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find differences
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && orig[i - 1] === updated[j - 1]) {
      result.push({ type: 'common', index: i - 1, lines: [orig[i - 1]] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j - 1])) {
      result.push({
        type: 'add',
        index: j - 1,
        lines: [updated[j - 1]],
        added: true,
      });
      j--;
    } else if (i > 0) {
      result.push({
        type: 'remove',
        index: i - 1,
        lines: [orig[i - 1]],
        added: false,
      });
      i--;
    } else {
      break;
    }
  }

  result.reverse();

  const added: LcsHunk[] = result.filter((r) => r.type === 'add');
  const removed: LcsHunk[] = result.filter((r) => r.type === 'remove');

  return { added, removed };
}

export interface GitOperationOptions {
  staging?: boolean;
  message?: string;
  all?: boolean;
}

export function gitStage(filePath: string, projectRoot: string): { output: string; exitCode: number } {
  try {
    const output = execFileSync('git', ['add', filePath], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    return { output: output.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as Error & { status?: number; stderr?: string };
    return { output: e.stderr?.trim() || '', exitCode: e.status ?? 1 };
  }
}

export function gitCommit(
  message: string,
  projectRoot: string,
  options: GitOperationOptions = {}
): { output: string; exitCode: number } {
  const flags = ['commit'];
  if (options.all) flags.push('-a');
  flags.push('-m', message);

  try {
    const output = execFileSync('git', flags, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    return { output: output.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as Error & { status?: number; stderr?: string };
    return { output: e.stderr?.trim() || '', exitCode: e.status ?? 1 };
  }
}

export function gitStatusShort(projectRoot: string): { output: string; exitCode: number } {
  try {
    const output = execFileSync('git', ['status', '--short'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 10,
    });
    return { output: output.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as Error & { status?: number; stderr?: string };
    return { output: e.stderr?.trim() || '', exitCode: e.status ?? 1 };
  }
}

export function stashAndRestore(projectRoot: string): { restored: boolean; errors: string[] } {
  const errors: string[] = [];
  let statusOutput: string;

  try {
    statusOutput = execFileSync('git', ['status', '--porcelain'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    }).trim();
  } catch (err: unknown) {
    return { restored: false, errors: [String(err)] };
  }

  if (!statusOutput) {
    return { restored: false, errors: [] };
  }

  try {
    execFileSync('git', ['stash', 'push', '-u', '-m', '"entro-coder: backup before changes"'], {
      cwd: projectRoot,
      timeout: 10000,
      encoding: 'utf-8',
    });

    return { restored: false, errors: [] };
  } catch (err: unknown) {
    errors.push(`Failed to stash: ${String(err)}`);
    return { restored: false, errors };
  }
}
