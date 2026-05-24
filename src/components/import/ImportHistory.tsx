/**
 * Import History Component
 * Display and manage import logs
 */

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getImportLogs, getImportStatistics } from "@/services/import/supabaseService";
import type { ImportLog } from "@/features/import/types";

interface ImportHistoryProps {
  orgId: string;
  collectionId?: string;
  limit?: number;
}

export function ImportHistory({
  orgId,
  collectionId,
  limit = 10,
}: ImportHistoryProps) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalImports: 0,
    totalRecordsImported: 0,
    successfulImports: 0,
    failedImports: 0,
    averageRowsPerImport: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load import logs
        const allLogs = await getImportLogs(orgId, limit);
        const filtered = collectionId
          ? allLogs.filter((log) => log.collection_id === collectionId)
          : allLogs;
        setLogs(filtered);

        // Load statistics
        const statistics = await getImportStatistics(orgId);
        setStats(statistics);
      } catch (error) {
        console.error("Failed to load import history:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orgId, collectionId, limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <div className="text-muted-foreground text-sm">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard
          label="Total Imports"
          value={stats.totalImports}
        />
        <StatCard
          label="Records Imported"
          value={stats.totalRecordsImported}
        />
        <StatCard
          label="Successful"
          value={stats.successfulImports}
        />
        <StatCard
          label="Failed"
          value={stats.failedImports}
        />
      </div>

      {/* Import Logs Table */}
      {logs.length === 0 ? (
        <div className="flex items-center justify-center h-40 border rounded-lg bg-secondary/20">
          <div className="text-muted-foreground text-sm">No imports yet</div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead className="text-right">Imported</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-secondary/50">
                  <TableCell>
                    <ImportStatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.filename}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {log.imported_rows}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {log.failed_rows > 0 ? (
                      <span className="text-red-600 font-medium">
                        {log.failed_rows}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.created_at).toLocaleDateString()} at{" "}
                    {new Date(log.created_at).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/**
 * Status badge component
 */
function ImportStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    success: {
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
      label: "Success",
    },
    partial: {
      icon: AlertTriangle,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      label: "Partial",
    },
    failed: {
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      label: "Failed",
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.failed;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border",
        config.bg,
        config.border
      )}
    >
      <Icon className={cn("h-3 w-3", config.color)} />
      <span className={config.color}>{config.label}</span>
    </div>
  );
}

/**
 * Stat card component
 */
function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="border rounded-lg p-3 bg-background/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

/**
 * Import details modal
 */
export function ImportDetails({ importId }: { importId: string }) {
  const [details, setDetails] = useState<ImportLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        // This would load individual import details
        // Implementation depends on your needs
        setLoading(false);
      } catch (error) {
        console.error("Failed to load import details:", error);
        setLoading(false);
      }
    };

    loadDetails();
  }, [importId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!details) {
    return <div>Import not found</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-semibold">{details.filename}</h3>
        <p className="text-sm text-muted-foreground">
          {new Date(details.created_at).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Imported Records</p>
          <p className="text-2xl font-bold">{details.imported_rows}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Failed Records</p>
          <p className="text-2xl font-bold text-red-600">
            {details.failed_rows}
          </p>
        </div>
      </div>

      {details.errors && details.errors.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">Errors</h4>
          <div className="border rounded p-2 max-h-40 overflow-y-auto bg-red-50">
            <ul className="space-y-1 text-xs">
              {details.errors.map((error, idx) => (
                <li key={idx} className="text-red-700">
                  Row {error.rowIndex + 1}: {error.errorMessage}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {details.warnings && details.warnings.length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">Warnings</h4>
          <div className="border rounded p-2 max-h-40 overflow-y-auto bg-yellow-50">
            <ul className="space-y-1 text-xs">
              {details.warnings.map((warning, idx) => (
                <li key={idx} className="text-yellow-700">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
