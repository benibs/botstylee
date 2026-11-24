import levelling from '../lib/levelling.js'

var handler = async (m, { conn }) => {
	var user = db.data.users[m.sender]
	if (!user) throw 'Data pengguna belum tersedia.'

	var name = m.pushName || conn.getName(m.sender) || m.sender.split('@')[0]
	var min = levelling.xpRange(user.level, global.multiplier).min
	var { xp, max } = levelling.xpRange(user.level, global.multiplier)

	if (!levelling.canLevelUp(user.level, user.exp, global.multiplier)) {
		return conn.reply(m.chat, `${sa}${kki} To Level Up ${kka}\n${gy} Nama: *${name}*\n${gy} Level: *${user.level}*\n${gy} Exp: ( *${user.exp - min}/${xp}* )\n${gy} Kurang *${max - user.exp}* Exp lagi levelup!\n${sb}`.trim(), m)
	}

	var before = Number(user.level) || 0
	while (levelling.canLevelUp(user.level, user.exp, global.multiplier)) user.level++
	if (before === user.level) return

	var randomReward = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
	if (user.level < 50) user.exp += randomReward(50, 1000)
	else if (user.level < 100) user.exp += randomReward(500, 3000)
	else user.exp += randomReward(3000, 10000)

	if (user.level % 60 === 0) {
		user.ruby = (user.ruby || 0) + Math.floor(user.level / 60)
		user.coin = (user.coin || 0) + Math.floor(user.level / 60) * 8
		user.limit = (user.limit || 0) + 8 + Math.floor(user.level / 60) * 4
		user.mp = (user.mp || 0) + 2000 + Math.floor(user.level / 60) * 5000
	} else if (user.level % 30 === 0) {
		user.coin = (user.coin || 0) + Math.floor(user.level / 30) * 5
		user.limit = (user.limit || 0) + 3 + Math.floor(user.level / 30) * 2
		user.mp = (user.mp || 0) + 2000 + Math.floor(user.level / 30) * 3000
	} else {
		user.limit = (user.limit || 0) + 3
		user.mp = (user.mp || 0) + 1000 + user.level * 100
	}

	await conn.reply(m.chat, `${sa}${kki} Level Up ${kka}\n${gy} Nama: *${name}*\n${gy} Level sebelumnya: *${before}*\n${gy} Level sekarang: *${user.level}*\n${sb}`, m)
}

handler.help = ['levelup']
handler.tags = ['tools']
handler.command = /^levelup$/i

export default handler
