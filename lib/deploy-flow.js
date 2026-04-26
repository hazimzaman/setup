const crypto = require('crypto');
const coolify = require('./coolify');
const db = require('./coolify-db');

const GOLDEN_IMAGE = process.env.GOLDEN_IMAGE || 'ghcr.io/hazimzaman/golden-wp:latest';

function randomPassword(length = 24) {
    return crypto.randomBytes(length).toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, length);
}

function buildCompose() {
    return `services:
  wordpress:
    image: '${GOLDEN_IMAGE}'
    environment:
      - SERVICE_FQDN_WORDPRESS_80=https://\${WP_DOMAIN}
      - WORDPRESS_DB_HOST=db
      - WORDPRESS_DB_USER=wordpress
      - WORDPRESS_DB_PASSWORD=\${MYSQL_PASSWORD}
      - WORDPRESS_DB_NAME=wordpress
      - WP_SITE_URL=https://\${WP_DOMAIN}
      - WP_SITE_TITLE=\${WP_SITE_TITLE}
      - WP_ADMIN_USER=\${WP_ADMIN_USER}
      - WP_ADMIN_PASS=\${WP_ADMIN_PASS}
      - WP_ADMIN_EMAIL=\${WP_ADMIN_EMAIL}
      - WP_THEME=\${WP_THEME}
      - WP_ACTIVATE_PLUGINS=\${WP_ACTIVATE_PLUGINS}
    volumes:
      - wp-data:/var/www/html
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost/wp-login.php || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 180s

  db:
    image: 'mariadb:11'
    environment:
      - MARIADB_ROOT_PASSWORD=\${MYSQL_ROOT_PASSWORD}
      - MARIADB_DATABASE=wordpress
      - MARIADB_USER=wordpress
      - MARIADB_PASSWORD=\${MYSQL_PASSWORD}
    volumes:
      - db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 60s

volumes:
  wp-data:
  db-data:
`;
}

async function deploySite(input, onProgress = () => {}) {
    const baseDomain = process.env.BASE_DOMAIN;
    const subdomain = input.subdomain;
    const domain = `${subdomain}.${baseDomain}`;

    onProgress('start', `Starting deployment for ${domain}`);

    const dockerCompose = buildCompose();

    onProgress('create', 'Creating Coolify service...');
    const service = await coolify.createService({
        name: `wp-${subdomain}`,
        description: `WordPress site for ${domain}`,
        dockerCompose
    });
    const serviceUuid = service.uuid;
    onProgress('create_done', `Service created`);

    onProgress('envs', 'Setting environment variables...');
    const mysqlPass = randomPassword(24);
    const mysqlRootPass = randomPassword(24);

    const activatePluginsCsv = Array.isArray(input.activatePlugins)
        ? input.activatePlugins.join(',')
        : (input.activatePlugins || '');

    const envVars = {
        SERVICE_FQDN_WORDPRESS_80: `https://${domain}`,
        WP_DOMAIN: domain,
        WP_SITE_TITLE: input.siteTitle || 'New Site',
        WP_ADMIN_USER: input.adminUser,
        WP_ADMIN_PASS: input.adminPass,
        WP_ADMIN_EMAIL: input.adminEmail,
        WP_THEME: input.theme || 'bricks',
        WP_ACTIVATE_PLUGINS: activatePluginsCsv,
        MYSQL_PASSWORD: mysqlPass,
        MYSQL_ROOT_PASSWORD: mysqlRootPass
    };

    const envResults = await coolify.setEnvVars(serviceUuid, envVars);
    onProgress('envs_done', `Env vars set (${envResults.filter(r => r.ok).length}/${envResults.length})`);

    onProgress('deploy', 'Triggering deployment...');
    await coolify.deploy(serviceUuid);
    onProgress('deploy_done', 'Deployment triggered');

    onProgress('fqdn', 'Updating FQDN...');
    await new Promise(r => setTimeout(r, 3000));

    try {
        const wpAppUuid = await coolify.getWordpressAppUuid(serviceUuid);
        if (wpAppUuid) {
            await db.updateServiceAppFqdn(wpAppUuid, `https://${domain}`);
            onProgress('fqdn_done', 'FQDN updated in DB');
        } else {
            onProgress('fqdn_warn', 'Could not find wordpress sub-app UUID');
        }
    } catch (err) {
        onProgress('fqdn_warn', `FQDN update skipped: ${err.message}`);
    }

    onProgress('restart', 'Restarting service...');
    try {
        await new Promise(r => setTimeout(r, 2000));
        await coolify.restart(serviceUuid);
        onProgress('restart_done', 'Restart triggered');
    } catch (err) {
        onProgress('restart_warn', `Restart skipped: ${err.message}`);
    }

    onProgress('done', 'Deployment complete!');

    return {
        serviceUuid,
        domain,
        siteUrl: `https://${domain}`,
        adminUrl: `https://${domain}/wp-admin`,
        adminUser: input.adminUser,
        adminPass: input.adminPass
    };
}

module.exports = { deploySite, buildCompose, randomPassword };
