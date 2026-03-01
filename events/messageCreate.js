const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'yardım',
    execute(message, args) {
        const embed = new EmbedBuilder()
            .setColor('#ff3366')
            .setTitle('📚 Pluvia V2 Komut Menüsü')
            .setDescription('Şu an aktif olan sistemler:')
            .addFields(
                { name: '🧹 Moderasyon', value: '`!temizle [sayı]`' },
                { name: '⚙️ Yakında', value: 'Bilet Sistemi, Otorol, İstatistikler' }
            )
            .setTimestamp();

        message.reply({ embeds: [embed] });
    },
};
