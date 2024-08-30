const { Client, GatewayIntentBits } = require('discord.js');
const { exec } = require('child_process');

// Load environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CONTROL_M_API_KEY = process.env.CONTROL_M_API_KEY;
const CONTROL_M_ENDPOINT = process.env.CONTROL_M_ENDPOINT;

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Bot connected as ${client.user.tag}`);

    // Add the environment using ctm-cli on bot startup
    exec(`ctm environment add prod ${CONTROL_M_ENDPOINT} ${CONTROL_M_API_KEY}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error adding environment: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Standard error: ${stderr}`);
            return;
        }
        console.log(`Environment added successfully: ${stdout}`);
    });
});

// Command to run a job using ctm-cli
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!run_job')) {
        const args = message.content.split(' ');
        const zipcode = args[1];
        const email = args[2];

        const runCommand = `ctm run order prod IN01 mqn-forecast-flow -v zipcode=${zipcode} -v email=${email}`;

        exec(runCommand, (error, stdout, stderr) => {
            if (error) {
                message.channel.send(`Error running job: ${error.message}`);
                return;
            }
            if (stderr) {
                message.channel.send(`Error: ${stderr}`);
                return;
            }
            const runId = stdout.trim();  // Assuming runId is returned in stdout
            message.channel.send(`Job submitted successfully! Run ID: ${runId}`);

            // Check the job status
            exec(`ctm run status prod ${runId}`, (statusError, statusStdout, statusStderr) => {
                if (statusError) {
                    message.channel.send(`Error checking status: ${statusError.message}`);
                    return;
                }
                if (statusStderr) {
                    message.channel.send(`Error: ${statusStderr}`);
                    return;
                }

                const statusResult = statusStdout.trim();
                message.channel.send(`Job Status: ${statusResult}`);
            });
        });
    }
});

// Command to get job output using ctm-cli
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!get_output')) {
        const args = message.content.split(' ');
        const jobId = args[1];
        const runNo = args[2] || 1;

        const outputCommand = `ctm run job prod ${jobId} output --runNo ${runNo}`;

        exec(outputCommand, (error, stdout, stderr) => {
            if (error) {
                message.channel.send(`Error getting output: ${error.message}`);
                return;
            }
            if (stderr) {
                message.channel.send(`Error: ${stderr}`);
                return;
            }

            message.channel.send(`Job Output:\n${stdout}`);
        });
    }
});

// Log in to Discord with your client's token
client.login(DISCORD_TOKEN);
