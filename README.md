# Token 24/7

A simple Discord bot that joins a voice channel when you use `/join` and stays there **24/7**.

Designed to run on [Railway](https://railway.com/).

## Features

- `/join` — Joins the voice channel you are currently in and stays connected
- `/leave` — Leaves the voice channel
- Auto-handles disconnects and keeps the process alive
- Lightweight (no audio playback required — just presence)

## Setup

### 1. Create a Discord Bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → give it a name (e.g. "Token 24/7")
3. Go to the **Bot** tab → click **Add Bot**
4. Under **Token**, click **Reset Token** / **Copy** and save it (this is your `DISCORD_TOKEN`)
5. Enable **Message Content Intent** is **not** required for this bot
6. Go to **OAuth2 → URL Generator**
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Connect`, `Speak`, `View Channels`, `Use Voice Activity`
7. Copy the generated URL and open it to invite the bot to your server

Also copy the **Application ID** from the **General Information** tab (this is your `CLIENT_ID`).

### 2. Deploy on Railway

1. Go to [railway.com](https://railway.com/) and sign in (GitHub login recommended)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select the repository `shanthoshss/Token-24-7` (or your fork)
4. Railway will detect it as a Node.js project
5. Go to the service → **Variables** tab and add:

   | Variable         | Value                          |
   |------------------|--------------------------------|
   | `DISCORD_TOKEN`  | Your bot token                 |
   | `CLIENT_ID`      | Your Application / Client ID   |

6. Click **Deploy**

Railway will run `npm start` automatically. Once the deploy finishes, the bot should come online.

### 3. Use the bot

1. Join a voice channel in your Discord server
2. Type `/join`
3. The bot will join and stay there 24/7

Use `/leave` when you want it to leave.

> **Note:** Global slash commands can take up to a few minutes (sometimes longer) to appear after the first deploy. If they don't show up, try restarting the Railway service or waiting a bit.

## Local Development

```bash
git clone https://github.com/shanthoshss/Token-24-7.git
cd Token-24-7
cp .env.example .env
# Edit .env and add your DISCORD_TOKEN and CLIENT_ID
npm install
npm start
```

## Permissions Required

The bot needs these permissions in the voice channel:

- Connect
- Speak
- View Channel

## License

MIT
