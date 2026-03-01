const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const express = require('express');

// --- 7/24 AKTİF TUTMA SİSTEMİ ---
const app = express();
app.get('/', (req, res) => res.send('Pluvia V2 Profesyonel Altyapı Aktif!'));
app.listen(3000, () => console.log('✅ Web sunucusu UptimeRobot için hazır!'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // Ses istatistikleri için şart!
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Komutları saklamak için bir koleksiyon oluşturuyoruz
client.commands = new Collection();

// --- AYARLAR ---
const config = require('./config.json');

// --- KOMUT VE EVENT YÜKLEYİCİ (Handler) ---

// Komutları Yükle
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

// Olayları (Events) Yükle
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

client.login(process.env.TOKEN); // Token Render üzerinden gelecek
