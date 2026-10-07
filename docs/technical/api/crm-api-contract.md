# CRM API Contract

Expected endpoints and payload shapes for Hesabix/MarkStreet CRM integration.

## Order
POST /api/v1/orders
```json
{
  "orderCode": "KP-20240919-123456",
  "customerId": "12345",
  "items": [
    {
      "productId": "p123",
      "sku": "PROD-001",
      "quantity": 2,
      "price": 49.99
    }
  ],
  "total": 99.98,
  "status": "new",
  "createdAt": "2024-09-19T12:34:56Z",
  "customer": {
    "id": "12345",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "09901046596"
  }
}
```

## Product
POST /api/v1/products
```json
{
  "productId": "p123",
  "sku": "PROD-001",
  "title": "Peyda T-Shirt",
  "model": "Classic",
  "categoryName": "Clothing",
  "brandName": "Tamas",
  "sku": "PROD-001",
  "stock": 100,
  "kermanStock": 50,
  "tehranStock": 50,
  "status": "active",
  "price": 39.99,
  "sku": "PROD-001",
  "brandName": "Tamas",
  "categoryName": "Clothing",
  "model": "Classic"
}
```

## Person
POST /api/v1/persons
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "09901046596",
  "aliasName": "JD123",
  "nationalCode": "1234567890123",
  "birthDate": "1990-01-01",
  "address": {
    "street": "Tehran St",
    "city": "Tehran",
    "postalCode": "12345"
  }
}
```

## Chat Message
POST /api/v1/chat/messages
```json
{
  "messageId": "msg-12345",
  "senderId": "crm-123",
  "senderType": "CRM",
  "recipientId": "user-6789",
  "recipientType": "user",
  "content": "Hello, this is a test message from CRM",
  "timestamp": "2024-09-19T12:45:00Z",
  "type": "text"
}
```

## Health Check
GET /api/v1/health
```json
{
  "success": true,
  "crm": {
    "reachable": true,
    "baseUrl": "https://tamastore.ir",
    "responseTimeMs": 123
  }
}
```