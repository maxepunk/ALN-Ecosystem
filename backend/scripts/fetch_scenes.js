const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');

const HA_URL = process.env.HOME_ASSISTANT_URL;
const HA_TOKEN = process.env.HOME_ASSISTANT_TOKEN;

if (!HA_URL || !HA_TOKEN) {
    console.error('Missing HOME_ASSISTANT_URL or HOME_ASSISTANT_TOKEN in .env');
    process.exit(1);
}

async function fetchScenes() {
    try {
        console.log(`Connecting to ${HA_URL}...`);
        const response = await axios.get(`${HA_URL}/api/states`, {
            headers: {
                Authorization: `Bearer ${HA_TOKEN}`,
                'Content-Type': 'application/json',
            },
            timeout: 5000,
        });

        const scenes = response.data
            .filter((entity) => entity.entity_id.startsWith('scene.'))
            .map((entity) => ({
                id: entity.entity_id,
                name: entity.attributes.friendly_name,
            }));

        console.log(JSON.stringify(scenes, null, 2));
    } catch (error) {
        console.error('Error fetching scenes:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
        }
    }
}

fetchScenes();
