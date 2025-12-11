const verifyAipexToken = (req, res, next) => {
    const token = req.headers['authorization'] || req.headers['x-aipex-token'];

    if (!token) {
        return res.status(401).json({ error: 'Aipex token required' });
    }

    const today = new Date();
    const currentDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[today.getDay()];

    const expectedToken = `Aipex_${currentDate}_${currentDay}`;

    if (token !== expectedToken) {
        return res.status(401).json({ error: 'Invalid Aipex token' });
    }

    // Optional: Add token data to req for route use
    req.aipexToken = { date: currentDate, day: currentDay };
    next();
};

module.exports = verifyAipexToken;
