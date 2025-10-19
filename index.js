// ==============
//  AutoVCStatus
// ==============
//
// A Discord bot that automatically sets the status of voice channels on a
// server according to the game activity of the channel members
//

const { Client, GatewayIntentBits, ChannelType, MessageFlags } = require('discord.js');

const { version } = require('./package.json');

// set to false to disable debug messsages
const DEBUG = false;

// Discord's ID for 'playing' activities (i.e. games)
const ID_GAME = 0;

// The AVCS_BOT_TOKEN environment variable needs to contain the Discord bot API key
// You could run this bot like this:
//     AVCS_BOT_TOKEN="your_discord_token_here" node index.js
// Or maybe store it in a (properly protected) file and then run this:
//   AVCS_BOT_TOKEN="$(cat token.secret)" node index.js
const AVCS_BOT_TOKEN = process.env.AVCS_BOT_TOKEN;


// these will become per-server config
//
// show player counts of the games in brackets?
const showPlayerCounts = true;

// show all games that are being played (rather than just the one with the most players)
const showAllGames = true;

// ===================================================
// ===================================================


// Suppress all console.debug output (comment out )
if (!DEBUG)
{
    console.debug = () => { };
}

if (!AVCS_BOT_TOKEN)
{
    console.error('Set AVCS_BOT_TOKEN environment variable and restart.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers
    ]
});

// used for pretty console output
const colours = {
    user: "\x1b[31m",     // red
    activity: "\x1b[32m", // green
    channel: "\x1b[94m",  // bright blue
    reset: "\x1b[0m"
};


// Get activities for all members in a voice channel
function getChannelActivities(channel)
{
    const members = channel.members.filter(m => !m.user.bot);

    const activities = [];
    members.forEach(member =>
    {
        if (member.presence && member.presence.activities)
        {
            console.debug(`Activities for user ${member.user.tag}:`, member.presence.activities);

            member.presence.activities.forEach(activity =>
            {
                if (activity.type === ID_GAME && activity.name)
                {
                    // type 0 (ID_GAME): "Playing" activities (i.e. games)
                    // type 2: "Listening to" activities (Music)

                    // strip '®' etc from game names e.g. 'Rocket League®'
                    const gameName = activity.name.replace(/[®©™]+$/, "");

                    activities.push({
                        user: member.user,
                        game: gameName
                    });
                    console.log(`[getChannelActivities] Member ${colours.user}${member.user.tag}${colours.reset} is playing ${colours.activity}${activity.name}${colours.reset}`);
                }
            });
        }
        else
        {
            console.log(`[getChannelActivities] Member ${colours.user}${member.user.tag}${colours.reset} is not playing anything.`);
        }
    });
    console.log(`[getChannelActivities] Activities found:`, activities.map(a => `${a.user.tag}: ${a.game}`));
    return activities;
}


// Decide channel status string
function decideChannelStatus(activities, memberCount)
{
    //console.debug(`[decideChannelStatus] called with memberCount=${memberCount}, activities=${JSON.stringify(activities)}`);

    if (activities.length === 0)
    {
        return '';
    }

    // in the specific case of 1 member, we can optimise...
    if (memberCount === 1)
    {
        const status = activities[0]?.game || '';
        return status;
    }

    // activities is an array of objects from getChannelActivities()
    // and will look something like this...
    // [
    //   { user: "April", game: "Fortnite" },
    //   { user: "Ben", game: "Minecraft" },
    //   { user: "Christine", game: "Fortnite" }
    // ]

    // plain object with no prototype so keys can't collide with Object.prototype
    // we'll then be adding properties..
    //   name: game name
    //   value: number of players
    const counts = Object.create(null);

    // tally game counts
    for (const activity of activities)
    {
        // skip items without a 'game' property (null/undefined)
        const game = activity && activity.game;
        if (!game)
        {
            continue;
        }

        // counts[game] = 1 where game = "Fortnite", is like setting counts.Fortnite = 1;
        counts[game] = (counts[game] || 0) + 1;
    }
    console.debug(`counts`, counts);

    // Convert the counts object into an array of { "Fornite", 2 } and sort by count desc
    // and then sorting by game name as a tie-breaker
    let gameCountsSorted = Object.keys(counts)
        .map((game) =>
        {
            // { game } is a shortcut for { game: game }
            return { name: game, numPlayers: counts[game] };
        })
        .sort((gameA, gameB) => (gameB.count - gameA.count) || gameA.name.localeCompare(gameB.name));

    console.debug(`gameCountsSorted`, gameCountsSorted);

    if (!showAllGames)
    {
        // recreate gameCountsSorted with only the first element
        gameCountsSorted = [gameCountsSorted[0]];
    }

    const status = gameCountsSorted
        .map(
            game => showPlayerCounts ? `${game.name} (${game.numPlayers})` : game.name
        )
        .join(', ');

    console.log(`[decideChannelStatus] Status: ${status}`);
    return status;
}


// Set channel status (topic)
async function setChannelStatus(channel, status)
{
    try
    {
        const res = await client.rest.put(`/channels/${channel.id}/voice-status`, { body: { status: status } });
        console.debug(`[setChannelStatus] REST call returned: `, res);
    }
    catch (err)
    {
        console.error(`[setChannelStatus] REST call errored: `, err);
    }
}


