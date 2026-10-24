import fs from 'node:fs';
import path from 'node:path';
import { validatePath } from '../security.js';

export interface ListFilesOptions {
  dir?: string;
  recursive?: boolean;
  maxDepth?: number;
}

export interface FileFilterOptions {
  excludeSecrets?: boolean;
  excludeGenerated?: boolean;
  excludePatterns?: string[];
}

const SECRET_PATTERNS = [
  /\.env(\.|$)/i,
  /\.pem$/i,
  /\.key$/i,
  /\.secret(\.|$)/i,
  /credentials/i,
  /\.aws\//i,
  /\.ssh\//i,
  /\.gitconfig$/i,
  /\.htpasswd$/i,
  /\.pgpass$/i,
];

const GENERATED_PATTERNS = [
  /\.(min\.|compiled|minified)\./i,
  /\.bundle\./i,
  /\.(map)$/i,
  /\.generated\.\w+$/i,
  /__pycache__/i,
  /\.pyc$/i,
  /node_modules\//i,
  /\.git\//i,
];

export function listFiles(
  targetPath: string,
  projectRoot: string,
  options?: ListFilesOptions & FileFilterOptions
): string[] {
  const error = validatePath(targetPath, projectRoot);
  if (error) throw new Error(`Security: ${error}`);

  const fullPath = path.resolve(projectRoot, targetPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Path does not exist: ${targetPath}`);
  }

  const files: string[] = [];
  const maxDepth = options?.maxDepth ?? 10;

  function walk(dir: string, currentDepth: number): void {
    if (currentDepth > maxDepth) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const relPath = path.relative(projectRoot, path.join(dir, entry.name));
      const isSecret = shouldExcludeFile(relPath, options);
      const isGenerated = options?.excludeGenerated && GENERATED_PATTERNS.some((p) => p.test(relPath));

      if (options?.excludeSecrets && isSecret) continue;
      if (isGenerated) continue;
      if (options?.excludePatterns?.some((p) => relPath.includes(p))) continue;

      files.push(relPath);

      if (entry.isDirectory() && (options?.recursive ?? false)) {
        walk(path.join(dir, entry.name), currentDepth + 1);
      }
    }
  }

  walk(fullPath, 0);
  return files.sort();
}

export function shouldExcludeFile(filePath: string, options?: FileFilterOptions): boolean {
  if (options?.excludeSecrets && SECRET_PATTERNS.some((p) => p.test(filePath))) {
    return true;
  }
  if (options?.excludeGenerated && GENERATED_PATTERNS.some((p) => p.test(filePath))) {
    return true;
  }
  if (options?.excludePatterns?.some((p) => filePath.includes(p))) {
    return true;
  }
  return false;
}

export async function readFile(
  filePath: string,
  projectRoot: string,
  maxSizeBytes: number = 500_000
): Promise<string> {
  const error = validatePath(filePath, projectRoot);
  if (error) throw new Error(`Security: ${error}`);

  const fullPath = path.resolve(projectRoot, filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(fullPath);
  if (stats.isFile() && stats.size > maxSizeBytes) {
    throw new Error(
      `File too large (${stats.size} bytes, max ${maxSizeBytes}): ${filePath}`
    );
  }

  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }

  return fs.readFileSync(fullPath, 'utf-8');
}

export interface WriteFileResult {
  created: boolean;
  overwritten: boolean;
  bytesWritten: number;
}

export async function writeFile(
  filePath: string,
  content: string,
  projectRoot: string,
  maxSizeBytes: number = 500_000
): Promise<WriteFileResult> {
  const error = validatePath(filePath, projectRoot);
  if (error) throw new Error(`Security: ${error}`);

  if (content.length > maxSizeBytes) {
    throw new Error(
      `Content too large (${content.length} bytes, max ${maxSizeBytes})`
    );
  }

  const fullPath = path.resolve(projectRoot, filePath);
  const dir = path.dirname(fullPath);
  const created = !fs.existsSync(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content, 'utf-8');

  return {
    created,
    overwritten: !created,
    bytesWritten: content.length,
  };
}

export async function applyPatch(
  filePath: string,
  patch: string,
  projectRoot: string
): Promise<{ hunksApplied: number; hunksSkipped: number }> {
  const error = validatePath(filePath, projectRoot);
  if (error) throw new Error(`Security: ${error}`);

  const existingContent = await readFile(filePath, projectRoot);
  const result = applyUnifiedPatch(existingContent, patch);

  await writeFile(filePath, result.newContent, projectRoot);

  return {
    hunksApplied: result.hunksApplied,
    hunksSkipped: result.hunksSkipped,
  };
}

interface PatchResult {
  newContent: string;
  hunksApplied: number;
  hunksSkipped: number;
}

function applyUnifiedPatch(original: string, patch: string): PatchResult {
  const lines = original.split('\n');
  const patchLines = patch.trim().split('\n').filter((l) => l.length > 0);

  let hunksApplied = 0;
  let hunksSkipped = 0;
  let currentLine = 0;

  while (currentLine < lines.length && patchLines.length > 0) {
    const line = patchLines.shift()!;

    if (line.startsWith('+++ ') || line.startsWith('--- ')) continue;
    if (line.startsWith('diff --git') || line.startsWith('index ')) continue;
    if (line.startsWith('@@ ')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (!match) {
        hunksSkipped++;
        continue;
      }

      const targetLine = parseInt(match[1], 10) - 1;
      if (targetLine >= 0 && targetLine <= currentLine) {
        currentLine = targetLine;
        const hunk: string[] = [];

        while (patchLines.length > 0) {
          const hunkLine = patchLines.shift()!;
          if (hunkLine.startsWith('@@ ') || hunkLine.startsWith('diff --git')) {
            patchLines.unshift(hunkLine);
            break;
          }

          if (hunkLine.startsWith('+')) {
            hunk.push(hunkLine.slice(1));
          } else if (hunkLine.startsWith('-')) {
            // skip
          } else {
            hunk.push(hunkLine);
          }
        }

        if (hunk.length > 0) {
          const insertCount = hunk.filter((l) => !l.startsWith('\\')).length;
          const deleteCount = hunk.filter((l) => l.startsWith('\\')).length || 0;
          const actualInsert = insertCount - deleteCount;

          lines.splice(currentLine, Math.max(actualInsert, 0), ...hunk);
          currentLine += hunk.length;
          hunksApplied++;
        } else {
          currentLine++;
          hunksApplied++;
        }
      } else {
        hunksSkipped++;
      }
    }
  }

  return {
    newContent: lines.join('\n'),
    hunksApplied,
    hunksSkipped,
  };
}
