# Asset Export Module - Frontend Integration Guide

This module provides functionality to export company assets into a professional Word (.docx) format.

## 1. REST Endpoint (Recommended)

The REST endpoint is the simplest way to trigger a file download in the browser.

**Endpoint:** `GET /api/assets/export/docx/:companyId`

### Usage with Vanilla JS / React / Angular
```javascript
const downloadAssets = (companyId) => {
  // Direct download via window location
  window.location.href = `http://localhost:3000/api/assets/export/docx/${companyId}`;
  
  // OR using fetch if you need to pass headers (e.g., Auth)
  fetch(`http://localhost:3000/api/assets/export/docx/${companyId}`, {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  })
  .then(response => response.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assets_company_${companyId}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
};
```

---

## 2. GraphQL Query

The GraphQL query returns the Word file as a **Base64-encoded string**. This is useful if you are already using a GraphQL client and want to keep all data fetching consistent.

**Query:**
```graphql
query DownloadAssets($compId: Int!) {
  downloadAssets(comp_id: $compId)
}
```

### Usage with Apollo Client
```javascript
import { useQuery, gql } from '@apollo/client';

const DOWNLOAD_QUERY = gql`
  query DownloadAssets($compId: Int!) {
    downloadAssets(comp_id: $compId)
  }
`;

const AssetDownloadButton = ({ companyId }) => {
  const [getDownload] = useLazyQuery(DOWNLOAD_QUERY);

  const handleDownload = async () => {
    const { data } = await getDownload({ variables: { compId: companyId } });
    const base64String = data.downloadAssets;
    
    // Convert base64 to Blob
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    // Trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assets_company_${companyId}.docx`;
    a.click();
  };

  return <button onClick={handleDownload}>Download Report</button>;
};
```

## Summary Table
| Method | Type | Path / Query | Response |
| :--- | :--- | :--- | :--- |
| **REST** | `GET` | `/api/assets/export/docx/:companyId` | Binary Stream (Blob) |
| **GraphQL** | `Query` | `downloadAssets(comp_id: Int!)` | Base64 String |
