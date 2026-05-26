import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  Cable,
  Cloud,
  Database,
  Loader2,
  PlugZap,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspacePermissions } from "@/hooks/useWorkspacePermissions";
import {
  importDataSourceAsCollection,
  testDataSourceConnection,
  type DataSourceAuthType,
  type DataSourcePayload,
  type DataSourceProvider,
} from "@/features/data-sources/api";

const providerOptions: Array<{ value: DataSourceProvider; label: string; urlHint: string }> = [
  { value: "mockapi", label: "MockAPI", urlHint: "https://<project>.mockapi.io/<resource>" },
  { value: "custom_api", label: "Custom API", urlHint: "https://api.example.com/resources" },
  { value: "odoo", label: "Odoo", urlHint: "https://your-odoo-instance.com/api/..." },
  { value: "jsonplaceholder", label: "JSONPlaceholder", urlHint: "https://jsonplaceholder.typicode.com/posts" },
];

const authOptions: Array<{ value: DataSourceAuthType; label: string }> = [
  { value: "none", label: "None" },
  { value: "bearer", label: "Bearer Token" },
  { value: "api_key", label: "API Key" },
];

function providerLabel(value: DataSourceProvider) {
  return providerOptions.find((option) => option.value === value)?.label ?? "Custom API";
}

function parseHeadersJson(value: string) {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers JSON must be an object.");
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(([, headerValue]) => typeof headerValue === "string")
  ) as Record<string, string>;
}

function formatPreviewValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function DataSources() {
  const navigate = useNavigate();
  const { currentOrgId } = useAuth();
  const { canCreateContent, isAdmin, isReadOnlyMember } = useWorkspacePermissions();

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<DataSourceProvider>("mockapi");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [authType, setAuthType] = useState<DataSourceAuthType>("none");
  const [token, setToken] = useState("");
  const [headersJson, setHeadersJson] = useState("{\n  \n}");
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [schemaRows, setSchemaRows] = useState<Array<{ name: string; type: string }>>([]);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentProvider = providerOptions.find((option) => option.value === provider) ?? providerOptions[0];
  const previewColumns = useMemo(() => {
    const schemaColumns = schemaRows.map((field) => field.name);
    if (schemaColumns.length) return schemaColumns;
    return Object.keys(previewRows[0] ?? {});
  }, [previewRows, schemaRows]);

  const payloadFromState = (): DataSourcePayload => ({
    name: name.trim(),
    provider,
    url: url.trim(),
    method: method.trim() || "GET",
    authType,
    token: token.trim() || undefined,
    headers: parseHeadersJson(headersJson),
  });

  const handleProviderChange = (value: DataSourceProvider) => {
    setProvider(value);
    if (!url.trim()) {
      const nextHint = providerOptions.find((option) => option.value === value)?.urlHint;
      if (nextHint) setUrl(nextHint);
    }
  };

  const handleTest = async () => {
    try {
      const payload = payloadFromState();
      if (!payload.url) throw new Error("API URL is required.");

      setTesting(true);
      setErrorMessage(null);
      setTestMessage(null);

      const result = await testDataSourceConnection(payload);
      setPreviewRows(result.preview);
      setSchemaRows(result.schema);
      setTotalRows(result.total);
      setTestMessage(`Connection succeeded. Detected ${result.schema.length} field${result.schema.length === 1 ? "" : "s"}.`);
      toast.success("Connection test succeeded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to test connection.";
      setErrorMessage(message);
      setTestMessage(null);
      setPreviewRows([]);
      setSchemaRows([]);
      setTotalRows(null);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    try {
      if (!currentOrgId) throw new Error("Select a workspace before importing a data source.");
      const payload = payloadFromState();
      if (!payload.name) throw new Error("Connection name is required.");
      if (!payload.url) throw new Error("API URL is required.");

      setImporting(true);
      setErrorMessage(null);

      const result = await importDataSourceAsCollection({
        ...payload,
        orgId: currentOrgId,
      });

      toast.success(`Imported ${result.total} record${result.total === 1 ? "" : "s"} into a new collection.`);
      navigate("/app/collections");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to import data source.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "Workspace" }, { label: "Data Sources" }]}
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Backend-only API access
          </Badge>
        }
      />
      <main className="flex-1 space-y-6 p-6 animate-fade-in">
        <div className="max-w-6xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Data Sources / Integrations</h1>
            <p className="text-sm text-muted-foreground">
              Connect external REST APIs, preview their payload, detect the schema automatically, and import the data as collections for dashboards.
            </p>
          </div>

          {(!canCreateContent && !isAdmin) || isReadOnlyMember ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>Read-only access</CardTitle>
                <CardDescription>
                  You can view this page, but only workspace owners or admins can import new data sources.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlugZap className="h-4 w-4 text-primary" />
                  New Integration
                </CardTitle>
                <CardDescription>
                  Configure a data source connection. Requests are executed server-side through Supabase edge functions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="connection-name">Connection name</Label>
                    <Input
                      id="connection-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Customer Orders API"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={provider} onValueChange={(value) => handleProviderChange(value as DataSourceProvider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <div className="space-y-2">
                    <Label htmlFor="api-url">API URL</Label>
                    <Input
                      id="api-url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder={currentProvider.urlHint}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>HTTP Method</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Auth type</Label>
                    <Select value={authType} onValueChange={(value) => setAuthType(value as DataSourceAuthType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {authOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token-input">
                      {authType === "api_key" ? "API Key" : "Token"}
                    </Label>
                    <Input
                      id="token-input"
                      type="password"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder={authType === "none" ? "No token required" : "Hidden value"}
                      disabled={authType === "none"}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headers-json">Headers JSON</Label>
                  <Textarea
                    id="headers-json"
                    value={headersJson}
                    onChange={(event) => setHeadersJson(event.target.value)}
                    className="min-h-36 font-mono text-xs"
                    placeholder={'{\n  "Accept": "application/json"\n}'}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this for custom headers. For API Key auth, `x-api-key` is added automatically if you do not provide one here.
                  </p>
                </div>

                {errorMessage ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </div>
                ) : null}

                {testMessage ? (
                  <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                    {testMessage}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={handleTest}
                    disabled={testing || importing}
                  >
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Test Connection
                  </Button>
                  <Button
                    type="button"
                    className="gap-2 bg-gradient-primary shadow-glow"
                    onClick={handleImport}
                    disabled={importing || testing || !name.trim() || !url.trim()}
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                    Import as Collection
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-primary" />
                    Connection Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <Badge variant="secondary">{providerLabel(provider)}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <Badge variant="outline">{method || "GET"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Auth</span>
                    <Badge variant="outline">{authOptions.find((option) => option.value === authType)?.label ?? "None"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rows detected</span>
                    <span>{totalRows ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    What Happens On Import
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>1. The connection metadata is stored in `api_connections`.</p>
                  <p>2. A collection is created in your current workspace.</p>
                  <p>3. Schema is saved on the collection and rows are inserted into `collection_records`.</p>
                  <p>4. The collection becomes available immediately in Collections and the dashboard builder.</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cable className="h-4 w-4 text-primary" />
                  Detected Schema
                </CardTitle>
                <CardDescription>
                  Field types are inferred automatically from the API response.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {schemaRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Test a connection to see the detected schema.
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5">Field</th>
                          <th className="px-4 py-2.5">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schemaRows.map((field) => (
                          <tr key={field.name} className="border-t border-border/60">
                            <td className="px-4 py-2.5 font-medium">{field.name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{field.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  Preview
                </CardTitle>
                <CardDescription>
                  First five rows returned by the API.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {previewRows.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    No preview yet. Run a connection test first.
                  </div>
                ) : (
                  <div className="overflow-auto rounded-lg border border-border">
                    <table className="w-full min-w-[540px] text-sm">
                      <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          {previewColumns.map((column) => (
                            <th key={column} className="px-4 py-2.5">{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-t border-border/60">
                            {previewColumns.map((column) => (
                              <td key={column} className="max-w-[220px] px-4 py-2.5 align-top text-muted-foreground">
                                <span className="line-clamp-3 break-words">{formatPreviewValue(row[column])}</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
