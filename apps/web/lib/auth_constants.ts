/**
 * Centralized auth/password constants. Server and client validation must
 * stay in lock-step — both read these.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES_TEXT = `At least ${PASSWORD_MIN_LENGTH} characters.`;
