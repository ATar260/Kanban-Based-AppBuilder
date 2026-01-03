import { appConfig } from '@/config/app.config';

const isDebugEnabled = () => {
  if (typeof window !== 'undefined') {
    return appConfig.dev.enableDebugLogging || localStorage.getItem('debug') === 'true';
  }
  return appConfig.dev.enableDebugLogging;
};

export const debug = {
  log: (prefix: string, ...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.log(`[${prefix}]`, ...args);
    }
  },
  error: (prefix: string, ...args: unknown[]) => {
    console.error(`[${prefix}]`, ...args);
  },
  warn: (prefix: string, ...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.warn(`[${prefix}]`, ...args);
    }
  }
};

export default debug;
