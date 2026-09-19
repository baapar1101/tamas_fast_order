# NISEDA Backend API

Simple Node.js + Express backend API for the NISEDA admin panel.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3004`

## API Endpoints

### User
- `GET /api/v1/user` - Get user information

### Products
- `GET /api/v1/manage/products` - Get all products
- `GET /api/v1/manage/products/count` - Get products count
- `GET /api/v1/manage/products/categories` - Get product categories
- `GET /api/v1/manage/products/categories/count` - Get categories count
- `GET /api/v1/manage/products/categories/nested` - Get nested categories
- `GET /api/v1/manage/products/brands` - Get product brands
- `GET /api/v1/manage/products/brands/count` - Get brands count
- `GET /api/v1/manage/products/variants` - Get product variants
- `GET /api/v1/manage/products/variants/count` - Get variants count
- `GET /api/v1/manage/products/attributes` - Get product attributes
- `GET /api/v1/manage/products/attributes/count` - Get attributes count
- `GET /api/v1/manage/products/comments/count` - Get comments count

### Orders
- `GET /api/v1/manage/orders` - Get all orders
- `GET /api/v1/manage/orders/count` - Get orders count
- `GET /api/v1/manage/orders/tags` - Get order tags

### Payments
- `GET /api/v1/manage/payments/count` - Get payments count

### Channels
- `GET /api/v1/manage/channels` - Get sales channels
- `GET /api/v1/manage/couriers` - Get couriers
- `GET /api/v1/manage/domains` - Get domains
- `GET /api/v1/manage/domains/count` - Get domains count
- `GET /api/v1/manage/emails` - Get emails
- `GET /api/v1/manage/emails/count` - Get emails count
- `GET /api/v1/manage/files` - Get files
- `GET /api/v1/manage/files/count` - Get files count
- `GET /api/v1/manage/settings` - Get settings

### Gateways
- `GET /api/v1/manage/gateways` - Get payment gateways

## Frontend

The frontend is served statically from the root directory. Access the admin panel at:
- `http://localhost:3004/` - Main admin panel
- `http://localhost:3004/login/` - Login page

## Data

All API responses are served from the JSON files in the `api/v1/` directory. To modify the data, edit the corresponding JSON files.
