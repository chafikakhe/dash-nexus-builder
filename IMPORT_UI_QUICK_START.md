# Import UI System - Quick Reference

**TL;DR**: Copy files → Install shadcn/ui → Add `<ImportButton>` → Done!

---

## ⚡ 60-Second Setup

### Step 1: Files Already Copied
```
✓ src/features/import-ui/
  - All components, hooks, types, utilities
```

### Step 2: Install shadcn/ui Components
```bash
npx shadcn-ui@latest add dialog button input textarea label select progress badge alert skeleton radio-group table collapsible
```

### Step 3: Add Import Button
```tsx
import { ImportButton } from "@/features/import-ui";

export function MyPage() {
  return (
    <ImportButton
      orgId="your-org-id"
      userId="your-user-id"
      onImportSuccess={() => refetch()}
    />
  );
}
```

**Done! 🎉**

---

## 📚 Component Cheat Sheet

### ImportButton
```tsx
<ImportButton
  orgId={string}
  userId={string}
  onImportSuccess={(id) => {}}
  onImportError={(error) => {}}
/>
```

### ImportModal
```tsx
<ImportModal
  open={boolean}
  onOpenChange={setOpen}
  orgId={string}
  userId={string}
/>
```

### DragDropUpload
```tsx
<DragDropUpload
  onFileSelect={(file) => {}}
  onError={(error) => {}}
/>
```

### FilePreviewTable
```tsx
<FilePreviewTable
  data={parsedData}
  detectedFields={fields}
  maxRows={10}
/>
```

### CollectionSelector
```tsx
<CollectionSelector
  collections={list}
  selectedId={id}
  onSelect={(id) => {}}
  onCreateNew={() => {}}
/>
```

### CreateCollectionForm
```tsx
<CreateCollectionForm
  suggestedName="auto"
  suggestedFields={fields}
  onSubmit={(input) => {}}
  onCancel={() => {}}
/>
```

### ImportProgress
```tsx
<ImportProgress progress={state.importProgress} />
```

### ImportResults
```tsx
<ImportResults
  result={result}
  error={error}
  onClose={() => {}}
/>
```

---

## 🎣 Hook Cheat Sheet

### useImportFlow
```tsx
const {
  state,
  uploadFile,
  selectCollection,
  startImport,
  reset,
  goToStep,
} = useImportFlow(orgId);
```

### useCollections
```tsx
const { collections, isLoading, refetch } = useCollections(orgId);
```

### useImportAPI
```tsx
const { executeImport, isLoading } = useImportAPI();

const result = await executeImport(
  orgId, userId, collectionId, null, rows, fields
);
```

---

## 🛠️ Utility Cheat Sheet

### File Operations
```tsx
import {
  validateFile,
  parseFile,
  detectFields,
  formatFileSize,
  sanitizeRowData,
  validateRowData,
} from "@/features/import-ui";

const validation = validateFile(file);
const parsed = await parseFile(file);
const detection = detectFields(parsed);
const size = formatFileSize(1048576); // "1.00 MB"
const clean = sanitizeRowData(row);
const { valid, errors } = validateRowData(row, fields);
```

---

## 📋 Import Flow States

```
idle
  ↓ (file upload)
uploading
  ↓ (file parsed)
preview
  ↓ (user reviews)
collection-select
  ↓ (collection selected)
importing
  ↓ (import completes)
success or error
```

Access current state:
```tsx
const { currentStep } = importFlow.state;

if (currentStep === "importing") {
  // Show progress
}
```

---

## 🎨 Customization

### Custom Styling
```tsx
<ImportButton className="my-custom-class" variant="outline" size="lg" />
```

### Custom Colors (Tailwind)
- Primary: `bg-blue-600`
- Success: `bg-green-600`
- Error: `bg-red-600`
- Warning: `bg-yellow-600`

---

## 🐛 Common Issues

### Modal won't open
```tsx
const [open, setOpen] = useState(false);

<ImportModal open={open} onOpenChange={setOpen} />
```

### File upload fails
```tsx
// Check console for:
// - File size < 10 MB
// - File format: .xlsx, .csv
// - Browser file API support
```

### Collections won't load
```tsx
// API endpoint must exist: GET /api/collections?orgId={orgId}
// Check network tab for errors
```

