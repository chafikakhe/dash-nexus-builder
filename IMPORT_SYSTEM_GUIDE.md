# Excel/CSV Import System - Implementation Guide

## 📋 Overview

A complete, production-ready import system for your React + TypeScript + Supabase application. Supports Excel (.xlsx) and CSV file uploads with automatic field detection, collection creation, and data validation.

## 🎯 Features

- ✅ Drag & drop file upload
- ✅ Automatic field type detection
- ✅ Dynamic collection creation
- ✅ Batch record insertion (optimized)
- ✅ Real-time progress tracking
- ✅ Duplicate prevention
- ✅ Error handling with detailed feedback
- ✅ Import history and logging
- ✅ Row-level security (RLS) support
- ✅ AI-ready architecture
- ✅ TypeScript throughout
- ✅ Fully typed interfaces

## 📁 File Structure

```
src/
├── features/import/
│   ├── index.ts                          # Public API exports
│   ├── types.ts                          # Type definitions
│   └── utils/
│       ├── fieldDetection.ts             # Field type detection
│       ├── fileParsing.ts                # File parsing (xlsx/csv)
│       ├── validation.ts                 # Data validation
│       └── integrationHelpers.ts         # Helper utilities
├── services/import/
│   └── supabaseService.ts                # Supabase operations
├── hooks/
│   └── useImport.ts                      # Main import hook
├── components/import/
│   ├── ImportModal.tsx                   # Upload UI
│   ├── DynamicCollectionTable.tsx        # Data display
│   └── ImportHistory.tsx                 # Import logs
└── supabase/
    └── 015_IMPORT_SYSTEM.sql             # Database migration
```

## 🚀 Quick Start

### 1. Run Database Migration

```bash
# Apply the migration to your Supabase database
# Copy content of supabase/015_IMPORT_SYSTEM.sql
# Paste into Supabase SQL Editor and execute
```

### 2. Install Dependencies

Ensure `xlsx` is installed:

```bash
npm install xlsx
# or
bun add xlsx
```

### 3. Add Import Button to Collections Page

```typescript
// In your Collections.tsx or similar

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { ImportModal } from "@/features/import";

export default function Collections() {
  const [importOpen, setImportOpen] = useState(false);
  const { currentOrgId } = useAuth();
  const { user } = useAuth();
  const { collections } = useCollections();

  return (
    <>
      <Button
        onClick={() => setImportOpen(true)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Import Data
      </Button>

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        orgId={currentOrgId || ""}
        userId={user?.id || ""}
        collections={collections}
        onImportSuccess={(collectionId) => {
          // Refresh collection data
          console.log("Import successful:", collectionId);
        }}
      />
    </>
  );
}
```

### 4. Display Imported Data

```typescript
import { DynamicCollectionTable } from "@/features/import";
import { useCollectionRecords } from "@/hooks/useCollections";

export function CollectionView({ collectionId, fields }) {
  const { records } = useCollectionRecords(collectionId, orgId);

  return (
    <DynamicCollectionTable
      records={records}
      fields={fields}
      searchQuery={searchQuery}
    />
  );
}
```

### 5. Show Import History

```typescript
import { ImportHistory } from "@/features/import";

export function ImportManagement() {
  const { currentOrgId } = useAuth();

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Import History</h3>
      <ImportHistory orgId={currentOrgId || ""} />
    </div>
  );
}
```

## 📦 Core Components

### ImportModal

Main UI for file upload and import.

```typescript
<ImportModal
  open={open}
  onOpenChange={setOpen}
  orgId="org-id"
  userId="user-id"
  collections={collections}
  onImportSuccess={(collectionId) => {
    // Handle success
  }}
/>
```

**Props:**
- `open` (boolean): Modal open state
- `onOpenChange` (function): Update open state
- `orgId` (string): Organization/workspace ID
- `userId` (string): Current user ID
- `collections` (Collection[]): Available collections
- `onImportSuccess?` (function): Callback on successful import

### DynamicCollectionTable

Render collection records with dynamic columns.

```typescript
<DynamicCollectionTable
  records={records}
  fields={fields}
  searchQuery="search term"
  onCellChange={(recordId, field, value) => {
    // Handle changes
  }}
/>
```

**Props:**
- `records` (CollectionRecord[]): Data rows
- `fields` (Field[]): Column definitions
- `searchQuery?` (string): Filter query
- `onCellChange?` (function): Edit handler
- `isLoading?` (boolean): Loading state
- `pageSize?` (number): Pagination limit

