require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const deployRoutes = require('./routes/deploy');
const sitesRoutes = require('./routes/sites');

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'change-me-please',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

function requireAuth(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

// Health check (public)
app.get('/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Routes
app.use('/', authRoutes);
app.use('/', deployRoutes);
app.use('/', sitesRoutes);

// Dashboard (root)
app.get('/', requireAuth, (req, res) => {
    res.render('dashboard', {
        user: req.session.user,
        active: 'dashboard'
    });
});

// Dashboard data API
const coolify = require('./lib/coolify');

app.get('/api/dashboard-data', requireAuth, async (req, res) => {
    try {
        const services = await coolify.listServices();
        const list = Array.isArray(services) ? services : [];
        const wpSites = list.filter(s => s.name && s.name.startsWith('wp-'));

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let active = 0;
        let healthy = 0, unhealthy = 0, exited = 0, other = 0;

        const recent = wpSites.map(s => {
            const status = (s.status || '').toLowerCase();
            const wpApp = (s.applications || []).find(a => a.name === 'wordpress');
            let url = wpApp ? wpApp.fqdn : null;
            if (url && !url.startsWith('http')) url = 'https://' + url;

            let statusKind = 'other';
            let statusLabel = s.status || 'unknown';
            if (status.includes('healthy') && !status.includes('unhealthy')) {
                statusKind = 'healthy';
                statusLabel = 'Healthy';
                healthy++;
                active++;
            } else if (status.includes('unhealthy')) {
                statusKind = 'unhealthy';
                statusLabel = 'Unhealthy';
                unhealthy++;
                active++;
            } else if (status.includes('exited') || status.includes('stopped')) {
                statusKind = 'exited';
                statusLabel = 'Stopped';
                exited++;
            } else if (status.includes('running')) {
                statusKind = 'other';
                statusLabel = 'Running';
                active++;
                other++;
            } else {
                other++;
            }

            return {
                name: s.name,
                url,
                statusKind,
                statusLabel,
                createdAt: s.created_at
            };
        });

        recent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const last7 = wpSites.filter(s => s.created_at && new Date(s.created_at) >= sevenDaysAgo).length;
        const thisMonth = wpSites.filter(s => s.created_at && new Date(s.created_at) >= monthStart).length;

        // Trend data — bucket by day for last 30 days
        const trend = [];
        for (let i = 29; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 86400000);
            day.setHours(0, 0, 0, 0);
            const next = new Date(day.getTime() + 86400000);
            const count = wpSites.filter(s => {
                if (!s.created_at) return false;
                const c = new Date(s.created_at);
                return c >= day && c < next;
            }).length;
            const label = (day.getMonth() + 1) + '/' + day.getDate();
            trend.push({ label, count });
        }

        res.json({
            total: wpSites.length,
            active,
            last7,
            thisMonth,
            statusBreakdown: { healthy, unhealthy, exited, other },
            trend,
            recent
        });
    } catch (err) {
        console.error('Dashboard data error:', err.message);
        res.status(500).json({
            error: err.message,
            total: 0, active: 0, last7: 0, thisMonth: 0,
            statusBreakdown: {}, trend: [], recent: []
        });
    }
});

app.use((req, res) => {
    res.status(404).render('404', {
        user: req.session.user || null,
        active: null
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).send('Server error: ' + err.message);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  Setup Portal is running!');
    console.log('========================================');
    console.log(`  Local:  http://localhost:${PORT}`);
    console.log(`  Login:  http://localhost:${PORT}/login`);
    console.log('========================================');
    console.log('');
});
