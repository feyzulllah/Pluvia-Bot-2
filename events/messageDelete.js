const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: 'messageDelete',
    async execute(message) {
        if (message.author.bot) return;

        // Log Kanalı (ID: 1477624714208739458)
        const logKanal = message.guild.channels.cache.get(config.modLog);
        if (!logKanal) return;

        const embed = new EmbedBuilder()
            .setColor('#ff3366')
            .setTitle('🗑️ Mesaj Silindi')
            .addFields(
                { name: 'Kullanıcı', value: `${message.author.tag}`, inline: true },
                { name: 'Kanal', value: `${message.channel}`, inline: true },
                { name: 'İçerik', value: `\`${message.content || "Resim/Dosya"}\`` }
            )
            .setTimestamp();

        logKanal.send({ embeds: [embed] });
    },
};
