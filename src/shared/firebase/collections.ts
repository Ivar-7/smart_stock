import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebaseClient';

export function shopDocRef(shopId: string): DocumentReference {
  return doc(getFirebaseDb(), 'shops', shopId);
}

export function suppliersCollectionRef(shopId: string): CollectionReference {
  return collection(getFirebaseDb(), 'shops', shopId, 'suppliers');
}

export function productsCollectionRef(shopId: string): CollectionReference {
  return collection(getFirebaseDb(), 'shops', shopId, 'products');
}

export function salesCollectionRef(shopId: string): CollectionReference {
  return collection(getFirebaseDb(), 'shops', shopId, 'sales');
}

export function restockOrdersCollectionRef(shopId: string): CollectionReference {
  return collection(getFirebaseDb(), 'shops', shopId, 'restockOrders');
}

export function stockMovementsCollectionRef(shopId: string): CollectionReference {
  return collection(getFirebaseDb(), 'shops', shopId, 'stockMovements');
}

export function alertStatesCollectionRef(shopId: string): CollectionReference {
  return collection(getFirebaseDb(), 'shops', shopId, 'alertStates');
}
