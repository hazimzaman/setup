const { Pool } = require('pg');

let pool = null;

function getPool() {
    if (pool) return pool;
    pool = new Pool({
        host: process.env.COOLIFY_DB_HOST || 'localhost',
        port: parseInt(process.env.COOLIFY_DB_PORT || '5432', 10),
        database: process.env.COOLIFY_DB_NAME || 'coolify',
        user: process.env.COOLIFY_DB_USER || 'coolify',
        password: process.env.COOLIFY_DB_PASS,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });
    return pool;
}

async function updateServiceAppFqdn(appUuid, fqdn) {
    const sql = `UPDATE service_applications SET fqdn = $1, updated_at = NOW() WHERE uuid = $2 RETURNING uuid, fqdn`;
    const { rows } = await getPool().query(sql, [fqdn, appUuid]);
    return rows[0] || null;
}

async function testConnection() {
    try {
        const { rows } = await getPool().query('SELECT NOW() AS now, version() AS version');
        return { ok: true, ...rows[0] };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

async function close() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

module.exports = { updateServiceAppFqdn, testConnection, close };
