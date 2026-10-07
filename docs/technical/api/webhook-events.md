# Inbound Webhook Events

Event types that the CRM may send to `/api/crm/webhook` endpoint.

## Event Types

### 1. Chat Message
```json
{
  "eventType": "chat.message.new",
  "eventId": "evt-987654321",
  "timestamp": "2024-09-19T12:34:56Z",
  "payload": {
    "messageId": "msg-12345",
    "conversationId": "conv-111",
    "sender": {
      "id": "crm-123",
      "type": "CRM",
      "firstName": "Support",
      "lastName": "Agent",
      "email": "support@hesabix.ir"
    },
    "recipient": {
      "id": "user-6789",
      "type": "USER",
      "phone": "09901046596"
    },
    "content": "Hello! How can I help you today?",
    "type": "text",
    "status": "sent"
  }
}
```

### 2. Payment Completed
```json
{
  "eventType": "payment.completed",
  "eventId": "evt-123456789",
  "timestamp": "2024-09-19T12:34:56Z",
  "payload": {
    "paymentId": "pay-789012",
    "orderCode": "KP-20240919-123456",
    "amount": 99.98,
    "currency": "IRR",
    "method": "online",
    "transactionId": "txn-abc123",
    "status": "completed",
    "paidAt": "2024-09-19T12:34:00Z"
  }
}
```

### 3. Order Status Changed
```json
{
  "eventType": "order.status.changed",
  "eventId": "evt-555666777",
  "timestamp": "2024-09-19T12:34:56Z",
  "payload": {
    "orderCode": "KP-20240919-123456",
    "previousStatus": "new",
    "newStatus": "confirmed",
    "changedAt": "2024-09-19T12:34:00Z",
    "changedBy": "crm-123"
  }
}
```

### 4. Person Updated
```json
{
  "eventType": "person.updated",
  "eventId": "evt-999888777",
  "timestamp": "2024-09-19T12:34:56Z",
  "payload": {
    "personId": "12345",
    "phone": "09901046596",
    "fieldsUpdated": ["firstName", "lastName", "nationalCode"],
    "updatedAt": "2024-09-19T12:34:00Z",
    "updatedBy": "crm-123"
  }
}
```

### 5. Inventory Update
```json
{
  "eventType": "product.stock.updated",
  "eventId": "evt-111222333",
  "timestamp": "2024-09-19T12:34:56Z",
  "payload": {
    "productId": "p123",
    "sku": "PROD-001",
    "stock": 95,
    "kermanStock": 45,
    "tehranStock": 50,
    "updatedAt": "2024-09-19T12:34:00Z"
  }
}
```

## Common Fields
All webhook events include:
- `eventType`: String identifying the event kind
- `eventId`: Unique identifier for deduplication
- `timestamp`: ISO 8601 timestamp when event was generated
- `payload`: Object containing event-specific data

## Security
Each webhook request includes HMAC-SHA256 signature in header:
```
X-Hub-Signature-256: sha256=<hex digest>
```
The signature is computed as: HMAC-SHA256(webhookSecret, rawRequestBody)