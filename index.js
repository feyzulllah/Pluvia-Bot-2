const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot aktif!"));
app.listen(PORT, () => console.log(`[WEB] ${PORT} portunda aktif`));

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

const APPROVED_ROLE_IDS = [
  "1481475983348334632",
  "1472747874650558624"
];

const INVITE_LINK = "https://discord.gg/pluvia";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Destek panelini gönderir")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// Bekleyen başvurular: userId -> messageId
const pendingApplications = new Map();

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
    return true;
  } catch {
    return false;
  }
}

function panelEmbed() {
  return new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle("Merhaba!")
    .setDescription(
      [
        "İstek veya önerin mi var?",
        "Yetkili olmak mı istiyorsun?",
        "Bir yetkiliden destek almak ister misin?",
        "Botlarla veya komutlarla ilgili bir sorunun mu var?",
        "",
        "Aşağıdaki menüyü kullanarak yapabileceğin işlemler bulunmaktadır."
      ].join("\n")
    )
    .setFooter({ text: "Pluvia Destek Sistemi" });
}

function prettyAcceptDM(username) {
  return new EmbedBuilder()
    .setColor("Green")
    .setTitle("🎉 Başvurun Kabul Edildi")
    .setDescription(
      [
        `Merhaba **${username}**,`,
        "",
        "Pluvia yetkili başvurun **olumlu sonuçlandı**.",
        "Sunucuda **Pluvia Yetkili Başlangıç** olarak göreve başlayacaksın.",
        "",
        "**Başlangıç görevlerin:**",
        "• Sunucuya yeni gelen üyelere hoş geldin demek",
        "• Chat aktifliğini desteklemek",
        "• Üyelerle saygılı ve düzgün iletişim kurmak",
        "• Yetkili ekibinin yönlendirmelerine uyum sağlamak",
        "• Kurallara dikkat ederek örnek bir görevli olmak",
        "",
        "Aramıza hoş geldin, başarılar dileriz. 💜"
      ].join("\n")
    )
    .setFooter({ text: "Pluvia Yönetimi" });
}

function prettyRejectDM(username, reasonLabel) {
  return new EmbedBuilder()
    .setColor("Red")
    .setTitle("❌ Başvurun Reddedildi")
    .setDescription(
      [
        `Merhaba **${username}**,`,
        "",
        "Pluvia yetkili başvurun bu kez olumlu sonuçlanmadı.",
        "",
        `**Sebep:** ${reasonLabel}`,
        "",
        "Lütfen moralini bozma.",
        "Kendini geliştirip ilerleyen süreçte tekrar başvuru yapabilirsin.",
        "",
        "İlgin ve emeğin için teşekkür ederiz. 💜"
      ].join("\n")
    )
    .setFooter({ text: "Pluvia Yönetimi" });
}

function prettySupportDM(username, type) {
  const isIssue = type === "sorun";
  return new EmbedBuilder()
    .setColor(isIssue ? "Orange" : "Blurple")
    .setTitle(isIssue ? "📩 Sorun Bildirimin Alındı" : "💡 İstek / Önerin Alındı")
    .setDescription(
      [
        `Merhaba **${username}**,`,
        "",
        isIssue
          ? "Göndermiş olduğun **sorun bildirimi** ekibimiz tarafından görüntülendi."
          : "Göndermiş olduğun **istek / öneri** ekibimiz tarafından görüntülendi.",
        "Bildirimin değerlendirme sürecine alınmıştır.",
        "",
        isIssue
          ? "Lütfen biraz sabırlı ol, en kısa sürede inceleme sağlanacaktır. 💜"
          : "Görüşün bizim için değerli, teşekkür ederiz. 💜"
      ].join("\n")
    )
    .setFooter({ text: "Pluvia Destek Ekibi" });
}

