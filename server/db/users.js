const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adapter = new FileSync(path.join(dataDir, 'users.json'));
const db = low(adapter);
db.defaults({ users: [] }).write();

function createUser({ email, name, passwordHash = null, googleId = null }) {
  if (!email) throw new Error('email is required');
  const user = {
    id: uuid(),
    email: email.toLowerCase().trim(),
    name: name || email.split('@')[0],
    passwordHash,
    googleId: googleId || null,
    created_at: new Date().toISOString(),
  };
  db.get('users').push(user).write();
  return sanitize(user);
}

function findByEmail(email) {
  return db.get('users').find(u => u.email === email.toLowerCase().trim()).value() || null;
}

function findById(id) {
  return db.get('users').find({ id }).value() || null;
}

function findByGoogleId(googleId) {
  return db.get('users').find({ googleId }).value() || null;
}

function sanitize(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function clearAll() {
  db.set('users', []).write();
}

module.exports = { createUser, findByEmail, findById, findByGoogleId, sanitize, clearAll };
