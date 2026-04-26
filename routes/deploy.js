const express = require('express');
const router = express.Router();
const deployFlow = require('../lib/deploy-flow');

const deployments = {};

function requireAuth(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

router.get('/deploy', requireAuth, (req, res) => {
    res.render('deploy-form', {
        user: req.session.user,
        baseDomain: process.env.BASE_DOMAIN || 'example.com',
        active: 'deploy',
        error: null,
        formData: {}
    });
});

router.post('/deploy', requireAuth, async (req, res) => {
    const { subdomain, siteTitle, adminUser, adminPass, adminEmail, theme } = req.body;

    let plugins = req.body.plugins;
    if (!plugins) plugins = [];
    if (typeof plugins === 'string') plugins = [plugins];

    const formData = { subdomain, siteTitle, adminUser, adminEmail, theme, plugins };

    if (!subdomain || !siteTitle || !adminUser || !adminPass || !adminEmail) {
        return res.render('deploy-form', {
            user: req.session.user,
            baseDomain: process.env.BASE_DOMAIN,
            active: 'deploy',
            error: 'All fields are required',
            formData
        });
    }

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain)) {
        return res.render('deploy-form', {
            user: req.session.user,
            baseDomain: process.env.BASE_DOMAIN,
            active: 'deploy',
            error: 'Invalid subdomain. Use lowercase letters, numbers, and hyphens only.',
            formData
        });
    }

    if (adminPass.length < 12) {
        return res.render('deploy-form', {
            user: req.session.user,
            baseDomain: process.env.BASE_DOMAIN,
            active: 'deploy',
            error: 'Password must be at least 12 characters.',
            formData
        });
    }

    const deployId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    deployments[deployId] = {
        id: deployId,
        domain: `${subdomain}.${process.env.BASE_DOMAIN}`,
        status: 'starting',
        steps: [],
        result: null,
        error: null,
        startedAt: new Date().toISOString()
    };

    deployFlow.deploySite(
        {
            subdomain,
            siteTitle,
            adminUser,
            adminPass,
            adminEmail,
            theme: theme || 'bricks',
            activatePlugins: plugins
        },
        (step, message) => {
            console.log(`[${deployId}] ${step}: ${message}`);
            deployments[deployId].steps.push({
                step,
                message,
                at: new Date().toISOString()
            });
            deployments[deployId].status = step;
        }
    ).then(result => {
        deployments[deployId].status = 'done';
        deployments[deployId].result = result;
        deployments[deployId].completedAt = new Date().toISOString();
    }).catch(err => {
        console.error(`[${deployId}] FAILED:`, err);
        deployments[deployId].status = 'failed';
        deployments[deployId].error = err.message;
        deployments[deployId].completedAt = new Date().toISOString();
    });

    res.redirect(`/deploy/${deployId}`);
});

router.get('/deploy/:id', requireAuth, (req, res) => {
    const dep = deployments[req.params.id];
    if (!dep) {
        return res.status(404).render('404', {
            user: req.session.user,
            active: 'deploy'
        });
    }
    res.render('deploy-status', {
        user: req.session.user,
        deployment: dep,
        active: 'deploy'
    });
});

router.get('/deploy/:id/status', requireAuth, (req, res) => {
    const dep = deployments[req.params.id];
    if (!dep) return res.status(404).json({ error: 'Not found' });
    res.json(dep);
});

// Expose the in-memory store so sites route can use recent deploys
router.deployments = deployments;

module.exports = router;
