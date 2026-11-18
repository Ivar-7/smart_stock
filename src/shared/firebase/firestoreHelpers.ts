import { Timestamp, writeBatch, type DocumentData, type Firestore } from 'firebase/firestore';
import { z } from 'zod';
import { AppError, logDiagnosticError } from '../errors';

export function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return new Date().toISOString();
}

export function decodeDocument<T>(
  id: string,
  rawData: DocumentData,
  schema: z.ZodType<T>,
  scope: string,
): T | null {
  const parsed = schema.safeParse({ ...rawData, id });
  if (!parsed.success) {
    logDiagnosticError(
      new AppError({
        code: 'VALIDATION_ERROR',
        userMessage: 'Skipped a malformed cloud record while syncing.',
        technicalMessage: parsed.error.message,
      }),
      scope,
      { docId: id },
    );
    return null;
  }
  return parsed.data;
}

export async function commitInChunks(
  db: Firestore,
  operations: ReadonlyArray<(batch: ReturnType<typeof writeBatch>) => void>,
  chunkSize = 400,
): Promise<void> {
  for (let i = 0; i < operations.length; i += chunkSize) {
    const batch = writeBatch(db);
    const slice = operations.slice(i, i + chunkSize);
    for (const applyOp of slice) {
      applyOp(batch);
    }
    await batch.commit();
  }
}
