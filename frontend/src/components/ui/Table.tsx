// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { Fragment, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type TableSortOrder = "asc" | "desc";

export interface TableSortState {
  key: string;
  order: TableSortOrder;
}

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** When true, header becomes a sort toggle (requires `sort` + `onSortChange` on Table). */
  sortable?: boolean;
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
  sort?: TableSortState | null;
  onSortChange?: (next: TableSortState) => void;
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
  sort,
  onSortChange,
}: TableProps<T>) {
  const { t } = useTranslation();

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

  function toggleSort(key: string) {
    if (!onSortChange) return;
    if (sort?.key === key) {
      onSortChange({ key, order: sort.order === "asc" ? "desc" : "asc" });
      return;
    }
    onSortChange({ key, order: key === "created_at" ? "desc" : "asc" });
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
          {columns.map((col) => {
            const active = sort?.key === col.key;
            const sortable = Boolean(col.sortable && onSortChange);
            return (
              <th
                key={col.key}
                scope="col"
                aria-sort={
                  sortable && active
                    ? sort.order === "asc"
                      ? "ascending"
                      : "descending"
                    : sortable
                      ? "none"
                      : undefined
                }
                className={cn(
                  "font-semibold text-[var(--color-text)]",
                  variant === "plain" ? "px-2 py-2 text-xs" : "px-4 py-3",
                  col.className,
                )}
              >
                {sortable ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-md text-start outline-none",
                      "hover:text-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30",
                      active && "text-[var(--color-primary)]",
                    )}
                    onClick={() => toggleSort(col.key)}
                    aria-label={t("common.sortBy", { column: col.header })}
                  >
                    <span className="truncate">{col.header}</span>
                    {active && sort.order === "asc" ? (
                      <ArrowUp className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    ) : active && sort.order === "desc" ? (
                      <ArrowDown className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    ) : (
                      <ArrowUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            );
          })}
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
