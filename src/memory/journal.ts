export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'action';
  message: string;
  context?: Record<string, unknown>;
}

const LOG_FILE = 'logs.jsonl';

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  action(message: string, context?: Record<string, unknown>): void;
  getEntries(): LogEntry[];
  flushToFile(): void;
}

export function createLogger(projectRoot: string): Logger {
  return new ConsoleLogger(projectRoot);
}

class ConsoleLogger implements Logger {
  private projectRoot: string;
  private entries: LogEntry[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  log(level: LogEntry['level'], message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    this.entries.push(entry);

    if (level === 'error') {
      console.error(`[ERROR] ${message}`);
    } else if (level === 'warn') {
      console.warn(`[WARN] ${message}`);
    } else if (level === 'debug') {
      console.debug(`[DEBUG] ${message}`);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log('error', message, context);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context);
  }

  action(message: string, context?: Record<string, unknown>) {
    this.log('action', message, context);
  }

  getEntries(): LogEntry[] {
    return this.entries;
  }

  flushToFile(): void {
    try {
      const fs = require('fs');
      const path = require('path');

      const logDir = path.join(this.projectRoot, '.entro');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, LOG_FILE);
      const existingContent = fs.existsSync(logFile)
        ? fs.readFileSync(logFile, 'utf-8')
        : '';

      const newEntries = this.entries.map(e => JSON.stringify(e)).join('\n');
      fs.writeFileSync(logFile, `${existingContent}\n${newEntries}`.trim() + '\n');
    } catch {
      // Silent fail — don't break the agent if logging fails
    }
  }
}
