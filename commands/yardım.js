const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'yardım',
    description: 'Botun komut listesini gösterir.',
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#ff3366')
            .setTitle('📚 Pluvia V2 Menü')
            .setDescription('Tüm komutlar artık `/` ile çalışır!')
            .addFields(
                { name: '🧹 Moderasyon', value: '`/temizle`' },
                { name: 'ℹ️ Bilgi', value: '`/yardım`' }
            );

        return interaction.reply({ embeds: [embed] });
    }
};
