const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const usersDb = require('../db/users');
const { signToken, requireAuth } = require('../middleware/authMiddleware');

// Verify Google ID token using Google's tokeninfo endpoint
async function verifyGoogleToken(credential) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
  if (!res.ok) throw new Error('Invalid Google token');
  const payload = await res.json();
  if (payload.error) throw new Error(payload.error_description || 'Google token error');
  // Optionally verify audience matches our client ID
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && payload.aud !== clientId) throw new Error('Token audience mismatch');
  return { googleId: payload.sub, email: payload.email, name: payload.name };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = usersDb.findByEmail(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = usersDb.createUser({ email, name: name || email.split('@')[0], passwordHash });
  const token = signToken({ id: user.id, email: user.email });
  res.status(201).json({ token, user });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = usersDb.findByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.passwordHash) return res.status(401).json({ error: 'This account uses Google sign-in' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken({ id: user.id, email: user.email });
  res.json({ token, user: usersDb.sanitize(user) });
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Google credential required' });

  try {
    const { googleId, email, name } = await verifyGoogleToken(credential);

    // Find existing user by Google ID or email
    let user = usersDb.findByGoogleId(googleId) || usersDb.findByEmail(email);
    if (!user) {
      user = usersDb.createUser({ email, name, googleId });
    }

    const token = signToken({ id: user.id, email: user.email });
    res.json({ token, user: usersDb.sanitize(user) });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// GET /api/auth/me — verify token and return user
router.get('/me', requireAuth, (req, res) => {
  const user = usersDb.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(usersDb.sanitize(user));
});


module.exports = router;
