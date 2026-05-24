# Import UI System - Integration Guide

Complete step-by-step guide to integrate the frontend import system into your application.

## 📋 Table of Contents

1. [Requirements](#requirements)
2. [Installation](#installation)
3. [Basic Integration](#basic-integration)
4. [Component APIs](#component-apis)
5. [Hook Documentation](#hook-documentation)
6. [Advanced Patterns](#advanced-patterns)
7. [Customization](#customization)
8. [Troubleshooting](#troubleshooting)

## Requirements

### Dependencies
- React 18+
- TypeScript 4.5+
- Tailwind CSS 3+
- shadcn/ui
- sonner (toast notifications)
- react-hook-form
- xlsx

### Already Installed
Verify these are in your `package.json`:
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-radio-group": "^1.1.0",
    "sonner": "^1.0.0",
    "react-hook-form": "^7.0.0",
    "xlsx": "^0.18.0",
    "lucide-react": "^0.263.0"
  }
}
```

## Installation

### 1. Copy Files to Your Project

```bash
# Copy the import-ui feature
cp -r src/features/import-ui your-project/src/features/

# Files included:
# - types.ts          # Type definitions
# - utils.ts          # Utility functions
# - hooks.ts          # Custom hooks
# - index.ts          # Public API
# - EXAMPLES.tsx      # Code examples
# - components/
#   - DragDropUpload.tsx
#   - FilePreviewTable.tsx
#   - CollectionSelector.tsx
#   - CreateCollectionForm.tsx
#   - ImportProgress.tsx
#   - ImportResults.tsx
#   - ImportModal.tsx
#   - ImportButton.tsx
```

### 2. Ensure shadcn/ui Components Exist

```bash
# These shadcn/ui components must be installed
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add table
npx shadcn-ui@latest add collapsible
```

### 3. Verify Import Paths

Update paths in components if needed:

```tsx
// Check these imports in components
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
```

## Basic Integration

### 1. Simplest: Add Import Button

```tsx
// pages/Collections.tsx
import { ImportButton } from "@/features/import-ui";

export function Collections() {
  return (
    <div>
      <h1>My Collections</h1>
      
      <ImportButton
        orgId={currentOrgId}
        userId={currentUserId}
        onImportSuccess={(collectionId) => {
          console.log("Imported to:", collectionId);
          // Refresh your collections list
          refetchCollections();
        }}
      />
    </div>
  );
}
```

### 2. More Control: Use Modal Directly

```tsx
import { ImportModal } from "@/features/import-ui";
import { useState } from "react";

export function Collections() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        📥 Import Data
      </button>

      <ImportModal
        open={isOpen}
        onOpenChange={setIsOpen}
        orgId={currentOrgId}
        userId={currentUserId}
        onImportSuccess={(collectionId) => {
          setIsOpen(false);
          refetchCollections();
        }}
        onImportError={(error) => {
          console.error(error);
        }}
      />
    </>
  );
}
```

## Component APIs

### ImportButton

Trigger button for import flow.

```tsx
<ImportButton
  // Required
  orgId={string}              // Organization ID
  userId={string}             // Current user ID
  
  // Optional callbacks
  onImportSuccess={(id) => {}} // Called after successful import
  onImportError={(err) => {}}  // Called on error
  
  // Optional styling
  variant="default"            // Button variant: default | outline | ghost | destructive
  size="default"               // Button size: default | sm | lg
  className="custom-class"     // Additional CSS
  
  // Default text: "Import Data"
>
  Custom Button Text
</ImportButton>
```

### ImportModal

Main orchestrator component.

```tsx
<ImportModal
  // Required
  open={boolean}              // Modal open state
  onOpenChange={(open) => {}} // State setter
  orgId={string}              // Organization ID
  userId={string}             // Current user ID
  
  // Optional callbacks
  onImportSuccess={(id) => {}}
  onImportError={(error) => {}}
/>
```

### DragDropUpload

File upload component.

```tsx
<DragDropUpload
  onFileSelect={(file) => {}}
  onError={(error) => {}}
  isLoading={false}
  acceptedFormats={[".xlsx", ".csv"]}
/>
```

### FilePreviewTable

Shows parsed data preview.

```tsx
<FilePreviewTable
  data={parsedFileData}
  detectedFields={fields}
  maxRows={10}
  onFieldEdit={(idx, field) => {}}
/>
```

### CollectionSelector

Choose collection or create new.

```tsx
<CollectionSelector
  collections={collectionList}
  selectedId={selectedId}
  onSelect={(id) => {}}
  onCreateNew={() => {}}
  isLoading={false}
/>
```

### CreateCollectionForm

Form for new collection.

```tsx
<CreateCollectionForm
  suggestedName="Auto-generated name"
  suggestedFields={detectedFields}
  onSubmit={(input) => {}}
  onCancel={() => {}}
  isLoading={false}
/>
```

### ImportProgress

Real-time progress display.

```tsx
<ImportProgress
  progress={{
    step: "importing",
    processedRows: 500,
    totalRows: 1000,
    percentage: 50,
    currentMessage: "Importing...",
    estimatedTimeRemaining: 30,
  }}
  isVisible={true}
  showEstimatedTime={true}
/>
```

### ImportResults

Success/error results.

```tsx
<ImportResults
  result={importResult}
  error={importError}
  onClose={() => {}}
  onRetry={() => {}}
  onViewCollection={() => {}}
  isLoading={false}
/>
```

## Hook Documentation

### useImportFlow

Main state management hook.

```tsx
const {
  state,           // Current import state
  uploadFile,      // (file: File) => Promise<void>
  selectCollection,// (id: string) => void
  createNewCollection, // (input) => void
  startImport,     // () => Promise<void>
  goToStep,        // (step: ImportStep) => void
  reset,           // () => void
  canProceed,      // () => boolean
} = useImportFlow(orgId);

// State structure
state.file               // Selected File or null
state.fileError         // Upload error or null
state.parsedData        // ParsedFileData or null
state.detectedFields    // DetectedField[] or null
state.selectedCollectionId // string or null
state.createNew         // boolean
state.newCollectionInput // CreateCollectionInput or null
state.isImporting       // boolean
state.importProgress    // ImportProgress
state.importResult      // ImportResult or null
state.importError       // ImportError or null
state.currentStep       // Current import step
state.isLoading         // Is any operation loading?
```

### useCollections

Fetch org collections.

```tsx
const {
  collections,    // CollectionSummary[]
  isLoading,      // boolean
  error,          // ImportError | null
  refetch,        // () => Promise<void>
} = useCollections(orgId);
```

### useImportAPI

Execute import via backend.

```tsx
const {
  executeImport,  // Async function
  isLoading,      // boolean
  error,          // ImportError | null
} = useImportAPI();

const result = await executeImport(
  orgId,                      // string
  userId,                     // string
  collectionId,              // string | null
  collectionInput,           // CreateCollectionInput | null
  rows,                      // Record<string, unknown>[]
  fields                     // DetectedField[]
);
```

## Advanced Patterns

### Pattern 1: Custom Collection Handler

```tsx
import { useImportFlow } from "@/features/import-ui";

export function CustomImportWorkflow() {
  const importFlow = useImportFlow(orgId);

  const handleCustomImport = async (file: File) => {
    // Upload
    await importFlow.uploadFile(file);
    
    // Customize fields before import
    const customizedFields = importFlow.state.detectedFields?.map(f => ({
      ...f,
      type: f.type === "text" ? "email" : f.type,
    }));
    
    // Create collection with customization
    await importFlow.createNewCollection({
      name: "Custom Import",
      fields: customizedFields as any[],
    });
    
    // Start import
    await importFlow.startImport();
  };

  return <input type="file" onChange={(e) => handleCustomImport(e.currentTarget.files?.[0] || new File([], ""))} />;
}
```

### Pattern 2: Multi-File Import Queue

```tsx
import { useImportFlow, useImportAPI } from "@/features/import-ui";
import { useState } from "react";

export function BatchImportQueue() {
  const [queue, setQueue] = useState<File[]>([]);
  const [results, setResults] = useState<Array<{file: string; status: string}>>([]);

  const importFlow = useImportFlow(orgId);
  const api = useImportAPI();

  const processQueue = async () => {
    for (const file of queue) {
      try {
        await importFlow.uploadFile(file);
        
        const result = await api.executeImport(
          orgId,
          userId,
          importFlow.state.selectedCollectionId,
          null,
          importFlow.state.parsedData?.rows || [],
          importFlow.state.detectedFields || []
        );

        setResults(prev => [...prev, {
          file: file.name,
          status: "success"
        }]);
        
        importFlow.reset();
      } catch (error) {
        setResults(prev => [...prev, {
          file: file.name,
          status: "error"
        }]);
      }
    }
  };

  return (
    <div>
      {/* Queue UI */}
      <button onClick={processQueue}>Process Queue</button>
    </div>
  );
}
```

### Pattern 3: Automated Field Mapping

```tsx
import { useImportFlow } from "@/features/import-ui";
import { DetectedField, FieldType } from "@/features/import-ui";

const FIELD_MAPPING: Record<string, FieldType> = {
  "id": "number",
  "email": "email",
  "phone": "phone",
  "created_at": "date",
  "updated_at": "date",
  "is_active": "boolean",
};

export function SmartFieldMapping() {
  const importFlow = useImportFlow(orgId);

  const applySmartMapping = () => {
    if (!importFlow.state.detectedFields) return;

    const mappedFields = importFlow.state.detectedFields.map(field => ({
      ...field,
      type: FIELD_MAPPING[field.name] || field.type,
    }));

    // Update detected fields with mappings
    // (You may need to extend the hook to support this)
  };

  return <button onClick={applySmartMapping}>Apply Smart Mapping</button>;
}
```

## Customization

### Custom Styling

All components use Tailwind CSS. Customize via:

```tsx
// Override component classes
<ImportButton className="my-custom-class" />

// Or wrap with custom styles
<div className="custom-container">
  <ImportModal {...props} />
</div>
```

### Custom Component Composition

Use components separately:

```tsx
import {
  DragDropUpload,
  FilePreviewTable,
  CollectionSelector,
  ImportProgress,
  ImportResults,
} from "@/features/import-ui";

export function CustomImportUI() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState("upload");

  return (
    <div className="custom-layout">
      {step === "upload" && (
        <DragDropUpload onFileSelect={setFile} onError={() => {}} />
      )}
      {step === "preview" && file && (
        <FilePreviewTable data={...} detectedFields={...} />
      )}
      {/* etc */}
    </div>
  );
}
```

### Custom Toast Notifications

```tsx
import { toast } from "sonner";

// In your import handler
try {
  await importFlow.startImport();
  toast.custom((t) => (
    <div className="custom-toast">
      ✨ Import complete!
    </div>
  ));
} catch (error) {
  toast.error("Custom error message");
}
```

## Troubleshooting

### Issue: Modal Doesn't Open

**Check:**
1. `open` prop is true
2. `onOpenChange` updates state properly
3. Dialog component is imported correctly

```tsx
const [open, setOpen] = useState(false);

<ImportModal
  open={open}
  onOpenChange={setOpen}
  // ...
/>
```

### Issue: File Upload Fails

**Check:**
1. File size < 10 MB
2. File format is .xlsx, .xls, or .csv
3. Browser allows file reading (check console)

```tsx
import { validateFile } from "@/features/import-ui";

const validation = validateFile(file);
console.log(validation); // Check error details
```

### Issue: Collections Won't Load

**Check:**
1. `orgId` is correct
2. API endpoint `/api/collections` exists
3. User has org membership

```tsx
const { collections, error } = useCollections(orgId);
console.log(error); // Check error details
```

### Issue: Import Doesn't Start

**Check:**
1. Collection is selected OR new collection form submitted
2. `userId` is provided
3. Backend `/api/imports` endpoint exists

```tsx
const canProceed = importFlow.canProceed();
console.log(canProceed); // Should be true before import
```

### Issue: Progress Not Showing

**Check:**
1. `ImportProgress` component is rendered
2. `isVisible` prop is true
3. `currentStep` is "importing"

```tsx
{importFlow.state.currentStep === "importing" && (
  <ImportProgress
    progress={importFlow.state.importProgress}
    isVisible={true}
  />
)}
```

## API Endpoints Required

Your backend must provide these endpoints:

### 1. GET /api/collections?orgId={orgId}

Returns array of collections:
```json
[
  {
    "id": "col-1",
    "name": "Customers",
    "fieldCount": 5,
    "recordCount": 100,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-02T00:00:00Z"
  }
]
```

### 2. POST /api/collections

Create new collection:
```json
Request:
{
  "orgId": "org-123",
  "name": "New Collection",
  "description": "Optional",
  "fields": [
    {
      "name": "customer_name",
      "displayName": "Customer Name",
      "type": "text"
    }
  ]
}

Response:
{
  "id": "col-new",
  "name": "New Collection",
  "fields": [...]
}
```

### 3. POST /api/imports

Execute import:
```json
Request:
{
  "orgId": "org-123",
  "userId": "user-456",
  "collectionId": "col-1",
  "rows": [...],
  "fields": [...]
}

Response:
{
  "importedRows": 100,
  "failedRows": 0,
  "collectionId": "col-1",
  "errors": []
}
```

## Next Steps

1. ✅ Copy files to project
2. ✅ Install shadcn/ui components
3. ✅ Add ImportButton to a page
4. ✅ Implement backend API endpoints
5. ✅ Test with sample data
6. ✅ Customize styling as needed
7. ✅ Deploy to production

## Support

For questions or issues:
1. Check IMPORT_UI_README.md
2. Review EXAMPLES.tsx
3. Check component prop types in types.ts
4. Review hook implementations in hooks.ts
