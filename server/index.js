require('dotenv').config();
const express = require('express');
const cors = require('cors');

const conflictsRouter = require('./routes/conflicts');
const marketsRouter = require('./routes/markets');
const tradeRouter = require('./routes/trade');
const predictRouter = require('./routes/predict');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/conflicts', conflictsRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/predict', predictRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
