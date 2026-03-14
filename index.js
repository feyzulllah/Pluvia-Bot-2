const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Bot aktif!"));
app.listen(PORT, () => console.log(`[WEB] ${PORT} portunda aktif`));

const fs = require("fs");
const path = require("path");
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

const SELF_ROLE_USER_ID = "1472935494043173156";

const SELF_ROLE_IDS = [
  "1465097885635842304",
  "1479581525094961384",
  "1472741983532355657"
];

const INVITE_LINK = "https://discord.gg/pluvia";
const MIN_ACCOUNT_AGE_DAYS = 30;
const MIN_GUILD_HOURS = 48;

const COOLDOWN_MS = {
  sorun: 10 * 60 * 1000,
  istek: 10 * 60 * 1000,
  isim: 12 * 60 * 60 * 1000
};

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "storage.json");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        pendingApplications: {},
        counters: {
          application: 0,
          support: 0,
          rename: 0
        },
        cooldowns: {},
        afk: {},
        stats: {},
        invites: {}
      },
      null,
      2
    )
  );
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return {
      pendingApplications: {},
      counters: { application: 0, support: 0, rename: 0 },
      cooldowns: {},
      afk: {},
      stats: {},
      invites: {}
    };
  }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

let storage = loadData();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildPresences
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Destek panelini gönderir"),

  new SlashCommandBuilder()
    .setName("kendimerolver")
    .setDescription("Sadece sahibine özel rol verir"),

  new SlashCommandBuilder()
    .setName("kendimdenrollerial")
    .setDescription("Sadece sahibine özel verilen rolleri geri alır")
].map(c => c.toJSON());

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

function getCooldownKey(userId, type) {
  return `${userId}_${type}`;
}

function getRemainingCooldown(userId, type) {
  const key = getCooldownKey(userId, type);
  const last = storage.cooldowns[key];
  if (!last) return 0;
  const remain = COOLDOWN_MS[type] - (Date.now() - last);
  return remain > 0 ? remain : 0;
}

function setCooldown(userId, type) {
  storage.cooldowns[getCooldownKey(userId, type)] = Date.now();
  saveData(storage);
}

function formatDuration(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h > 0 ? `${h}s ` : ""}${m > 0 ? `${m}dk ` : ""}${s}sn`;
}

function formatDiscordDate(timestamp) {
  if (!timestamp) return "Bilinmiyor";
  return `<t:${Math.floor(timestamp / 1000)}:F> • <t:${Math.floor(timestamp / 1000)}:R>`;
}

function formatRoleList(member) {
  const roles = member.roles.cache
    .filter(role => role.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map(role => role.toString());

  return roles.length
    ? `${roles.join("\n")}\n\nToplam **${roles.length}** rol bulunuyor.`
    : "Üzerinde herhangi bir rol bulunmuyor.";
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
    .setTitle("✨ Pluvia Destek & Başvuru Paneli")
    .setDescription(
      [
        "Merhaba, hoş geldin.",
        "",
        "Aşağıdaki butonlar ve menüler aracılığıyla:",
        "• Sorunlarını iletebilir",
        "• İstek ve önerilerini paylaşabilir",
        "• Yetkili başvurusu yapabilir",
        "• Hesap / katılım / rol bilgilerini görüntüleyebilirsin",
        "",
        "Lütfen sistemi gereksiz kullanma ve bilgileri doğru gir."
      ].join("\n")
    )
    .setFooter({ text: "Pluvia • Destek Sistemi" });
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
        "• Üyelere karşı saygılı ve düzgün iletişim kurmak",
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
        `**Red Sebebi:** ${reasonLabel}`,
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
          : "Geri bildirimin bizim için değerli, teşekkür ederiz. 💜"
      ].join("\n")
    )
    .setFooter({ text: "Pluvia Destek Ekibi" });
}

function prettyRenameAcceptDM(username, newName) {
  return new EmbedBuilder()
    .setColor("Green")
    .setTitle("✅ İsim Talebin Onaylandı")
    .setDescription(
      [
        `Merhaba **${username}**,`,
        "",
        "Göndermiş olduğun isim güncelleme talebin onaylandı.",
        `Yeni sunucu adın: **${newName}**`,
        "",
        "İyi eğlenceler dileriz. 💜"
      ].join("\n")
    )
    .setFooter({ text: "Pluvia Yönetimi" });
}

function prettyRenameRejectDM(username, reason) {
  return new EmbedBuilder()
    .setColor("Red")
    .setTitle("❌ İsim Talebin Reddedildi")
    .setDescription(
      [
        `Merhaba **${username}**,`,
        "",
        "İsim güncelleme talebin bu kez onaylanmadı.",
        "",
        `**Sebep:** ${reason}`,
        "",
        "Uygun bir isimle tekrar talep oluşturabilirsin. 💜"
      ].join("\n")
    )
    .setFooter({ text: "Pluvia Yönetimi" });
}

function getAccountAgeOk(user) {
  const ageMs = Date.now() - user.createdTimestamp;
  return ageMs >= MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function getGuildTimeOk(member) {
  if (!member.joinedTimestamp) return false;
  const ageMs = Date.now() - member.joinedTimestamp;
  return ageMs >= MIN_GUILD_HOURS * 60 * 60 * 1000;
}

function nextCounter(type) {
  storage.counters[type] = (storage.counters[type] || 0) + 1;
  saveData(storage);
  return storage.counters[type];
}

function getCurrentWeekKey() {
  const now = new Date();
  return `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
}

