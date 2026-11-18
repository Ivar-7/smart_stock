import {
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { z } from 'zod';
import { AppError, logDiagnosticError, type AppError as AppErrorType } from '../../shared/errors';
import {
  alertStatesCollectionRef,
  productsCollectionRef,
  restockOrdersCollectionRef,
  stockMovementsCollectionRef,
} from '../../shared/firebase/collections';
import { getFirebaseDb } from '../../shared/firebase/firebaseClient';
import { timestampToIso } from '../../shared/firebase/firestoreHelpers';
import { todayIsoDate } from '../../shared/utils/date';
import type { Product, Supplier } from '../inventory/inventory.types';
import { createRestockOrderSchema, receiveRestockOrderSchema } from './restock.schema';
import type { AlertStateRecord, RestockOrder } from './restock.types';

const restockOrderDocSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  supplierId: z.string(),
  supplierName: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
  totalCost: z.number(),
  status: z.enum(['ordered', 'received', 'cancelled']),
  expectedDate: z.string(),
  receivedDate: z.string().nullable(),
  notes: z.string(),
});

const alertStateDocSchema = z.object({
  status: z.enum(['read', 'dismissed', 'snoozed']),
  snoozedUntil: z.string().nullable(),
});

export function subscribeToRestockOrders(
  shopId: string,
  onData: (orders: RestockOrder[]) => void,
  onError: (error: AppErrorType) => void,
): Unsubscribe {
  const q = query(restockOrdersCollectionRef(shopId), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: RestockOrder[] = [];
      for (const docSnap of snapshot.docs) {
        const raw = docSnap.data();
        const parsed = restockOrderDocSchema.safeParse(raw);
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
      onError(logDiagnosticError(error, 'restock.subscribeToRestockOrders', { shopId }));
    },
  );
}

export function subscribeToAlertStates(
  shopId: string,
  onData: (states: AlertStateRecord[]) => void,
  onError: (error: AppErrorType) => void,
): Unsubscribe {
  return onSnapshot(
    alertStatesCollectionRef(shopId),
    (snapshot) => {
      const items: AlertStateRecord[] = [];
      for (const docSnap of snapshot.docs) {
        const raw = docSnap.data();
        const parsed = alertStateDocSchema.safeParse(raw);
        if (parsed.success) {
          items.push({
            id: docSnap.id,
            ...parsed.data,
            updatedAt: timestampToIso(raw.updatedAt),
          });
        }
      }
      onData(items);
    },
    (error) => {
      onError(logDiagnosticError(error, 'restock.subscribeToAlertStates', { shopId }));
    },
  );
}

