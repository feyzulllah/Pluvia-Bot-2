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
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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

function hasOpenTicket(guild, userId) {
  return guild.channels.cache.find(
    ch =>
      ch.parentId === process.env.CATEGORY_ID &&
      ch.topic &&
      ch.topic.includes(`owner:${userId}`)
  );
}

async function createTicketChannel(guild, user, type, contentText) {
  const ticketCount =
    guild.channels.cache.filter(ch => ch.parentId === process.env.CATEGORY_ID).size + 1;

  const channel = await guild.channels.create({
    name: `${type}-${ticketCount}`,
    type: ChannelType.GuildText,
    parent: process.env.CATEGORY_ID,
    topic: `owner:${user.id} | type:${type}`,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: user.id,
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

  const titleMap = {
    sorun: "⛔ Sorun Bildirimi",
    istek: "☑️ İstek & Öneri",
    yetkili: "🛡️ Yetkili Başvurusu"
  };

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(titleMap[type] || "🎫 Ticket")
    .setDescription(
      `Merhaba ${user}, talebin başarıyla oluşturuldu.\n\n` +
      `**İçerik:**\n${contentText}\n\n` +
      `Yetkili ekip en kısa sürede seninle ilgilenecektir.`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Üstlen")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🙋"),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Kapat")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒")
  );

  await channel.send({
    content: `${user} <@&${process.env.STAFF_ROLE_ID}>`,
    embeds: [embed],
    components: [row]
  });

  return channel;
}

