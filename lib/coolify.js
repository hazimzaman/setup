const axios = require('axios');

const COOLIFY_URL = process.env.COOLIFY_URL;
const COOLIFY_TOKEN = process.env.COOLIFY_TOKEN;

const client = axios.create({
    baseURL: `${COOLIFY_URL}/api/v1`,
    headers: {
        'Authorization': `Bearer ${COOLIFY_TOKEN}`,
        'Content-Type': 'application/json'
    },
    timeout: 30000
});

async function createService({ name, description, dockerCompose }) {
    const composeBase64 = Buffer.from(dockerCompose).toString('base64');
    const body = {
        project_uuid: process.env.PROJECT_UUID,
        server_uuid: process.env.SERVER_UUID,
        environment_name: process.env.ENVIRONMENT_NAME || 'production',
        name,
        description: description || '',
        docker_compose_raw: composeBase64,
        instant_deploy: false
    };
    const { data } = await client.post('/services', body);
    return data;
}

async function setEnvVar(serviceUuid, key, value) {
    const body = { key, value };
    try {
        await client.patch(`/services/${serviceUuid}/envs`, body);
    } catch (err) {
        if (err.response && (err.response.status === 404 || err.response.status === 422)) {
            await client.post(`/services/${serviceUuid}/envs`, body);
        } else {
            throw err;
        }
    }
}

async function setEnvVars(serviceUuid, envObject) {
    const results = [];
    for (const [key, value] of Object.entries(envObject)) {
        try {
            await setEnvVar(serviceUuid, key, value);
            results.push({ key, ok: true });
        } catch (err) {
            results.push({ key, ok: false, error: err.message });
        }
    }
    return results;
}

async function deploy(serviceUuid) {
    const { data } = await client.get(`/deploy?uuid=${serviceUuid}`);
    return data;
}

async function restart(serviceUuid) {
    const { data } = await client.get(`/services/${serviceUuid}/restart`);
    return data;
}

async function stop(serviceUuid) {
    const { data } = await client.get(`/services/${serviceUuid}/stop`);
    return data;
}

async function deleteService(serviceUuid) {
    const { data } = await client.delete(`/services/${serviceUuid}`);
    return data;
}

async function getService(serviceUuid) {
    const { data } = await client.get(`/services/${serviceUuid}`);
    return data;
}

async function listServices() {
    const { data } = await client.get('/services');
    // API may return either {value: [...]} or [...]
    if (data && data.value) return data.value;
    return data;
}

async function getWordpressAppUuid(serviceUuid) {
    const service = await getService(serviceUuid);
    const apps = service.applications || [];
    const wpApp = apps.find(a => a.name === 'wordpress');
    return wpApp ? wpApp.uuid : null;
}

module.exports = {
    createService,
    setEnvVar,
    setEnvVars,
    deploy,
    restart,
    stop,
    deleteService,
    getService,
    listServices,
    getWordpressAppUuid
};
