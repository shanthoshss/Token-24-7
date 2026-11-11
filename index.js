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
    selfDeaf: true,
    selfMute: false,
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
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
  console.log(`Allowed user ID: ${ALLOWED_USER_ID}`);
  client.user.setActivity('24/7 Voice', { type: 3 });
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild, user } = interaction;

  console.log(`Command /${commandName} from ${user.tag} (${user.id})`);

  // Always acknowledge the interaction within 3 seconds
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (err) {
    console.error('Failed to defer reply:', err);
    return;
  }

  // Only allow the specified user
  if (user.id !== ALLOWED_USER_ID) {
    return interaction.editReply({
      content: 'You are not allowed to use this command.',
    });
  }

  if (commandName === 'join') {
    try {
      const voiceChannel = member?.voice?.channel;

      if (!voiceChannel) {
        return interaction.editReply({
          content: 'You need to be in a voice channel first!',
        });
      }

      if (
        voiceChannel.type !== ChannelType.GuildVoice &&
        voiceChannel.type !== ChannelType.GuildStageVoice
      ) {
        return interaction.editReply({
          content: 'That is not a valid voice channel.',
        });
      }

      const me = guild.members.me;
      if (!me) {
        return interaction.editReply({
          content: 'Could not find me in this server. Please re-invite the bot.',
        });
      }

      const permissions = voiceChannel.permissionsFor(me);
      if (!permissions || !permissions.has(['Connect', 'Speak'])) {
        return interaction.editReply({
          content: 'I need **Connect** and **Speak** permissions in that channel.',
        });
      }

      // Destroy existing connection if any
      const existing = getVoiceConnection(guild.id);
      if (existing) {
        existing.destroy();
        connections.delete(guild.id);
      }

      const connection = createConnection(voiceChannel);
      connections.set(guild.id, connection);

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      await interaction.editReply({
        content: `Joined **${voiceChannel.name}** and will stay here 24/7!`,
      });

      console.log(`[${guild.name}] Joined ${voiceChannel.name}`);
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      try {
        await interaction.editReply({
          content: `Failed to join the voice channel: ${error.message || 'Unknown error'}`,
        });
      } catch {}
    }
  }

  if (commandName === 'leave') {
    try {
      const connection = getVoiceConnection(guild.id);

      if (!connection) {
        return interaction.editReply({
          content: 'I am not in a voice channel.',
        });
      }

      connection.destroy();
      connections.delete(guild.id);

      await interaction.editReply({ content: 'Left the voice channel.' });
      console.log(`[${guild.name}] Left voice channel`);
    } catch (error) {
      console.error('Failed to leave voice channel:', error);
      try {
        await interaction.editReply({
          content: `Failed to leave: ${error.message || 'Unknown error'}`,
        });
      } catch {}
    }
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

client.login(TOKEN);
