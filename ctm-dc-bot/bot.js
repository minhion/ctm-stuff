const { Client, GatewayIntentBits } = require('discord.js');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CONTROL_M_ENDPOINT = process.env.CONTROL_M_ENDPOINT;

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', () => {
    console.log(`Bot connected as ${client.user.tag}`);

    // Add the environment using ctm-cli on bot startup
    exec(`ctm environment add prod ${CONTROL_M_ENDPOINT} ${process.env.CONTROL_M_API_KEY}`, (error, stdout, stderr) => {
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

// Command to run a job using ctm-cli with a JSON config
client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!run_job')) {
        const args = message.content.split(' ');
        const zipcode = args[1];
        const email = args[2];

        // Create the JSON config file
        const configPath = path.join(__dirname, 'config.json');
        const configContent = {
            variables: [
                { zipcode: zipcode },
                { email: email }
            ]
        };
        fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));

        const runCommand = `ctm run order IN01 mqn-forecast-flow -f ${configPath}`;

        exec(runCommand, (error, stdout, stderr) => {
            if (error) {
                message.channel.send(`Error running job: ${error.message}`);
                return;
            }
            if (stderr) {
                message.channel.send(`Error: ${stderr}`);
                return;
            }
            const result = JSON.parse(stdout);
            const runId = result.runId;
            message.channel.send(`Job submitted successfully! Run ID: ${runId}`);

            // Check the job status
            exec(`ctm run status ${runId}`, (statusError, statusStdout, statusStderr) => {
                if (statusError) {
                    message.channel.send(`Error checking status: ${statusError.message}`);
                    return;
                }
                if (statusStderr) {
                    message.channel.send(`Error: ${statusStderr}`);
                    return;
                }

                const statusResult = JSON.parse(statusStdout);
                if (statusResult.completion === 'Completed') {
                    const jobList = statusResult.statuses.map((job, index) => {
                        return `${index + 1}. Name: ${job.name}, Job ID: ${job.jobId}`;
                    }).join('\n');

                    message.channel.send(`Job completed successfully! Here are the jobs:\n${jobList}\nReply with the job number to get the output.`);

                    const filter = m => !isNaN(m.content) && parseInt(m.content) > 0 && parseInt(m.content) <= statusResult.statuses.length;
                    const collector = message.channel.createMessageCollector({ filter, max: 1, time: 30000 });

                    collector.on('collect', m => {
                        const jobIndex = parseInt(m.content) - 1;
                        const selectedJob = statusResult.statuses[jobIndex];
                        const outputCommand = `ctm run job:output::get ${selectedJob.jobId} 0`;

                        exec(outputCommand, (outputError, outputStdout, outputStderr) => {
                            if (outputError) {
                                message.channel.send(`Error getting output: ${outputError.message}`);
                                return;
                            }
                            if (outputStderr) {
                                message.channel.send(`Error: ${outputStderr}`);
                                return;
                            }

                            message.channel.send(`Job Output:\n${outputStdout}`);
                        });
                    });

                    collector.on('end', collected => {
                        if (collected.size === 0) {
                            message.channel.send('No job selected within the time limit.');
                        }
                    });
                } else {
                    message.channel.send(`Job is still in progress or failed. Status: ${statusResult.completion}`);
                }
            });
        });
    }
});

// Log in to Discord with your client's token
client.login(DISCORD_TOKEN);
