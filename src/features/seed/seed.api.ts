import {
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type writeBatch,
} from 'firebase/firestore';
import { logDiagnosticError } from '../../shared/errors';
import {
  alertStatesCollectionRef,
  productsCollectionRef,
  restockOrdersCollectionRef,
  salesCollectionRef,
  shopDocRef,
  stockMovementsCollectionRef,
  suppliersCollectionRef,
} from '../../shared/firebase/collections';
import { getFirebaseDb } from '../../shared/firebase/firebaseClient';
import { commitInChunks } from '../../shared/firebase/firestoreHelpers';
import { buildProductionSeedBundle } from './seedDataset';

type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;

async function collectDeletes(shopId: string): Promise<BatchOp[]> {
  const ops: BatchOp[] = [];
  const collections = [
    suppliersCollectionRef(shopId),
    productsCollectionRef(shopId),
    salesCollectionRef(shopId),
    restockOrdersCollectionRef(shopId),
    stockMovementsCollectionRef(shopId),
    alertStatesCollectionRef(shopId),
  ];

  const snapshots = await Promise.all(collections.map((ref) => getDocs(ref)));
  for (const snap of snapshots) {
    for (const d of snap.docs) {
      ops.push((batch) => {
        batch.delete(d.ref);
      });
    }
  }
  return ops;
}

export async function seedShopWorkspace(
  shopId: string,
  options?: {
    shopName?: string;
    clearExisting?: boolean;
    onProgress?: (message: string) => void;
  },
): Promise<void> {
  try {
    const db = getFirebaseDb();
    const bundle = buildProductionSeedBundle();

    if (options?.clearExisting) {
      options.onProgress?.('Clearing previous workspace records...');
      const deleteOps = await collectDeletes(shopId);
      if (deleteOps.length > 0) {
        await commitInChunks(db, deleteOps);
      }
    }

    options?.onProgress?.('Configuring shop profile & suppliers...');
    const shopRef = shopDocRef(shopId);
    const existingShopSnap = await getDoc(shopRef);
    const desiredName = options?.shopName?.trim() || bundle.shopSettings.name;

    if (existingShopSnap.exists()) {
      await updateDoc(shopRef, {
        ...bundle.shopSettings,
        name: desiredName,
        seededAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(shopRef, {
        ...bundle.shopSettings,
        name: desiredName,
        ownerUid: shopId,
        seededAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const writeOps: BatchOp[] = [];

    for (const supplier of bundle.suppliers) {
      const ref = doc(suppliersCollectionRef(shopId), supplier.id);
      writeOps.push((batch) => {
        batch.set(ref, {
          name: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          defaultLeadTimeDays: supplier.defaultLeadTimeDays,
          orderDays: supplier.orderDays,
          notes: supplier.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    }

    for (const product of bundle.products) {
      const ref = doc(productsCollectionRef(shopId), product.id);
      writeOps.push((batch) => {
        batch.set(ref, {
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          currentStock: product.currentStock,
          onOrderQty: product.onOrderQty,
          unitCost: product.unitCost,
          sellingPrice: product.sellingPrice,
          supplierId: product.supplierId,
          leadTimeDays: product.leadTimeDays,
          safetyDays: product.safetyDays,
          packSize: product.packSize,
          isPerishable: product.isPerishable,
          shelfLifeDays: product.shelfLifeDays,
          nearestExpiryDate: product.nearestExpiryDate,
          bulkUnitThreshold: product.bulkUnitThreshold,
          isActive: product.isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    }

    for (const order of bundle.restockOrders) {
      const ref = doc(restockOrdersCollectionRef(shopId), order.id);
      writeOps.push((batch) => {
        batch.set(ref, {
          productId: order.productId,
          productName: order.productName,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          quantity: order.quantity,
          unitCost: order.unitCost,
          totalCost: order.totalCost,
          status: order.status,
          expectedDate: order.expectedDate,
          receivedDate: order.receivedDate,
          notes: order.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    }

    for (const movement of bundle.stockMovements) {
      const ref = doc(stockMovementsCollectionRef(shopId), movement.id);
      writeOps.push((batch) => {
        batch.set(ref, {
          productId: movement.productId,
          productName: movement.productName,
          delta: movement.delta,
          previousStock: movement.previousStock,
          newStock: movement.newStock,
          reason: movement.reason,
          note: movement.note,
          createdAt: serverTimestamp(),
        });
      });
    }

    options?.onProgress?.(`Uploading ${bundle.products.length} products & 90 days of POS sales...`);
    for (const sale of bundle.sales) {
      const ref = doc(salesCollectionRef(shopId), sale.id);
      writeOps.push((batch) => {
        batch.set(ref, {
          productId: sale.productId,
          sku: sale.sku,
          productName: sale.productName,
          soldDate: sale.soldDate,
          quantity: sale.quantity,
          unitPrice: sale.unitPrice,
          orderType: sale.orderType,
          isPromotion: sale.isPromotion,
          promoTag: sale.promoTag,
          anomalyAction: sale.anomalyAction,
          source: sale.source,
          notes: sale.notes,
          createdAt: serverTimestamp(),
        });
      });
    }

    await commitInChunks(db, writeOps, 400);
    options?.onProgress?.('Seed completed!');
  } catch (error) {
    throw logDiagnosticError(error, 'seed.seedShopWorkspace', { shopId });
  }
}