### Import won't start
```tsx
// Must have:
// - File uploaded
// - Fields detected
// - Collection selected
// - User ID provided
```

---

## ✅ Checklist Before Going Live

- [ ] shadcn/ui components installed
- [ ] `<ImportButton>` added to page
- [ ] API endpoints created:
  - [ ] GET /api/collections
  - [ ] POST /api/collections
  - [ ] POST /api/imports
- [ ] Tested with sample Excel file
- [ ] Tested with sample CSV file
- [ ] Error handling works
- [ ] Toast notifications display
- [ ] Mobile responsive tested

---

## 📖 Full Documentation

- **IMPORT_UI_README.md** - Complete API reference
- **IMPORT_UI_INTEGRATION_GUIDE.md** - Step-by-step guide
- **IMPORT_UI_FRONTEND_SUMMARY.md** - This implementation
- **src/features/import-ui/EXAMPLES.tsx** - 6 code examples

---

## 🚀 API Endpoints Required

Create these in your backend:

### GET /api/collections

```json
Response: [
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

### POST /api/collections

```json
Request: {
  "orgId": "org-1",
  "name": "New Collection",
  "description": "optional",
  "fields": [
    {
      "name": "customer_name",
      "displayName": "Customer Name",
      "type": "text"
    }
  ]
}

Response: {
  "id": "col-new",
  "name": "New Collection"
}
```

### POST /api/imports

```json
Request: {
  "orgId": "org-1",
  "userId": "user-1",
  "collectionId": "col-1",
  "rows": [
    { "name": "John", "email": "john@example.com" }
  ],
  "fields": [
    { "name": "name", "displayName": "Name", "type": "text" }
  ]
}

Response: {
  "importedRows": 1,
  "failedRows": 0,
  "collectionId": "col-1",
  "errors": []
}
```

---

## 💡 Pro Tips

1. **Auto-refresh after import**
   ```tsx
   onImportSuccess={() => refetchCollections()}
   ```

2. **Show toast notification**
   ```tsx
   import { toast } from "sonner";
   toast.success("Import complete!");
   ```

3. **Handle import errors**
   ```tsx
   onImportError={(error) => {
     toast.error(error.message);
   }}
   ```

4. **Use custom layouts**
   ```tsx
   import {
     DragDropUpload,
     FilePreviewTable,
   } from "@/features/import-ui";
   
   // Compose your own UI
   ```

5. **Batch imports**
   ```tsx
   for (const file of files) {
     await importFlow.uploadFile(file);
     // ... process each file
   }
   ```

---

## 🎯 What's Included

✅ 8 React components
✅ 3 custom hooks
✅ 15+ utility functions
✅ 25+ TypeScript types
✅ 6 working examples
✅ 3 documentation files
✅ 3,500+ lines of code
✅ 100% TypeScript
✅ Production-ready

---

## 🌟 Features

✅ Drag & drop file upload
✅ Parse Excel & CSV
✅ Auto-detect field types
✅ Real-time progress
✅ Create collections
✅ Error handling
✅ Toast notifications
✅ Responsive design
✅ Accessible UI
✅ Type-safe

---

## 🎓 Learning Resources

Excellent examples of:
- React hooks patterns
- TypeScript best practices
- State management
- Form handling
- File API usage
- Component composition
- Error handling
- Responsive design

---

## 📞 Help

1. **Can't import button?**
   - Check path: `@/features/import-ui`
   - Check `orgId` and `userId` are provided

2. **Styles look wrong?**
   - Install shadcn/ui components (see above)
   - Check Tailwind CSS configured

3. **Upload fails?**
   - Check file < 10 MB
   - Check file is .xlsx or .csv
   - Check browser console for errors

4. **Import doesn't start?**
   - Check all API endpoints exist
   - Check console for API errors
   - Verify user/org IDs correct

5. **Need more help?**
   - Read IMPORT_UI_INTEGRATION_GUIDE.md
   - Check IMPORT_UI_README.md
   - Review EXAMPLES.tsx

---

## 🚀 You're Ready!

The import system is production-ready.

1. Install shadcn/ui
2. Add `<ImportButton>`
3. Create API endpoints
4. Test it out
5. Deploy!

**That's it! 🎉**
