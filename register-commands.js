// register-commands.js
//
// run once to register the bots slash commands with the Discord API

const { REST, Routes, SlashCommandBuilder } = require('discord.js');


// your bot’s token and application ID (from the Discord Developer Portal)
const AVCS_BOT_TOKEN = process.env.AVCS_BOT_TOKEN;
const AVCS_APP_ID = process.env.AVCS_APP_ID;


if (!AVCS_BOT_TOKEN)
{
    console.error('Set AVCS_BOT_TOKEN environment variable and restart.');
    process.exit(1);
}

if (!AVCS_APP_ID)
{
    console.error('Set AVCS_APP_ID environment variable and restart.');
    process.exit(1);
}

// Define the /avcs command
const commands = [
    new SlashCommandBuilder()
        .setName('avcs')
        .setDescription('Auto Voice Channel Status commands')
        .addSubcommand(sub =>
            sub.setName('version')
                .setDescription('Show the current bot version')
        )
        .addSubcommand(sub =>
            sub
                .setName('hello')
                .setDescription('Say hello to everyone on the channel')
        )
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(AVCS_BOT_TOKEN);

console.log('Registering /avcs command...');

rest.put(Routes.applicationCommands(AVCS_APP_ID), { body: commands })
    .then(() =>
    {
        console.log('✅ Successfully registered command.');
    })
    .catch((err) =>
    {
        console.error('Failed to register commands: ', err);
    });
