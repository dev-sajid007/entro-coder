import fs from 'node:fs';
import path from 'node:path';

export interface RepoContext {
  structure: string;
  keyFiles: string[];
  packageManager: string;
  hasTests: boolean;
  hasLint: boolean;
  hasTypecheck: boolean;
  language: string;
}

export async function buildRepoContext(projectRoot: string): Promise<RepoContext> {
  const structure = await gatherStructure(projectRoot);
  const packageJson = await tryReadPackageJson(projectRoot);
  const packageManager = packageJson?.packageManager || detectPackageManager(projectRoot);
  const hasTests = await checkIfExists(projectRoot, 'test', '__tests__', 'tests', '*.test.*', '*.spec.*');
  const hasLint = await checkIfExists(projectRoot, '.eslintrc', 'eslint.config', '.stylelintrc', 'biome.json');
  const hasTypecheck = await checkIfExists(projectRoot, 'tsconfig.json', 'jsconfig.json');

  let language = 'unknown';
  if (hasTypecheck || packageJson?.devDependencies?.typescript) {
    language = 'typescript';
  } else if (await checkIfExists(projectRoot, '*.py')) {
    language = 'python';
  } else if (await checkIfExists(projectRoot, '*.js', '*.mjs', '*.cjs')) {
    language = 'javascript';
  }

  return {
    structure,
    keyFiles: extractKeyFiles(packageJson),
    packageManager,
    hasTests,
    hasLint,
    hasTypecheck,
    language,
  };
}

async function gatherStructure(projectRoot: string, _depth: number = 3): Promise<string> {
  return findTopLevelDirs(projectRoot);
}

function findTopLevelDirs(root: string): string {
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'build')
      .map((e) => e.name)
      .sort();

    return dirs.join(', ');
  } catch {
    return '';
  }
}

async function tryReadPackageJson(root: string): Promise<{ scripts?: Record<string, string>; devDependencies?: Record<string, string>; packageManager?: string } | null> {
  const pjsonPath = path.join(root, 'package.json');
  if (!fs.existsSync(pjsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pjsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

function detectPackageManager(root: string): string {
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'bun.lockb'))) return 'bun';
  return 'npm';
}

async function checkIfExists(root: string, ...patterns: string[]): Promise<boolean> {
  for (const p of patterns) {
    if (p.includes('*')) {
      try {
        const found = await globSearch(root, p);
        if (found) return true;
      } catch { /* skip */ }
    } else {
      if (fs.existsSync(path.join(root, p))) return true;
    }
  }
  return false;
}

async function globSearch(root: string, pattern: string): Promise<boolean> {
  // Simple glob using fs.readdirSync for single-level patterns
  if (!pattern.endsWith('.*')) return false;
  const ext = pattern.replace(/\*\./, '.');
  const entries = fs.readdirSync(root);
  return entries.some((e) => e.endsWith(ext));
}

function extractKeyFiles(pkg: { scripts?: Record<string, string>; devDependencies?: Record<string, string> } | null): string[] {
  const keyFiles: string[] = ['package.json', 'tsconfig.json'];
  if (pkg?.scripts) {
    for (const script of Object.keys(pkg.scripts)) {
      if (script.includes('test') || script.includes('lint') || script.includes('typecheck') || script.includes('build')) {
        keyFiles.push(`npm run ${script}`);
      }
    }
  }
  return [...new Set(keyFiles)];
}
