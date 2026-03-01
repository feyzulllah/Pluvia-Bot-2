module.exports = {
    name: 'temizle',
    description: 'Belirtilen miktarda mesajı siler.',
    slash: true, // Slash desteği aktif
    options: [{
        name: 'sayı',
        description: 'Silinecek mesaj sayısı (1-100)',
        type: 4, // Integer (Tam Sayı)
        required: true
    }],
    async execute(message, args, client) {
        // Bu kısım hem normal mesaj hem de slash için ortak çalışır
        const isSlash = !message.content; 
        const sayi = isSlash ? message.options.getInteger('sayı') : parseInt(args[0]);
        
        if (!message.member.permissions.has('ManageMessages')) return message.reply('Yetkin yok!');
        if (!sayi || sayi < 1 || sayi > 100) return message.reply('1-100 arası bir sayı gir.');

        await (isSlash ? message.channel : message.channel).bulkDelete(sayi);
        const reply = `✅ **${sayi}** mesaj silindi.`;
        
        if (isSlash) message.reply({ content: reply, ephemeral: true });
        else message.channel.send(reply).then(m => setTimeout(() => m.delete(), 3000));
    }
};
