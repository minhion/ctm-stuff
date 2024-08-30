const { Client, GatewayIntentBits } = require('discord.js');

// Load environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CONTROL_M_API_KEY = process.env.CONTROL_M_API_KEY;
const CONTROL_M_ENDPOINT = process.env.CONTROL_M_ENDPOINT;

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Bot connected as ${client.user.tag}`);
});

// Command to get servers
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!get_servers')) {
        try {
            const response = await fetch(`${CONTROL_M_ENDPOINT}/config/servers`, {
                method: 'GET',
                headers: {
                    'x-api-key': CONTROL_M_API_KEY,
                },
            });

            if (response.ok) {
                const servers = await response.json();
                const serverList = servers.map(server => 
                    `Name: ${server.name}, Host: ${server.host}, State: ${server.state}, Version: ${server.version}, OS: ${server.OSType}`
                ).join('\n');

                message.channel.send(`Control-M Servers:\n${serverList}`);
            } else {
                message.channel.send(`Failed to retrieve servers. Status code: ${response.status}`);
            }
        } catch (error) {
            message.channel.send(`An error occurred: ${error.message}`);
        }
    }
});

// Command to run a job
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!run_job')) {
        const args = message.content.split(' ');
        const zipcode = args[1];
        const email = args[2];

        const payload = {
            ctm: "IN01",
            folder: "mqn-forecast-flow",
            jobs: "*",
            variables: [
                {
                    zipcode: zipcode,
                    email: email,
                },
            ],
        };

        try {
            const response = await fetch(`${CONTROL_M_ENDPOINT}/run/order`, {
                method: 'POST',
                headers: {
                    'x-api-key': CONTROL_M_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const result = await response.json();
                const { runId, statusURI } = result;
                message.channel.send(`Job submitted! Run ID: ${runId}. Checking status...`);

                // Check job status
                const statusResponse = await fetch(statusURI, {
                    method: 'GET',
                    headers: {
                        'x-api-key': CONTROL_M_API_KEY,
                    },
                });

                if (statusResponse.ok) {
                    const statusResult = await statusResponse.json();
                    const completion = statusResult.completion;

                    if (completion === "Completed") {
                        const jobName = statusResult.statuses[0].name;
                        const jobId = statusResult.statuses[0].jobId;
                        message.channel.send(`Job ${runId} completed successfully!`);
                        message.channel.send(`Job Name: ${jobName}, Job ID: ${jobId}. Use !get_output ${jobId} to see the output.`);
                    } else {
                        message.channel.send(`Job ${runId} is still in progress. Please check again later.`);
                    }
                } else {
                    message.channel.send(`Failed to retrieve job status. Status code: ${statusResponse.status}`);
                }
            } else {
                message.channel.send(`Failed to submit job. Status code: ${response.status}`);
            }
        } catch (error) {
            message.channel.send(`An error occurred: ${error.message}`);
        }
    }
});

// Command to get job output
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!get_output')) {
        const args = message.content.split(' ');
        const jobId = args[1];
        const runNo = args[2] || 1;

        try {
            const response = await fetch(`${CONTROL_M_ENDPOINT}/run/job/${jobId}/output/?runNo=${runNo}`, {
                method: 'GET',
                headers: {
                    'x-api-key': CONTROL_M_API_KEY,
                },
            });

            if (response.ok) {
                const output = await response.text();
                message.channel.send(`Job Output:\n${output}`);
            } else {
                message.channel.send(`Failed to retrieve job output. Status code: ${response.status}`);
            }
        } catch (error) {
            message.channel.send(`An error occurred: ${error.message}`);
        }
    }
});

// Log in to Discord with your client's token
client.login(DISCORD_TOKEN);
