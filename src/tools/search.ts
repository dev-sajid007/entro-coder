import { execFileSync } from 'node:child_process';

export interface SearchOptions {
  pattern: string;
  paths?: string;
  maxResults?: number;
  filePattern?: string;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
}

export function searchCode(options: SearchOptions): SearchResult[] {
  const rgFlags: string[] = ['-e', options.pattern];

  if (options.paths) rgFlags.push(options.paths);
  if (options.filePattern) rgFlags.push('--glob', options.filePattern);
  if (options.maxResults) rgFlags.push('-n', String(options.maxResults));

  try {
    const output = execFileSync('rg', rgFlags, {
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 10,
      encoding: 'utf-8',
    });

    const results: SearchResult[] = [];
    const lines = output.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const match = line.match(/^(.+):(\d+):(\d+)\s+(.+)$/);
      if (match) {
        results.push({
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          match: match[4],
        });
      } else {
        const pathMatch = line.match(/^(.+):\s*(.+)$/);
        if (pathMatch) {
          results.push({
            file: pathMatch[1],
            line: 0,
            column: 0,
            match: pathMatch[2],
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}
