# Asset API Calls for Frontend Integration

This document explains in detail how a frontend should call the asset REST endpoints.

Base URL examples:

- Local backend: `http://localhost:3000`
- Full assets base path: `http://localhost:3000/api/assets`

All endpoints return JSON.

---

## 1) Create Asset

**Endpoint**

- `POST /api/assets`

**Use case**

- Create a new asset in both MySQL (`ASSET_MGMT`) and MongoDB (`assets` collection).

**Request body**

```json
{
  "name": "CRM Database",
  "type": "database",
  "description": "Stores customer records",
  "classification": "confidential",
  "location": "eu-central-1",
  "owner": "IT Security",
  "value": "high",
  "status": "active",
  "username": "NSCHMID",
  "companyId": 7
}
```

**Required fields**

- `name`
- `type`
- `username`
- `companyId`

**Success response**

```json
{
  "success": true,
  "message": "Asset created successfully",
  "assetId": 123
}
```

**Error responses**

- `400` if required fields are missing
- `404` if username does not exist for the given company

---

## 2) Get Asset by ID

**Endpoint**

- `GET /api/assets/:id`

**Use case**

- Load a single asset detail view.

**Path parameter**

- `id` = numeric asset ID

**Example request**

- `GET /api/assets/123`

**Success response**

```json
{
  "success": true,
  "asset": {
    "asset_id": 123,
    "name": "CRM Database",
    "type": "database",
    "status": "active",
    "risks": [],
    "controls": [],
    "created_at": "2026-04-07T10:30:00.000Z",
    "updated_at": "2026-04-07T10:30:00.000Z"
  }
}
```

**Error responses**

- `404` if asset does not exist

---

## 3) Update Asset

**Endpoint**

- `PUT /api/assets/:id`

**Use case**

- Update selected fields in MongoDB asset details.

**Path parameter**

- `id` = numeric asset ID

**Request body (all fields optional)**

```json
{
  "name": "CRM Database v2",
  "classification": "strictly-confidential",
  "value": "critical",
  "status": "active"
}
```

**Success response**

```json
{
  "success": true,
  "message": "Asset updated successfully"
}
```

**Error responses**

- `404` if asset does not exist

---

## 4) Delete Asset

**Endpoint**

- `DELETE /api/assets/:id`

**Use case**

- Remove asset from both MySQL and MongoDB.

**Path parameter**

- `id` = numeric asset ID

**Success response**

```json
{
  "success": true,
  "message": "Asset deleted successfully"
}
```

**Error responses**

- `404` if asset does not exist in persistence layers

---

## 5) Analytics Endpoints

All analytics endpoints require:

- Query parameter: `companyId` (number)
- Return shape: `{ success: true, data: [...] }` except summary which returns object in `data`

### 5.1 By Type

- `GET /api/assets/analytics/by-type?companyId=7`

Response item shape:

```json
{ "key": "database", "count": 10 }
```

### 5.2 By Status

- `GET /api/assets/analytics/by-status?companyId=7`

Response item shape:

```json
{ "key": "active", "count": 18 }
```

### 5.3 By Value

- `GET /api/assets/analytics/by-value?companyId=7`

Response item shape:

```json
{ "key": "high", "count": 4 }
```

### 5.4 By Classification

- `GET /api/assets/analytics/by-classification?companyId=7`

Response item shape:

```json
{ "key": "confidential", "count": 9 }
```

### 5.5 By Month

- `GET /api/assets/analytics/by-month?companyId=7`

Response item shape:

```json
{
  "year": 2026,
  "month": 4,
  "monthName": "Apr",
  "label": "Apr 2026",
  "count": 6
}
```

### 5.6 Summary

- `GET /api/assets/analytics/summary?companyId=7`

Response shape:

```json
{
  "success": true,
  "data": {
    "totalAssets": 24,
    "highValueAssets": 7,
    "byType": [{ "key": "database", "count": 10 }],
    "byStatus": [{ "key": "active", "count": 18 }],
    "byValue": [{ "key": "high", "count": 4 }]
  }
}
```

---

## 6) Frontend Implementation Guidance

### 6.1 Central API helper (recommended)

Use one shared function that throws on non-2xx responses:

```ts
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `Request failed with status ${res.status}`);
  }
  return data as T;
}
```

### 6.2 Query keys for React Query / TanStack Query

Suggested keys:

- `['asset', assetId]`
- `['asset-analytics', 'by-type', companyId]`
- `['asset-analytics', 'by-status', companyId]`
- `['asset-analytics', 'by-value', companyId]`
- `['asset-analytics', 'by-classification', companyId]`
- `['asset-analytics', 'by-month', companyId]`
- `['asset-analytics', 'summary', companyId]`

### 6.3 Cache invalidation on mutations

After `create`, `update`, or `delete`:

- Invalidate individual asset query (`['asset', assetId]` if known)
- Invalidate all analytics keys for the same company

### 6.4 Error handling UX

Recommended mapping:

- `400`: show validation message near form fields
- `404`: show "Asset not found" and redirect to list page if needed
- `500`: show generic toast/snackbar and allow retry

### 6.5 Numeric ID handling

Always pass numeric IDs:

- Path params: `/api/assets/${Number(assetId)}`
- Query params: `companyId=${Number(companyId)}`

Avoid sending empty strings for IDs because backend parses numeric values.

---

## 7) Example Frontend Calls

### Create

```ts
await apiFetch('http://localhost:3000/api/assets', {
  method: 'POST',
  body: JSON.stringify({
    name: 'SIEM Platform',
    type: 'application',
    username: 'NSCHMID',
    companyId: 7,
    value: 'critical',
    status: 'active',
  }),
});
```

### Update

```ts
await apiFetch('http://localhost:3000/api/assets/123', {
  method: 'PUT',
  body: JSON.stringify({ status: 'inactive' }),
});
```

### Analytics

```ts
const summary = await apiFetch<{ success: true; data: any }>(
  'http://localhost:3000/api/assets/analytics/summary?companyId=7',
);
```
