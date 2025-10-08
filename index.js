const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
//const { fetch } = require('undici');

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Suppress all console.debug output
//console.debug = () => { };

// DISCORD_TOKEN environment variable needs to contain the Discord bot API key
const TOKEN = process.env.DISCORD_TOKEN;

const ID_GAME = 0;

// .. so you could run this bot like this:
// > DISCORD_TOKEN="your_discord_token_here" node index.js

if (!TOKEN)
{
    console.error('Set DISCORD_TOKEN environment variable and restart.');
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

// used for console output
const colours = {
    user: "\x1b[36m",
    activity: "\x1b[32m",
    channel: "\x1b[33m",
    reset: "\x1b[0m"
};


// Helper: Get activities for all members in a voice channel
function getChannelActivities(channel)
{
    const members = channel.members.filter(m => !m.user.bot);

    const activities = [];
    members.forEach(member =>
    {
        if (member.presence && member.presence.activities)
        {
            console.debug(`activities set for user ${member.user}:`, member.presence.activities);

            member.presence.activities.forEach(act =>
            {
                if (act.type === ID_GAME && act.name)
                {
                    // type ID_GAME: "Playing" activities (i.e. games)
                    activities.push({
                        user: member.user,
                        game: act.name
                    });
                    console.log(`[getChannelActivities] Member ${colours.user}${member.user.tag}${colours.reset} is playing ${colours.activity}${act.name}${colours.reset}`);
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


// Helper: Decide channel status string
function decideChannelStatus(activities, memberCount)
{
    console.debug(`[decideChannelStatus] memberCount=${memberCount}, activities=${JSON.stringify(activities)}`);

    if (activities.length === 0)
    {
        console.log(`[decideChannelStatus] No activities found.`);
        return '';
    }

    if (memberCount === 1)
    {
        const status = activities[0]?.game || '';
        //console.log(`[decideChannelStatus] Only one member, status: ${colours.activity}${status}${colours.reset}`);
        return status;
    }

    // Count games
    const gameCounts = {};
    activities.forEach(activity =>
    {
        gameCounts[activity.game] = (gameCounts[activity.game] || 0) + 1;
    });
    console.log(`[decideChannelStatus] Game counts:`, gameCounts);

    // gameCounts is an object which maps game name to a number of players

    // Find most common game
    let maxCount = 0, maxGame = null;
    Object.entries(gameCounts).forEach(([game, count]) =>
    {
        if (count > maxCount)
        {
            maxCount = count;
            maxGame = game;
        }
    });

    // TODO: store this data in a sortable way so we can optionally display all played games like...
    // "Minecraft (3), Guild Wars 2 (2), Fortnite (1)"

    if (maxCount >= 2)
    {
        console.log(`[decideChannelStatus] Most common game: ${colours.activity}${maxGame}${colours.reset} (${maxCount} users)`);
        return maxGame;
    }

    // Otherwise, list all games
    const status = Object.keys(gameCounts).join(', ');
    console.log(`[decideChannelStatus] No common game, status: ${status}`);
    return status;
}


// Helper: Set channel status (topic)
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

    // this is how we would do it using a raw(ish) REST request
    /*
    const url = `${DISCORD_API_BASE}/channels/${channel.id}/voice-status`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bot ${TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: status })
    });
    console.log(`[setChannelStatus] REST PATCH response status: ${res.status}`);
    */

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


// Listen for voice state updates
client.on('voiceStateUpdate', async (oldState, newState) =>
{
    // Ignore stage channels
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    let from = null;
    let to = null;

    console.debug(`[voiceStateUpdate] >>> User ${colours.user}${newState.member?.user?.tag ?? oldState.member?.user?.tag ?? 'unknown'}${colours.reset} changed voice state.`);

    if (oldChannel && oldChannel.type === ChannelType.GuildVoice)
    {
        from = oldChannel.name;
    }
    if (newChannel && newChannel.type === ChannelType.GuildVoice && newChannel !== oldChannel)
    {
        to = newChannel.name;
    }

    if (from)
    {
        if (to)
        {
            // channel swap
            console.log(`[voiceStateUpdate] >>> User ${colours.user}${newState.member?.user?.tag ?? oldState.member?.user?.tag ?? 'unknown'}${colours.reset} changed voice channel ` +
                `${colours.channel}${from}${colours.reset} => ${colours.channel}${to}${colours.reset}`);
        }
        else
        {
            // disconnected
            console.log(`[voiceStateUpdate] >>> User ${colours.user}${newState.member?.user?.tag ?? oldState.member?.user?.tag ?? 'unknown'}${colours.reset} disconnected from ` +
                `${colours.channel}${from}${colours.reset}`);
        }
    }
    else
    {
        if (to)
        {
            // connected
            console.log(`[voiceStateUpdate] >>> User ${colours.user}${newState.member?.user?.tag ?? oldState.member?.user?.tag ?? 'unknown'}${colours.reset} connected to ` +
                `${colours.channel}${to}${colours.reset}`);
        }
        else
        {
            // probably moving from a stage channel to another stage.  just return
            console.warn(`[voiceStateUpdate] No 'from' or 'to' for user ${colours.user}${newState.member?.user?.tag ?? oldState.member?.user?.tag ?? 'unknown'}${colours.reset}`);
            return;
        }
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

    console.debug(`[presenceUpdate] >>> Member ${colours.user}${member.user.tag}${colours.reset} has updated presence.`);

    // Check if member is in a voice channel
    const channel = member.voice?.channel;
    if (channel && channel.type === ChannelType.GuildVoice)
    {
        console.log(`[presenceUpdate] Update from member ${colours.user}${member.user.tag}${colours.reset} in voice channel ${colours.channel}${channel.name}${colours.reset}`);
        await updateVoiceChannelStatus(channel);
    }
    else
    {
        console.debug(`[presenceUpdate] Member is not in a GuildVoice channel - ignoring`);
    }
});


client.once('clientReady', () =>
{
    console.log(`------------------------`);
    console.log(`AutoVCStatus Discord Bot`);
    console.log(`------------------------`);
    console.log('');
    console.log(`Logged in as ${client.user.tag}`);
    console.log('Bot is ready and listening for events.');
});

client.login(TOKEN)
    .catch(err =>
    {
        console.error('Failed to login:', err);
        process.exit(1);
    });

