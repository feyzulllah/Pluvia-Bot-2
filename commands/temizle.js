const { PermissionFlagsBits, ApplicationCommandOptionType } = require('discord.js');

module.exports = {
    name: 'temizle',
    description: 'Kanaldaki mesajları toplu siler.',
    options: [
        {
            name: 'sayı',
            description: 'Silinecek miktar (1-100)',
            type: ApplicationCommandOptionType.Integer,
            required: true
        }
    ],
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: '❌ Yetkin yok!', ephemeral: true });
        }

        const sayi = interaction.options.getInteger('sayı');
        await interaction.channel.bulkDelete(sayi);
        return interaction.reply({ content: `✅ **${sayi}** mesaj silindi.`, ephemeral: true });
    }
};
