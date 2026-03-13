const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot aktif!');
});

app.listen(PORT, () => {
  console.log(`Web server ${PORT} portunda aktif.`);
});

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const { createTranscript } = require('discord-html-transcripts');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = [
  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Ticket panelini gönderir')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    console.log('Slash komutları yükleniyor...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash komutları yüklendi.');
  } catch (error) {
    console.error('Komut yükleme hatası:', error);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`${client.user.tag} aktif!`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') {
        const embed = new EmbedBuilder()
          .setTitle('🎫 Destek Paneli')
          .setDescription('Aşağıdan bir destek türü seçerek ticket açabilirsin.')
          .setColor('Blue')
          .setFooter({ text: 'Ticket sistemi' })
          .setTimestamp();

        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket_select')
          .setPlaceholder('Destek türü seç')
          .addOptions([
            {
              label: 'Genel Destek',
              description: 'Genel yardım ve destek talepleri',
              value: 'genel',
              emoji: '🎫'
            },
            {
              label: 'Şikayet',
              description: 'Kullanıcı veya durum hakkında şikayet',
              value: 'sikayet',
              emoji: '⚠️'
            },
            {
              label: 'Yetkili Başvuru',
              description: 'Yetkili başvurusu yapmak için',
              value: 'basvuru',
              emoji: '📝'
            }
          ]);

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
          embeds: [embed],
          components: [row]
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== 'ticket_select') return;

      const ticketType = interaction.values[0];

      const existingChannel = interaction.guild.channels.cache.find(
        ch =>
          ch.parentId === process.env.CATEGORY_ID &&
          ch.topic &&
          ch.topic.includes(`owner:${interaction.user.id}`)
      );

      if (existingChannel) {
        return interaction.reply({
          content: `Zaten açık bir ticketın var: ${existingChannel}`,
          ephemeral: true
        });
      }

      const ticketCount = interaction.guild.channels.cache.filter(
        ch => ch.parentId === process.env.CATEGORY_ID
      ).size + 1;

      const channel = await interaction.guild.channels.create({
        name: `ticket-${ticketCount}`,
        type: ChannelType.GuildText,
        parent: process.env.CATEGORY_ID,
        topic: `owner:${interaction.user.id} | type:${ticketType}`,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks
            ]
          },
          {
            id: process.env.STAFF_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks
            ]
          }
        ]
      });

      const openEmbed = new EmbedBuilder()
        .setTitle('🎫 Ticket Açıldı')
        .setDescription(
          `Merhaba ${interaction.user}, ticketın başarıyla oluşturuldu.\n\n**Tür:** ${ticketType}\n**Durum:** Açık`
        )
        .setColor('Green')
        .setTimestamp();

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('Claim')
          .setEmoji('🙋')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Kapat')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content: `${interaction.user} <@&${process.env.STAFF_ROLE_ID}>`,
        embeds: [openEmbed],
        components: [buttons]
      });

      const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('📩 Ticket Açıldı')
          .addFields(
            { name: 'Kullanıcı', value: `${interaction.user.tag}`, inline: true },
            { name: 'Tür', value: ticketType, inline: true },
            { name: 'Kanal', value: `${channel}`, inline: true }
          )
          .setColor('Green')
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }

      return interaction.reply({
        content: `Ticket başarıyla açıldı: ${channel}`,
        ephemeral: true
      });
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_claim') {
        if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
          return interaction.reply({
            content: 'Bu butonu sadece yetkililer kullanabilir.',
            ephemeral: true
          });
        }

        const claimedEmbed = new EmbedBuilder()
          .setDescription(`✅ Bu ticket ${interaction.user} tarafından claim alındı.`)
          .setColor('Blue')
          .setTimestamp();

        return interaction.reply({ embeds: [claimedEmbed] });
      }

      if (interaction.customId === 'ticket_close') {
        const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID);
        const isOwner = interaction.channel.topic?.includes(`owner:${interaction.user.id}`);

        if (!isStaff && !isOwner) {
          return interaction.reply({
            content: 'Bu ticketı kapatma yetkin yok.',
            ephemeral: true
          });
        }

        await interaction.reply({
          content: 'Ticket kapatılıyor, transcript hazırlanıyor...'
        });

        const attachment = await createTranscript(interaction.channel, {
          limit: -1,
          returnType: 'attachment',
          filename: `${interaction.channel.name}.html`
        });

        const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
          const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Kapatıldı')
            .addFields(
              { name: 'Kanal', value: `${interaction.channel.name}`, inline: true },
              { name: 'Kapatan', value: `${interaction.user.tag}`, inline: true }
            )
            .setColor('Red')
            .setTimestamp();

          await logChannel.send({
            embeds: [closeEmbed],
            files: [attachment]
          });
        }

        setTimeout(async () => {
          await interaction.channel.delete().catch(console.error);
        }, 3000);
      }
    }
  } catch (error) {
    console.error('Interaction hatası:', error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'Bir hata oluştu.',
        ephemeral: true
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: 'Bir hata oluştu.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
