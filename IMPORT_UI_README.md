# Excel/CSV Import UI System - Frontend Implementation

Complete production-ready frontend for Excel/CSV import with field detection, progress tracking, and collection management.

## 🚀 Features

### File Upload
- ✅ Drag & drop support
- ✅ Click to select
- ✅ File validation (size, format)
- ✅ Visual feedback (file selected state)
- ✅ Format support: XLSX, XLS, CSV, TXT

### Field Detection
- ✅ Automatic type detection (7+ types)
- ✅ Confidence scoring
- ✅ Sample value display
- ✅ Expandable field preview
- ✅ Manual field type override (form)

### Collection Management
- ✅ Select existing collection
- ✅ Create new collection
- ✅ Auto-detect field names
- ✅ Customize fields before import
- ✅ Suggested collection names

### Import Process
- ✅ Real-time progress tracking
- ✅ Row count display
- ✅ Percentage indicator
- ✅ Animated progress bar
- ✅ Estimated time remaining

### Results
- ✅ Success confirmation
- ✅ Error handling
- ✅ Import statistics
- ✅ Success rate display
- ✅ Retry on recoverable errors

### UI/UX
- ✅ Modern modal interface
- ✅ Step-by-step flow
- ✅ Back navigation
- ✅ Toast notifications
- ✅ Responsive design
- ✅ Loading states
- ✅ Empty states
- ✅ Inline error messages

## 📦 Components

### ImportButton
Trigger button to open import modal.

```tsx
<ImportButton
  orgId="org-123"
  userId="user-456"
  onImportSuccess={(collectionId) => {
    console.log("Imported to:", collectionId);
  }}
/>
```

### ImportModal
Main container managing the entire import flow.

```tsx
<ImportModal
  open={isOpen}
  onOpenChange={setIsOpen}
  orgId="org-123"
  userId="user-456"
  onImportSuccess={(collectionId) => {}}
  onImportError={(error) => {}}
/>
```

### DragDropUpload
File upload component with drag-drop support.

```tsx
<DragDropUpload
  onFileSelect={(file) => console.log(file)}
  onError={(error) => console.error(error)}
  isLoading={false}
  acceptedFormats={[".xlsx", ".csv"]}
/>
```

### FilePreviewTable
Shows parsed file data and detected fields.

```tsx
<FilePreviewTable
  data={parsedData}
  detectedFields={fields}
  maxRows={10}
  onFieldEdit={(idx, field) => {}}
/>
```

### CollectionSelector
Choose existing or create new collection.

```tsx
<CollectionSelector
  collections={collectionsList}
  selectedId={selectedId}
  onSelect={(id) => {}}
  onCreateNew={() => {}}
/>
```

### CreateCollectionForm
Form to create new collection with fields.

```tsx
<CreateCollectionForm
  suggestedName="Customers"
  suggestedFields={detectedFields}
  onSubmit={(input) => {}}
  onCancel={() => {}}
/>
```

### ImportProgress
Real-time progress indicator during import.

```tsx
<ImportProgress
  progress={progressState}
  isVisible={true}
  showEstimatedTime={true}
/>
```

### ImportResults
Shows success/error results with statistics.

```tsx
<ImportResults
  result={importResult}
  error={importError}
  onClose={() => {}}
  onRetry={() => {}}
  onViewCollection={() => {}}
/>
```

## 🎣 Hooks

### useImportFlow
Main state management hook for import orchestration.

```tsx
const {
  state,
  uploadFile,
  selectCollection,
  createNewCollection,
  startImport,
  goToStep,
  reset,
  canProceed,
} = useImportFlow(orgId);

// state.currentStep: 'idle' | 'preview' | 'collection-select' | 'importing' | 'success' | 'error'
// state.file: File | null
// state.parsedData: ParsedFileData | null
// state.detectedFields: DetectedField[] | null
// state.selectedCollectionId: string | null
// state.importProgress: ImportProgress
// state.importResult: ImportResult | null
// state.importError: ImportError | null
```

### useCollections
Fetch available collections for current org.

```tsx
const {
  collections,
  isLoading,
  error,
  refetch,
} = useCollections(orgId);
```

### useImportAPI
Execute import via backend API.

```tsx
const {
  executeImport,
  isLoading,
  error,
} = useImportAPI();

const result = await executeImport(
  orgId,
  userId,
  collectionId,
  collectionInput,
  rows,
  fields
);
```

## 🛠️ Utilities

### File Operations
```tsx
import {
  validateFile,
  parseFile,
  detectFields,
  formatFileSize,
  getPreviewRows,
  sanitizeRowData,
} from "@/features/import-ui";

// Validate file
const validation = validateFile(file);
if (!validation.valid) console.error(validation.error);

// Parse file
const parsed = await parseFile(file);
console.log(parsed.headers, parsed.rows);

// Detect field types
const detection = detectFields(parsed);
detection.fields.forEach(field => {
  console.log(`${field.displayName}: ${field.type} (${field.confidence * 100}%)`);
});

// Format file size
console.log(formatFileSize(1048576)); // "1.00 MB"

// Get preview rows
const preview = getPreviewRows(parsed, 10);

// Sanitize data
const clean = sanitizeRowData({ name: "  John  ", age: 30 });
```

### Validation
```tsx
import { validateRowData } from "@/features/import-ui";

const { valid, errors } = validateRowData(row, fields);
if (!valid) {
  console.log("Validation errors:", errors);
}
```

