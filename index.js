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

require("dotenv").config();

const PANEL_ALLOWED_ROLES = [
  "1472774718250549399",
  "1465097885635842304"
];

const APPLICATION_REVIEW_ROLE_ID = "1481490846049239241";
const SUPPORT_REVIEW_ROLE_ID = "1472774718250549399";

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

function hasApplicationReviewPermission(member) {
  return member.roles.cache.has(APPLICATION_REVIEW_ROLE_ID);
}

function hasSupportReviewPermission(member) {
  return member.roles.cache.has(SUPPORT_REVIEW_ROLE_ID);
}

async function sendSafeDM(user, embed) {
  try {
    await user.send({ embeds: [embed] });
  } catch {}
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
          content: "✏️ İsim güncelleme için yetkililere ulaşabilirsiniz.",
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === "open_sorun_modal") {
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

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === "open_istek_modal") {
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

        modal.addComponents(new ActionRowBuilder().addComponents(input));
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

      if (interaction.customId.startsWith("support_read_sorun_")) {
        if (!hasSupportReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu bildirimi sadece ilgili destek yetkilisi değerlendirebilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[3];
        const targetUser = await client.users.fetch(userId).catch(() => null);

        if (targetUser) {
          const dmEmbed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("📩 Sorun Bildirimin Alındı")
            .setDescription(
              `Merhaba **${targetUser.username}**,\n\n` +
              `Göndermiş olduğun **sorun bildirimi** ekibimiz tarafından görüntülendi.\n` +
              `Konun değerlendirmeye alınmıştır.\n\n` +
              `Lütfen biraz sabırlı ol, en kısa sürede inceleme sağlanacaktır. 💜`
            );

          await sendSafeDM(targetUser, dmEmbed);
        }

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("Orange")
          .addFields({ name: "Durum", value: `📩 Okundu - ${interaction.user.tag}` });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("done_support")
            .setLabel("Okundu")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );

        return interaction.update({
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
      }

      if (interaction.customId.startsWith("support_read_istek_")) {
        if (!hasSupportReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu bildirimi sadece ilgili destek yetkilisi değerlendirebilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[3];
        const targetUser = await client.users.fetch(userId).catch(() => null);

        if (targetUser) {
          const dmEmbed = new EmbedBuilder()
            .setColor("Blurple")
            .setTitle("💡 İstek / Önerin Alındı")
            .setDescription(
              `Merhaba **${targetUser.username}**,\n\n` +
              `Göndermiş olduğun **istek / öneri** ekibimiz tarafından görüntülendi.\n` +
              `Geri bildirimin değerlendirme sürecine alınmıştır.\n\n` +
              `Görüşün bizim için değerli, teşekkür ederiz. 💜`
            );

          await sendSafeDM(targetUser, dmEmbed);
        }

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("Blurple")
          .addFields({ name: "Durum", value: `📩 Okundu - ${interaction.user.tag}` });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("done_support")
            .setLabel("Okundu")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );

        return interaction.update({
          embeds: [updatedEmbed],
          components: [disabledRow]
        });
      }

      if (interaction.customId.startsWith("app_accept_")) {
        if (!hasApplicationReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu başvuruyu sadece yetkili değerlendirme ekibi onaylayabilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];
        const targetUser = await client.users.fetch(userId).catch(() => null);

        if (targetUser) {
          const acceptEmbed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🎉 Başvurun Kabul Edildi")
            .setDescription(
              `Merhaba **${targetUser.username}**,\n\n` +
              `Pluvia yetkili başvurun olumlu sonuçlandı.\n` +
              `Sunucuda **Pluvia Yetkili Başlangıç** olarak göreve başlayacaksın.\n\n` +
              `**Başlangıç görevlerin:**\n` +
              `• Sunucuya yeni gelen üyelere hoş geldin demek\n` +
              `• Chat aktifliğini desteklemek\n` +
              `• Üyelerle düzgün ve saygılı iletişim kurmak\n` +
              `• Yetkili ekibinin yönlendirmelerine uyum sağlamak\n` +
              `• Kurallara dikkat ederek örnek bir görevli olmak\n\n` +
              `Aramıza hoş geldin, başarılar dileriz. 💜`
            );

          await sendSafeDM(targetUser, acceptEmbed);
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
        if (!hasApplicationReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu başvuruyu sadece yetkili değerlendirme ekibi reddedebilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];
        const targetUser = await client.users.fetch(userId).catch(() => null);

        if (targetUser) {
          const rejectEmbed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ Başvurun Reddedildi")
            .setDescription(
              `Merhaba **${targetUser.username}**,\n\n` +
              `Pluvia yetkili başvurun bu kez olumlu sonuçlanmadı.\n\n` +
              `Lütfen moralini bozma.\n` +
              `Kendini geliştirip ilerleyen süreçte tekrar başvuru yapabilirsin.\n\n` +
              `İlgin ve emeğin için teşekkür ederiz. 💜`
            );

          await sendSafeDM(targetUser, rejectEmbed);
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
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_sorun") {
        await interaction.deferReply({ ephemeral: true });

        const sorun = interaction.fields.getTextInputValue("sorun_text");
        const channel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (!channel) {
          return interaction.editReply({
            content: "❌ Bildirim kanalı bulunamadı."
          });
        }

        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("⛔ Yeni Sorun Bildirimi")
          .addFields(
            { name: "Kullanıcı", value: `${interaction.user} (${interaction.user.tag})` },
            { name: "Sorun", value: sorun }
          )
          .setFooter({ text: `Kullanıcı ID: ${interaction.user.id}` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`support_read_sorun_${interaction.user.id}`)
            .setLabel("Okudum")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅")
        );

        await channel.send({
          embeds: [embed],
          components: [row]
        });

        return interaction.editReply({
          content: "✅ Sorun bildirimin yetkili ekibe iletildi."
        });
      }

      if (interaction.customId === "modal_istek") {
        await interaction.deferReply({ ephemeral: true });

        const istek = interaction.fields.getTextInputValue("istek_text");
        const channel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (!channel) {
          return interaction.editReply({
            content: "❌ Bildirim kanalı bulunamadı."
          });
        }

        const embed = new EmbedBuilder()
          .setColor("Blurple")
          .setTitle("☑️ Yeni İstek / Öneri")
          .addFields(
            { name: "Kullanıcı", value: `${interaction.user} (${interaction.user.tag})` },
            { name: "İstek / Öneri", value: istek }
          )
          .setFooter({ text: `Kullanıcı ID: ${interaction.user.id}` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`support_read_istek_${interaction.user.id}`)
            .setLabel("Okudum")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅")
        );

        await channel.send({
          embeds: [embed],
          components: [row]
        });

        return interaction.editReply({
          content: "✅ İstek / önerin yetkili ekibe iletildi."
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
            content: "❌ Başvuru kanalı bulunamadı."
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
