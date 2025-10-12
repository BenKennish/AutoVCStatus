# AutoVCStatus

A Discord bot that automatically sets the status of voice channels (displayed underneath their name)
on a server according to the game activity of the channel members.

## Example

If there are 4 members of a voice channel "Alpha" as follows:

- Alice is playing "Fortnite"
- Bob is playing "Minecraft"
- Charlie is playing "Fortnite"
- Dylan isn't playing any game

The bot may set the channel status for "Alpha" to one of the following, depending upon configuration:

- "Fortnite (2), Minecraft (1)"
- "Fornite, Minecraft"
- "Fortnite (2)"
- "Fortnite"

## Required Scopes

- bot
- application.commands

## Required Permissions

- Set Voice Channel Status
- Manage Channels

Bots also need "Manage Channels" to set the status of a voice channel, unlike users, because they cannot connect to the channel.

## Slash commands

You can currently use the `/avcs` commmand with `version` and `hello` subcommands - more to come to allow per-server customisation.

## Adding the bot

### Using Existing Bot

I'm currently running the bot privately for a select number of servers during testing.  If you want to use the bot on your server,
you'll need to either self-host it or ask me nicely for a link to add it to your server.

### Self-Hosting Installation

- `npm install`
- `AVCS_BOT_TOKEN="XXXxxXX0XX.XXx.XXxx0xx0XXx" AVCS_APP_ID="1234567890" node register-commands.js`
- `AVCS_BOT_TOKEN="XXXxxXX0XX.XXx.XXxx0xx0XXx" node index.js`

_(replacting the strings with the actual bot secret token / application ID)_

