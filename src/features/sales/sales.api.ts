import {
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';
import { AppError, logDiagnosticError, type AppError as AppErrorType } from '../../shared/errors';
import {
  productsCollectionRef,
  salesCollectionRef,
  stockMovementsCollectionRef,
} from '../../shared/firebase/collections';
import { getFirebaseDb } from '../../shared/firebase/firebaseClient';
import { commitInChunks, timestampToIso } from '../../shared/firebase/firestoreHelpers';
import type { Product } from '../inventory/inventory.types';
import { saleInputSchema } from './sales.schema';
import type { AnomalyAction, CleanedCsvRow, SaleInput, SaleRecord } from './sales.types';

const saleDocSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  soldDate: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  orderType: z.enum(['normal', 'bulk']),
  isPromotion: z.boolean(),
  promoTag: z.string(),
  anomalyAction: z.enum(['auto', 'dampen', 'keep']),
  source: z.enum(['manual', 'csv_import', 'seed']),
  notes: z.string(),
});

export function subscribeToSales(
  shopId: string,
  onData: (sales: SaleRecord[]) => void,
  onError: (error: AppErrorType) => void,
): Unsubscribe {
  const q = query(salesCollectionRef(shopId), orderBy('soldDate', 'desc'), limit(2500));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SaleRecord[] = [];
      for (const docSnap of snapshot.docs) {
        const raw = docSnap.data();
        const parsed = saleDocSchema.safeParse(raw);
        if (parsed.success) {
          items.push({
            id: docSnap.id,
            ...parsed.data,
            createdAt: timestampToIso(raw.createdAt),
          });
        }
      }
      onData(items);
    },
    (error) => {
      onError(logDiagnosticError(error, 'sales.subscribeToSales', { shopId }));
    },
  );
}

export async function recordManualSale(
  shopId: string,
  rawInput: SaleInput,
  product: Product,
): Promise<void> {
  try {
    const input = saleInputSchema.parse(rawInput);
    const db = getFirebaseDb();
    const saleRef = doc(salesCollectionRef(shopId));
    const productRef = doc(productsCollectionRef(shopId), product.id);

    await runTransaction(db, async (tx) => {
      if (input.deductStock) {
        const prodSnap = await tx.get(productRef);
        if (!prodSnap.exists()) {
          throw new AppError({
            code: 'FIRESTORE_NOT_FOUND',
            userMessage: 'Selected product could not be found.',
          });
        }
        const data = prodSnap.data();
        const currentStock = typeof data.currentStock === 'number' ? data.currentStock : 0;
        const nextStock = Math.max(0, Math.round((currentStock - input.quantity) * 100) / 100);
        tx.update(productRef, {
          currentStock: nextStock,
          updatedAt: serverTimestamp(),
        });

        const movementRef = doc(stockMovementsCollectionRef(shopId));
        tx.set(movementRef, {
          productId: product.id,
          productName: product.name,
          delta: -(currentStock - nextStock),
          previousStock: currentStock,
          newStock: nextStock,
          reason: 'sale',
          note:
            input.orderType === 'bulk'
              ? `Bulk sale (${input.quantity} ${product.unit})`
              : 'POS sale entry',
          createdAt: serverTimestamp(),
        });
      }

      tx.set(saleRef, {
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        soldDate: input.soldDate,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        orderType: input.orderType,
        isPromotion: input.isPromotion,
        promoTag: input.isPromotion ? input.promoTag : '',
        anomalyAction: input.anomalyAction,
        source: 'manual',
        notes: input.notes,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw logDiagnosticError(error, 'sales.recordManualSale', { shopId });
  }
}

export async function importCleanedCsvSales(
  shopId: string,
  rows: readonly CleanedCsvRow[],
  productsById: ReadonlyMap<string, Product>,
  deductFromStock: boolean,
): Promise<number> {
  try {
    const selectedRows = rows.filter(
      (r) =>
        r.selectedForImport &&
        r.soldDate !== null &&
        r.matchedProductId !== null &&
        r.quantity !== null &&
        r.unitPrice !== null,
    );

    if (selectedRows.length === 0) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        userMessage: 'No valid rows are selected for import.',
      });
    }

    const db = getFirebaseDb();
    const ops: Array<(batch: ReturnType<typeof import('firebase/firestore').writeBatch>) => void> =
      [];
    const deductionsByProduct = new Map<string, number>();

    for (const row of selectedRows) {
      const productId = row.matchedProductId!;
      const quantity = row.quantity!;
      const ref = doc(salesCollectionRef(shopId));
      ops.push((batch) => {
        batch.set(ref, {
          productId,
          sku: row.matchedSku ?? 'SKU',
          productName: row.matchedProductName ?? 'Product',
          soldDate: row.soldDate!,
          quantity,
          unitPrice: row.unitPrice!,
          orderType: row.orderType,
          isPromotion: row.isPromotion,
          promoTag: row.isPromotion ? row.promoTag : '',
          anomalyAction: 'auto',
          source: 'csv_import',
          notes: row.notes,
          createdAt: serverTimestamp(),
        });
      });

      if (deductFromStock) {
        deductionsByProduct.set(productId, (deductionsByProduct.get(productId) ?? 0) + quantity);
      }
    }

    if (deductFromStock) {
      for (const [productId, totalQty] of deductionsByProduct.entries()) {
        const product = productsById.get(productId);
        if (!product) {
          continue;
        }
        const prodRef = doc(productsCollectionRef(shopId), productId);
        const nextStock = Math.max(0, Math.round((product.currentStock - totalQty) * 100) / 100);
        ops.push((batch) => {
          batch.update(prodRef, {
            currentStock: nextStock,
            updatedAt: serverTimestamp(),
          });
        });
      }
    }

    await commitInChunks(db, ops);
    return selectedRows.length;
  } catch (error) {
    throw logDiagnosticError(error, 'sales.importCleanedCsvSales', { shopId });
  }
}

export async function updateSaleClassification(
  shopId: string,
  saleId: string,
  updates: {
    orderType?: 'normal' | 'bulk';
    isPromotion?: boolean;
    promoTag?: string;
    anomalyAction?: AnomalyAction;
  },
): Promise<void> {
  try {
    await updateDoc(doc(salesCollectionRef(shopId), saleId), updates);
  } catch (error) {
    throw logDiagnosticError(error, 'sales.updateSaleClassification', { shopId, saleId });
  }
}

export async function deleteSaleRecord(shopId: string, saleId: string): Promise<void> {
  try {
    await deleteDoc(doc(salesCollectionRef(shopId), saleId));
  } catch (error) {
    throw logDiagnosticError(error, 'sales.deleteSaleRecord', { shopId, saleId });
  }
}
