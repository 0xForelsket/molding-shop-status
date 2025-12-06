import { Pencil, Trash2 } from 'lucide-react';
import type React from 'react';

// Reusable CRUD Table Component
export function CrudTable<T extends object>({
  data,
  columns,
  keyField,
  onEdit,
  onDelete,
  isLoading,
}: {
  data: T[];
  columns: {
    key: keyof T;
    label: string;
    render?: (value: T[keyof T], row: T) => React.ReactNode;
  }[];
  keyField: keyof T;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                  className="px-6 py-12 text-center text-slate-400 italic"
                >
                  No data found
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={String(row[keyField])}
                  className="hover:bg-slate-50 transition-colors duration-150"
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-6 py-4 text-sm text-slate-700">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
