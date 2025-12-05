// packages/web/src/components/OrderImport.tsx
// Bulk import production orders from Excel (paste TSV)

import { useState } from 'react';
import { getAuthHeader } from '../lib/auth';

interface ImportResult {
  imported: number;
  skippedDuplicates: string[];
  duplicatesInImport: string[];
}

export function OrderImport({
  onClose,
  onSuccess,
}: { onClose: () => void; onSuccess?: () => void }) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!text.trim()) {
      setError('Please paste order data');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/orders/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          ...getAuthHeader(),
        },
        body: text,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const data: ImportResult = await res.json();
      setResult(data);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Import Production Orders</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          Paste data from Excel with 3 columns: <strong>Order Number</strong>,{' '}
          <strong>Part Number</strong>, <strong>Quantity</strong> (tab-separated)
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="PO-2024-001	PART-A	1000
PO-2024-002	PART-B	500
PO-2024-003	PART-C	2000"
          className="w-full h-48 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && (
          <div className="mt-4 bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded-lg text-sm">
            <p className="font-bold">✓ Imported {result.imported} orders</p>
            {result.skippedDuplicates.length > 0 && (
              <p className="mt-1">Skipped (already exist): {result.skippedDuplicates.join(', ')}</p>
            )}
            {result.duplicatesInImport.length > 0 && (
              <p className="mt-1">Duplicates in paste: {result.duplicatesInImport.join(', ')}</p>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isLoading ? 'Importing...' : 'Import Orders'}
          </button>
        </div>
      </div>
    </div>
  );
}