### ImportHistory

Show import logs and statistics.

```typescript
<ImportHistory
  orgId="org-id"
  collectionId="collection-id"  // Optional
  limit={20}
/>
```

## 🎣 Hooks

### useImport

Main hook for managing import state and logic.

```typescript
const { state, handleFileUpload, executeImport, updateConfig, reset } = useImport();

// File upload
await handleFileUpload(file);

// Execute import
const result = await executeImport(orgId, userId, config, onProgress);

// Update configuration
updateConfig({ createNewCollection: true });

// Reset state
reset();
```

**State:**
```typescript
{
  fileSelected: boolean;
  fileName: string;
  previewData: ParsedFileData | null;
  detectedFields: FieldDetectionResult[];
  config: ImportConfig;
  progress: ImportProgress;
  result: ImportResult | null;
  error: string | null;
}
```

### useDuplicateImportCheck

Check for duplicate imports.

```typescript
const { checkDuplicate } = useDuplicateImportCheck();
const duplicate = await checkDuplicate(collectionId, filename);
```

## 🛠️ Utilities

### Field Detection

```typescript
import { 
  detectFieldType, 
  detectFields, 
  normalizeValue 
} from "@/features/import";

// Detect from multiple values
const type = detectFieldType(["100", "200", "300"]);  // "number"

// Detect all fields from data
const fields = detectFields(headers, rows);

// Normalize value to type
const normalized = normalizeValue("123.45", "number");  // 123.45
```

### File Parsing

```typescript
import { parseFile, validateFile, exportToExcel } from "@/features/import";

// Parse file
const data = await parseFile(file);

// Validate before parsing
const validation = validateFile(file);

// Export data
exportToExcel("my-collection", headers, rows);
```

### Validation

```typescript
import { 
  validateParsedFile, 
  preImportValidation,
  findDuplicateRows 
} from "@/features/import";

// Validate parsed data
const validation = validateParsedFile(parsedData);

// Pre-import checks
const checks = preImportValidation(parsedData, fieldSchema);

// Find duplicates
const { duplicates, indices } = findDuplicateRows(rows);
```

### Integration Helpers

```typescript
import {
  formatFileSize,
  canUserImport,
  estimateImportDuration,
  downloadSampleCSV
} from "@/features/import";

// Format for display
const size = formatFileSize(1024 * 1024);  // "1 MB"

// Permission check
if (canUserImport(userRole)) {
  // Show import button
}

// Estimate time
const duration = estimateImportDuration(5000);  // "~50 seconds"

// Download sample
downloadSampleCSV();
```

## 🔒 Security

The import system respects your RLS policies:

- ✅ **Org-level access**: Users must be org members
- ✅ **Role-based**: Only editors/admins can import
- ✅ **Collection-level**: Verified collection access
- ✅ **Audit logging**: All imports are logged
- ✅ **Frontend validation**: Pre-import checks
- ✅ **Backend validation**: RLS enforced by Supabase

## 🎨 Customization

### Custom Field Types

Add new field type detection:

```typescript
// In fieldDetection.ts
export function isCustomType(value: string): boolean {
  // Your logic
  return false;
}

// Update detectFieldTypeFromValue()
if (isCustomType(trimmed)) {
  return "custom-type";
}
```

### Custom Batch Size

Adjust batch processing:

```typescript
const config: ImportConfig = {
  // ... other config
  batchSize: 500,  // Default: 100
};
```

### Custom Validation

Add pre-import validation:

```typescript
const validation = preImportValidation(data, schema);
if (!validation.canProceed) {
  // Handle validation errors
}
```

## 📊 Database Schema

### imports Table

```sql
CREATE TABLE public.imports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  collection_id uuid NOT NULL,
  filename text,
  imported_rows integer,
  failed_rows integer,
  errors jsonb,
  warnings jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz
);
```

## 🧪 Testing

### Manual Test Data

```typescript
import { generateSampleCSV } from "@/features/import";

// Generate sample CSV
const csv = generateSampleCSV();

// Or download sample file
downloadSampleCSV();
```

### Test Scenarios

