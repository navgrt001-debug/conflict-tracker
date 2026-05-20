const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(path.join(dataDir, 'predictions.json'));
const db = low(adapter);

db.defaults({ predictions: [] }).write();

function add(prediction) {
  db.get('predictions').push(prediction).write();
  return prediction;
}

function getAll() {
  return db.get('predictions').value();
}

function getById(id) {
  return db.get('predictions').find({ id }).value();
}

function update(id, changes) {
  db.get('predictions').find({ id }).assign(changes).write();
  return getById(id);
}

function getActive() {
  return db.get('predictions').filter({ status: 'pending' }).sortBy('created_at').reverse().value();
}

function getHistory() {
  return db.get('predictions')
    .filter(p => p.status === 'resolved' || p.status === 'expired')
    .sortBy('created_at').reverse().value();
}

function getExpired() {
  const now = Date.now();
  return db.get('predictions')
    .filter(p => p.status === 'pending' && new Date(p.resolve_date).getTime() <= now)
    .value();
}

function hasEventPrediction(eventId, asset) {
  return db.get('predictions')
    .some(p => p.event_id === eventId && p.asset === asset)
    .value();
}

module.exports = { add, getAll, getById, update, getActive, getHistory, getExpired, hasEventPrediction };
