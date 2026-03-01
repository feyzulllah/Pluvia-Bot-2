module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ ${client.user.tag} Gelişmiş Sistemlerle Aktif!`);
        client.user.setActivity('!yardım | Pluvia V2');
    },
};
