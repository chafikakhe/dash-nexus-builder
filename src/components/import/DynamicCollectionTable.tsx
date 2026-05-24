/**
 * Dynamic Collection Table Component
 * Renders collection records with dynamic columns based on collection fields
 */

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Field } from "@/hooks/useCollections";
import type { CollectionRecord } from "@/hooks/useCollections";

interface DynamicCollectionTableProps {
  records: CollectionRecord[];
  fields: Field[];
  onRowClick?: (record: CollectionRecord) => void;
  onCellChange?: (recordId: string, fieldName: string, value: any) => void;
  searchQuery?: string;
  isLoading?: boolean;
  pageSize?: number;
}

export function DynamicCollectionTable({
  records,
  fields,
  onRowClick,
  onCellChange,
  searchQuery = "",
  isLoading = false,
  pageSize = 100,
}: DynamicCollectionTableProps) {
  // Filter records based on search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery) return records;

    const query = searchQuery.toLowerCase();
    return records.filter((record) =>
      Object.values(record.data || {}).some(
        (value) =>
          value &&
          String(value).toLowerCase().includes(query)
      )
    );
  }, [records, searchQuery]);

  // Paginate records
  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice(0, pageSize);
  }, [filteredRecords, pageSize]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-muted-foreground">Loading records...</div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-muted-foreground">No records found</div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-muted-foreground">No fields configured</div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-background/95 backdrop-blur border-b">
            <tr>
              {fields.map((field) => (
                <th
                  key={field.name}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
                >
                  <div className="flex items-center gap-2">
                    <span>{field.name}</span>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {field.type}
                    </Badge>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.map((record, idx) => (
              <tr
                key={record.id}
                className={cn(
                  "border-b hover:bg-secondary/30 transition-colors",
                  idx % 2 === 0 ? "bg-background/50" : ""
                )}
                onClick={() => onRowClick?.(record)}
              >
                {fields.map((field) => (
                  <td key={`${record.id}-${field.name}`} className="px-4 py-2">
                    <DynamicFieldCell
                      field={field}
                      value={record.data?.[field.name]}
                      onChange={(value) =>
                        onCellChange?.(record.id, field.name, value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRecords.length > pageSize && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-background/50">
          Showing {paginatedRecords.length} of {filteredRecords.length} records
        </div>
      )}
    </div>
  );
}

/**
 * Dynamic field cell renderer
 */
interface DynamicFieldCellProps {
  field: Field;
  value: any;
  onChange?: (value: any) => void;
  editable?: boolean;
}

export function DynamicFieldCell({
  field,
  value,
  onChange,
  editable = false,
}: DynamicFieldCellProps) {
  if (!value && value !== 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  switch (field.type) {
    case "number":
      return (
        <span className="text-sm font-mono">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      );

    case "boolean":
      return (
        <Badge variant={value ? "default" : "secondary"} className="text-xs">
          {value ? "True" : "False"}
        </Badge>
      );

    case "date":
      return (
        <span className="text-sm">
          {new Date(value).toLocaleDateString()}
        </span>
      );

    case "select":
      return (
        <Badge variant="secondary" className="text-xs">
          {String(value)}
        </Badge>
      );

    case "text":
    default:
      if (editable && onChange) {
        return (
          <Input
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        );
      }
      return <span className="text-sm truncate max-w-xs">{String(value)}</span>;
  }
}

/**
 * Table with inline editing
 */
export function EditableCollectionTable({
  records,
  fields,
  onCellChange,
  searchQuery = "",
  isLoading = false,
}: DynamicCollectionTableProps) {
  return (
    <DynamicCollectionTable
      records={records}
      fields={fields}
      onCellChange={onCellChange}
      searchQuery={searchQuery}
      isLoading={isLoading}
    />
  );
}
