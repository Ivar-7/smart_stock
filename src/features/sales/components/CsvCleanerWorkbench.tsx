import { Check, FileSpreadsheet, Sparkles, Upload } from 'lucide-react';
import { useMemo, useState, type ChangeEvent } from 'react';
import { toAppError } from '../../../shared/errors';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { Textarea } from '../../../shared/ui/FormFields';
import { useToast } from '../../../shared/ui/useToast';
import { formatCurrency } from '../../../shared/utils/format';
import { buildMessySamplePosCsv } from '../../seed/seedDataset';
import { useShopData } from '../../settings/useShopData';
import { importCleanedCsvSales } from '../sales.api';
import type { CleanedCsvRow } from '../sales.types';
import { parseAndCleanSalesCsv } from '../utils/csvCleaner';

export function CsvCleanerWorkbench({ onImported }: { onImported: () => void }) {
  const { shopId, profile, products, sales } = useShopData();
  const { pushToast } = useToast();

  const [rawCsv, setRawCsv] = useState('');
  const [deductStock, setDeductStock] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [rowSelectionOverrides, setRowSelectionOverrides] = useState<Record<number, boolean>>({});

  const currency = profile?.currency ?? 'USD';

  const summary = useMemo(
    () => parseAndCleanSalesCsv(rawCsv, products, sales),
    [rawCsv, products, sales],
  );

  const effectiveRows = useMemo<CleanedCsvRow[]>(
    () =>
      summary.rows.map((row) => ({
        ...row,
        selectedForImport:
          row.status === 'invalid'
            ? false
            : (rowSelectionOverrides[row.rowIndex] ?? row.selectedForImport),
      })),
    [summary.rows, rowSelectionOverrides],
  );

  const selectedCount = effectiveRows.filter((r) => r.selectedForImport).length;

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawCsv(text);
      setRowSelectionOverrides({});
    } catch (err) {
      pushToast({
        title: 'Could not read CSV file',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    }
  };

  const handleLoadMessySample = () => {
    setRawCsv(buildMessySamplePosCsv());
    setRowSelectionOverrides({});
    pushToast({
      title: 'Messy POS sample loaded',
      description: 'Includes duplicates, negative void qty, bad date, and case-mismatched SKUs.',
      tone: 'info',
    });
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const productsById = new Map(products.map((p) => [p.id, p]));
      const count = await importCleanedCsvSales(shopId, effectiveRows, productsById, deductStock);
      pushToast({
        title: `Imported ${count} cleaned sales row${count === 1 ? '' : 's'}`,
        description: 'Forecasts and reorder points refreshed automatically.',
        tone: 'success',
      });
      setRawCsv('');
      setRowSelectionOverrides({});
      onImported();
    } catch (err) {
      pushToast({
        title: 'Import failed',
        description: toAppError(err).userMessage,
        tone: 'error',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="text-ink-secondary h-4 w-4" />
              <span>POS File Upload &amp; Automatic Data Cleaner</span>
            </CardTitle>
            <CardDescription>
              Standardizes mixed dates, trims whitespace, matches SKUs, skips duplicate rows,
              quarantines errors, and flags bulk orders before saving.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLoadMessySample}
            leftIcon={<Sparkles className="h-3.5 w-3.5" />}
          >
            Load Messy Sample CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="bg-panel-subtle border-edge text-ink hover:bg-panel-hover inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-4 text-xs font-medium transition-colors">
              <Upload className="h-3.5 w-3.5" />
              <span>Choose CSV / TSV File</span>
              <input
                id="csv-file-upload"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
            <span className="text-ink-muted text-xs">
              Expected columns:{' '}
              <code>date, sku, qty, unit_price, promo_tag, order_type, notes</code>
            </span>
          </div>

          <Textarea
            id="csv-raw-input"
            aria-label="Raw CSV sales input"
            value={rawCsv}
            onChange={(e) => {
              setRawCsv(e.target.value);
              setRowSelectionOverrides({});
            }}
            placeholder="Paste POS CSV rows here, choose a file above, or click Load Messy Sample CSV..."
            className="min-h-32 font-mono text-xs"
          />
        </CardContent>
      </Card>

      {summary.totalRows > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="p-3.5">
              <p className="text-ink-muted text-xs">Total Rows</p>
              <p className="text-ink mt-1 text-lg font-semibold tabular-nums">
                {summary.totalRows}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-ink-muted text-xs">Ready to Import</p>
              <p className="mt-1 text-lg font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                {summary.readyCount}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-ink-muted text-xs">Auto-Cleaned</p>
              <p className="text-ink mt-1 text-lg font-semibold tabular-nums">
                {summary.cleanedCount}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-ink-muted text-xs">Duplicates Skipped</p>
              <p className="mt-1 text-lg font-semibold text-amber-600 tabular-nums dark:text-amber-400">
                {summary.duplicateCount}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-ink-muted text-xs">Invalid Quarantined</p>
              <p className="mt-1 text-lg font-semibold text-rose-600 tabular-nums dark:text-rose-400">
                {summary.invalidCount}
              </p>
            </Card>
            <Card className="p-3.5">
              <p className="text-ink-muted text-xs">Bulk / Promo Flagged</p>
              <p className="text-ink mt-1 text-lg font-semibold tabular-nums">
                {summary.bulkDetectedCount} / {summary.promoDetectedCount}
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Cleaning Preview ({selectedCount} selected)</CardTitle>
                <CardDescription>
                  Review auto-normalized fields and quarantined lines before committing to Firestore
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="csv-deduct-stock"
                  className="flex cursor-pointer items-center gap-2 text-xs"
                >
                  <input
                    id="csv-deduct-stock"
                    type="checkbox"
                    checked={deductStock}
                    onChange={(e) => setDeductStock(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="text-ink-secondary">Deduct from current stock</span>
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selectedCount === 0}
                  isLoading={isImporting}
                  onClick={() => void handleImport()}
                  leftIcon={<Check className="h-3.5 w-3.5" />}
                >
                  Import {selectedCount} Cleaned Rows
                </Button>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-edge text-ink-muted border-y font-medium">
                    <th className="px-4 py-2.5">Use</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Matched Product</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Unit Price</th>
                    <th className="px-4 py-2.5">Cleaning Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-edge divide-y">
                  {effectiveRows.map((row) => {
                    const tone =
                      row.status === 'invalid'
                        ? 'critical'
                        : row.status === 'duplicate'
                          ? 'warning'
                          : row.status === 'cleaned'
                            ? 'info'
                            : 'healthy';
                    return (
                      <tr key={row.rowIndex} className="hover:bg-panel-subtle/50">
                        <td className="px-4 py-2.5">
                          <input
                            id={`csv-row-select-${row.rowIndex}`}
                            aria-label={`Select CSV row ${row.rowIndex}`}
                            type="checkbox"
                            disabled={row.status === 'invalid'}
                            checked={row.selectedForImport}
                            onChange={(e) =>
                              setRowSelectionOverrides((prev) => ({
                                ...prev,
                                [row.rowIndex]: e.target.checked,
                              }))
                            }
                            className="h-3.5 w-3.5 rounded accent-zinc-900 dark:accent-zinc-100"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone={tone}>{row.status}</Badge>
                        </td>
                        <td className="text-ink px-4 py-2.5 font-mono">
                          {row.soldDate ?? row.rawDate}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-ink font-medium">
                            {row.matchedProductName ?? row.rawSkuOrName}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {row.orderType === 'bulk' ? <Badge tone="warning">Bulk</Badge> : null}
                            {row.isPromotion ? (
                              <Badge tone="info">{row.promoTag || 'Promo'}</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-ink px-4 py-2.5 text-right tabular-nums">
                          {row.quantity ?? row.rawQuantity}
                        </td>
                        <td className="text-ink px-4 py-2.5 text-right tabular-nums">
                          {row.unitPrice !== null
                            ? formatCurrency(row.unitPrice, currency)
                            : row.rawPrice || '—'}
                        </td>
                        <td className="text-ink-muted px-4 py-2.5">
                          {row.flags.length > 0 ? row.flags.join(' · ') : 'Clean row'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