// Main update logic for a voice channel
async function updateVoiceChannelStatus(channel)
{
    if (!channel || channel.type !== ChannelType.GuildVoice)
    {
        console.debug(`[updateVoiceChannelStatus] Skipping channel ${colours.channel}${channel?.name ?? 'unknown'}${colours.reset}, not a GuildVoice.`);
        return;
    }
    const members = channel.members.filter(m => !m.user.bot);
    console.debug(`[updateVoiceChannelStatus] Channel ${colours.channel}${channel.name}${colours.reset} has ${members.size} non-bot members.`);

    if (members.size === 0)
    {
        // Discord automatically clears an empty vc's status
        return;
    }
    const activities = getChannelActivities(channel);
    const status = decideChannelStatus(activities, members.size);
    console.log(`[updateVoiceChannelStatus] Setting status for ${colours.channel}${channel?.name ?? 'unknown'}${colours.reset} to "${colours.activity}${status}${colours.reset}"`);
    await setChannelStatus(channel, status);
}


async function listGuilds()
{
    console.log(`Bot is currently being used by these servers: `);

    const guilds = await client.guilds.fetch();
    guilds.forEach(guild =>
    {
        console.log(' - ' + guild.name);
    });
    console.log('');
}


// ===================================================
// ===================================================


// Listen for voice state updates
//
client.on('voiceStateUpdate', async (oldState, newState) =>
{
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    let from = null;
    let to = null;

    const userTag = newState.member?.user?.tag ?? oldState.member?.user?.tag ?? 'unknown';

    console.debug(`[voiceStateUpdate] >>> User ${colours.user}${userTag}${colours.reset} changed voice state.`);

    // Only consider GuildVoice channels (e.g. ignore Stage)
    if (oldChannel && oldChannel.type === ChannelType.GuildVoice)
    {
        from = oldChannel.name;
    }
    if (newChannel && newChannel.type === ChannelType.GuildVoice && newChannel !== oldChannel)
    {
        to = newChannel.name;
    }

    if (from && to)
    {
        // channel swapped
        console.log(`[voiceStateUpdate] >>> User ${colours.user}${userTag}${colours.reset} changed voice channel ` +
            `${colours.channel}${from}${colours.reset} => ${colours.channel}${to}${colours.reset}`);
    }
    else if (from)
    {
        // disconnected
        console.log(`[voiceStateUpdate] >>> User ${colours.user}${userTag}${colours.reset} disconnected from ` +
            `${colours.channel}${from}${colours.reset}`);
    }
    else if (to)
    {
        // connected
        console.log(`[voiceStateUpdate] >>> User ${colours.user}${userTag}${colours.reset} connected to ` +
            `${colours.channel}${to}${colours.reset}`);
    }
    else
    {
        // no 'from' or 'to' so probably moving from a GuildStageVoice (stage) channel to a GuildStageVoice.  just return
        console.warn(`[voiceStateUpdate] No 'from' or 'to' for user ${colours.user}${userTag}${colours.reset}`);
        return;
    }


    if (from)
    {
        console.debug(`[voiceStateUpdate] Updating status of old channel: ${colours.channel}${oldChannel.name}${colours.reset}`);
        await updateVoiceChannelStatus(oldChannel);
    }
    if (to)
    {
        console.debug(`[voiceStateUpdate] Updating status of new channel: ${colours.channel}${newChannel.name}${colours.reset}`);
        await updateVoiceChannelStatus(newChannel);
    }

});


// Listen for presence/activity updates
//
client.on('presenceUpdate', async (oldPresence, newPresence) =>
{
    if (!newPresence || !newPresence.member)
    {
        console.warn(`[presenceUpdate] No new presence or it has no member property - weird!`, newPresence);
        return;
    }
    const member = newPresence.member;

    if (member.user.bot)
    {
        console.debug(`[presenceUpdate] Member ${colours.user}${member.user.tag}${colours.reset} is a bot - ignoring`);
        return;
    }

    console.debug(`[presenceUpdate] >>> Presence update from member ${colours.user}${member.user.tag}${colours.reset}.`);

    // Check if member is in a voice channel
    const channel = member.voice?.channel;
    if (channel && channel.type === ChannelType.GuildVoice)
    {
        console.log(`[presenceUpdate] >>> Presence update from member ${colours.user}${member.user.tag}${colours.reset} in voice channel ${colours.channel}${channel.name}${colours.reset}`);
        await updateVoiceChannelStatus(channel);
    }
    else
    {
        console.debug(`[presenceUpdate] Member is not in a GuildVoice channel - ignoring`);
    }
});



// Listen for slash commands (and other interactions)
//
client.on('interactionCreate', async interaction =>
{
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'avcs')
    {
        console.warn(`Received an unrecognised command`, interaction.commandName);
        return;
    }

    const sub = interaction.options.getSubcommand();

    switch (sub)
    {
        case 'version':

            await interaction.reply({
                content: `AutoVCStatus v${version} at your service`,
                flags: MessageFlags.Ephemeral // private reply
            });

            break;
        case 'hello':

            await interaction.reply({
                content: `Hello everyone!  I'm AutoVCStatus, a bot made by Bennish that automatically sets voice channel status messages depending on the game activity of the users on the channel.`
            });

            break;
        default:

            await interaction.reply({
                content: `Unrecognised subcommand: ${sub}`,
                flags: MessageFlags.Ephemeral // private reply
            });
    }

});


client.on('guildCreate', async (guild) =>
{
    console.log(`>>> Bot joined new server:`, guild.name);
    await listGuilds();
});


client.on('guildDelete', async (guild) =>
{
    console.log(`>>> Bot left server:`, guild.name);
    await listGuilds();
});


client.once('clientReady', () =>
{
    console.log(`--------------------`);
    console.log(`AutoVCStatus v${version}`);
    console.log(`--------------------`);
    console.log('');
    console.log(`Logged in as ${client.user.tag}`);
    console.log('Bot is ready and listening for events.');
    console.log('');
    setTimeout(listGuilds, 1000);
});

client.login(AVCS_BOT_TOKEN)
    .catch(err =>
    {
        console.error('Failed to login:', err);
        process.exit(1);
    });

