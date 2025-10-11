# AutoVCStatus

A Discord bot that automatically sets the status of voice channels on a server according to the game activity of the channel members.

## Required Scopes

- bot
- application.commands

## Required Permissions

- Set Voice Channel Status
- Manage Channels

Bots need "Manage Channels" to set voice channel status of a voice channel, unlike users.

## Slash commands

You can currently use the `/avcs` commmand with 'version' and 'hello' subcommands, more to come to allow per-server customisation.

## Adding the bot

### Using existing Bot

I'm currently running the bot privately for a select number of servers during testing.  If you want to use the bot on your server,
you'll need to either self-host it or ask me nicely for a link to add it to your server.

### Self Hosting Installation

- `npm install`
- `AVCS_BOT_TOKEN="XXXxxXX0XX.XXx.XXxx0xx0XXx" node index.js`

_(replacting the string with the actual bot secret token)_

