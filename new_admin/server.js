const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to read JSON files
const readJsonFile = (filePath) => {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      const data = fs.readFileSync(fullPath, 'utf8');
      return JSON.parse(data);
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Helper function to handle both with and without trailing slash
const handleJsonRoute = (jsonPath) => {
  return (req, res) => {
    const data = readJsonFile(jsonPath);
    res.json(data);
  };
};

// API Routes - User
app.get('/api/v1/user', handleJsonRoute('api/v1/user.json'));
app.get('/api/v1/user/', handleJsonRoute('api/v1/user.json'));

// API Routes - Manage/Products
app.get('/api/v1/manage/products', handleJsonRoute('api/v1/manage/products.json'));
app.get('/api/v1/manage/products/', handleJsonRoute('api/v1/manage/products.json'));
app.get('/api/v1/manage/products/count', handleJsonRoute('api/v1/manage/products/count.json'));
app.get('/api/v1/manage/products/count/', handleJsonRoute('api/v1/manage/products/count.json'));
app.get('/api/v1/manage/products/categories', handleJsonRoute('api/v1/manage/products/categories.json'));
app.get('/api/v1/manage/products/categories/', handleJsonRoute('api/v1/manage/products/categories.json'));
app.get('/api/v1/manage/products/categories/count', handleJsonRoute('api/v1/manage/products/categories/count.json'));
app.get('/api/v1/manage/products/categories/count/', handleJsonRoute('api/v1/manage/products/categories/count.json'));
app.get('/api/v1/manage/products/categories/nested', handleJsonRoute('api/v1/manage/products/categories/nested.json'));
app.get('/api/v1/manage/products/categories/nested/', handleJsonRoute('api/v1/manage/products/categories/nested.json'));
app.get('/api/v1/manage/products/brands', handleJsonRoute('api/v1/manage/products/brands.json'));
app.get('/api/v1/manage/products/brands/', handleJsonRoute('api/v1/manage/products/brands.json'));
app.get('/api/v1/manage/products/brands/count', handleJsonRoute('api/v1/manage/products/brands/count.json'));
app.get('/api/v1/manage/products/brands/count/', handleJsonRoute('api/v1/manage/products/brands/count.json'));
app.get('/api/v1/manage/products/variants', handleJsonRoute('api/v1/manage/products/variants.json'));
app.get('/api/v1/manage/products/variants/', handleJsonRoute('api/v1/manage/products/variants.json'));
app.get('/api/v1/manage/products/variants/count', handleJsonRoute('api/v1/manage/products/variants/count.json'));
app.get('/api/v1/manage/products/variants/count/', handleJsonRoute('api/v1/manage/products/variants/count.json'));
app.get('/api/v1/manage/products/attributes', handleJsonRoute('api/v1/manage/products/attributes.json'));
app.get('/api/v1/manage/products/attributes/', handleJsonRoute('api/v1/manage/products/attributes.json'));
app.get('/api/v1/manage/products/attributes/count', handleJsonRoute('api/v1/manage/products/attributes/count.json'));
app.get('/api/v1/manage/products/attributes/count/', handleJsonRoute('api/v1/manage/products/attributes/count.json'));
app.get('/api/v1/manage/products/comments/count', handleJsonRoute('api/v1/manage/products/comments/count.json'));
app.get('/api/v1/manage/products/comments/count/', handleJsonRoute('api/v1/manage/products/comments/count.json'));

// API Routes - Manage/Orders
app.get('/api/v1/manage/orders', handleJsonRoute('api/v1/manage/orders.json'));
app.get('/api/v1/manage/orders/', handleJsonRoute('api/v1/manage/orders.json'));
app.get('/api/v1/manage/orders/count', handleJsonRoute('api/v1/manage/orders/count.json'));
app.get('/api/v1/manage/orders/count/', handleJsonRoute('api/v1/manage/orders/count.json'));
app.get('/api/v1/manage/orders/tags', handleJsonRoute('api/v1/manage/orders/tags.json'));
app.get('/api/v1/manage/orders/tags/', handleJsonRoute('api/v1/manage/orders/tags.json'));

// API Routes - Manage/Payments
app.get('/api/v1/manage/payments/count', handleJsonRoute('api/v1/manage/payments/count.json'));
app.get('/api/v1/manage/payments/count/', handleJsonRoute('api/v1/manage/payments/count.json'));

// API Routes - Manage/Channels
app.get('/api/v1/manage/channels', handleJsonRoute('api/v1/manage/channels.json'));
app.get('/api/v1/manage/channels/', handleJsonRoute('api/v1/manage/channels.json'));

// API Routes - Manage/Gateways
app.get('/api/v1/manage/gateways', handleJsonRoute('api/v1/manage/gateways.json'));
app.get('/api/v1/manage/gateways/', handleJsonRoute('api/v1/manage/gateways.json'));

// API Routes - Manage/Couriers
app.get('/api/v1/manage/couriers', handleJsonRoute('api/v1/manage/couriers.json'));
app.get('/api/v1/manage/couriers/', handleJsonRoute('api/v1/manage/couriers.json'));

// API Routes - Manage/Domains
app.get('/api/v1/manage/domains', handleJsonRoute('api/v1/manage/domains.json'));
app.get('/api/v1/manage/domains/', handleJsonRoute('api/v1/manage/domains.json'));
app.get('/api/v1/manage/domains/count', handleJsonRoute('api/v1/manage/domains/count.json'));
app.get('/api/v1/manage/domains/count/', handleJsonRoute('api/v1/manage/domains/count.json'));

// API Routes - Manage/Emails
app.get('/api/v1/manage/emails', handleJsonRoute('api/v1/manage/emails.json'));
app.get('/api/v1/manage/emails/', handleJsonRoute('api/v1/manage/emails.json'));
app.get('/api/v1/manage/emails/count', handleJsonRoute('api/v1/manage/emails/count.json'));
app.get('/api/v1/manage/emails/count/', handleJsonRoute('api/v1/manage/emails/count.json'));

// API Routes - Manage/Files
app.get('/api/v1/manage/files', handleJsonRoute('api/v1/manage/files.json'));
app.get('/api/v1/manage/files/', handleJsonRoute('api/v1/manage/files.json'));
app.get('/api/v1/manage/files/count', handleJsonRoute('api/v1/manage/files/count.json'));
app.get('/api/v1/manage/files/count/', handleJsonRoute('api/v1/manage/files/count.json'));

// API Routes - Manage/Settings
app.get('/api/v1/manage/settings', handleJsonRoute('api/v1/manage/settings.json'));
app.get('/api/v1/manage/settings/', handleJsonRoute('api/v1/manage/settings.json'));

// Serve static files (must be after API routes)
app.use(express.static(__dirname));

// Catch-all route for frontend
app.get('*', (req, res) => {
  // Serve index.html for root
  if (req.path === '/' || req.path === '/index.html') {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    // Try to serve static files
    const filePath = path.join(__dirname, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(__dirname, 'index.html'));
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/v1/`);
});
