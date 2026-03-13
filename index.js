const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot aktif!");
});

app.listen(PORT, () => {
  console.log(`[WEB] ${PORT} portunda aktif`);
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
} = require("discord.js");

const { createTranscript } = require("discord-html-transcripts");
require("dotenv").config();

const PANEL_ALLOWED_ROLES = [
  "1472774718250549399",
  "1465097885635842304"
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Destek panelini gönderir")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("[BOT] Slash komutları yüklendi");
  } catch (error) {
    console.error("[KOMUT HATASI]", error);
  }
}

function hasPanelPermission(member) {
  return PANEL_ALLOWED_ROLES.some(roleId => member.roles.cache.has(roleId));
}

function getTicketTypeName(type) {
  if (type === "sorun") return "Sorun Bildirimi";
  if (type === "istek") return "İstek Bildirimi";
  if (type === "yetkili") return "Yetkili Başvurusu";
  return "Destek";
}

function getTicketButtonInfo(type) {
  if (type === "sorun") {
    return {
      emoji: "⛔",
      title: "Sorun Bildirimi",
      color: "Red"
    };
  }

  if (type === "istek") {
    return {
      emoji: "☑️",
      title: "İstek Bildirimi",
      color: "Blurple"
    };
  }

  if (type === "yetkili") {
    return {
      emoji: "🛡️",
      title: "Yetkili Başvurusu",
      color: "Green"
    };
  }

  return {
    emoji: "🎫",
    title: "Destek",
    color: "Blue"
  };
}

