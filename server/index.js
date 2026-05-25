require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRouter = require('./routes/auth');
const conflictsRouter = require('./routes/conflicts');
const marketsRouter = require('./routes/markets');
const tradeRouter = require('./routes/trade');
const predictRouter = require('./routes/predict');
const chatRouter = require('./routes/chat');
const feedRouter = require('./routes/feed');
const predictionsRouter = require('./routes/predictions');
const scenariosRouter = require('./routes/scenarios');
const portfolioRouter = require('./routes/portfolio');
const supplyChainRouter = require('./routes/supplyChain');
const pricingRouter = require('./routes/pricing');

const { startScheduler } = require('./services/dataFeed');
const { startPredictionScheduler } = require('./services/predictionEngine');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/conflicts', conflictsRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/predict', predictRouter);
app.use('/api/chat', chatRouter);
app.use('/api/feed', feedRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/scenarios', scenariosRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/supply-chain', supplyChainRouter);
app.use('/api/pricing', pricingRouter);

app.get('/api/health', (req, res) => {
  const key = process.env.DEEPSEEK_API_KEY;
  res.json({
    status: 'ok',
    deepseek_key: key ? `${key.slice(0, 6)}...${key.slice(-4)} (len=${key.length})` : 'NOT SET',
  });
});

// Serve React build in production (client/dist must exist)
const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startScheduler();
  startPredictionScheduler();
});
