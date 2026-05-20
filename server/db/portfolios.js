const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(path.join(dataDir, 'portfolios.json'));
const db = low(adapter);
db.defaults({ sessions: [] }).write();

const EMPTY_PORTFOLIO = () => ({
  assets: [],
  risk_profile: 'moderate',
  base_currency: 'USD',
  focus_regions: [],
});

function getSession(sessionId) {
  return db.get('sessions').find({ session_id: sessionId }).value();
}

function createSession(sessionId) {
  const session = {
    session_id: sessionId,
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    portfolio: EMPTY_PORTFOLIO(),
    watchlist: [],
    alert_preferences: { min_severity: 6, assets: [], channels: ['in-app'] },
    conversation_history: [],
  };
  db.get('sessions').push(session).write();
  return session;
}

function getOrCreate(sessionId) {
  return getSession(sessionId) || createSession(sessionId);
}

function touch(sessionId) {
  db.get('sessions').find({ session_id: sessionId })
    .assign({ last_active: new Date().toISOString() }).write();
}

function updatePortfolio(sessionId, portfolio) {
  getOrCreate(sessionId);
  db.get('sessions').find({ session_id: sessionId })
    .assign({ portfolio, last_active: new Date().toISOString() }).write();
}

function appendConversation(sessionId, role, content) {
  getOrCreate(sessionId);
  db.get('sessions').find({ session_id: sessionId })
    .get('conversation_history')
    .push({ role, content, timestamp: new Date().toISOString() })
    .write();

  // Keep last 50 turns
  const hist = db.get('sessions').find({ session_id: sessionId })
    .get('conversation_history').value();
  if (hist.length > 50) {
    db.get('sessions').find({ session_id: sessionId })
      .assign({ conversation_history: hist.slice(-50) }).write();
  }
  touch(sessionId);
}

function deleteSession(sessionId) {
  db.get('sessions').remove({ session_id: sessionId }).write();
}

module.exports = { getOrCreate, getSession, updatePortfolio, appendConversation, touch, deleteSession };