client.once(Events.ClientReady, async () => {
  console.log(`[BOT] ${client.user.tag} aktif`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "panel") {
        if (!hasPanelPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu komutu kullanma yetkin yok.",
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setDescription(
            `**Merhaba!**\n\n` +
            `İstek veya önerin mi var?\n` +
            `Yetkili olmak mı istiyorsun?\n` +
            `Bir yetkiliden destek almak ister misin?\n` +
            `Botlarla veya komutlarla ilgili bir sorunun mu var?\n` +
            `Aşağıdaki menüyü kullanarak yapabileceğin işlemler bulunmaktadır.`
          );

        const infoMenu = new StringSelectMenuBuilder()
          .setCustomId("info_menu")
          .setPlaceholder("Katılım Tarihi")
          .addOptions([
            {
              label: "Katılım Tarihi",
              description: "Sunucuya giriş tarihinizi öğrenin.",
              value: "katilim_tarihi",
              emoji: "›"
            },
            {
              label: "Hesap Tarihi",
              description: "Hesabınızın açılış tarihini öğrenin.",
              value: "hesap_tarihi",
              emoji: "›"
            },
            {
              label: "Rol Bilgisi",
              description: "Üzerinizde bulunan rolleri listeleyin.",
              value: "rol_bilgisi",
              emoji: "›"
            },
            {
              label: "Davet Bilgisi",
              description: "Davet bilgilerinizi öğrenin.",
              value: "davet_bilgisi",
              emoji: "›"
            },
            {
              label: "İsim Güncelleme",
              description: "İsim güncelleme hakkında bilgi alın.",
              value: "isim_guncelleme",
              emoji: "›"
            }
          ]);

        const menuRow = new ActionRowBuilder().addComponents(infoMenu);

        const buttonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_sorun")
            .setLabel("Sorunlarımı İletmek İstiyorum")
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId("open_istek")
            .setLabel("İsteklerimi İletmek İstiyorum")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId("open_yetkili")
            .setLabel("Yetkili Olmak İstiyorum")
            .setStyle(ButtonStyle.Success)
        );

        return interaction.reply({
          embeds: [embed],
          components: [menuRow, buttonRow]
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== "info_menu") return;

      if (interaction.values[0] === "katilim_tarihi") {
        return interaction.reply({
          content: `📌 Sunucuya katılım tarihin: <t:${Math.floor(interaction.member.joinedTimestamp / 1000)}:F>`,
          ephemeral: true
        });
      }

      if (interaction.values[0] === "hesap_tarihi") {
        return interaction.reply({
          content: `📅 Hesabının oluşturulma tarihi: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:F>`,
          ephemeral: true
        });
      }

      if (interaction.values[0] === "rol_bilgisi") {
        const roles = interaction.member.roles.cache
          .filter(role => role.id !== interaction.guild.id)
          .map(role => role.toString());

        return interaction.reply({
          content: roles.length
            ? `🎭 Üzerindeki roller:\n${roles.join(", ")}`
            : "Üzerinde herhangi bir rol bulunmuyor.",
          ephemeral: true
        });
      }

      if (interaction.values[0] === "davet_bilgisi") {
        return interaction.reply({
          content: "📨 Davet bilgisi sistemi şu an aktif değil.",
          ephemeral: true
        });
      }

      if (interaction.values[0] === "isim_guncelleme") {
        return interaction.reply({
          content: "✏️ İsim güncelleme için yetkililere ticket açabilirsiniz.",
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      if (
        interaction.customId === "open_sorun" ||
        interaction.customId === "open_istek" ||
        interaction.customId === "open_yetkili"
      ) {
        let type = "destek";
        if (interaction.customId === "open_sorun") type = "sorun";
        if (interaction.customId === "open_istek") type = "istek";
        if (interaction.customId === "open_yetkili") type = "yetkili";

        const existingChannel = interaction.guild.channels.cache.find(
          ch =>
            ch.parentId === process.env.CATEGORY_ID &&
            ch.topic &&
            ch.topic.includes(`owner:${interaction.user.id}`)
        );

        if (existingChannel) {
          return interaction.reply({
            content: `❌ Zaten açık bir ticketın var: ${existingChannel}`,
            ephemeral: true
          });
        }

        const ticketCount =
          interaction.guild.channels.cache.filter(ch => ch.parentId === process.env.CATEGORY_ID).size + 1;

        const channel = await interaction.guild.channels.create({
          name: `${type}-${ticketCount}`,
          type: ChannelType.GuildText,
          parent: process.env.CATEGORY_ID,
          topic: `owner:${interaction.user.id} | type:${type}`,
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

        const info = getTicketButtonInfo(type);

        const ticketEmbed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle(`${info.emoji} ${info.title}`)
          .setDescription(
            `Merhaba ${interaction.user}, talebin başarıyla oluşturuldu.\n\n` +
            `**Talep Türü:** ${getTicketTypeName(type)}\n` +
            `**Durum:** Açık\n\n` +
            `Yetkili ekip en kısa sürede seninle ilgilenecektir.`
          );

        const controlRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_claim")
            .setLabel("Üstlen")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Kapat")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
          content: `${interaction.user} <@&${process.env.STAFF_ROLE_ID}>`,
          embeds: [ticketEmbed],
          components: [controlRow]
        });

        const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("📩 Ticket Açıldı")
            .addFields(
              { name: "Kullanıcı", value: `${interaction.user.tag}`, inline: true },
              { name: "Tür", value: getTicketTypeName(type), inline: true },
              { name: "Kanal", value: `${channel}`, inline: true }
            );

          await logChannel.send({ embeds: [logEmbed] });
        }

        return interaction.reply({
          content: `✅ Ticket oluşturuldu: ${channel}`,
          ephemeral: true
        });
      }

      if (interaction.customId === "ticket_claim") {
        if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
          return interaction.reply({
            content: "❌ Bu butonu sadece yetkililer kullanabilir.",
            ephemeral: true
          });
        }

        const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
          const claimEmbed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle("🙋 Ticket Üstlenildi")
            .addFields(
              { name: "Yetkili", value: `${interaction.user.tag}`, inline: true },
              { name: "Kanal", value: `${interaction.channel}`, inline: true }
            );

          await logChannel.send({ embeds: [claimEmbed] });
        }

        return interaction.reply({
          content: `✅ Ticket ${interaction.user} tarafından üstlenildi.`
        });
      }

      if (interaction.customId === "ticket_close") {
        const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID);
        const isOwner = interaction.channel.topic?.includes(`owner:${interaction.user.id}`);

        if (!isStaff && !isOwner) {
          return interaction.reply({
            content: "❌ Bu ticketı kapatma yetkin yok.",
            ephemeral: true
          });
        }

        await interaction.reply({
          content: "🔒 Ticket kapatılıyor, transcript hazırlanıyor..."
        });

        const attachment = await createTranscript(interaction.channel, {
          limit: -1,
          returnType: "attachment",
          filename: `${interaction.channel.name}.html`
        });

        const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
          const closeEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🔒 Ticket Kapatıldı")
            .addFields(
              { name: "Kanal", value: `${interaction.channel.name}`, inline: true },
              { name: "Kapatan", value: `${interaction.user.tag}`, inline: true }
            );

          await logChannel.send({
            embeds: [closeEmbed],
            files: [attachment]
          });
        }

        setTimeout(async () => {
          await interaction.channel.delete().catch(() => {});
        }, 3000);
      }
    }
  } catch (error) {
    console.error("[INTERACTION HATASI]", error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ Bir hata oluştu.",
        ephemeral: true
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: "❌ Bir hata oluştu.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
