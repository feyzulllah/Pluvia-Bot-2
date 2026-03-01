const config = require('../config.json');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        // Otorol Verme (ID: 1477624928856571914)
        const rol = member.guild.roles.cache.get(config.otoRol);
        if (rol) await member.roles.add(rol).catch(() => console.log("Rol yetkim yetersiz."));

        // Hoş Geldin Mesajı (ID: 1477626275269972000)
        const kanal = member.guild.channels.cache.get(config.hgKanal);
        if (kanal) {
            kanal.send({ content: `📥 **${member.user.tag}** sunucumuza katıldı! Sunucumuz artık **${member.guild.memberCount}** kişi.` });
        }
    },
};
