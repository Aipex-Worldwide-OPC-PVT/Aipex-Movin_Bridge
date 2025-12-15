const express = require('express');
// const verifyAipexToken = require('./middleware/auth');
const aipexProxy = require('./middleware/proxy');

const app = express();
require("dotenv").config();
// ===== MIDDLEWARE STACK =====

// 1. Body parsers (before auth)


app.get('/movintesting', async (req, res) => {
    const myHeaders = new Headers();
    myHeaders.append("Ocp-Apim-Subscription-Key", "015a5d2790c743eba08cdac9fcec6374");
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "communication_email": "naveen@aipexworldwide.com",
        "payload": [
            {
                "shipment": {
                    "sync": true,
                    "shipment_unique_id": "SHIP_1",
                    "shipment_type": "forward",
                    "ship_from_account": "NP-004404",
                    "ship_from_company": "Brihans Natural",
                    "ship_from_first_name": "----",
                    "ship_from_last_name": "Brihans Natural",
                    "ship_from_address_line1": "242 Shaniwar peth",
                    "ship_from_address_line2": "Beside Vartak Garden",
                    "ship_from_address_line3": "Opp Diamond Publications",
                    "ship_from_zipcode": "411030",
                    "ship_from_email": "leenabiradar@gmail.com",
                    "ship_from_phone": "7875075550",
                    "shipment_date": "2025-12-15",
                    "shipment_priority": "Standard Premium",
                    "ship_to_first_name": "Apollo Healthco Limited",
                    "ship_to_last_name": "---",
                    "ship_to_company": "Apollo Healthco Limited",
                    "ship_to_address_line1": "Gala No.1 to 8,Ground Floor,",
                    "ship_to_address_line2": "Bldg No.A/2,Prithvi Complex,",
                    "ship_to_address_line3": "Kalher Village,Thane",
                    "ship_to_zipcode": "421302",
                    "ship_to_email": "praful_choudhary@apollohealthco.org",
                    "ship_to_phone": "8976865547",
                    "invoice_number": "AI-251211115123350",
                    "reference_number_1": "945",
                    "reference_number_2": "AI-251211115123350",
                    "package_type": "Package",
                    "goods_general_description": "Beauty Products",
                    "special_instructions": "Testing",
                    "additional_email_ids": "",
                    "goods_value": "13397.00",
                    "declared_value": "13397.00",
                    "bill_to": "shipper",
                    "billing_account_number": "",
                    "billing_account_zipcode": "",
                    "gst_id": "",
                    "include_insurance": "No",
                    "email_notification": "Yes",
                    "mobile_notification": "Yes",
                    "add_adult_signature": "No",
                    "cash_on_delivery": "No"
                },
                "package": [
                    {
                        "package_unique_id": "AI-251211115123350",
                        "length": 46,
                        "width": 38,
                        "height": 14,
                        "weight_actual": 9.5,
                        "reference_number_1": "945",
                        "reference_number_2": "",
                        "invoice_number": "",
                        "identical_package_count": 1
                    },
                    {
                        "package_unique_id": "AI-251211115123350",
                        "length": 47,
                        "width": 35,
                        "height": 12,
                        "weight_actual": 7.5,
                        "reference_number_1": "945",
                        "reference_number_2": "",
                        "invoice_number": "",
                        "identical_package_count": 1
                    },
                    {
                        "package_unique_id": "AI-251211115123350",
                        "length": 46,
                        "width": 38,
                        "height": 14,
                        "weight_actual": 9.5,
                        "reference_number_1": "945",
                        "reference_number_2": "",
                        "invoice_number": "",
                        "identical_package_count": 1
                    }
                ]
            }
        ]
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };


    const response = await fetch("https://apim.iristransport.co.in/rest/shipment/sync/create", requestOptions)
       const data = await response.json()

        res.status(200).json({data:data})

})



app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// 2. Auth middleware (check Aipex token)
// app.use(verifyAipexToken);

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
