type LogMeta = unknown;

function write(level: 'info' | 'warn' | 'error', message: string, meta?: LogMeta) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;

  if (level === 'error') {
    console.error(line, meta ?? '');
    return;
  }

  if (level === 'warn') {
    console.warn(line, meta ?? '');
    return;
  }

  console.log(line, meta ?? '');
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write('info', message, meta),
  warn: (message: string, meta?: LogMeta) => write('warn', message, meta),
  error: (message: string, meta?: LogMeta) => write('error', message, meta),
};
