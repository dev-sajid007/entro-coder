import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as filesystem from '../src/tools/filesystem.js';

describe('filesystem tools', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entro-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readFile', () => {
    it('reads a text file successfully', async () => {
      const filePath = 'hello.txt';
      const content = 'Hello, EntroCoder!';
      fs.writeFileSync(path.join(tmpDir, filePath), content);

      const result = await filesystem.readFile(filePath, tmpDir);
      expect(result).toBe(content);
    });

    it('throws for non-existent files', async () => {
      await expect(filesystem.readFile('nonexistent.txt', tmpDir))
        .rejects.toThrow('File not found');
    });

    it('throws on path traversal', async () => {
      await expect(filesystem.readFile('../etc/passwd', tmpDir))
        .rejects.toThrow(/Security|escapes/i);
    });
  });

  describe('writeFile', () => {
    it('writes a new file', async () => {
      const filePath = 'new-file.ts';
      const content = 'export const x = 1;';

      await filesystem.writeFile(filePath, content, tmpDir);
      const written = fs.readFileSync(path.join(tmpDir, filePath), 'utf-8');
      expect(written).toBe(content);
    });

    it('creates parent directories', async () => {
      const filePath = 'deep/nested/dir/file.ts';
      const content = 'console.log("deep");';

      await filesystem.writeFile(filePath, content, tmpDir);
      expect(fs.existsSync(path.join(tmpDir, filePath))).toBe(true);
    });

    it('throws on traversal', async () => {
      await expect(filesystem.writeFile('../../escape.txt', 'bad', tmpDir))
        .rejects.toThrow(/Security|escapes/i);
    });
  });

  describe('listFiles', () => {
    it('lists files in root directory', () => {
      fs.writeFileSync(path.join(tmpDir, 'a.ts'), '');
      fs.writeFileSync(path.join(tmpDir, 'b.ts'), '');

      const files = filesystem.listFiles('.', tmpDir);
      expect(files).toContain('a.ts');
      expect(files).toContain('b.ts');
    });

    it('returns empty array for empty directory', () => {
      const subDir = 'empty';
      fs.mkdirSync(path.join(tmpDir, subDir));
      const files = filesystem.listFiles(subDir, tmpDir);
      expect(files).toEqual([]);
    });

    it('rejects non-existent paths', () => {
      expect(() => filesystem.listFiles('does-not-exist', tmpDir))
        .toThrow('Path does not exist');
    });
  });

  describe('applyPatch', () => {
    it('applies a simple patch correctly', async () => {
      const filePath = 'example.ts';
      const original = `function hello(name: string): string {
  return "Hello, " + name;
}
`;
      fs.writeFileSync(path.join(tmpDir, filePath), original);

      const patch = `--- a/example.ts
+++ b/example.ts
@@ -1,3 +1,3 @@
 function hello(name: string): string {
-  return "Hello, " + name;
+  return \`Hello, \${name}!\`;
 }
`;
      const result = await filesystem.applyPatch(filePath, patch, tmpDir);
      expect(result.hunksApplied).toBeGreaterThanOrEqual(0);

      const updated = fs.readFileSync(path.join(tmpDir, filePath), 'utf-8');
      expect(updated).toContain('Hello');
    });
  });
});
