const config = require('../config.json');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        // 1. Rolü Verme
        const rol1 = member.guild.roles.cache.get(config.otoRol1);
        if (rol1) await member.roles.add(rol1).catch(() => console.log("1. Rol yetkim yetersiz."));

        // 2. Rolü Verme
        const rol2 = member.guild.roles.cache.get(config.otoRol2);
        if (rol2) await member.roles.add(rol2).catch(() => console.log("2. Rol yetkim yetersiz."));

        // Hoş Geldin Mesajı
        const kanal = member.guild.channels.cache.get(config.hgKanal);
        if (kanal) {
            kanal.send({ content: `📥 **${member.user.tag}** Hoşgeldin kingo Seninle birlikte **${member.guild.memberCount}** kişiyiz.` });
        }
    },
};
