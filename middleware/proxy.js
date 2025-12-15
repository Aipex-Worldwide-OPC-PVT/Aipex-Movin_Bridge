const https = require('https');
const http = require('http');
const { URL } = require('url');

// Detailed logging function
const logRequest = (req, endpoint, statusCode, responseTime, error = null) => {
    const log = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        endpoint,
        statusCode,
        responseTime: `${responseTime}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: error ? error : undefined,
        credentials: {
            hasOcpKey: !!req.headers['ocp-apim-subscription-key']
        }
    };

};

// Promise-based proxy request (async/await)
const proxyRequest = (targetUrl, req, res) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        // 1. Check for required header
        const ocpKey = req.headers['ocp-apim-subscription-key'];
        if (!ocpKey) {

            res.status(400).json({
                error: 'Missing Ocp-Apim-Subscription-Key header',
                hint: 'Add header: Ocp-Apim-Subscription-Key: your-api-key'
            });
            return reject(new Error('Missing OCP key'));
        }

        // 2. Parse target URL
        let url;
        try {
            url = new URL(targetUrl);

        } catch (err) {

            res.status(400).json({ error: 'Invalid target URL', message: err.message });
            return reject(err);
        }

        // 3. Determine protocol (http or https)
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        // 4. Prepare request body
        let bodyBuffer = Buffer.alloc(0);
        if (req.body && Object.keys(req.body).length > 0) {
            bodyBuffer = Buffer.from(JSON.stringify(req.body));
        }

        // 5. Build request options
        const options = {
            hostname: url.hostname,
            port: 443,  // Always use 443 for HTTPS
            path: url.pathname + (url.search || ''),
            method: req.method,
            headers: {
                'Ocp-Apim-Subscription-Key': ocpKey,
                'Content-Type': 'application/json',
                'Content-Length': bodyBuffer.length,
                'User-Agent': 'Aipex-Middleman/1.0',
                'Connection': 'close'
            },
            timeout: 90000,
            rejectUnauthorized: false
        };


        // 6. Make the actual request
        const carrierReq = client.request(options, (carrierRes) => {

            let responseBody = '';

            // Collect response data
            carrierRes.on('data', (chunk) => {
                responseBody += chunk.toString();
            });

            // When response ends
            carrierRes.on('end', () => {
                const responseTime = Date.now() - startTime;

                // Send complete response back to client
                res.writeHead(carrierRes.statusCode, carrierRes.headers);
                res.end(responseBody);

                logRequest(req, targetUrl, carrierRes.statusCode, responseTime);
                resolve();
            });
        });

        // 7. Handle errors
        carrierReq.on('error', (err) => {
            const responseTime = Date.now() - startTime;

            logRequest(req, targetUrl, 502, responseTime, err.message);

            if (!res.headersSent) {
                res.status(502).json({
                    error: 'Upstream service error',
                    errorCode: err.code,
                    errorMessage: err.message,
                    targetUrl: targetUrl,
                    hint: 'Check if carrier URL is correct and accessible'
                });
            }
            reject(err);
        });

        // 8. Handle timeout
        carrierReq.on('timeout', () => {
            const responseTime = Date.now() - startTime;

            carrierReq.destroy();
            logRequest(req, targetUrl, 504, responseTime, 'Request timeout');

            if (!res.headersSent) {
                res.status(504).json({
                    error: 'Gateway Timeout',
                    message: 'Carrier API did not respond within 90 seconds',
                    targetUrl: targetUrl
                });
            }
            reject(new Error('Request timeout'));
        });

        // 9. Write body and send request
        if (bodyBuffer.length > 0) {

            carrierReq.write(bodyBuffer);
        }

        carrierReq.end();

    });
};

// Main middleware with async/await
const aipexProxy = async (req, res, next) => {
    try {

        const url = req.originalUrl || req.url;

        let targetUrl;

        // Match endpoints
        if (url.includes('/shipment/create')) {
            targetUrl = process.env.CARRIER_CREATE_URL;
            // console.log('✅ Matched: CREATE CONSIGNMENT');
        } else if (url.includes('/shipment/track')) {
            targetUrl = process.env.CARRIER_TRACK_URL;
            //console.log('✅ Matched: TRACKING');
        } else if (url.includes('/shipment/label')) {
            targetUrl = process.env.CARRIER_LABEL_URL;
            //console.log('✅ Matched: LABEL GENERATION');
        } else {
            //console.error('❌ No endpoint match');
            return res.status(400).json({
                error: 'Invalid endpoint',
                receivedUrl: url,
                availableEndpoints: [
                    'POST /shipment/sync/create',
                    'POST /rest/shipment/track',
                    'POST /rest/shipment/label'
                ]
            });
        }

        // Validate target URL exists
        if (!targetUrl) {
            //console.error('❌ Target URL not configured in .env');
            return res.status(500).json({
                error: 'Target URL not configured',
                hint: 'Check .env file for CARRIER_CREATE_URL, CARRIER_TRACK_URL, or CARRIER_LABEL_URL'
            });
        }

        // Wait for proxy request to complete
        await proxyRequest(targetUrl, req, res);

    } catch (error) {
        //console.error('❌ Middleware Error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
};

module.exports = aipexProxy;
