const express = require('express');
const yf = require('yahoo-finance2').default;
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/stock/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    try {
        const quote = await yf.quote(symbol);
        res.json({
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            percent: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume
        });
    } catch (err) {
        res.status(500).json({ error: "Symbol not found or API issue." });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