async function sendLog(guild, embed, files = []) {
  try {
    const logChannel = guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (!logChannel) return;
    await logChannel.send({ embeds: [embed], files });
  } catch (err) {
    console.error("[LOG HATASI]", err);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`[BOT] ${client.user.tag} aktif`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "panel") {
        await interaction.deferReply({ ephemeral: true });

        if (!hasPanelPermission(interaction.member)) {
          return interaction.editReply({
            content: "❌ Bu komutu kullanma yetkin yok."
          });
        }

        const embed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setDescription(
            `**Merhaba!**\n\n` +
            `İstek veya önerin mi var?\n` +
            `Yetkili olmak mı istiyorsun?\n` +
            `Bir yetkiliden destek almak ister misin?\n` +
            `Botlarla veya komutlarla ilgili bir sorunun mu var?\n\n` +
            `Aşağıdaki menüyü kullanarak yapabileceğin işlemler bulunmaktadır.`
          );

        const infoMenu = new StringSelectMenuBuilder()
          .setCustomId("info_menu")
          .setPlaceholder("Bir işlem seçiniz")
          .addOptions([
            {
              label: "Katılım Tarihi",
              description: "Sunucuya giriş tarihinizi öğrenin.",
              value: "katilim_tarihi",
              emoji: "🕓"
            },
            {
              label: "Hesap Tarihi",
              description: "Hesabınızın açılış tarihini öğrenin.",
              value: "hesap_tarihi",
              emoji: "📅"
            },
            {
              label: "Rol Bilgisi",
              description: "Üzerinizde bulunan rolleri listeleyin.",
              value: "rol_bilgisi",
              emoji: "🎭"
            },
            {
              label: "Davet Bilgisi",
              description: "Davet bilgilerinizi öğrenin.",
              value: "davet_bilgisi",
              emoji: "📨"
            },
            {
              label: "İsim Güncelleme",
              description: "İsim güncelleme hakkında bilgi alın.",
              value: "isim_guncelleme",
              emoji: "✏️"
            }
          ]);

        const menuRow = new ActionRowBuilder().addComponents(infoMenu);

        const buttonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("open_sorun_modal")
            .setLabel("Sorunlarımı İletmek İstiyorum")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("⛔"),
          new ButtonBuilder()
            .setCustomId("open_istek_modal")
            .setLabel("İsteklerimi İletmek İstiyorum")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("☑️"),
          new ButtonBuilder()
            .setCustomId("open_yetkili_modal")
            .setLabel("Yetkili Olmak İstiyorum")
            .setStyle(ButtonStyle.Success)
            .setEmoji("🛡️")
        );

        await interaction.channel.send({
          embeds: [embed],
          components: [menuRow, buttonRow]
        });

        return interaction.editReply({
          content: "✅ Panel başarıyla gönderildi."
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
      if (interaction.customId === "open_sorun_modal") {
        const existing = hasOpenTicket(interaction.guild, interaction.user.id);
        if (existing) {
          return interaction.reply({
            content: `❌ Zaten açık bir ticketın var: ${existing}`,
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("modal_sorun")
          .setTitle("Sorunları İlet");

        const input = new TextInputBuilder()
          .setCustomId("sorun_text")
          .setLabel("Sorunu anlatır mısınız?")
          .setPlaceholder("Örn: Kayıt ederken bir hata oluştu ve kayıt edemiyorum.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      }

      if (interaction.customId === "open_istek_modal") {
        const existing = hasOpenTicket(interaction.guild, interaction.user.id);
        if (existing) {
          return interaction.reply({
            content: `❌ Zaten açık bir ticketın var: ${existing}`,
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("modal_istek")
          .setTitle("İstek & Öneri Formu");

        const input = new TextInputBuilder()
          .setCustomId("istek_text")
          .setLabel("İstek veya öneriniz nedir?")
          .setPlaceholder("İsteğinizi ve önerinizi bizlere iletin.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        return interaction.showModal(modal);
      }

      if (interaction.customId === "open_yetkili_modal") {
        const modal = new ModalBuilder()
          .setCustomId("modal_yetkili")
          .setTitle("Yetkili Başvuru Formu");

        const adyas = new TextInputBuilder()
          .setCustomId("ad_yas")
          .setLabel("İsminiz ve yaşınız?")
          .setPlaceholder("Örn: Ahmet 20")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100);

        const referans = new TextInputBuilder()
          .setCustomId("referans")
          .setLabel("Referans")
          .setPlaceholder("Örn: @rizeli / ID")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(100);

        const onceYetkili = new TextInputBuilder()
          .setCustomId("once_yetkili")
          .setLabel("Daha önce yetkilik yaptınız mı?")
          .setPlaceholder('Örn: Evet yaptım, "xxx" sunucusunda yönetim kadrosundaydım')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        const neYaparsin = new TextInputBuilder()
          .setCustomId("ne_yaparsin")
          .setLabel("Ne yapabilirsiniz bize açıklar mısınız?")
          .setPlaceholder("Örn: Her işi yaparım vs.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        const hakkinda = new TextInputBuilder()
          .setCustomId("hakkinda")
          .setLabel("Hakkında birkaç şey söyler misin?")
          .setPlaceholder("Örn: Telli enstrüman çalmayı çok seviyorum.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        modal.addComponents(
          new ActionRowBuilder().addComponents(adyas),
          new ActionRowBuilder().addComponents(referans),
          new ActionRowBuilder().addComponents(onceYetkili),
          new ActionRowBuilder().addComponents(neYaparsin),
          new ActionRowBuilder().addComponents(hakkinda)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === "ticket_claim") {
        if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
          return interaction.reply({
            content: "❌ Bu butonu sadece yetkililer kullanabilir.",
            ephemeral: true
          });
        }

        const claimLog = new EmbedBuilder()
          .setColor("Blue")
          .setTitle("🙋 Ticket Üstlenildi")
          .addFields(
            { name: "Yetkili", value: `${interaction.user.tag}`, inline: true },
            { name: "Kanal", value: `${interaction.channel}`, inline: true }
          );

        await sendLog(interaction.guild, claimLog);

        return interaction.reply({
          content: `✅ Ticket ${interaction.user} tarafından üstlenildi.`
        });
      }

      if (interaction.customId.startsWith("app_accept_")) {
        if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
          return interaction.reply({
            content: "❌ Bunu sadece yetkililer kullanabilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];
        const targetUser = await client.users.fetch(userId).catch(() => null);

        if (targetUser) {
          const acceptEmbed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🎉 Yetkili Başvurun Kabul Edildi")
            .setDescription(
              `Merhaba **${targetUser.username}**,\n\n` +
              `Pluvia yetkili başvurun olumlu sonuçlandı.\n` +
              `Sunucuda **stajyer** olarak göreve başlayacaksın.\n\n` +
              `**İlk görevlerin:**\n` +
              `• Sunucuya yeni gelen üyelere hoş geldin demek\n` +
              `• Chat aktifliğine katkı sağlamak\n` +
              `• Yetkililerle uyumlu şekilde çalışmak\n` +
              `• Kurallara uygun davranmak\n\n` +
              `Aramıza hoş geldin, başarılar dileriz. 💜`
            );

          await targetUser.send({ embeds: [acceptEmbed] }).catch(() => {});
        }

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("Green")
          .addFields({ name: "Durum", value: `✅ Kabul edildi - ${interaction.user.tag}` });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("accepted_done")
            .setLabel("Onaylandı")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("rejected_done")
            .setLabel("Reddedildi")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

        return interaction.update({
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
      }

      if (interaction.customId.startsWith("app_reject_")) {
        if (!interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
          return interaction.reply({
            content: "❌ Bunu sadece yetkililer kullanabilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];
        const targetUser = await client.users.fetch(userId).catch(() => null);

        if (targetUser) {
          const rejectEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ Yetkili Başvurun Reddedildi")
            .setDescription(
              `Merhaba **${targetUser.username}**,\n\n` +
              `Pluvia yetkili başvurun bu kez olumlu sonuçlanmadı.\n` +
              `Lütfen moralini bozma.\n\n` +
              `Kendini geliştirip ileride tekrar başvuru yapabilirsin.\n` +
              `İlgin için teşekkür ederiz. 💜`
            );

          await targetUser.send({ embeds: [rejectEmbed] }).catch(() => {});
        }

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("Red")
          .addFields({ name: "Durum", value: `❌ Reddedildi - ${interaction.user.tag}` });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("accepted_done")
            .setLabel("Onaylandı")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("rejected_done")
            .setLabel("Reddedildi")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

        return interaction.update({
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
      }

      if (interaction.customId === "ticket_close") {
        await interaction.deferReply();

        const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID);
        const isOwner = interaction.channel.topic?.includes(`owner:${interaction.user.id}`);

        if (!isStaff && !isOwner) {
          return interaction.editReply({
            content: "❌ Bu ticketı kapatma yetkin yok."
          });
        }

        await interaction.editReply({
          content: "🔒 Ticket kapatılıyor, transcript hazırlanıyor..."
        });

        const attachment = await createTranscript(interaction.channel, {
          limit: -1,
          returnType: "attachment",
          filename: `${interaction.channel.name}.html`
        });

        const closeLog = new EmbedBuilder()
          .setColor("Red")
          .setTitle("🔒 Ticket Kapatıldı")
          .addFields(
            { name: "Kanal", value: `${interaction.channel.name}`, inline: true },
            { name: "Kapatan", value: `${interaction.user.tag}`, inline: true }
          );

        await sendLog(interaction.guild, closeLog, [attachment]);

        setTimeout(async () => {
          await interaction.channel.delete().catch(() => {});
        }, 3000);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_sorun") {
        await interaction.deferReply({ ephemeral: true });

        const existing = hasOpenTicket(interaction.guild, interaction.user.id);
        if (existing) {
          return interaction.editReply({
            content: `❌ Zaten açık bir ticketın var: ${existing}`
          });
        }

        const sorun = interaction.fields.getTextInputValue("sorun_text");
        const channel = await createTicketChannel(interaction.guild, interaction.user, "sorun", sorun);

        const openLog = new EmbedBuilder()
          .setColor("Red")
          .setTitle("⛔ Sorun Ticketı Açıldı")
          .addFields(
            { name: "Kullanıcı", value: interaction.user.tag, inline: true },
            { name: "Kanal", value: `${channel}`, inline: true }
          );

        await sendLog(interaction.guild, openLog);

        return interaction.editReply({
          content: `✅ Sorun bildirimin alındı: ${channel}`
        });
      }

      if (interaction.customId === "modal_istek") {
        await interaction.deferReply({ ephemeral: true });

        const existing = hasOpenTicket(interaction.guild, interaction.user.id);
        if (existing) {
          return interaction.editReply({
            content: `❌ Zaten açık bir ticketın var: ${existing}`
          });
        }

        const istek = interaction.fields.getTextInputValue("istek_text");
        const channel = await createTicketChannel(interaction.guild, interaction.user, "istek", istek);

        const openLog = new EmbedBuilder()
          .setColor("Blurple")
          .setTitle("☑️ İstek Ticketı Açıldı")
          .addFields(
            { name: "Kullanıcı", value: interaction.user.tag, inline: true },
            { name: "Kanal", value: `${channel}`, inline: true }
          );

        await sendLog(interaction.guild, openLog);

        return interaction.editReply({
          content: `✅ İstek / önerin alındı: ${channel}`
        });
      }

      if (interaction.customId === "modal_yetkili") {
        await interaction.deferReply({ ephemeral: true });

        const adYas = interaction.fields.getTextInputValue("ad_yas");
        const referans = interaction.fields.getTextInputValue("referans") || "Belirtilmedi";
        const onceYetkili = interaction.fields.getTextInputValue("once_yetkili");
        const neYaparsin = interaction.fields.getTextInputValue("ne_yaparsin");
        const hakkinda = interaction.fields.getTextInputValue("hakkinda");

        const applicationChannel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (!applicationChannel) {
          return interaction.editReply({
            content: "❌ Başvuru kanalı bulunamadı. Yetkililere bildir."
          });
        }

        const appEmbed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle("🛡️ Yeni Yetkili Başvurusu")
          .addFields(
            { name: "Başvuran", value: `${interaction.user} (${interaction.user.tag})` },
            { name: "İsim / Yaş", value: adYas },
            { name: "Referans", value: referans },
            { name: "Daha önce yetkilik yaptı mı?", value: onceYetkili },
            { name: "Neler yapabilir?", value: neYaparsin },
            { name: "Kendinden bahset", value: hakkinda }
          )
          .setFooter({ text: `Başvuran ID: ${interaction.user.id}` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`app_accept_${interaction.user.id}`)
            .setLabel("Onayla")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅"),
          new ButtonBuilder()
            .setCustomId(`app_reject_${interaction.user.id}`)
            .setLabel("Reddet")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌")
        );

        await applicationChannel.send({
          embeds: [appEmbed],
          components: [row]
        });

        const appLog = new EmbedBuilder()
          .setColor("Green")
          .setTitle("🛡️ Yetkili Başvurusu Gönderildi")
          .addFields(
            { name: "Kullanıcı", value: interaction.user.tag, inline: true },
            { name: "Kanal", value: `<#${process.env.APPLICATION_CHANNEL_ID}>`, inline: true }
          );

        await sendLog(interaction.guild, appLog);

        return interaction.editReply({
          content: "✅ Yetkili başvurun başarıyla gönderildi. Sonuç sana DM üzerinden bildirilecektir."
        });
      }
    }
  } catch (error) {
    console.error("[INTERACTION HATASI]", error);

    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: "❌ Bir hata oluştu."
        });
      } else if (interaction.replied) {
        await interaction.followUp({
          content: "❌ Bir hata oluştu.",
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: "❌ Bir hata oluştu.",
          ephemeral: true
        });
      }
    } catch {}
  }
});

client.login(process.env.TOKEN);
