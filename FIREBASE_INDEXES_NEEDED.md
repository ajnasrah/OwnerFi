# Firebase Indexes Needed for Optimal Scheduling

The following indexes are required for the optimal scheduling system to work properly. Click each link to create the index in Firebase Console:

## Abdullah Content Queue

**Index 1: status + completedAt (DESC)**
```
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=Clxwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9hYmR1bGxhaF9jb250ZW50X3F1ZXVlL2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGg8KC2NvbXBsZXRlZEF0EAEaDAoIX19uYW1lX18QAQ
```

**Index 2: status + createdAt (ASC)** - for `getWorkflowsCreatedToday()`
```
Collection: abdullah_content_queue
Fields: status (ASC), createdAt (ASC)
```
(Create manually in console)

## Workflow Queues - createdAt Indexes

These indexes are needed by `getWorkflowsCreatedToday()` to calculate `videoIndex`:

**Carz Workflow Queue:**
```
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=Cllwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9jYXJ6X3dvcmtmbG93X3F1ZXVlL2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGg0KCWNyZWF0ZWRBdBABGgwKCF9fbmFtZV9fEAE
```

**OwnerFi Workflow Queue:**
```
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=Clxwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9vd25lcmZpX3dvcmtmbG93X3F1ZXVlL2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGg0KCWNyZWF0ZWRBdBABGgwKCF9fbmFtZV9fEAE
```

**VassDistro Workflow Queue:**
```
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=Cl9wcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy92YXNzZGlzdHJvX3dvcmtmbG93X3F1ZXVlL2luZGV4ZXMvXhABGgoKBnN0YXR1cxABGg0KCWNyZWF0ZWRBdBABGgwKCF9fbmFtZV9fEAE
```

**Podcast Workflow Queue:**
```
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=Clxwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9wb2RjYXN0X3dvcmtmbG93X3F1ZXVlL2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGg0KCWNyZWF0ZWRBdBABGgwKCF9fbmFtZV9fEAE
```

**Benefit Workflow Queue:**
```
https://console.firebase.google.com/v1/r/project/ownerfi-95aa0/firestore/indexes?create_composite=Clxwcm9qZWN0cy9vd25lcmZpLTk1YWEwL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9iZW5lZml0X3dvcmtmbG93X3F1ZXVlL2luZGV4ZXMvXxABGgoKBnN0YXR1cxABGg0KCWNyZWF0ZWRBdBABGgwKCF9fbmFtZV9fEAE
```

## Why These Indexes Are Needed

### `status + createdAt (ASC)`
Used by `getWorkflowsCreatedToday()` in `/src/lib/feed-store-firestore.ts` (line 406-412):
```typescript
const querySnapshot = await getDocs(
  query(
    collection(db, collectionName),
    where('createdAt', '>=', todayStartTimestamp),
    orderBy('createdAt', 'asc') // ← Requires index
  )
);
```

This function counts how many videos have been created today to calculate the `videoIndex` (0-4), which determines which of the 3 optimal time slots each platform should use.

## Index Creation Status

- [ ] Abdullah: status + completedAt (DESC)
- [ ] Abdullah: status + createdAt (ASC)
- [ ] Carz: status + createdAt (ASC)
- [ ] OwnerFi: status + createdAt (ASC)
- [ ] VassDistro: status + createdAt (ASC)
- [ ] Podcast: status + createdAt (ASC)
- [ ] Benefit: status + createdAt (ASC)

Once all indexes are created, the retry script (`scripts/retry-stuck-workflows.ts`) will run successfully.
