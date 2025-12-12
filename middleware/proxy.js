const https = require('https');
const http = require('http');
const { URL } = require('url');

// Log requests with timing and credentials
const logRequest = (req, endpoint, statusCode, responseTime) => {
    const log = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        endpoint,
        statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        tokenDate: req.aipexToken?.date,
        credentials: {
            hasOcpKey: !!req.headers['ocp-apim-subscription-key'],
            otherHeaders: Object.keys(req.headers).filter(h =>
                h.toLowerCase().includes('auth') ||
                h.toLowerCase().includes('key') ||
                h.toLowerCase().includes('secret')
            )
        }
    };
    console.log('PROXY LOG:', JSON.stringify(log, null, 2));
};

// Forward request to carrier API
const proxyRequest = (targetUrl, req, res) => {
    const startTime = Date.now();

    // Extract credentials from incoming headers
    const ocpKey = req.headers['ocp-apim-subscription-key'];

    if (!ocpKey) {
        return res.status(400).json({
            error: 'Missing Ocp-Apim-Subscription-Key header',
            hint: 'Pass your carrier API key in header'
        });
    }

    const url = new URL(targetUrl);
    const client = url.protocol === 'https:' ? https : http;

    // Prepare request body
    const body = JSON.stringify(req.body || {});

    const proxyOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: req.method,
        headers: {
            'Ocp-Apim-Subscription-Key': ocpKey,  // Forward credential
            'Content-Type': 'application/json',
        },
        timeout: 30000
    };

    // Make request to carrier
    const carrierReq = client.request(proxyOptions, (carrierRes) => {
        const responseTime = Date.now() - startTime;

        // Mirror response status and headers exactly
        res.writeHead(carrierRes.statusCode, carrierRes.headers);

        // Stream response body
        carrierRes.pipe(res);

        // Log the request
        logRequest(req, targetUrl, carrierRes.statusCode, responseTime);
    });

    // Handle request errors
    carrierReq.on('error', (err) => {
        console.error('Carrier request error:', err.message);
        const responseTime = Date.now() - startTime;
        logRequest(req, targetUrl, 502, responseTime);

        if (!res.headersSent) {
            res.status(502).json({
                error: 'Upstream service error',
                message: err.message
            });
        }
    });

    // Handle timeout
    carrierReq.on('timeout', () => {
        carrierReq.destroy();
        const responseTime = Date.now() - startTime;
        logRequest(req, targetUrl, 504, responseTime);

        if (!res.headersSent) {
            res.status(504).json({ error: 'Upstream timeout' });
        }
    });

    // Send request body and end
    carrierReq.write(body);
    carrierReq.end();
};

// Main proxy middleware
const aipexProxy = (req, res, next) => {
    // Determine which endpoint from request
    const url = req.originalUrl || req.url;

    let targetUrl;

    if (url.includes('/shipment/create')) {
        targetUrl = process.env.CARRIER_CREATE_URL;
        console.log("targetUrl", targetUrl)
    } else if (url.includes('/shipment/track')) {
        targetUrl = process.env.CARRIER_TRACK_URL;
    } else if (url.includes('/shipment/label')) {
        targetUrl = process.env.CARRIER_LABEL_URL;
    }

    if (!targetUrl) {
        return res.status(400).json({
            error: 'Invalid endpoint',
            available: ['/shipment/create', '/shipment/track', '/shipment/label']
        });
    }

    proxyRequest(targetUrl, req, res);
};

module.exports = aipexProxy;