client.once(Events.ClientReady, async () => {
  console.log(`[BOT] ${client.user.tag} aktif`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    // /panel
    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
      await interaction.deferReply({ ephemeral: true });

      if (!hasPanelPermission(interaction.member)) {
        return interaction.editReply({ content: "❌ Bu komutu kullanma yetkin yok." });
      }

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
            description: "Sunucu davet bağlantısını alın.",
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
        embeds: [panelEmbed()],
        components: [menuRow, buttonRow]
      });

      return interaction.editReply({ content: "✅ Panel başarıyla gönderildi." });
    }

    // Bilgi menüsü
    if (interaction.isStringSelectMenu() && interaction.customId === "info_menu") {
      const v = interaction.values[0];

      if (v === "katilim_tarihi") {
        const joined = interaction.member.joinedTimestamp;
        return interaction.reply({
          content: joined
            ? `📌 Sunucuya katılım tarihin: <t:${Math.floor(joined / 1000)}:F>`
            : "❌ Katılım tarihi bulunamadı.",
          ephemeral: true
        });
      }

      if (v === "hesap_tarihi") {
        const created = interaction.user.createdTimestamp;
        return interaction.reply({
          content: `📅 Hesabının oluşturulma tarihi: <t:${Math.floor(created / 1000)}:F>`,
          ephemeral: true
        });
      }

      if (v === "rol_bilgisi") {
        const roles = interaction.member.roles.cache
          .filter(role => role.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(role => role.toString());

        return interaction.reply({
          content: roles.length
            ? `🎭 Üzerindeki roller:\n${roles.join(", ")}`
            : "Üzerinde herhangi bir rol bulunmuyor.",
          ephemeral: true
        });
      }

      if (v === "davet_bilgisi") {
        return interaction.reply({
          content: `📨 Sunucu davet bağlantısı:\n${INVITE_LINK}`,
          ephemeral: true
        });
      }

      if (v === "isim_guncelleme") {
        return interaction.reply({
          content: "✏️ İsim güncelleme için yetkililere ulaşabilirsiniz.",
          ephemeral: true
        });
      }
    }

    // Butonlar
    if (interaction.isButton()) {
      // Formları aç
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
        // 3) Tekrar başvuru engeli
        if (pendingApplications.has(interaction.user.id)) {
          return interaction.reply({
            content: "❌ Zaten bekleyen bir yetkili başvurun var. Sonuçlanmadan yeni başvuru yapamazsın.",
            ephemeral: true
          });
        }

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

      // Sorun/istek okundu
      if (interaction.customId.startsWith("support_read_sorun_")) {
        if (!hasSupportReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu bildirimi sadece ilgili destek yetkilisi değerlendirebilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[3];
        const targetUser = await client.users.fetch(userId).catch(() => null);

        let dmStatus = "⚠️ DM gönderilemedi.";
        if (targetUser) {
          const sent = await sendSafeDM(targetUser, prettySupportDM(targetUser.username, "sorun"));
          dmStatus = sent ? "✅ DM gönderildi." : "❌ DM gönderilemedi.";
        }

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("Orange")
          .addFields(
            { name: "Durum", value: `📩 Okundu - ${interaction.user.tag}` },
            { name: "DM Durumu", value: dmStatus }
          );

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

        let dmStatus = "⚠️ DM gönderilemedi.";
        if (targetUser) {
          const sent = await sendSafeDM(targetUser, prettySupportDM(targetUser.username, "istek"));
          dmStatus = sent ? "✅ DM gönderildi." : "❌ DM gönderilemedi.";
        }

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("Blurple")
          .addFields(
            { name: "Durum", value: `📩 Okundu - ${interaction.user.tag}` },
            { name: "DM Durumu", value: dmStatus }
          );

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

      // Yetkili kabul
      if (interaction.customId.startsWith("app_accept_")) {
        if (!hasApplicationReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu başvuruyu sadece yetkili değerlendirme ekibi onaylayabilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];
        const targetUser = await client.users.fetch(userId).catch(() => null);
        const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

        let roleStatus = "⚠️ Roller verilemedi.";
        if (targetMember) {
          try {
            // 7) Rol zaten varsa tekrar verme
            const rolesToAdd = APPROVED_ROLE_IDS.filter(roleId => !targetMember.roles.cache.has(roleId));

            if (!rolesToAdd.length) {
              roleStatus = "ℹ️ Roller zaten kullanıcıda vardı.";
            } else {
              await targetMember.roles.add(rolesToAdd);
              roleStatus = `✅ Roller verildi: ${rolesToAdd.map(r => `<@&${r}>`).join(", ")}`;
            }
          } catch (err) {
            console.error("[ROL VERME HATASI]", err);
            roleStatus = "❌ Roller verilemedi. Bot yetkisini ve rol sırasını kontrol et.";
          }
        }

        let dmStatus = "⚠️ DM gönderilemedi.";
        if (targetUser) {
          const sent = await sendSafeDM(targetUser, prettyAcceptDM(targetUser.username));
          dmStatus = sent ? "✅ DM gönderildi." : "❌ DM gönderilemedi.";
        }

        // bekleyen başvuru kaydını temizle
        pendingApplications.delete(userId);

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("Green")
          .addFields(
            { name: "Durum", value: `✅ Kabul edildi - ${interaction.user.tag}` },
            { name: "Rol Durumu", value: roleStatus },
            { name: "DM Durumu", value: dmStatus }
          );

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

      // 13) Reddet -> sebep seç menüsü
      if (interaction.customId.startsWith("app_reject_")) {
        if (!hasApplicationReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu başvuruyu sadece yetkili değerlendirme ekibi reddedebilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];

        const reasonMenu = new StringSelectMenuBuilder()
          .setCustomId(`reject_reason_${userId}`)
          .setPlaceholder("Red sebebi seçiniz")
          .addOptions([
            {
              label: "Aktiflik yetersiz",
              description: "Sunucu aktifliği yeterli değil.",
              value: "aktiflik_yetersiz",
              emoji: "📉"
            },
            {
              label: "Başvuru özensiz",
              description: "Başvuru yeterince özenli değil.",
              value: "basvuru_ozensiz",
              emoji: "📝"
            },
            {
              label: "Uygun görülmedi",
              description: "Yönetim tarafından uygun görülmedi.",
              value: "uygun_gorulmedi",
              emoji: "❌"
            },
            {
              label: "Daha sonra tekrar dene",
              description: "İleride yeniden başvurabilir.",
              value: "tekrar_dene",
              emoji: "🔁"
            }
          ]);

        const row = new ActionRowBuilder().addComponents(reasonMenu);

        return interaction.reply({
          content: "❗ Lütfen reddetme sebebini seçiniz:",
          components: [row],
          ephemeral: true
        });
      }
    }

    // 13) Red sebebi seçimi
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("reject_reason_")) {
      if (!hasApplicationReviewPermission(interaction.member)) {
        return interaction.reply({
          content: "❌ Bunu kullanma yetkin yok.",
          ephemeral: true
        });
      }

      const userId = interaction.customId.split("_")[2];
      const targetUser = await client.users.fetch(userId).catch(() => null);

      const reasonMap = {
        aktiflik_yetersiz: "Aktiflik yetersiz görüldü.",
        basvuru_ozensiz: "Başvurun yeterince özenli bulunmadı.",
        uygun_gorulmedi: "Yönetim tarafından uygun görülmedi.",
        tekrar_dene: "Şu an uygun görülmedi, daha sonra tekrar başvuru yapabilirsin."
      };

      const reasonLabel = reasonMap[interaction.values[0]] || "Uygun görülmedi.";

      let dmStatus = "⚠️ DM gönderilemedi.";
      if (targetUser) {
        const sent = await sendSafeDM(targetUser, prettyRejectDM(targetUser.username, reasonLabel));
        dmStatus = sent ? "✅ DM gönderildi." : "❌ DM gönderilemedi.";
      }

      pendingApplications.delete(userId);

      // Başvuru kanalındaki ilgili mesajı bulup güncellemeye çalış
      const appChannel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);
      if (appChannel?.isTextBased()) {
        try {
          const msgId = pendingApplications.get(userId); // temizledik ama alttaki blok için önce almak lazımdı
        } catch {}
      }

      // En basit ve sağlam: ilgili kanal son mesajları arasında kullanıcı ID'si geçen bekleyen başvuruyu bul
      const applicationChannel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);
      if (applicationChannel?.isTextBased()) {
        try {
          const messages = await applicationChannel.messages.fetch({ limit: 50 });
          const targetMessage = messages.find(
            m =>
              m.author.id === client.user.id &&
              m.embeds?.[0] &&
              m.embeds[0].footer?.text?.includes(`Başvuran ID: ${userId}`) &&
              m.components?.length
          );

          if (targetMessage) {
            const updatedEmbed = EmbedBuilder.from(targetMessage.embeds[0])
              .setColor("Red")
              .addFields(
                { name: "Durum", value: `❌ Reddedildi - ${interaction.user.tag}` },
                { name: "Red Sebebi", value: reasonLabel },
                { name: "DM Durumu", value: dmStatus }
              );

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

            await targetMessage.edit({
              embeds: [updatedEmbed],
              components: [disabledRow]
            });
          }
        } catch (e) {
          console.error("[RED GÜNCELLEME HATASI]", e);
        }
      }

      return interaction.update({
        content: `✅ Başvuru reddedildi.\n**Sebep:** ${reasonLabel}\n**DM:** ${dmStatus}`,
        components: []
      });
    }

    // Modal gönderimleri
    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_sorun") {
        await interaction.deferReply({ ephemeral: true });

        const sorun = interaction.fields.getTextInputValue("sorun_text");
        const channel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (!channel) {
          return interaction.editReply({ content: "❌ Bildirim kanalı bulunamadı." });
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
          return interaction.editReply({ content: "❌ Bildirim kanalı bulunamadı." });
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

        // 3) tekrar başvuru engeli (modal submit anında da kontrol)
        if (pendingApplications.has(interaction.user.id)) {
          return interaction.editReply({
            content: "❌ Zaten bekleyen bir yetkili başvurun var. Sonuçlanmadan yeni başvuru yapamazsın."
          });
        }

        const adYas = interaction.fields.getTextInputValue("ad_yas");
        const referans = interaction.fields.getTextInputValue("referans") || "Belirtilmedi";
        const onceYetkili = interaction.fields.getTextInputValue("once_yetkili");
        const neYaparsin = interaction.fields.getTextInputValue("ne_yaparsin");
        const hakkinda = interaction.fields.getTextInputValue("hakkinda");

        const applicationChannel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);
        if (!applicationChannel) {
          return interaction.editReply({ content: "❌ Başvuru kanalı bulunamadı." });
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

        const sentMessage = await applicationChannel.send({
          embeds: [appEmbed],
          components: [row]
        });

        pendingApplications.set(interaction.user.id, sentMessage.id);

        return interaction.editReply({
          content: "✅ Yetkili başvurun başarıyla gönderildi. Sonuç sana DM üzerinden bildirilecektir."
        });
      }
    }
  } catch (error) {
    console.error("[INTERACTION HATASI]", error);

    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: "❌ Bir hata oluştu." });
      } else if (interaction.replied) {
        await interaction.followUp({ content: "❌ Bir hata oluştu.", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Bir hata oluştu.", ephemeral: true });
      }
    } catch {}
  }
});

client.login(process.env.TOKEN);
