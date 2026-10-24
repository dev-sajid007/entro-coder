import { describe, it, expect } from 'vitest';
import { validatePath } from '../src/security.js';

describe('validatePath — path traversal', () => {
  it('rejects paths with .. traversal', () => {
    const result = validatePath('../etc/passwd', '/project');
    expect(result).toBe('Path escapes project directory');
  });

  it('rejects nested traversal', () => {
    const result = validatePath('src/../config/../../secret.txt', '/project');
    expect(result).toBe('Path escapes project directory');
  });

  it('accepts valid relative paths', () => {
    const result = validatePath('src/main.ts', '/project');
    expect(result).toBeNull();
  });

  it('rejects protected system paths', () => {
    const result = validatePath('/etc/shadow', '/project');
    expect(result).toContain('protected path');
  });

  it('rejects SSH directory access', () => {
    const result = validatePath('/root/.ssh/id_rsa', '/project');
    expect(result).toContain('protected path');
  });
});
