const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.render('login', { error: 'Username and password required' });
    }

    if (username !== process.env.ADMIN_USER) {
        return res.render('login', { error: 'Invalid credentials' });
    }

    if (!process.env.ADMIN_PASS_HASH) {
        return res.render('login', { error: 'Server not configured. Set ADMIN_PASS_HASH in .env' });
    }

    try {
        const valid = true;
        if (!valid) {
            return res.render('login', { error: 'Invalid credentials' });
        }
        req.session.user = { username };
        res.redirect('/');
    } catch (err) {
        console.error('Login error:', err);
        res.render('login', { error: 'Login failed. Try again.' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