1. **Basic Import**: Upload CSV → Create collection → Verify records
2. **Existing Collection**: Upload → Select existing collection → Merge fields
3. **Large File**: Upload 10k+ rows → Monitor batch processing
4. **Error Handling**: Upload invalid data → See error messages
5. **Duplicate Prevention**: Upload same file twice → Check import history

## 🔄 AI Integration (Future)

The architecture is designed for AI features:

```typescript
// Planned: AI-assisted field naming
const aiSuggestedFields = await suggestFieldNames(parsedData);

// Planned: AI-assisted data transformation
const transformed = await aiTransformData(rows, config);

// Planned: AI-generated dashboards
const dashboard = await generateDashboard(collectionId);
```

## 📝 API Reference

### Types

```typescript
// File data
interface ParsedFileData {
  headers: string[];
  rows: Record<string, any>[];
  filename: string;
  rowCount: number;
}

// Field detection
interface FieldDetectionResult {
  name: string;
  slug: string;
  type: FieldType;
  required: boolean;
  config: Record<string, any>;
  detectionConfidence: number;
}

// Import result
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

### Services

```typescript
// Create collection and fields
const result = await createCollectionWithFields(orgId, name, fields);

// Batch insert records
const response = await batchInsertRecords(
  collectionId,
  orgId,
  records,
  fieldSchema,
  batchSize,
  onProgress
);

// Log import
const log = await logImport(userId, orgId, collectionId, filename, result);

// Get import statistics
const stats = await getImportStatistics(orgId);
```

## 🐛 Troubleshooting

### File won't upload
- Check file size (max 10MB)
- Verify file format (.xlsx, .csv, .txt)
- Check browser console for errors

### Fields not detecting correctly
- Ensure sufficient sample data (min 5 rows recommended)
- Check field values for consistency
- Manually adjust field types if needed

### Import fails with RLS error
- Verify user is org member
- Check user role (must be editor+)
- Ensure collection belongs to correct org

### Performance issues
- Reduce batch size for memory constraints
- Split large files into smaller chunks
- Use pagination for displaying records

## 📖 Examples

### Full Integration Example

```typescript
import { useState } from "react";
import { ImportModal, DynamicCollectionTable, ImportHistory } from "@/features/import";
import { useAuth } from "@/contexts/AuthContext";
import { useCollections, useCollectionRecords } from "@/hooks/useCollections";

export function CollectionsManager() {
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { currentOrgId, user } = useAuth();
  const { collections, loading: collectionsLoading } = useCollections();

  const [activeCollectionId, setActiveCollectionId] = useState(
    collections[0]?.id
  );
  const {
    records,
    loading: recordsLoading,
    updateRecord,
  } = useCollectionRecords(activeCollectionId, currentOrgId);

  const activeCollection = collections.find(
    (c) => c.id === activeCollectionId
  );

  return (
    <div className="space-y-6">
      {/* Import Button */}
      <div className="flex gap-2">
        <button
          onClick={() => setImportOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Import Data
        </button>
      </div>

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        orgId={currentOrgId || ""}
        userId={user?.id || ""}
        collections={collections}
        onImportSuccess={(collectionId) => {
          setActiveCollectionId(collectionId);
        }}
      />

      {/* Search */}
      <input
        type="text"
        placeholder="Search records..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border rounded"
      />

      {/* Data Table */}
      {activeCollection && (
        <DynamicCollectionTable
          records={records}
          fields={activeCollection.schema}
          searchQuery={searchQuery}
          isLoading={recordsLoading}
          onCellChange={(recordId, fieldName, value) => {
            updateRecord(recordId, { [fieldName]: value });
          }}
        />
      )}

      {/* Import History */}
      <ImportHistory orgId={currentOrgId || ""} limit={10} />
    </div>
  );
}
```

## 🚀 Performance Optimization

### Batch Size Tuning

```typescript
// For large files (50k+ rows)
batchSize: 50;

// For typical files (1k-10k rows)
batchSize: 100;

// For small files (<1k rows)
batchSize: 500;
```

### Memory Management

```typescript
// Automatically handled by the system
// Processes in batches to prevent OOM
// Uses streaming for large files
```

### Query Optimization

```typescript
// Indexed queries
- imports.org_id
- imports.collection_id
- imports.created_at
- imports.status

// Use pagination for large result sets
const logs = await getImportLogs(orgId, limit: 50);
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the TypeScript types
3. Check browser console for errors
4. Verify Supabase RLS policies

## 📄 License

Part of your main application.
