export type AppErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_IN_USE'
  | 'AUTH_POPUP_CLOSED'
  | 'AUTH_UNAUTHORIZED_DOMAIN'
  | 'AUTH_TOO_MANY_REQUESTS'
  | 'AUTH_REQUIRED'
  | 'FIRESTORE_PERMISSION_DENIED'
  | 'FIRESTORE_INDEX_REQUIRED'
  | 'FIRESTORE_UNAVAILABLE'
  | 'FIRESTORE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CSV_PARSE_ERROR'
  | 'ENV_CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export type ErrorContextMap = Record<string, string | number | boolean | null>;

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly userMessage: string;
  public readonly recoverable: boolean;
  public readonly context: ErrorContextMap;

  constructor(params: {
    code: AppErrorCode;
    userMessage: string;
    technicalMessage?: string;
    recoverable?: boolean;
    context?: ErrorContextMap;
    cause?: unknown;
  }) {
    super(params.technicalMessage ?? params.userMessage);
    this.name = 'AppError';
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.recoverable = params.recoverable ?? true;
    this.context = params.context ?? {};
    if (params.cause !== undefined) {
      this.cause = params.cause;
    }
  }
}
