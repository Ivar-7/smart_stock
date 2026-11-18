export type SalesOrderType = 'normal' | 'bulk';
export type AnomalyAction = 'auto' | 'dampen' | 'keep';
export type SaleSource = 'manual' | 'csv_import' | 'seed';

export interface SaleRecord {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  soldDate: string;
  quantity: number;
  unitPrice: number;
  orderType: SalesOrderType;
  isPromotion: boolean;
  promoTag: string;
  anomalyAction: AnomalyAction;
  source: SaleSource;
  notes: string;
  createdAt: string;
}

export interface SaleInput {
  productId: string;
  soldDate: string;
  quantity: number;
  unitPrice: number;
  orderType: SalesOrderType;
  isPromotion: boolean;
  promoTag: string;
  anomalyAction: AnomalyAction;
  notes: string;
  deductStock: boolean;
}

export type CsvRowStatus = 'valid' | 'cleaned' | 'duplicate' | 'invalid';

export interface CleanedCsvRow {
  rowIndex: number;
  rawDate: string;
  rawSkuOrName: string;
  rawQuantity: string;
  rawPrice: string;
  soldDate: string | null;
  matchedProductId: string | null;
  matchedSku: string | null;
  matchedProductName: string | null;
  quantity: number | null;
  unitPrice: number | null;
  orderType: SalesOrderType;
  isPromotion: boolean;
  promoTag: string;
  notes: string;
  status: CsvRowStatus;
  flags: string[];
  selectedForImport: boolean;
}

export interface CsvImportSummary {
  totalRows: number;
  readyCount: number;
  cleanedCount: number;
  duplicateCount: number;
  invalidCount: number;
  bulkDetectedCount: number;
  promoDetectedCount: number;
  rows: CleanedCsvRow[];
}
