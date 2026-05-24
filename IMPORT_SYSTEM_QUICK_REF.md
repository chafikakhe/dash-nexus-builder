# Import System - Quick Reference

## 🚀 Getting Started in 5 Minutes

### Step 1: Run Migration
Execute `supabase/015_IMPORT_SYSTEM.sql` in your Supabase dashboard.

### Step 2: Add Import Button
```tsx
import { ImportModal } from "@/features/import";
import { useState } from "react";

function MyPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Import</button>
      <ImportModal
        open={open}
        onOpenChange={setOpen}
        orgId="org-id"
        userId="user-id"
        collections={collections}
      />
    </>
  );
}
```

### Step 3: Display Data
```tsx
import { DynamicCollectionTable } from "@/features/import";

<DynamicCollectionTable
  records={records}
  fields={collection.schema}
/>
```

## 📚 Common Patterns

### Pattern 1: Basic Import Flow
```typescript
// User uploads file
const { state, handleFileUpload, executeImport } = useImport();

// Parse file
await handleFileUpload(file);

// Fields auto-detected in state.detectedFields

// Execute import
const result = await executeImport(orgId, userId, config);
```

### Pattern 2: Detect Field Types
```typescript
import { detectFields } from "@/features/import";

const fields = detectFields(headers, data.rows);
// Returns: FieldDetectionResult[]
// Each with: { name, type, slug, detectionConfidence }
```

### Pattern 3: Validate Before Import
```typescript
import { preImportValidation } from "@/features/import";

const check = preImportValidation(parsedData, schema);
if (!check.canProceed) {
  console.error("Validation failed:", check.errors);
}
```

### Pattern 4: Custom Batch Processing
```typescript
import { batchInsertRecords } from "@/features/import";

const result = await batchInsertRecords(
  collectionId,
  orgId,
  records,
  fields,
  batchSize = 100,  // Customize batch size
  (progress) => {
    console.log(`${progress.processed}/${progress.total}`);
  }
);
```

### Pattern 5: Import History
```typescript
import { ImportHistory } from "@/features/import";

<ImportHistory
  orgId={orgId}
  collectionId={collectionId}  // Optional
/>
```

## 🔑 Key APIs

### useImport() Hook
```typescript
const {
  state,           // Current state
  handleFileUpload,// Parse file
  executeImport,   // Run import
  updateConfig,    // Update settings
  reset            // Clear state
} = useImport();
```

**State object:**
```typescript
{
  fileSelected: boolean;
  fileName: string;
  previewData?: ParsedFileData;
  detectedFields: FieldDetectionResult[];
  config: ImportConfig;
  progress: ImportProgress;
  result?: ImportResult;
  error?: string;
}
```

### File Parsing
```typescript
import { parseFile, validateFile } from "@/features/import";

// Validate
const { valid, error } = validateFile(file);

// Parse (auto-detects xlsx vs csv)
const data = await parseFile(file);
// Returns: { headers, rows, filename, rowCount }
```

### Field Detection
```typescript
import { 
  detectFieldType,
  detectFields,
  normalizeValue 
} from "@/features/import";

// Single value
detectFieldType(["val1", "val2"]);  // "text" | "number" | "date" | ...

// Multiple fields
detectFields(headers, rows.slice(0, 100));

// Normalize to type
normalizeValue("123.45", "number");  // 123.45
```

### Database Operations
```typescript
import {
  createCollectionWithFields,
  getCollectionWithFields,
  addMissingFields,
  batchInsertRecords,
  logImport
} from "@/features/import";

// Create collection
const { collectionId, fields } = 
  await createCollectionWithFields(orgId, name, fieldResults);

// Get existing
const collection = 
  await getCollectionWithFields(collectionId, orgId);

// Add fields
await addMissingFields(collectionId, existing, newFields);

// Insert records
const { successful, failed, errors } = 
  await batchInsertRecords(collectionId, orgId, records, fields);

// Log import
await logImport(userId, orgId, collectionId, filename, result);
```

### Validation
```typescript
import {
  validateParsedFile,
  preImportValidation,
  sanitizeRowData
} from "@/features/import";

// Data validation
const result = validateParsedFile(data, schema);

// Pre-import checks
const check = preImportValidation(data);

// Sanitize
const clean = sanitizeRowData(row, headers);
```

## 📦 Components

