# Firestore Index Required for Admin Panel

## Issue

The admin panel needs a composite index to query `zillow_imports` properties:

- `ownerFinanceVerified` (ASCENDING)
- `foundAt` (DESCENDING)

## Steps to Create Index

### Option 1: Auto-Create Link

Click this link to automatically create the index:

```
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=ClRwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy96aWxsb3dfaW1wb3J0cy9pbmRleGVzL18QARoYChRvd25lckZpbmFuY2VWZXJpZmllZBABGgsKB2ZvdW5kQXQQAhoMCghfX25hbWVfXxAC
```

### Option 2: Manual Creation

1. Go to Firebase Console: https://console.firebase.google.com
2. Select project: `ownerfi-95aa0`
3. Go to Firestore Database > Indexes tab
4. Click "Create Index"
5. Configure:
   - Collection ID: `zillow_imports`
   - Fields:
     - `ownerFinanceVerified` - Ascending
     - `foundAt` - Descending
6. Click "Create"

## Why This Index is Needed

The admin panel API (`/api/admin/properties`) queries:

```typescript
db.collection('zillow_imports')
  .where('ownerFinanceVerified', '==', true)
  .orderBy('foundAt', 'desc')
```

This requires a composite index for optimal performance.

## Status

- ✅ Index added to `firestore.indexes.json`
- ⏳ **Needs deployment** - Click the link above to create it

## After Creating Index

1. Wait 1-2 minutes for index to build
2. Test the admin panel: `/admin` → "Properties" tab
3. Should show all 1,417 properties
