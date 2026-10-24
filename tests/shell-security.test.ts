import { describe, it, expect } from 'vitest';
import { validateCommand } from '../src/security.js';

describe('validateCommand — dangerous command detection', () => {
  it('blocks rm -rf commands', () => {
    expect(validateCommand('rm -rf /')).not.toBeNull();
    expect(validateCommand('rm -fr ./node_modules')).not.toBeNull();
  });

  it('blocks mkfs and fdisk', () => {
    expect(validateCommand('mkfs.ext4 /dev/sda')).not.toBeNull();
    expect(validateCommand('fdisk -l')).not.toBeNull();
  });

  it('blocks destructive mount commands', () => {
    expect(validateCommand('mount -o force /dev/sdb /mnt')).not.toBeNull();
    expect(validateCommand('umount -f /mnt')).not.toBeNull();
  });

  it('blocks shell spawning via sh/bash', () => {
    expect(validateCommand('./script.sh')).not.toBeNull();
    expect(validateCommand('run bash')).not.toBeNull();
  });

  it('allows safe npm commands', () => {
    expect(validateCommand('npm run test')).toBeNull();
    expect(validateCommand('npm run lint')).toBeNull();
    expect(validateCommand('npm run build')).toBeNull();
  });

  it('allows git commands', () => {
    expect(validateCommand('git status')).toBeNull();
    expect(validateCommand('git diff')).toBeNull();
    expect(validateCommand('git add .')).toBeNull();
  });

  it('allows file reading commands', () => {
    expect(validateCommand('cat src/main.ts')).toBeNull();
    expect(validateCommand('grep pattern src/file.ts')).toBeNull();
  });
});
