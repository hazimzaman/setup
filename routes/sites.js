const express = require('express');
const router = express.Router();
const coolify = require('../lib/coolify');

function requireAuth(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

router.get('/sites', requireAuth, async (req, res) => {
    let sites = [];
    let fetchError = null;

    try {
        const services = await coolify.listServices();
        const list = Array.isArray(services) ? services : [];
        sites = list
            .filter(s => s.name && s.name.startsWith('wp-'))
            .map(s => {
                const wpApp = (s.applications || []).find(a => a.name === 'wordpress');
                let url = wpApp ? wpApp.fqdn : null;
                if (url && !url.startsWith('http')) url = 'https://' + url;
                return {
                    uuid: s.uuid,
                    name: s.name,
                    description: s.description || '',
                    url,
                    status: s.status || 'unknown',
                    createdAt: s.created_at,
                    updatedAt: s.updated_at
                };
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
        console.error('Error fetching sites:', err.message);
        fetchError = err.message;
    }

    res.render('sites', {
        user: req.session.user,
        sites,
        fetchError,
        active: 'sites'
    });
});

module.exports = router;
