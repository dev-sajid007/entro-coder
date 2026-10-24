import readline from 'node:readline';
import type { Logger } from './journal.js';

export interface ApprovalRequest {
  action: 'write_file' | 'run_command' | 'apply_patch' | 'delete_file' | 'other';
  description: string;
  file?: string;
  command?: string;
  riskLevel: 'low' | 'medium' | 'high';
  details?: string;
}

export interface ApprovalResult {
  granted: boolean;
  reason?: string;
}

const HIGH_RISK_COMMANDS = [
  /rm\s+(-rf|-fr)\b/i,
  /dd\s+if=/i,
  /mkfs/i,
  /umount\s+-f/i,
  /\bsudo\b/i,
  /chmod\s+[0-7]*7/i,
];

export class ApprovalManager {
  private logger: Logger;
  private rl: readline.Interface | null = null;
  private nonInteractive: boolean;

  constructor(logger: Logger, options?: { nonInteractive?: boolean }) {
    this.logger = logger;
    this.nonInteractive = options?.nonInteractive ?? !process.stdout.isTTY;
  }

  async requestApproval(request: ApprovalRequest): Promise<ApprovalResult> {
    if (this.nonInteractive) {
      if (request.riskLevel === 'high') {
        return { granted: false, reason: 'Non-interactive mode: high-risk actions require explicit approval' };
      }
      // In non-interactive mode, allow medium risk but block high
      this.logger.warn(`[auto-approved] ${request.description}`, {
        action: request.action,
        file: request.file,
        command: request.command,
      });
      return { granted: true };
    }

    const isBlocked = this.isDangerouslyBlocked(request);
    if (isBlocked) {
      return { granted: false, reason: 'Action blocked by security policy' };
    }

    console.log('\n' + '='.repeat(60));
    console.log(`  APPROVAL REQUEST — ${request.riskLevel.toUpperCase()} RISK`);
    console.log('='.repeat(60));
    console.log();
    console.log(`  Action   : ${request.action}`);
    console.log(`  Summary  : ${request.description}`);

    if (request.file) {
      console.log(`  File     : ${request.file}`);
    }
    if (request.command) {
      console.log(`  Command  : ${request.command}`);
    }
    if (request.details) {
      console.log(`  Details  : ${request.details}`);
    }

    console.log();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const answer = await new Promise<string>((resolve) => {
        this.rl!.question('  Allow this action? [Y/n]: ', (answer) => resolve(answer));
      });

      const normalized = answer.trim().toLowerCase();
      const approved = normalized === '' || normalized === 'y' || normalized === 'yes';

      if (approved) {
        this.logger.info(`Approved: ${request.description}`, {
          action: request.action,
          file: request.file,
          command: request.command,
        });
      } else {
        this.logger.warn(`Denied: ${request.description}`, {
          action: request.action,
          file: request.file,
          command: request.command,
        });
      }

      return { granted: approved };
    } finally {
      this.rl?.close();
      this.rl = null;
    }
  }

  private isDangerouslyBlocked(request: ApprovalRequest): boolean {
    if (request.command && HIGH_RISK_COMMANDS.some((p) => p.test(request.command as string))) {
      return true;
    }
    if (request.riskLevel === 'high') {
      // Always require explicit approval for high risk
    }
    return false;
  }

  shouldBlockFile(filePath: string): string | null {
    const secretPatterns = [
      /\.env(\.|$)/i,
      /\.pem$/i,
      /\.key$/i,
      /\.secret(\.|$)/i,
      /credentials/i,
      /\.aws\//i,
      /\.ssh\//i,
      /\.gitconfig$/i,
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(filePath)) {
        return `Auto-excluding secret/sensitive file: ${filePath}`;
      }
    }

    return null;
  }
}
