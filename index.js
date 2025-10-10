// ==============
//  AutoVCStatus
// ==============
//
// A Discord bot that automatically sets the status of voice channels on a
// server according to the game activity of the channel members
//

const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const { version } = require('./package.json');

// set to false to disable debug messsages
const DEBUG = true;

// Discord's ID for 'playing' activities (i.e. games)
const ID_GAME = 0;

// The AVS_BOT_TOKEN environment variable needs to contain the Discord bot API key
// You could run this bot like this:
//     AVS_BOT_TOKEN="your_discord_token_here" node index.js
// Or maybe store it in a (properly protected) file and then run this:
//   AVS_BOT_TOKEN="$(cat token.secret)" node index.js
const AVS_BOT_TOKEN = process.env.AVS_BOT_TOKEN;


// ===================================================
// ===================================================


// Suppress all console.debug output (comment out )
if (!DEBUG)
{
    console.debug = () => { };
}

if (!AVS_BOT_TOKEN)
{
    console.error('Set AVS_BOT_TOKEN environment variable and restart.');
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

            member.presence.activities.forEach(act =>
            {
                if (act.type === ID_GAME && act.name)
                {
                    // type 0 (ID_GAME): "Playing" activities (i.e. games)
                    // type 2: "Listening to" activities (Music)
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


    /* ==== OLD WAY
    //
    // Count games, using game name as a property (kinda like a Map)
    const gameCounts = {};
    activities.forEach(activity =>
    {
        gameCounts[activity.game] = (gameCounts[activity.game] || 0) + 1;
    });
    console.log(`[decideChannelStatus] gameCounts:`, gameCounts);

    // now we build an array like this
    // [ { game: "Fortnite", numPlayers: 2 }, { game: "Minecraft", numPlayers: 1 }]
    const games = [];

    Object.keys(gameCounts).forEach(game =>
    {
        games.push({ name: game, numPlayers: gameCounts[game] });
    });

    // sort in descending order of players
    games.sort((a, b) => { b.numPlayers - a.numPlayers });

    console.log(`[decideChannelStatus] games:`, games);

    const status = games.map((game) => `${game.name} (${game.numPlayers})`).join(', ');
    // status will now be in the form of
    // "Fortnite (2), Minecraft (1)"
    */


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
    const gameCountsSorted = Object.keys(counts)
        .map((game) =>
        {
            // { game } is a shortcut for { game: game }
            return { name: game, numPlayers: counts[game] };
        })
        .sort((a, b) => (b.count - a.count) || a.game.localeCompare(b.game));

    console.debug(`gameCountsSorted`, gameCountsSorted);

    // TODO: omit the number if everyone in the channel is playing that game?
    // but if we do, we wont know the difference between 4 out of 5 playing it and all 5
    const status = gameCountsSorted
        .map(game => `${game.name} [${game.numPlayers}]`)
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

    // this is how we could do it using a raw(ish) REST request
    // requires these lines at the top
    //   const { fetch } = require('undici');
    //   const DISCORD_API_BASE = 'https://discord.com/api/v10';
    /*
    const url = `${DISCORD_API_BASE}/channels/${channel.id}/voice-status`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bot ${AVS_BOT_TOKEN}`,
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
        //await setChannelStatus(channel, "");
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
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    let from = null;
    let to = null;

    const userTag = newState.member?.user?.tag ?? oldState.member?.user?.tag ?? 'unknown';

    console.debug(`[voiceStateUpdate] >>> User ${colours.user}${userTag}${colours.reset} changed voice state.`);

    // Ignore stage channels
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
        // probably moving from a ChannelType.GuildStageVoice (stage) channel to another.  just return
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
        console.log(`[presenceUpdate] >>> Update from member ${colours.user}${member.user.tag}${colours.reset} in voice channel ${colours.channel}${channel.name}${colours.reset}`);
        await updateVoiceChannelStatus(channel);
    }
    else
    {
        console.debug(`[presenceUpdate] Member is not in a GuildVoice channel - ignoring`);
    }
});


async function listGuilds()
{
    console.log(`Currently being used by these servers: `);

    const guilds = await client.guilds.fetch();
    guilds.forEach(guild =>
    {
        console.log(' - ' + guild.name);
    });
}


client.on('guildCreate', async (guild) =>
{
    console.log(`>>> Bot added to a new server: `, guild.name);
    listGuilds();
});


client.once('clientReady', () =>
{
    console.log(`--------------------`);
    console.log(`AutoVCStatus v${version}`);
    console.log(`--------------------`);
    console.log('');
    console.log(`Logged in as ${client.user.tag}`);
    console.log('Bot is ready and listening for events.');
    setTimeout(listGuilds, 1000);
});

client.login(AVS_BOT_TOKEN)
    .catch(err =>
    {
        console.error('Failed to login:', err);
        process.exit(1);
    });

