// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage: string;
  emptyIcon?: ReactNode;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  onRowMouseEnter?: (row: T) => void;
  onRowMouseLeave?: (row: T) => void;
  getRowClassName?: (row: T) => string | undefined;
  isRowExpanded?: (row: T) => boolean;
  renderExpandedRow?: (row: T) => ReactNode;
  /** Embedded inside another card — no outer chrome / fixed min-width. */
  variant?: "card" | "plain";
  className?: string;
}

export function Table<T>({
  columns,
  data,
  emptyMessage,
  emptyIcon,
  rowKey,
  onRowClick,
  onRowMouseEnter,
  onRowMouseLeave,
  getRowClassName,
  isRowExpanded,
  renderExpandedRow,
  variant = "card",
  className,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-16 text-center text-[var(--color-text-muted)]",
          variant === "card" &&
            "rounded-2xl border border-dashed border-gray-200 bg-[var(--color-surface)]",
          className,
        )}
      >
        {emptyIcon ? <div className="mb-3 opacity-60">{emptyIcon}</div> : null}
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const table = (
    <table
      className={cn(
        "w-full border-collapse text-start text-sm",
        variant === "card" && "min-w-[640px]",
      )}
    >
      <thead>
        <tr className="border-b border-gray-100 bg-gray-50/80">
          {columns.map((col) => (
            <th
              key={col.key}
              className={cn(
                "font-semibold text-[var(--color-text)]",
                variant === "plain" ? "px-2 py-2 text-xs" : "px-4 py-3",
                col.className,
              )}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => {
          const key = rowKey(row);
          const expanded = Boolean(renderExpandedRow && isRowExpanded?.(row));
          return (
            <Fragment key={key}>
              <tr
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onMouseEnter={onRowMouseEnter ? () => onRowMouseEnter(row) : undefined}
                onMouseLeave={onRowMouseLeave ? () => onRowMouseLeave(row) : undefined}
                className={cn(
                  "border-b border-gray-50 last:border-0",
                  onRowClick || onRowMouseEnter
                    ? "cursor-pointer hover:bg-gray-50/70"
                    : "hover:bg-gray-50/50",
                  getRowClassName?.(row),
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "text-[var(--color-text)]",
                      variant === "plain" ? "px-2 py-1.5" : "px-4 py-3",
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
              {expanded ? (
                <tr className="border-b border-gray-100 bg-[var(--color-bg)] last:border-0">
                  <td colSpan={columns.length} className="px-4 py-3 text-sm text-[var(--color-text)]">
                    {renderExpandedRow!(row)}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );

  if (variant === "plain") {
    return <div className={cn("min-w-0 overflow-x-auto", className)}>{table}</div>;
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-gray-100 bg-[var(--color-surface)] shadow-sm",
        className,
      )}
    >
      {table}
    </div>
  );
}
