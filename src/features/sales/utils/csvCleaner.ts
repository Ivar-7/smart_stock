import { parseFlexibleDateToIso } from '../../../shared/utils/date';
import type { Product } from '../../inventory/inventory.types';
import type { CleanedCsvRow, CsvImportSummary, SaleRecord } from '../sales.types';

function splitDelimitedLine(line: string, delimiter: ',' | '\t' | ';'): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string): ',' | '\t' | ';' {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas && semis > 0) return ';';
  return ',';
}

function normalizeHeaderName(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface ColumnMap {
  dateIdx: number;
  productIdx: number;
  qtyIdx: number;
  priceIdx: number;
  promoIdx: number;
  typeIdx: number;
  notesIdx: number;
}

function resolveColumns(headers: readonly string[]): ColumnMap {
  const norm = headers.map(normalizeHeaderName);
  const findCol = (candidates: readonly string[]) =>
    norm.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  return {
    dateIdx: findCol(['solddate', 'date', 'txdate', 'day']),
    productIdx: findCol(['sku', 'product', 'item', 'productname', 'code']),
    qtyIdx: findCol(['quantity', 'qty', 'units', 'sold']),
    priceIdx: findCol(['unitprice', 'price', 'amount']),
    promoIdx: findCol(['promotag', 'promo', 'promotion', 'discount']),
    typeIdx: findCol(['ordertype', 'type', 'channel']),
    notesIdx: findCol(['notes', 'note', 'memo']),
  };
}

function matchProduct(
  rawIdentifier: string,
  products: readonly Product[],
): {
  product: Product | null;
  wasNormalized: boolean;
} {
  const trimmed = rawIdentifier.trim();
  if (!trimmed) {
    return { product: null, wasNormalized: false };
  }
  const exactSku = products.find((p) => p.sku === trimmed);
  if (exactSku) {
    return { product: exactSku, wasNormalized: false };
  }
  const upperNormalized = trimmed.toUpperCase().replace(/\s+/g, '-');
  const fuzzySku = products.find(
    (p) => p.sku.toUpperCase() === trimmed.toUpperCase() || p.sku.toUpperCase() === upperNormalized,
  );
  if (fuzzySku) {
    return { product: fuzzySku, wasNormalized: true };
  }
  const lowerName = trimmed.toLowerCase();
  const byName = products.find(
    (p) => p.name.toLowerCase() === lowerName || p.name.toLowerCase().includes(lowerName),
  );
  if (byName) {
    return { product: byName, wasNormalized: byName.name !== trimmed };
  }
  return { product: null, wasNormalized: false };
}

/**
 * Parses and cleans POS sales CSV/TSV files:
 * - Normalizes dates & currency symbols
 * - Matches SKUs / names case-insensitively
 * - Flags & skips duplicates against both the file and existing Firestore history
 * - Auto-tags wholesale bulk orders and promotional lines
 * - Quarantines malformed rows with clear human-readable reasons
 */
export function parseAndCleanSalesCsv(
  rawText: string,
  products: readonly Product[],
  existingSales: readonly SaleRecord[],
): CsvImportSummary {
  const sanitized = rawText.replace(/^\uFEFF/, '').trim();
  if (!sanitized) {
    return {
      totalRows: 0,
      readyCount: 0,
      cleanedCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      bulkDetectedCount: 0,
      promoDetectedCount: 0,
      rows: [],
    };
  }

  const lines = sanitized.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      totalRows: 0,
      readyCount: 0,
      cleanedCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      bulkDetectedCount: 0,
      promoDetectedCount: 0,
      rows: [],
    };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = splitDelimitedLine(lines[0]!, delimiter);
  const cols = resolveColumns(headers);

  // Build duplicate fingerprint set from recent sales (date|productId|qty)
  const seenSignatures = new Set<string>();
  for (const s of existingSales) {
    seenSignatures.add(`${s.soldDate}|${s.productId}|${s.quantity}`);
  }

  const rows: CleanedCsvRow[] = [];
  let readyCount = 0;
  let cleanedCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let bulkDetectedCount = 0;
  let promoDetectedCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitDelimitedLine(lines[i]!, delimiter);
    const rawDate = cols.dateIdx >= 0 ? (cells[cols.dateIdx] ?? '') : (cells[0] ?? '');
    const rawSkuOrName = cols.productIdx >= 0 ? (cells[cols.productIdx] ?? '') : (cells[1] ?? '');
    const rawQuantity = cols.qtyIdx >= 0 ? (cells[cols.qtyIdx] ?? '') : (cells[2] ?? '');
    const rawPrice = cols.priceIdx >= 0 ? (cells[cols.priceIdx] ?? '') : (cells[3] ?? '');
    const rawPromo = cols.promoIdx >= 0 ? (cells[cols.promoIdx] ?? '') : '';
    const rawType = cols.typeIdx >= 0 ? (cells[cols.typeIdx] ?? '') : '';
    const rawNotes = cols.notesIdx >= 0 ? (cells[cols.notesIdx] ?? '') : '';

    const flags: string[] = [];
    let wasCleaned = false;

    const soldDate = parseFlexibleDateToIso(rawDate);
    if (!soldDate) {
      flags.push('Invalid or missing date');
    } else if (soldDate !== rawDate.trim()) {
      flags.push(`Normalized date -> ${soldDate}`);
      wasCleaned = true;
    }

    const { product, wasNormalized } = matchProduct(rawSkuOrName, products);
    if (!product) {
      flags.push(`Unknown product/SKU "${rawSkuOrName || '(blank)'}"`);
    } else if (wasNormalized) {
      flags.push(`Matched "${rawSkuOrName}" -> ${product.sku}`);
      wasCleaned = true;
    }

    const numericQtyStr = rawQuantity.replace(/,/g, '').trim();
    const parsedQty = Number(numericQtyStr);
    const quantity =
      numericQtyStr.length > 0 && Number.isFinite(parsedQty) && parsedQty > 0
        ? Math.round(parsedQty * 100) / 100
        : null;
    if (quantity === null) {
      flags.push(
        parsedQty <= 0 && numericQtyStr !== ''
          ? `Invalid quantity (${rawQuantity})`
          : 'Missing numeric quantity',
      );
    }

    const cleanedPriceStr = rawPrice.replace(/[$,€£\s]/g, '').trim();
    const parsedPrice = cleanedPriceStr.length > 0 ? Number(cleanedPriceStr) : Number.NaN;
    let unitPrice: number | null = null;
    if (Number.isFinite(parsedPrice) && parsedPrice >= 0) {
      unitPrice = Math.round(parsedPrice * 100) / 100;
      if (cleanedPriceStr !== rawPrice.trim() && rawPrice.trim() !== '') {
        flags.push('Stripped currency symbol');
        wasCleaned = true;
      }
    } else if (product) {
      unitPrice = product.sellingPrice;
      if (rawPrice.trim() === '') {
        flags.push('Filled missing price from catalog');
        wasCleaned = true;
      }
    }

    const promoTag = rawPromo.trim();
    const isPromotion =
      promoTag.length > 0 && !['none', 'no', 'false', '0', '-'].includes(promoTag.toLowerCase());
    if (isPromotion) {
      promoDetectedCount += 1;
    }

    const explicitBulk = /bulk|wholesale|b2b/i.test(rawType);
    const autoBulk = product !== null && quantity !== null && quantity >= product.bulkUnitThreshold;
    const orderType = explicitBulk || autoBulk ? 'bulk' : 'normal';
    if (orderType === 'bulk') {
      flags.push(autoBulk && !explicitBulk ? 'Auto-tagged bulk order' : 'Bulk order');
      bulkDetectedCount += 1;
    }

    let status: CleanedCsvRow['status'] = 'valid';
    if (!soldDate || !product || quantity === null) {
      status = 'invalid';
      invalidCount += 1;
    } else {
      const signature = `${soldDate}|${product.id}|${quantity}`;
      if (seenSignatures.has(signature)) {
        status = 'duplicate';
        duplicateCount += 1;
        flags.push('Duplicate row skipped by default');
      } else {
        seenSignatures.add(signature);
        if (wasCleaned) {
          status = 'cleaned';
          cleanedCount += 1;
        }
        readyCount += 1;
      }
    }

    rows.push({
      rowIndex: i,
      rawDate,
      rawSkuOrName,
      rawQuantity,
      rawPrice,
      soldDate,
      matchedProductId: product?.id ?? null,
      matchedSku: product?.sku ?? null,
      matchedProductName: product?.name ?? null,
      quantity,
      unitPrice,
      orderType,
      isPromotion,
      promoTag: isPromotion ? promoTag : '',
      notes: rawNotes.trim(),
      status,
      flags,
      selectedForImport: status === 'valid' || status === 'cleaned',
    });
  }

  return {
    totalRows: rows.length,
    readyCount,
    cleanedCount,
    duplicateCount,
    invalidCount,
    bulkDetectedCount,
    promoDetectedCount,
    rows,
  };
}
