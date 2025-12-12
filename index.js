const express = require('express');
const verifyAipexToken = require('./middleware/auth');
const aipexProxy = require('./middleware/proxy');

const app = express();
require("dotenv").config();
// ===== MIDDLEWARE STACK =====

// 1. Body parsers (before auth)
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// 2. Auth middleware (check Aipex token)
app.use(verifyAipexToken);

// ===== ROUTES =====

// 1. CreateConsignment API
// Health check
app.get('/health', (req, res) => res.json({ status: 'Aipex Middleman Active' }));

app.post('/shipment/create', (req, res) => {
    aipexProxy(req, res);
});

// 2. Tracking API
app.post('/shipment/track', (req, res) => {
    aipexProxy(req, res);
});

// 3. Label Generation API
app.post('/shipment/label', (req, res) => {
    aipexProxy(req, res);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'Aipex Middleman Active',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Token generator (for testing)
app.get('/generate-token', (req, res) => {
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const day = dayNames[today.getDay()];
    const token = `Aipex_${date}_${day}`;

    res.json({
        token,
        date,
        day,
        expires: 'Midnight UTC'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        availableEndpoints: [
            'POST /shipment/create',
            'POST /shipment/track',
            'POST /shipment/label',
            'GET /health',
            // 'GET /generate-token'
        ]
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n✅ Aipex Middleman running on http://localhost:${PORT}`);
    //  console.log(`📝 Health: http://localhost:${PORT}/health`);
    //  console.log(`🔑 Token: http://localhost:${PORT}/generate-token\n`);
});
