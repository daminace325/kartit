// Thin logger wrapper over console — pino swap in P2.10 is a one-line change.
export const logger = {
    info: (...args: unknown[]) => console.log(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args),
};