### Error Handling
```tsx
import { createImportError, handleFileError } from "@/features/import-ui";

const error = createImportError(
  "PARSE_ERROR",
  "Failed to parse file",
  { originalError: err }
);

try {
  // ...
} catch (err) {
  const importError = handleFileError(err);
}
```

## 📋 Type System

All TypeScript types are available:

```tsx
import type {
  ParsedFileData,
  DetectedField,
  CollectionSummary,
  ImportError,
  ImportProgress,
  ImportResult,
  ImportFlowState,
  CreateCollectionInput,
} from "@/features/import-ui";
```

## 🎨 Styling

All components use:
- **shadcn/ui** for base components
- **Tailwind CSS** for styling
- **lucide-react** for icons
- Consistent color scheme (blue primary, green success, red danger)
- Responsive design (mobile-first)

## 🔄 Import Flow States

```
START
  ↓
[idle] → User uploads file
  ↓
[uploading] → File being parsed
  ↓
[preview] → User reviews data and fields
  ↓
[collection-select] → User selects or creates collection
  ↓
[importing] → Data being imported with progress
  ↓
[success] OR [error]
  ↓
User closes modal or retries
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install @supabase/supabase-js xlsx sonner react-hook-form
npm install @radix-ui/react-dialog @radix-ui/react-radio-group
```

### 2. Add Import Button
```tsx
import { ImportButton } from "@/features/import-ui";

export function MyPage() {
  return (
    <div>
      <ImportButton
        orgId="your-org-id"
        userId="your-user-id"
        onImportSuccess={(collectionId) => {
          // Refresh collection data
          refetchCollections();
        }}
      />
    </div>
  );
}
```

### 3. Use Custom Modal
```tsx
import { ImportModal } from "@/features/import-ui";
import { useState } from "react";

export function MyPage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Import Data
      </button>
      
      <ImportModal
        open={isOpen}
        onOpenChange={setIsOpen}
        orgId="your-org-id"
        userId="your-user-id"
      />
    </>
  );
}
```

### 4. Use Hooks Directly
```tsx
import { useImportFlow, useImportAPI } from "@/features/import-ui";

export function CustomImport() {
  const importFlow = useImportFlow(orgId);
  const api = useImportAPI();

  const handleUpload = async (file: File) => {
    await importFlow.uploadFile(file);
  };

  const handleImport = async () => {
    const result = await api.executeImport(
      orgId,
      userId,
      importFlow.state.selectedCollectionId,
      null,
      importFlow.state.parsedData?.rows || [],
      importFlow.state.detectedFields || []
    );
    console.log(result);
  };

  return (
    <div>
      {/* Your custom UI */}
    </div>
  );
}
```

## 📊 Configuration

### File Size Limits
- Default: 10 MB
- Configurable via `IMPORT_CONFIG.MAX_FILE_SIZE`

### Row Limits
- Default: 50,000 rows
- Configurable via `IMPORT_CONFIG.MAX_ROWS`

### Batch Size
- Default: 100 rows per batch
- Configurable via `IMPORT_CONFIG.BATCH_SIZE`

### Preview Rows
- Default: 10 rows
- Configurable via `IMPORT_CONFIG.PREVIEW_ROWS`

## 🧪 Testing

Mock data generators available in testing utilities:

```tsx
import {
  generateMockParsedData,
  generateMockFieldDetection,
  generateMockFields,
} from "@/features/import-ui/testing";

const mockData = generateMockParsedData(100, 5);
const mockFields = generateMockFieldDetection(5);
```

## 🔒 Security

- ✅ File validation before processing
- ✅ Size limits enforced
- ✅ Input sanitization
- ✅ Type validation
- ✅ Error details not exposed to users
- ✅ Backend API calls required
- ✅ User/org ID verification

## 🐛 Error Handling

All errors follow the `ImportError` type:

```tsx
interface ImportError {
  code: string;           // Error identifier
  message: string;        // User-friendly message
  details?: unknown;      // Additional context
  recoverable: boolean;   // Can user retry?
}
```

Error codes:
- `FILE_TOO_LARGE` - File exceeds 10 MB
- `INVALID_FILE_TYPE` - File format not supported
- `FILE_READ_ERROR` - Error reading file
- `PARSE_ERROR` - Error parsing file content
- `VALIDATION_ERROR` - Data validation failed
- `NO_COLLECTION_SELECTED` - User didn't select collection
- `COLLECTION_CREATE_FAILED` - Failed to create new collection
- `IMPORT_FAILED` - Import operation failed
- `NETWORK_ERROR` - Network/API error
- `UNAUTHORIZED` - User not authorized

## 📱 Responsive Design

- Mobile: Full width, single column
- Tablet: 2-column layout for fields
- Desktop: 3-column layout for fields
- Modal scales to viewport (max 2xl)
- Scrollable content area

## ♿ Accessibility

- ✅ Semantic HTML
- ✅ ARIA labels
- ✅ Keyboard navigation
- ✅ Focus management
- ✅ Color contrast compliance
- ✅ Form labels
- ✅ Error announcements

## 🎭 States & Animations

- Loading spinner on buttons
- Progress bar animation
- Fade transitions
- Smooth color changes
- Hover effects
- Disabled state styling

## 📚 Additional Resources

- See `ImportButton` for basic integration
- See `ImportModal` for full control
- Check component props for full API
- Review hooks for state management
- Use utilities for custom workflows

## 🤝 Contributing

All code is production-ready. To extend:

1. Add new components in `/components`
2. Add utilities in `utils.ts`
3. Add types in `types.ts`
4. Export from `index.ts`
5. Update documentation

## 📄 License

Same as main application
