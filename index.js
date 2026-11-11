require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType,
} = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // Application ID from Discord Developer Portal

// Only this user can use /join and /leave
const ALLOWED_USER_ID = '1291129443376562247';

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Store connections per guild so we can manage them
const connections = new Map();

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Make the bot join your current voice channel and stay 24/7')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Make the bot leave the voice channel')
      .toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log('Registering slash commands...');
    if (CLIENT_ID) {
      // Global commands (can take up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Successfully registered global slash commands.');
    } else {
      console.warn('CLIENT_ID not set. Slash commands will not be registered automatically.');
      console.warn('Set CLIENT_ID (Application ID) in Railway variables for auto-registration.');
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
  }
}

function createConnection(channel) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,  // Bot is deafened (doesn't need to hear)
    selfMute: false, // Can speak if needed later
  });

  // Handle disconnects and try to recover for 24/7 uptime
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Reconnecting (e.g. channel move) - do nothing
    } catch {
      // Real disconnect - destroy and clean up
      try {
        connection.destroy();
      } catch {}
      connections.delete(channel.guild.id);
      console.log(`[${channel.guild.name}] Disconnected from voice.`);
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    connections.delete(channel.guild.id);
  });

  connection.on('error', (error) => {
    console.error(`[${channel.guild.name}] Voice connection error:`, error);
  });

  return connection;
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setActivity('24/7 Voice', { type: 3 }); // Watching
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Only allow the specified user
  if (interaction.user.id !== ALLOWED_USER_ID) {
    return interaction.reply({
      content: 'You are not allowed to use this command.',
      ephemeral: true,
    });
  }

  const { commandName, member, guild } = interaction;

  if (commandName === 'join') {
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: 'You need to be in a voice channel first!',
        ephemeral: true,
      });
    }

    if (voiceChannel.type !== ChannelType.GuildVoice && voiceChannel.type !== ChannelType.GuildStageVoice) {
      return interaction.reply({
        content: 'That is not a valid voice channel.',
        ephemeral: true,
      });
    }

    // Check permissions
    const permissions = voiceChannel.permissionsFor(guild.members.me);
    if (!permissions.has(['Connect', 'Speak'])) {
      return interaction.reply({
        content: 'I need **Connect** and **Speak** permissions in that channel.',
        ephemeral: true,
      });
    }

    // Destroy existing connection if any
    const existing = getVoiceConnection(guild.id);
    if (existing) {
      existing.destroy();
      connections.delete(guild.id);
    }

    try {
      const connection = createConnection(voiceChannel);
      connections.set(guild.id, connection);

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      await interaction.reply({
        content: `Joined **${voiceChannel.name}** and will stay here 24/7!`,
      });

      console.log(`[${guild.name}] Joined ${voiceChannel.name}`);
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      await interaction.reply({
        content: 'Failed to join the voice channel. Please try again.',
        ephemeral: true,
      });
    }
  }

  if (commandName === 'leave') {
    const connection = getVoiceConnection(guild.id);

    if (!connection) {
      return interaction.reply({
        content: 'I am not in a voice channel.',
        ephemeral: true,
      });
    }

    connection.destroy();
    connections.delete(guild.id);

    await interaction.reply({ content: 'Left the voice channel.' });
    console.log(`[${guild.name}] Left voice channel`);
  }
});

// Keep the process alive and log unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

client.login(TOKEN);
