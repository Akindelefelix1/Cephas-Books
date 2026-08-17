import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { TableColumn, TableRow } from '@/types/app';
import { Badge } from './Badge';

interface DataTableProps {
  columns: TableColumn[];
  rows: TableRow[];
}

export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'is-right' : ''}>
                {column.label}
              </th>
            ))}
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${String(row[columns[0].key])}-${index}`}>
              {columns.map((column, columnIndex) => (
                <td
                  key={column.key}
                  className={`${column.align === 'right' ? 'is-right' : ''} ${columnIndex === 0 ? 'is-primary' : ''}`}
                >
                  {column.key === 'status' ? (
                    <Badge>{String(row[column.key])}</Badge>
                  ) : (
                    String(row[column.key])
                  )}
                </td>
              ))}
              <td>
                <button className="row-action" aria-label="Open row actions">
                  <MoreHorizontal size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-pagination">
        <p>
          Showing <strong>1–{rows.length}</strong> of 48
        </p>
        <div>
          <button aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <button className="active">1</button>
          <button>2</button>
          <button>3</button>
          <button aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
