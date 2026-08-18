import { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { TableColumn, TableRow } from '@/types/app';
import { Badge } from './Badge';
import { Modal } from './Modal';

interface DataTableProps {
  columns: TableColumn[];
  rows: TableRow[];
}

export function DataTable({ columns, rows }: DataTableProps) {
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <>
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
            {visibleRows.map((row, index) => (
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
                  <button
                    className="row-action"
                    aria-label="Open row details"
                    onClick={() => setSelectedRow(row)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {!visibleRows.length && (
              <tr>
                <td className="table-empty" colSpan={columns.length + 1}>
                  No records match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="table-pagination">
          <p>
            Showing{' '}
            <strong>
              {rows.length ? (currentPage - 1) * pageSize + 1 : 0}–
              {Math.min(currentPage * pageSize, rows.length)}
            </strong>{' '}
            of {rows.length}
          </p>
          <div>
            <button
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
              <button
                className={number === currentPage ? 'active' : ''}
                onClick={() => setPage(number)}
                key={number}
              >
                {number}
              </button>
            ))}
            <button
              aria-label="Next page"
              disabled={currentPage === pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      <Modal
        open={Boolean(selectedRow)}
        onClose={() => setSelectedRow(null)}
        title="Record details"
        footer={
          <button className="button" onClick={() => setSelectedRow(null)}>
            Done
          </button>
        }
      >
        <div className="form-grid">
          {selectedRow &&
            columns.map((column) => (
              <label key={column.key}>
                {column.label}
                <input value={String(selectedRow[column.key])} readOnly />
              </label>
            ))}
        </div>
      </Modal>
    </>
  );
}
