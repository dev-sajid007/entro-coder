const PROTECTED_PATHS = [
  '/etc/shadow',
  '/etc/passwd',
  '/proc',
  '/sys',
  '/dev/null',
  '/root/.ssh',
];

const DANGEROUS_COMMANDS = [
  /rm\s+-(fr|rf)\b/i,
  /dd\s+if=/i,
  /mkfs/i,
  /fdisk/i,
  /parted/i,
  /mount\s+-o/i,
  /umount\s+-f/i,
  /chmod\s+[0-7]*7/i,
  /chown.*:\s*$/i,
  /wget\s+-O/i,
  /curl\s+-[A-Z]\s*>/i,
  />\s*\/dev\/sda/i,
  />\s*\/dev\/sdb/i,
  /\bsh\s*$/i,
  /\bbash\s*$/i,
];

export function validatePath(
  requestedPath: string,
  projectRoot: string
): string | null {
  const resolved = resolveProjectPath(requestedPath, projectRoot);
  if (!resolved) return 'Path escapes project directory';

  for (const protectedPath of PROTECTED_PATHS) {
    if (requestedPath.includes(protectedPath)) {
      return `Access denied: ${protectedPath} is a protected path`;
    }
  }

  return null;
}

export function validateCommand(command: string): string | null {
  for (const pattern of DANGEROUS_COMMANDS) {
    if (pattern.test(command)) {
      return `Command blocked by security policy: matches restricted pattern`;
    }
  }

  return null;
}

function resolveProjectPath(path: string, projectRoot: string): string | null {
  if (path.startsWith('..') || path.includes('/../')) {
    return null;
  }

  const normalizedRoot = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`;
  const resolved = `${normalizedRoot}${path.replace(/^\.\//, '')}`;
  return resolved;
}
