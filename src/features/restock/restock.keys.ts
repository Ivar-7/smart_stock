export const restockKeys = {
  orders: (shopId: string) => ['shops', shopId, 'restockOrders'] as const,
  alerts: (shopId: string) => ['shops', shopId, 'alertStates'] as const,
};