export async function createRestockOrder(params: {
  shopId: string;
  product: Product;
  supplier: Supplier | undefined;
  quantity: number;
  expectedDate: string;
  notes: string;
}): Promise<string> {
  try {
    const validated = createRestockOrderSchema.parse({
      productId: params.product.id,
      quantity: params.quantity,
      expectedDate: params.expectedDate,
      notes: params.notes,
    });

    const db = getFirebaseDb();
    const orderRef = doc(restockOrdersCollectionRef(params.shopId));
    const productRef = doc(productsCollectionRef(params.shopId), params.product.id);
    const totalCost = Math.round(validated.quantity * params.product.unitCost * 100) / 100;

    await runTransaction(db, async (tx) => {
      const prodSnap = await tx.get(productRef);
      if (!prodSnap.exists()) {
        throw new AppError({
          code: 'FIRESTORE_NOT_FOUND',
          userMessage: 'Product no longer exists in your catalog.',
        });
      }
      const prevOnOrder =
        typeof prodSnap.data().onOrderQty === 'number' ? prodSnap.data().onOrderQty : 0;

      tx.update(productRef, {
        onOrderQty: prevOnOrder + validated.quantity,
        updatedAt: serverTimestamp(),
      });

      tx.set(orderRef, {
        productId: params.product.id,
        productName: params.product.name,
        supplierId: params.product.supplierId,
        supplierName: params.supplier?.name ?? 'Primary Supplier',
        quantity: validated.quantity,
        unitCost: params.product.unitCost,
        totalCost,
        status: 'ordered',
        expectedDate: validated.expectedDate,
        receivedDate: null,
        notes: validated.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    return orderRef.id;
  } catch (error) {
    throw logDiagnosticError(error, 'restock.createRestockOrder', { shopId: params.shopId });
  }
}

export async function receiveRestockOrder(
  shopId: string,
  rawInput: z.infer<typeof receiveRestockOrderSchema>,
): Promise<void> {
  try {
    const input = receiveRestockOrderSchema.parse(rawInput);
    const db = getFirebaseDb();
    const orderRef = doc(restockOrdersCollectionRef(shopId), input.orderId);

    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) {
        throw new AppError({
          code: 'FIRESTORE_NOT_FOUND',
          userMessage: 'Purchase order not found.',
        });
      }
      const orderData = orderSnap.data();
      if (orderData.status !== 'ordered') {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          userMessage: 'Only pending orders can be marked as received.',
        });
      }

      const productId = String(orderData.productId);
      const orderedQty = Number(orderData.quantity) || 0;
      const productRef = doc(productsCollectionRef(shopId), productId);
      const prodSnap = await tx.get(productRef);

      if (prodSnap.exists()) {
        const prodData = prodSnap.data();
        const prevStock = typeof prodData.currentStock === 'number' ? prodData.currentStock : 0;
        const prevOnOrder = typeof prodData.onOrderQty === 'number' ? prodData.onOrderQty : 0;
        const nextStock = prevStock + input.receivedQty;
        const nextOnOrder = Math.max(0, prevOnOrder - orderedQty);

        const productUpdates: Record<string, unknown> = {
          currentStock: nextStock,
          onOrderQty: nextOnOrder,
          updatedAt: serverTimestamp(),
        };
        if (input.newExpiryDate !== null) {
          productUpdates.nearestExpiryDate = input.newExpiryDate;
        }
        tx.update(productRef, productUpdates);

        const movementRef = doc(stockMovementsCollectionRef(shopId));
        tx.set(movementRef, {
          productId,
          productName: String(orderData.productName ?? prodData.name ?? 'Product'),
          delta: input.receivedQty,
          previousStock: prevStock,
          newStock: nextStock,
          reason: 'restock_received',
          note: input.note || `Received PO (${input.receivedQty} units)`,
          createdAt: serverTimestamp(),
        });
      }

      tx.update(orderRef, {
        status: 'received',
        receivedDate: todayIsoDate(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw logDiagnosticError(error, 'restock.receiveRestockOrder', { shopId });
  }
}

export async function cancelRestockOrder(shopId: string, order: RestockOrder): Promise<void> {
  try {
    if (order.status !== 'ordered') {
      return;
    }
    const db = getFirebaseDb();
    const orderRef = doc(restockOrdersCollectionRef(shopId), order.id);
    const productRef = doc(productsCollectionRef(shopId), order.productId);

    await runTransaction(db, async (tx) => {
      const prodSnap = await tx.get(productRef);
      if (prodSnap.exists()) {
        const prevOnOrder =
          typeof prodSnap.data().onOrderQty === 'number' ? prodSnap.data().onOrderQty : 0;
        tx.update(productRef, {
          onOrderQty: Math.max(0, prevOnOrder - order.quantity),
          updatedAt: serverTimestamp(),
        });
      }
      tx.update(orderRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    throw logDiagnosticError(error, 'restock.cancelRestockOrder', { shopId });
  }
}

export async function setAlertState(
  shopId: string,
  alertId: string,
  status: 'read' | 'dismissed' | 'snoozed',
  snoozedUntil: string | null = null,
): Promise<void> {
  try {
    const ref = doc(alertStatesCollectionRef(shopId), alertId);
    await setDoc(ref, {
      status,
      snoozedUntil,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw logDiagnosticError(error, 'restock.setAlertState', { shopId, alertId });
  }
}

export async function updateRestockNotes(
  shopId: string,
  orderId: string,
  notes: string,
): Promise<void> {
  try {
    await updateDoc(doc(restockOrdersCollectionRef(shopId), orderId), {
      notes: notes.slice(0, 300),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw logDiagnosticError(error, 'restock.updateRestockNotes', { shopId, orderId });
  }
}
