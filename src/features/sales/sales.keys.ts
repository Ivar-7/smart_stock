export const salesKeys = {
  all: (shopId: string) => ['shops', shopId, 'sales'] as const,
};
