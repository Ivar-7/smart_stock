import {
  addDoc,
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
  stockMovementsCollectionRef,
  suppliersCollectionRef,
} from '../../shared/firebase/collections';
import { getFirebaseDb } from '../../shared/firebase/firebaseClient';
import { timestampToIso } from '../../shared/firebase/firestoreHelpers';
import { productInputSchema, stockAdjustmentSchema, supplierInputSchema } from './inventory.schema';
import type {
  Product,
  ProductInput,
  StockMovement,
  Supplier,
  SupplierInput,
} from './inventory.types';

const stockMovementDocSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  delta: z.number(),
  previousStock: z.number(),
  newStock: z.number(),
  reason: z.enum(['sale', 'restock_received', 'spoilage', 'cycle_count', 'initial_seed']),
  note: z.string(),
});

export function subscribeToSuppliers(
  shopId: string,
  onData: (suppliers: Supplier[]) => void,
  onError: (error: AppErrorType) => void,
): Unsubscribe {
  const q = query(suppliersCollectionRef(shopId), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Supplier[] = [];
      for (const docSnap of snapshot.docs) {
        const raw = docSnap.data();
        const parsed = supplierInputSchema.safeParse(raw);
        if (parsed.success) {
          items.push({
            id: docSnap.id,
            ...parsed.data,
            createdAt: timestampToIso(raw.createdAt),
            updatedAt: timestampToIso(raw.updatedAt),
          });
        }
      }
      onData(items);
    },
    (error) => {
      onError(logDiagnosticError(error, 'inventory.subscribeToSuppliers', { shopId }));
    },
  );
}

export function subscribeToProducts(
  shopId: string,
  onData: (products: Product[]) => void,
  onError: (error: AppErrorType) => void,
): Unsubscribe {
  const q = query(productsCollectionRef(shopId), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Product[] = [];
      for (const docSnap of snapshot.docs) {
        const raw = docSnap.data();
        const parsed = productInputSchema.safeParse(raw);
        if (parsed.success) {
          items.push({
            id: docSnap.id,
            ...parsed.data,
            createdAt: timestampToIso(raw.createdAt),
            updatedAt: timestampToIso(raw.updatedAt),
          });
        }
      }
      onData(items);
    },
    (error) => {
      onError(logDiagnosticError(error, 'inventory.subscribeToProducts', { shopId }));
    },
  );
}

export function subscribeToStockMovements(
  shopId: string,
  onData: (movements: StockMovement[]) => void,
  onError: (error: AppErrorType) => void,
): Unsubscribe {
  const q = query(stockMovementsCollectionRef(shopId), orderBy('createdAt', 'desc'), limit(120));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: StockMovement[] = [];
      for (const docSnap of snapshot.docs) {
        const raw = docSnap.data();
        const parsed = stockMovementDocSchema.safeParse(raw);
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
      onError(logDiagnosticError(error, 'inventory.subscribeToStockMovements', { shopId }));
    },
  );
}

export async function createProduct(shopId: string, input: ProductInput): Promise<string> {
  try {
    const validated = productInputSchema.parse(input);
    const ref = await addDoc(productsCollectionRef(shopId), {
      ...validated,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    throw logDiagnosticError(error, 'inventory.createProduct', { shopId });
  }
}

export async function updateProduct(
  shopId: string,
  productId: string,
  input: ProductInput,
): Promise<void> {
  try {
    const validated = productInputSchema.parse(input);
    const ref = doc(productsCollectionRef(shopId), productId);
    await updateDoc(ref, {
      ...validated,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw logDiagnosticError(error, 'inventory.updateProduct', { shopId, productId });
  }
}

export async function deleteProduct(shopId: string, productId: string): Promise<void> {
  try {
    await deleteDoc(doc(productsCollectionRef(shopId), productId));
  } catch (error) {
    throw logDiagnosticError(error, 'inventory.deleteProduct', { shopId, productId });
  }
}

export async function createSupplier(shopId: string, input: SupplierInput): Promise<string> {
  try {
    const validated = supplierInputSchema.parse(input);
    const ref = await addDoc(suppliersCollectionRef(shopId), {
      ...validated,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    throw logDiagnosticError(error, 'inventory.createSupplier', { shopId });
  }
}

export async function updateSupplier(
  shopId: string,
  supplierId: string,
  input: SupplierInput,
): Promise<void> {
  try {
    const validated = supplierInputSchema.parse(input);
    await updateDoc(doc(suppliersCollectionRef(shopId), supplierId), {
      ...validated,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw logDiagnosticError(error, 'inventory.updateSupplier', { shopId, supplierId });
  }
}

export async function adjustProductStock(
  shopId: string,
  rawInput: z.infer<typeof stockAdjustmentSchema>,
): Promise<void> {
  try {
    const input = stockAdjustmentSchema.parse(rawInput);
    const db = getFirebaseDb();
    const productRef = doc(productsCollectionRef(shopId), input.productId);
    const movementRef = doc(stockMovementsCollectionRef(shopId));

    await runTransaction(db, async (tx) => {
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) {
        throw new AppError({
          code: 'FIRESTORE_NOT_FOUND',
          userMessage: 'This product no longer exists in your catalog.',
        });
      }
      const data = productSnap.data();
      const prevStock = typeof data.currentStock === 'number' ? data.currentStock : 0;
      const productName = typeof data.name === 'string' ? data.name : 'Product';

      let nextStock: number;
      if (input.mode === 'add') {
        nextStock = prevStock + input.quantity;
      } else if (input.mode === 'remove') {
        nextStock = Math.max(0, prevStock - input.quantity);
      } else {
        nextStock = input.quantity;
      }

      const delta = Math.round((nextStock - prevStock) * 100) / 100;
      const updates: Record<string, unknown> = {
        currentStock: nextStock,
        updatedAt: serverTimestamp(),
      };
      if (input.expiryDate !== null) {
        updates.nearestExpiryDate = input.expiryDate;
      }

      tx.update(productRef, updates);
      tx.set(movementRef, {
        productId: input.productId,
        productName,
        delta,
        previousStock: prevStock,
        newStock: nextStock,
        reason: input.reason,
        note: input.note,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw logDiagnosticError(error, 'inventory.adjustProductStock', { shopId });
  }
}
