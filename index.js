const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
// , PermissionFlagsBits, ClientPresence
//const { fetch } = require('undici');

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Suppress all console.debug output
console.debug = () => { };

// DISCORD_TOKEN environment variable needs to contain the Discord bot API key
const TOKEN = process.env.DISCORD_TOKEN;

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

    // channel.id example "1195437941439348806"
    //console.log(`[getChannelActivities] Channel "${colours.channel}${channel.name}${colours.reset}" has ${members.size} non-bot members.`);

    const activities = [];
    members.forEach(member =>
    {
        if (member.presence && member.presence.activities)
        {
            console.debug(`activities set for user ${member.user}:`, member.presence.activities);

            member.presence.activities.forEach(act =>
            {
                if (act.type === 0 && act.name)
                {
                    // type 0 = "Playing" activities (i.e. games)
                    activities.push({
                        user: member.user,
                        game: act.name
                    });
                    console.log(`[getChannelActivities] Member "${colours.user}${member.user.tag}${colours.reset}" is playing: "${colours.activity}${act.name}${colours.reset}"`);
                }
            });
        }
        else
        {
            console.log(`[getChannelActivities] Member "${colours.user}${member.user.tag}${colours.reset}" has no presence or activities.`);
        }
    });
    console.log(`[getChannelActivities] Activities found:`, activities.map(a => `${a.user.tag}: ${a.game}`));
    return activities;
}


// Helper: Decide channel status string
function decideChannelStatus(activities, memberCount)
{
    //console.debug(`[decideChannelStatus] memberCount=${memberCount}, activities=${JSON.stringify(activities)}`);

    if (activities.length === 0)
    {
        console.log(`[decideChannelStatus] No activities found.`);
        return '';
    }

    if (memberCount === 1)
    {
        const status = activities[0]?.game || '';
        console.log(`[decideChannelStatus] Only one member, status: "${colours.activity}${status}${colours.reset}"`);
        return status;
    }

    // Count games
    const gameCounts = {};
    activities.forEach(a =>
    {
        gameCounts[a.game] = (gameCounts[a.game] || 0) + 1;
    });
    console.log(`[decideChannelStatus] Game counts:`, gameCounts);

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

    if (maxCount >= 2)
    {
        console.log(`[decideChannelStatus] Most common game: "${colours.activity}${maxGame}${colours.reset}" (${maxCount} users)`);
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
    //console.debug(`client`, client);

    try
    {
        const res = await client.rest.put(`/channels/${channel.id}/voice-status`, { body: { status: status } });
        console.debug(`[setChannelStatus] REST call returned: `, res);
    }
    catch (err)
    {
        console.error(`[setChannelStatus] REST call errored: `, err);
    }

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
        // (${channel?.id ?? 'unknown'})
        console.log(`[updateVoiceChannelStatus] Skipping channel "${colours.channel}${channel?.name ?? 'unknown'}"${colours.reset}, not a GuildVoice.`);
        return;
    }
    const members = channel.members.filter(m => !m.user.bot);
    console.log(`[updateVoiceChannelStatus] Channel "${colours.channel}${channel.name}${colours.reset}" has ${members.size} non-bot members.`);

    //TODO: list the user tags (and the activities?)

    if (members.size === 0)
    {
        return;
    }
    const activities = getChannelActivities(channel);
    const status = decideChannelStatus(activities, members.size);
    console.log(`[updateVoiceChannelStatus] Final status to set: "${status}"`);
    await setChannelStatus(channel, status);
}


// Listen for voice state updates
client.on('voiceStateUpdate', async (oldState, newState) =>
{
    // Ignore stage channels
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    console.log(`[voiceStateUpdate] >>> User "${colours.user}${newState.member?.user?.tag ?? oldState.member?.user?.tag ?? 'unknown'}"${colours.reset} changed voice state.`);

    if (oldChannel && oldChannel.type === ChannelType.GuildVoice)
    {
        console.log(`[voiceStateUpdate] Updating old channel: "${colours.channel}${oldChannel.name}${colours.reset}"`);
        await updateVoiceChannelStatus(oldChannel);
    }
    if (newChannel && newChannel.type === ChannelType.GuildVoice && newChannel !== oldChannel)
    {
        console.log(`[voiceStateUpdate] Updating new channel: "${colours.channel}${newChannel.name}${colours.reset}"`);
        await updateVoiceChannelStatus(newChannel);
    }
});

// Listen for presence/activity updates
client.on('presenceUpdate', async (oldPresence, newPresence) =>
{
    if (!newPresence || !newPresence.member)
    {
        console.warn(`[presenceUpdate] No new presence or member - weird!`, newPresence);
        return;
    }
    const member = newPresence.member;

    if (member.user.bot)
    {
        console.debug(`[presenceUpdate] Member ${colours.user}"${member.user.tag}"${colours.reset}" is a bot - ignoring`);
        return;
    }

    console.debug(`[presenceUpdate] >>> Member ${colours.user}"${member.user.tag}"${colours.reset}" has updated presence.`);

    // Check if member is in a voice channel
    const channel = member.voice?.channel;
    if (channel && channel.type === ChannelType.GuildVoice)
    {
        console.log(`[presenceUpdate] Member ${colours.user}"${member.user.tag}"${colours.reset}" has updated presence and is in voice channel: "${colours.channel}${channel.name}${colours.reset}"`);
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