### ImportModal
```tsx
<ImportModal
  open={boolean}
  onOpenChange={(open) => void}
  orgId={string}
  userId={string}
  collections={Collection[]}
  onImportSuccess?={(collectionId) => void}
/>
```

### DynamicCollectionTable
```tsx
<DynamicCollectionTable
  records={CollectionRecord[]}
  fields={Field[]}
  searchQuery={string}
  onCellChange={(recordId, field, value) => void}
  isLoading={boolean}
  pageSize={number}
/>
```

### ImportHistory
```tsx
<ImportHistory
  orgId={string}
  collectionId={string}
  limit={number}
/>
```

## 💡 Tips & Tricks

### Auto-refresh after import
```typescript
onImportSuccess={(collectionId) => {
  // Trigger re-fetch of records
  refetch(collectionId);
}}
```

### Custom progress bar
```typescript
await executeImport(orgId, userId, config, (progress) => {
  setProgressValue(progress.percentage);
  setMessage(progress.message);
});
```

### Download template
```typescript
import { downloadSampleCSV } from "@/features/import";

<button onClick={downloadSampleCSV}>
  Download Template
</button>
```

### Check permissions
```typescript
import { canUserImport } from "@/features/import";

if (canUserImport(userRole)) {
  // Show import button
}
```

### Format numbers
```typescript
import { formatNumber, formatFileSize } from "@/features/import";

formatNumber(1000);        // "1,000"
formatFileSize(1024*1024); // "1 MB"
```

## ⚠️ Common Issues

### Issue: "File won't upload"
```typescript
// Check file size
if (file.size > 10 * 1024 * 1024) {
  toast.error("File too large (max 10MB)");
}

// Check file type
const ext = file.name.split(".").pop();
if (!["xlsx", "csv"].includes(ext)) {
  toast.error("Unsupported file type");
}
```

### Issue: "RLS Errors"
```typescript
// Make sure user is org member
const { data: member } = await supabase
  .from("org_members")
  .select()
  .eq("org_id", orgId)
  .eq("user_id", userId)
  .single();

if (!member) {
  toast.error("No access to organization");
}
```

### Issue: "Import slow"
```typescript
// Reduce batch size for large imports
config.batchSize = 50;  // Instead of 100

// Or split file into chunks
// Process files sequentially
```

## 🎯 Import Config

```typescript
interface ImportConfig {
  // Collection handling
  collectionId?: string;        // For existing collection
  collectionName?: string;      // For new collection
  createNewCollection: boolean;

  // Import options
  skipFirstRow: boolean;        // Skip headers
  validateBeforeImport: boolean;
  batchSize: number;            // Default: 100

  // Field mapping
  fieldMappings: Record<string, FieldDetectionResult>;
}
```

## 🔄 Import Result

```typescript
interface ImportResult {
  success: boolean;
  collectionId: string;
  importedRows: number;
  failedRows: number;
  errors: ImportError[];
  warnings: string[];
  importId: string;
  timestamp: string;
}
```

## 📊 Import Progress

```typescript
interface ImportProgress {
  totalRows: number;
  processedRows: number;
  failedRows: number;
  successRows: number;
  percentage: number;
  status: "idle" | "parsing" | "detecting" | "validating" | "importing" | "completed" | "error";
  message: string;
}
```

## 🛠️ Utility Functions

| Function | Purpose |
|----------|---------|
| `parseFile(file)` | Parse xlsx/csv file |
| `detectFields(headers, rows)` | Auto-detect field types |
| `preImportValidation(data)` | Validate before import |
| `formatFileSize(bytes)` | Format for display |
| `estimateImportDuration(rows)` | Estimate time |
| `canUserImport(role)` | Check permissions |
| `downloadSampleCSV()` | Download template |
| `exportToExcel(name, headers, rows)` | Export data |

## 📝 Types

```typescript
// Main types to import
import type {
  ParsedFileData,
  FieldDetectionResult,
  ImportConfig,
  ImportResult,
  ImportProgress,
  ImportLog,
} from "@/features/import";
```

## 🚀 Next Steps

1. ✅ Run migration: `supabase/015_IMPORT_SYSTEM.sql`
2. ✅ Add ImportModal to your page
3. ✅ Hook up to collections
4. ✅ Display results with DynamicCollectionTable
5. ✅ Show import history

## 📖 Full Documentation

See `IMPORT_SYSTEM_GUIDE.md` for detailed documentation.
