export const inventoryKeys = {
  products: (shopId: string) => ['shops', shopId, 'products'] as const,
  suppliers: (shopId: string) => ['shops', shopId, 'suppliers'] as const,
  movements: (shopId: string) => ['shops', shopId, 'stockMovements'] as const,
};