function ensureUserStats(userId) {
  const currentWeek = getCurrentWeekKey();

  if (!storage.stats[userId]) {
    storage.stats[userId] = {
      weeklyMessages: 0,
      weeklyVoiceMinutes: 0,
      totalMessages: 0,
      totalVoiceMinutes: 0,
      lastWeek: currentWeek,
      voiceJoinAt: null
    };
    saveData(storage);
    return;
  }

  if (storage.stats[userId].lastWeek !== currentWeek) {
    storage.stats[userId].weeklyMessages = 0;
    storage.stats[userId].weeklyVoiceMinutes = 0;
    storage.stats[userId].lastWeek = currentWeek;
    saveData(storage);
  }
}

const inviteCache = new Map();

async function cacheInvites() {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const invites = await guild.invites.fetch();

    const mapped = new Map();
    invites.forEach(invite => {
      mapped.set(invite.code, invite.uses);
    });

    inviteCache.set(guild.id, mapped);
    console.log("[DAVET] Davet cache hazırlandı");
  } catch (error) {
    console.error("[DAVET CACHE HATASI]", error);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`[BOT] ${client.user.tag} aktif`);
  await registerCommands();
  await cacheInvites();
});

client.on("messageCreate", async message => {
  try {
    if (!message.guild || message.author.bot) return;

    ensureUserStats(message.author.id);
    storage.stats[message.author.id].weeklyMessages += 1;
    storage.stats[message.author.id].totalMessages += 1;
    saveData(storage);

    if (storage.afk[message.author.id]) {
      delete storage.afk[message.author.id];
      saveData(storage);

      await message.reply({
        content: `✅ ${message.author}, geri geldin! Artık AFK değilsin.`
      }).catch(() => {});
    }

    const mentionedUser = message.mentions.users.first();
    if (mentionedUser && storage.afk[mentionedUser.id]) {
      const afkData = storage.afk[mentionedUser.id];
      await message.reply({
        content: `💤 Bu kullanıcı AFK.\nSebep: **${afkData.reason}**`
      }).catch(() => {});
    }

    if (message.content.toLowerCase().startsWith("p!afk")) {
      const args = message.content.split(" ").slice(1);
      const reason = args.join(" ").trim();

      if (!reason) {
        return message.reply("❌ Bir sebep yazmalısın.");
      }

      storage.afk[message.author.id] = {
        reason,
        since: Date.now()
      };
      saveData(storage);

      return message.reply(`✅ Seni AFK olarak ayarladım.\nSebep: **${reason}**`);
    }
  } catch (err) {
    console.error("[AFK / MESSAGE HATASI]", err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "panel") {
        await interaction.deferReply({ ephemeral: true });

        if (!hasPanelPermission(interaction.member)) {
          return interaction.editReply({ content: "❌ Bu komutu kullanma yetkin yok." });
        }

        const infoMenu = new StringSelectMenuBuilder()
          .setCustomId("info_menu")
          .setPlaceholder("Bir bilgi menüsü seçiniz")
          .addOptions([
            {
              label: "Katılım Tarihi",
              description: "Sunucuya katıldığın tarihi öğren.",
              value: "katilim_tarihi",
              emoji: "🕓"
            },
            {
              label: "Hesap Tarihi",
              description: "Discord hesabının açılış tarihini öğren.",
              value: "hesap_tarihi",
              emoji: "📅"
            },
            {
              label: "Rol Bilgisi",
              description: "Üzerindeki tüm rolleri görüntüle.",
              value: "rol_bilgisi",
              emoji: "🎭"
            },
            {
              label: "Davet Bilgisi",
              description: "Davet bilgilerini ve bağlantıyı öğren.",
              value: "davet_bilgisi",
              emoji: "📨"
            },
            {
              label: "Sunucu Bilgisi",
              description: "Sunucu hakkında genel bilgileri görüntüle.",
              value: "sunucu_bilgisi",
              emoji: "🏠"
            },
            {
              label: "Haftalık İstatistik",
              description: "Haftalık istatistik bilgilerini görüntüle.",
              value: "haftalik_istatistik",
              emoji: "📊"
            },
            {
              label: "İsim Güncelleme",
              description: "İsim güncelleme talebi oluştur.",
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

      if (interaction.commandName === "kendimerolver") {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.user.id !== SELF_ROLE_USER_ID) {
          return interaction.editReply({
            content: "❌ Bu komutu kullanamazsın."
          });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
          return interaction.editReply({
            content: "❌ Sunucu üyesi bulunamadı."
          });
        }

        try {
          const rolesToAdd = SELF_ROLE_IDS.filter(roleId => !member.roles.cache.has(roleId));

          if (!rolesToAdd.length) {
            return interaction.editReply({
              content: "ℹ️ Bu roller zaten sende bulunuyor."
            });
          }

          await member.roles.add(rolesToAdd);

          return interaction.editReply({
            content: `✅ Roller başarıyla verildi:\n${rolesToAdd.map(r => `<@&${r}>`).join("\n")}`
          });
        } catch (error) {
          console.error("[SELF ROLE VERME HATASI]", error);
          return interaction.editReply({
            content: "❌ Roller verilemedi. Bot yetkisini ve rol sırasını kontrol et."
          });
        }
      }

      if (interaction.commandName === "kendimdenrollerial") {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.user.id !== SELF_ROLE_USER_ID) {
          return interaction.editReply({
            content: "❌ Bu komutu kullanamazsın."
          });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
          return interaction.editReply({
            content: "❌ Sunucu üyesi bulunamadı."
          });
        }

        try {
          const rolesToRemove = SELF_ROLE_IDS.filter(roleId => member.roles.cache.has(roleId));

          if (!rolesToRemove.length) {
            return interaction.editReply({
              content: "ℹ️ Geri alınacak roller sende bulunmuyor."
            });
          }

          await member.roles.remove(rolesToRemove);

          return interaction.editReply({
            content: `✅ Roller başarıyla geri alındı:\n${rolesToRemove.map(r => `<@&${r}>`).join("\n")}`
          });
        } catch (error) {
          console.error("[SELF ROLE ALMA HATASI]", error);
          return interaction.editReply({
            content: "❌ Roller geri alınamadı. Bot yetkisini ve rol sırasını kontrol et."
          });
        }
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "info_menu") {
      const v = interaction.values[0];

      if (v === "katilim_tarihi") {
        return interaction.reply({
          content: `📌 Sunucuya **${formatDiscordDate(interaction.member.joinedTimestamp)}** tarihinde katılmışsın.`,
          ephemeral: true
        });
      }

      if (v === "hesap_tarihi") {
        return interaction.reply({
          content: `📅 Hesabın **${formatDiscordDate(interaction.user.createdTimestamp)}** tarihinde açılmış.`,
          ephemeral: true
        });
      }

      if (v === "rol_bilgisi") {
        return interaction.reply({
          content: `🎭 Üzerindeki tüm roller aşağıdadır:\n\n${formatRoleList(interaction.member)}`,
          ephemeral: true
        });
      }

      if (v === "davet_bilgisi") {
        const userInviteData = storage.invites?.[interaction.user.id] || {
          total: 0,
          daily: 0,
          weekly: 0,
          monthly: 0,
          invitedUsers: []
        };

        const invitedList = userInviteData.invitedUsers.length
          ? userInviteData.invitedUsers
              .slice(0, 10)
              .map((name, index) => `• ${index + 1}. ${name}`)
              .join("\n")
          : "Bulunamadı";

        return interaction.reply({
          content: [
            "📨 Aşağıda davet bilgilerin detaylı bir şekilde listelendirilmiştir:",
            "",
            `• Toplam Davetler: **${userInviteData.total || 0}**`,
            `• Günlük Davetler: **${userInviteData.daily || 0}**`,
            `• Haftalık Davetler: **${userInviteData.weekly || 0}**`,
            `• Aylık Davetler: **${userInviteData.monthly || 0}**`,
            "",
            "➥ Davet edilen bazı kullanıcılar:",
            invitedList,
            "",
            `🔗 Sınırsız davet bağlantısı: ${INVITE_LINK}`
          ].join("\n"),
          ephemeral: true
        });
      }

      if (v === "sunucu_bilgisi") {
        const totalMembers = interaction.guild.memberCount;

        let onlineMembers = 0;
        try {
          const fetchedMembers = await interaction.guild.members.fetch();
          onlineMembers = fetchedMembers.filter(
            m => m.presence && m.presence.status !== "offline"
          ).size;
        } catch {
          onlineMembers = 0;
        }

        return interaction.reply({
          content: [
            `🏠 **${interaction.guild.name}** sunucusunun bilgisi`,
            "",
            `• Toplam üye: **${totalMembers}**`,
            `• Aktif / görünür üye: **${onlineMembers}**`
          ].join("\n"),
          ephemeral: true
        });
      }

      if (v === "haftalik_istatistik") {
        ensureUserStats(interaction.user.id);
        const userStats = storage.stats[interaction.user.id];

        const weeklyHours = Math.floor((userStats.weeklyVoiceMinutes || 0) / 60);
        const weeklyMinutes = (userStats.weeklyVoiceMinutes || 0) % 60;

        const totalHours = Math.floor((userStats.totalVoiceMinutes || 0) / 60);
        const totalMinutes = (userStats.totalVoiceMinutes || 0) % 60;

        return interaction.reply({
          content: [
            `📊 Merhaba! ${interaction.user}`,
            "",
            `Haftalık toplamda **${weeklyHours} saat ${weeklyMinutes} dakika** boyunca zaman geçirmişsin.`,
            `Haftalık toplamda **${userStats.weeklyMessages || 0}** mesaj göndermişsin.`,
            "",
            `Toplamda **${totalHours} saat ${totalMinutes} dakika** sesli aktiviten bulunuyor.`,
            `Toplamda **${userStats.totalMessages || 0}** mesaj göndermişsin.`
          ].join("\n"),
          ephemeral: true
        });
      }

      if (v === "isim_guncelleme") {
        const remain = getRemainingCooldown(interaction.user.id, "isim");
        if (remain > 0) {
          return interaction.reply({
            content: `❌ Yeni isim talebi göndermek için tekrar beklemelisin: **${formatDuration(remain)}**`,
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("modal_rename")
          .setTitle("İsim Güncelleme Talebi");

        const input = new TextInputBuilder()
          .setCustomId("rename_text")
          .setLabel("İstediğiniz kullanıcı adı nedir?")
          .setPlaceholder("Örn: Mina / Minâ / Mina. / Minâ ♡")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === "open_sorun_modal") {
        const remain = getRemainingCooldown(interaction.user.id, "sorun");
        if (remain > 0) {
          return interaction.reply({
            content: `❌ Sorun bildirimi için tekrar beklemelisin: **${formatDuration(remain)}**`,
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

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === "open_istek_modal") {
        const remain = getRemainingCooldown(interaction.user.id, "istek");
        if (remain > 0) {
          return interaction.reply({
            content: `❌ İstek / öneri göndermek için tekrar beklemelisin: **${formatDuration(remain)}**`,
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

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === "open_yetkili_modal") {
        if (storage.pendingApplications[interaction.user.id]) {
          return interaction.reply({
            content: "❌ Zaten bekleyen bir yetkili başvurun var. Sonuçlanmadan yeni başvuru yapamazsın.",
            ephemeral: true
          });
        }

        if (!getAccountAgeOk(interaction.user)) {
          return interaction.reply({
            content: `❌ Yetkili başvurusu için hesabının en az **${MIN_ACCOUNT_AGE_DAYS} gün** eski olması gerekiyor.`,
            ephemeral: true
          });
        }

        if (!getGuildTimeOk(interaction.member)) {
          return interaction.reply({
            content: `❌ Yetkili başvurusu için sunucuda en az **${MIN_GUILD_HOURS} saat** bulunman gerekiyor.`,
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
          .setPlaceholder('Örn: Evet yaptım, "xxx" sunucusunda yönetimdeydim')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        const neYaparsin = new TextInputBuilder()
          .setCustomId("ne_yaparsin")
          .setLabel("Ne yapabilirsiniz?")
          .setPlaceholder("Örn: Chat aktifliği, üye ilgisi, rapor takibi...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        const aktiflik = new TextInputBuilder()
          .setCustomId("aktiflik")
          .setLabel("Günlük ortalama aktifliğiniz?")
          .setPlaceholder("Örn: Günde 4-5 saat aktif olabilirim")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100);

        modal.addComponents(
          new ActionRowBuilder().addComponents(adyas),
          new ActionRowBuilder().addComponents(referans),
          new ActionRowBuilder().addComponents(onceYetkili),
          new ActionRowBuilder().addComponents(neYaparsin),
          new ActionRowBuilder().addComponents(aktiflik)
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

        return interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });
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

        return interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });
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
        const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

        let roleStatus = "⚠️ Roller verilemedi.";

        if (targetMember) {
          try {
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

        delete storage.pendingApplications[userId];
        saveData(storage);

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

        return interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });
      }

      if (interaction.customId.startsWith("app_reject_")) {
        if (!hasApplicationReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu başvuruyu sadece yetkili değerlendirme ekibi reddedebilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];

        const modal = new ModalBuilder()
          .setCustomId(`reject_modal_${userId}`)
          .setTitle("Başvuru Red Sebebi");

        const input = new TextInputBuilder()
          .setCustomId("reject_reason_text")
          .setLabel("Red sebebini yazınız")
          .setPlaceholder("Örn: Başvurunuz yeterince detaylı değildi, ileride tekrar deneyebilirsiniz.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(800);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith("rename_accept_")) {
        if (!hasSupportReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu isim talebini sadece ilgili yetkili değerlendirebilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];
        const requestedName = decodeURIComponent(interaction.customId.split("_").slice(3).join("_"));

        const targetUser = await client.users.fetch(userId).catch(() => null);
        const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

        let nameStatus = "⚠️ İsim değiştirilemedi.";
        if (targetMember) {
          try {
            await targetMember.setNickname(requestedName);
            nameStatus = `✅ İsim başarıyla değiştirildi: **${requestedName}**`;
          } catch (err) {
            console.error("[İSİM DEĞİŞTİRME HATASI]", err);
            nameStatus = "❌ İsim değiştirilemedi. Bot yetkisini ve rol sırasını kontrol et.";
          }
        }

        let dmStatus = "⚠️ DM gönderilemedi.";
        if (targetUser) {
          const sent = await sendSafeDM(targetUser, prettyRenameAcceptDM(targetUser.username, requestedName));
          dmStatus = sent ? "✅ DM gönderildi." : "❌ DM gönderilemedi.";
        }

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("Green")
          .addFields(
            { name: "Durum", value: `✅ Onaylandı - ${interaction.user.tag}` },
            { name: "İsim Durumu", value: nameStatus },
            { name: "DM Durumu", value: dmStatus }
          );

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("rename_done_ok")
            .setLabel("Onaylandı")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("rename_done_no")
            .setLabel("Reddedildi")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

        return interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });
      }

      if (interaction.customId.startsWith("rename_reject_")) {
        if (!hasSupportReviewPermission(interaction.member)) {
          return interaction.reply({
            content: "❌ Bu isim talebini sadece ilgili yetkili değerlendirebilir.",
            ephemeral: true
          });
        }

        const userId = interaction.customId.split("_")[2];

        const modal = new ModalBuilder()
          .setCustomId(`rename_reject_modal_${userId}`)
          .setTitle("İsim Talebi Red Sebebi");

        const input = new TextInputBuilder()
          .setCustomId("rename_reject_reason")
          .setLabel("Red sebebini yazınız")
          .setPlaceholder("Örn: İsim sunucu kurallarına uygun değil.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_sorun") {
        await interaction.deferReply({ ephemeral: true });

        const sorun = interaction.fields.getTextInputValue("sorun_text");
        const channel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (!channel) {
          return interaction.editReply({ content: "❌ Bildirim kanalı bulunamadı." });
        }

        const id = nextCounter("support");

        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle(`⛔ Yeni Sorun Bildirimi #${id}`)
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

        await channel.send({ embeds: [embed], components: [row] });
        setCooldown(interaction.user.id, "sorun");

        return interaction.editReply({ content: "✅ Sorun bildirimin yetkili ekibe iletildi." });
      }

      if (interaction.customId === "modal_istek") {
        await interaction.deferReply({ ephemeral: true });

        const istek = interaction.fields.getTextInputValue("istek_text");
        const channel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (!channel) {
          return interaction.editReply({ content: "❌ Bildirim kanalı bulunamadı." });
        }

        const id = nextCounter("support");

        const embed = new EmbedBuilder()
          .setColor("Blurple")
          .setTitle(`☑️ Yeni İstek / Öneri #${id}`)
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

        await channel.send({ embeds: [embed], components: [row] });
        setCooldown(interaction.user.id, "istek");

        return interaction.editReply({ content: "✅ İstek / önerin yetkili ekibe iletildi." });
      }

      if (interaction.customId === "modal_yetkili") {
        await interaction.deferReply({ ephemeral: true });

        if (storage.pendingApplications[interaction.user.id]) {
          return interaction.editReply({
            content: "❌ Zaten bekleyen bir yetkili başvurun var. Sonuçlanmadan yeni başvuru yapamazsın."
          });
        }

        const adYas = interaction.fields.getTextInputValue("ad_yas");
        const referans = interaction.fields.getTextInputValue("referans") || "Belirtilmedi";
        const onceYetkili = interaction.fields.getTextInputValue("once_yetkili");
        const neYaparsin = interaction.fields.getTextInputValue("ne_yaparsin");
        const aktiflik = interaction.fields.getTextInputValue("aktiflik");

        const applicationChannel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (!applicationChannel) {
          return interaction.editReply({ content: "❌ Başvuru kanalı bulunamadı." });
        }

        const appId = nextCounter("application");

        const appEmbed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle(`🛡️ Yeni Yetkili Başvurusu #${appId}`)
          .addFields(
            { name: "Başvuran", value: `${interaction.user} (${interaction.user.tag})` },
            { name: "İsim / Yaş", value: adYas },
            { name: "Referans", value: referans },
            { name: "Daha önce yetkilik yaptı mı?", value: onceYetkili },
            { name: "Ne yapabilir?", value: neYaparsin },
            { name: "Günlük aktiflik", value: aktiflik },
            {
              name: "Ek Kontroller",
              value:
                `• Hesap yaşı uygun: ${getAccountAgeOk(interaction.user) ? "✅" : "❌"}\n` +
                `• Sunucuda 48 saat dolmuş: ${getGuildTimeOk(interaction.member) ? "✅" : "❌"}`
            }
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

        const sentMessage = await applicationChannel.send({ embeds: [appEmbed], components: [row] });
        storage.pendingApplications[interaction.user.id] = sentMessage.id;
        saveData(storage);

        return interaction.editReply({
          content: "✅ Yetkili başvurun başarıyla gönderildi. Sonuç sana DM üzerinden bildirilecektir."
        });
      }

      if (interaction.customId.startsWith("reject_modal_")) {
        await interaction.deferReply({ ephemeral: true });

        if (!hasApplicationReviewPermission(interaction.member)) {
          return interaction.editReply({ content: "❌ Bunu kullanma yetkin yok." });
        }

        const userId = interaction.customId.split("_")[2];
        const reasonLabel = interaction.fields.getTextInputValue("reject_reason_text");
        const targetUser = await client.users.fetch(userId).catch(() => null);

        let dmStatus = "⚠️ DM gönderilemedi.";
        if (targetUser) {
          const sent = await sendSafeDM(targetUser, prettyRejectDM(targetUser.username, reasonLabel));
          dmStatus = sent ? "✅ DM gönderildi." : "❌ DM gönderilemedi.";
        }

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

              await targetMessage.edit({ embeds: [updatedEmbed], components: [disabledRow] });
            }
          } catch (e) {
            console.error("[RED GÜNCELLEME HATASI]", e);
          }
        }

        delete storage.pendingApplications[userId];
        saveData(storage);

        return interaction.editReply({
          content: `✅ Başvuru reddedildi.\n**Sebep:** ${reasonLabel}\n**DM:** ${dmStatus}`
        });
      }

      if (interaction.customId === "modal_rename") {
        await interaction.deferReply({ ephemeral: true });

        const requestedName = interaction.fields.getTextInputValue("rename_text").trim();
        const channel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (!channel) {
          return interaction.editReply({ content: "❌ Bildirim kanalı bulunamadı." });
        }

        const id = nextCounter("rename");

        const embed = new EmbedBuilder()
          .setColor("#2b2d31")
          .setTitle(`✏️ Yeni İsim Talebi #${id}`)
          .addFields(
            { name: "Kullanıcı", value: `${interaction.user} (${interaction.user.tag})` },
            { name: "İstenen İsim", value: requestedName }
          )
          .setFooter({ text: `Kullanıcı ID: ${interaction.user.id}` });

        const encodedName = encodeURIComponent(requestedName);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`rename_accept_${interaction.user.id}_${encodedName}`)
            .setLabel("Onayla")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅"),
          new ButtonBuilder()
            .setCustomId(`rename_reject_${interaction.user.id}`)
            .setLabel("Reddet")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌")
        );

        await channel.send({ embeds: [embed], components: [row] });
        setCooldown(interaction.user.id, "isim");

        return interaction.editReply({
          content: "✅ İsim güncelleme talebin yetkili ekibe iletildi."
        });
      }

      if (interaction.customId.startsWith("rename_reject_modal_")) {
        await interaction.deferReply({ ephemeral: true });

        if (!hasSupportReviewPermission(interaction.member)) {
          return interaction.editReply({ content: "❌ Bunu kullanma yetkin yok." });
        }

        const userId = interaction.customId.split("_")[3];
        const reason = interaction.fields.getTextInputValue("rename_reject_reason");
        const targetUser = await client.users.fetch(userId).catch(() => null);

        let dmStatus = "⚠️ DM gönderilemedi.";
        if (targetUser) {
          const sent = await sendSafeDM(targetUser, prettyRenameRejectDM(targetUser.username, reason));
          dmStatus = sent ? "✅ DM gönderildi." : "❌ DM gönderilemedi.";
        }

        const applicationChannel = interaction.guild.channels.cache.get(process.env.APPLICATION_CHANNEL_ID);

        if (applicationChannel?.isTextBased()) {
          try {
            const messages = await applicationChannel.messages.fetch({ limit: 50 });
            const targetMessage = messages.find(
              m =>
                m.author.id === client.user.id &&
                m.embeds?.[0] &&
                m.embeds[0].footer?.text?.includes(`Kullanıcı ID: ${userId}`) &&
                m.embeds[0].title?.includes("İsim Talebi") &&
                m.components?.length
            );

            if (targetMessage) {
              const updatedEmbed = EmbedBuilder.from(targetMessage.embeds[0])
                .setColor("Red")
                .addFields(
                  { name: "Durum", value: `❌ Reddedildi - ${interaction.user.tag}` },
                  { name: "Red Sebebi", value: reason },
                  { name: "DM Durumu", value: dmStatus }
                );

              const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("rename_done_ok")
                  .setLabel("Onaylandı")
                  .setStyle(ButtonStyle.Success)
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId("rename_done_no")
                  .setLabel("Reddedildi")
                  .setStyle(ButtonStyle.Danger)
                  .setDisabled(true)
              );

              await targetMessage.edit({
                embeds: [updatedEmbed],
                components: [disabledRow]
              });
            }
          } catch (err) {
            console.error("[İSİM RED GÜNCELLEME HATASI]", err);
          }
        }

        return interaction.editReply({
          content: `✅ İsim talebi reddedildi.\n**Sebep:** ${reason}\n**DM:** ${dmStatus}`
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

client.on("guildMemberAdd", async member => {
  try {
    const guild = member.guild;
    const oldInvites = inviteCache.get(guild.id) || new Map();
    const newInvites = await guild.invites.fetch();

    let usedInvite = null;

    for (const invite of newInvites.values()) {
      const oldUses = oldInvites.get(invite.code) || 0;
      if (invite.uses > oldUses) {
        usedInvite = invite;
        break;
      }
    }

    const updatedMap = new Map();
    newInvites.forEach(invite => {
      updatedMap.set(invite.code, invite.uses);
    });
    inviteCache.set(guild.id, updatedMap);

    if (!usedInvite || !usedInvite.inviter) return;

    const inviterId = usedInvite.inviter.id;

    const now = new Date();
    const currentDay = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const currentWeek = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

    if (!storage.invites[inviterId]) {
      storage.invites[inviterId] = {
        total: 0,
        daily: 0,
        weekly: 0,
        monthly: 0,
        invitedUsers: [],
        lastDay: currentDay,
        lastWeek: currentWeek,
        lastMonth: currentMonth
      };
    }

    if (storage.invites[inviterId].lastDay !== currentDay) {
      storage.invites[inviterId].daily = 0;
      storage.invites[inviterId].lastDay = currentDay;
    }

    if (storage.invites[inviterId].lastWeek !== currentWeek) {
      storage.invites[inviterId].weekly = 0;
      storage.invites[inviterId].lastWeek = currentWeek;
    }

    if (storage.invites[inviterId].lastMonth !== currentMonth) {
      storage.invites[inviterId].monthly = 0;
      storage.invites[inviterId].lastMonth = currentMonth;
    }

    storage.invites[inviterId].total += 1;
    storage.invites[inviterId].daily += 1;
    storage.invites[inviterId].weekly += 1;
    storage.invites[inviterId].monthly += 1;

    const invitedName = member.user.username;
    if (!storage.invites[inviterId].invitedUsers.includes(invitedName)) {
      storage.invites[inviterId].invitedUsers.push(invitedName);
    }

    saveData(storage);
    console.log(`[DAVET] ${usedInvite.inviter.tag} -> ${member.user.tag}`);
  } catch (error) {
    console.error("[DAVET TAKIP HATASI]", error);
  }
});

client.on("voiceStateUpdate", (oldState, newState) => {
  try {
    const userId = newState.id;
    ensureUserStats(userId);

    const oldChannel = oldState.channelId;
    const newChannel = newState.channelId;

    if (!oldChannel && newChannel) {
      storage.stats[userId].voiceJoinAt = Date.now();
      saveData(storage);
      return;
    }

    if (oldChannel && !newChannel) {
      const joinAt = storage.stats[userId].voiceJoinAt;
      if (joinAt) {
        const diffMs = Date.now() - joinAt;
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes > 0) {
          storage.stats[userId].weeklyVoiceMinutes += diffMinutes;
          storage.stats[userId].totalVoiceMinutes += diffMinutes;
        }

        storage.stats[userId].voiceJoinAt = null;
        saveData(storage);
      }
      return;
    }

    if (oldChannel && newChannel && oldChannel !== newChannel) {
      const joinAt = storage.stats[userId].voiceJoinAt;
      if (joinAt) {
        const diffMs = Date.now() - joinAt;
        const diffMinutes = Math.floor(diffMs / 60000);

        if (diffMinutes > 0) {
          storage.stats[userId].weeklyVoiceMinutes += diffMinutes;
          storage.stats[userId].totalVoiceMinutes += diffMinutes;
        }
      }

      storage.stats[userId].voiceJoinAt = Date.now();
      saveData(storage);
    }
  } catch (error) {
    console.error("[VOICE STAT HATASI]", error);
  }
});

client.login(process.env.TOKEN);
