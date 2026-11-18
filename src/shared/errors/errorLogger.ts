import { AppError, type ErrorContextMap } from './errors.types';
import { toAppError } from './errorMapper';

export function logDiagnosticError(
  error: unknown,
  scope: string,
  extraContext: ErrorContextMap = {},
): AppError {
  const normalized = toAppError(error, undefined, { scope, ...extraContext });
  if (import.meta.env.DEV) {
    console.error(`[SmartStock:${scope}]`, {
      code: normalized.code,
      message: normalized.message,
      userMessage: normalized.userMessage,
      context: normalized.context,
      cause: normalized.cause,
    });
  } else {
    console.error(`[SmartStock:${scope}] ${normalized.code}: ${normalized.message}`);
  }
  return normalized;
}
