// E9: generic table used across the staff portals so each screen only declares
// its columns instead of re-implementing thead/tbody markup.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export function DataTable<T>({
  columns, rows, rowKey, empty = "—", loading = false, loadingLabel = "Loading…", className, onRowClick,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border bg-card", className)}>
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-start text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn("p-3 text-start font-medium", c.headerClassName)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn("align-top", onRowClick && "cursor-pointer hover:bg-muted/40")}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("p-3", c.className)}>
                  {c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={columns.length} className="p-4 text-center text-xs text-muted-foreground">{empty}</td></tr>
          )}
        </tbody>
      </table>
      {loading && <p className="p-4 text-sm text-muted-foreground">{loadingLabel}</p>}
    </div>
  );
}
