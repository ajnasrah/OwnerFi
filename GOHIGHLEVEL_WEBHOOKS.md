# GoHighLevel Webhook Integration

## Overview
This document describes the GoHighLevel webhook endpoints for managing properties in the OwnerFi system.

## Setup

### Environment Variables
Add the following to your `.env.local` file:
```
GHL_WEBHOOK_SECRET=your_webhook_secret_here
```

## Webhook Endpoints

### 1. List Properties
**Endpoint:** `POST /api/gohighlevel/webhook/list-properties`

**Headers:**
- `x-ghl-signature`: HMAC-SHA256 signature of the request body

**Request Body:**
```json
{
  "contactId": "ghl_contact_123",
  "locationId": "ghl_location_456",
  "filters": {
    "city": "Austin",
    "state": "TX",
    "minPrice": 200000,
    "maxPrice": 500000,
    "minBeds": 3,
    "maxBeds": 5,
    "minBaths": 2,
    "maxBaths": 4,
    "status": "available",
    "limit": 50
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "properties": [
      {
        "id": "property_id",
        "address": "123 Main St",
        "city": "Austin",
        "state": "TX",
        "zipCode": "78701",
        "price": 350000,
        "beds": 3,
        "baths": 2,
        "sqft": 1800,
        "status": "available",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "count": 1,
    "filters": {},
    "contactId": "ghl_contact_123",
    "locationId": "ghl_location_456"
  }
}
```

### 2. Delete Property
**Endpoint:** `POST /api/gohighlevel/webhook/delete-property`

**Headers:**
- `x-ghl-signature`: HMAC-SHA256 signature of the request body

**Request Body Options:**

#### Delete single property by ID:
```json
{
  "contactId": "ghl_contact_123",
  "locationId": "ghl_location_456",
  "propertyId": "property_id_to_delete"
}
```

#### Delete multiple properties by IDs:
```json
{
  "contactId": "ghl_contact_123",
  "locationId": "ghl_location_456",
  "propertyIds": ["property_id_1", "property_id_2", "property_id_3"]
}
```

#### Delete properties by field value:
```json
{
  "contactId": "ghl_contact_123",
  "locationId": "ghl_location_456",
  "deleteBy": {
    "field": "city",
    "value": "Austin"
  }
}
```

**Allowed fields for deleteBy:**
- `address`
- `city`
- `state`
- `zipCode`
- `status`

**Response:**
```json
{
  "success": true,
  "data": {
    "deletedProperties": ["property_id_1", "property_id_2"],
    "deletedCount": 2,
    "errors": [],
    "contactId": "ghl_contact_123",
    "locationId": "ghl_location_456"
  }
}
```

## Security

### Webhook Signature Verification
All webhook requests must include a valid HMAC-SHA256 signature in the `x-ghl-signature` header.

To generate the signature:
1. Create an HMAC-SHA256 hash of the request body using your webhook secret
2. Include the hex digest in the `x-ghl-signature` header

Example in Node.js:
```javascript
const crypto = require('crypto');

const signature = crypto
  .createHmac('sha256', process.env.GHL_WEBHOOK_SECRET)
  .update(JSON.stringify(requestBody))
  .digest('hex');
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (invalid signature)
- `404`: Resource not found
- `500`: Server error

Error response format:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

## Testing with cURL

### List Properties:
```bash
# Generate signature
BODY='{"contactId":"test","filters":{"city":"Austin","limit":10}}'
SECRET='your_webhook_secret_here'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Make request
curl -X POST https://your-domain.com/api/gohighlevel/webhook/list-properties \
  -H "Content-Type: application/json" \
  -H "x-ghl-signature: $SIGNATURE" \
  -d "$BODY"
```

### Delete Property:
```bash
# Generate signature
BODY='{"contactId":"test","propertyId":"prop_123"}'
SECRET='your_webhook_secret_here'
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Make request
curl -X POST https://your-domain.com/api/gohighlevel/webhook/delete-property \
  -H "Content-Type: application/json" \
  -H "x-ghl-signature: $SIGNATURE" \
  -d "$BODY"
```

## GoHighLevel Webhook Configuration

In your GoHighLevel account:
1. Navigate to Settings > Webhooks
2. Create a new webhook
3. Set the URL to your endpoint
4. Add your webhook secret
5. Select the appropriate trigger events
6. Test the connection

## Rate Limits

- Maximum 100 properties per list request
- Batch delete limited to 100 properties at once
- Delete all operations require additional confirmation