import db from '../lib/database.js'

var handler = async (m, { conn }) => {
	var sticker = db.data.sticker || (db.data.sticker = {})
	var entries = Object.entries(sticker)
	var mentions = Object.values(sticker).flatMap(item => item.mentionedJid || [])
	conn.reply(m.chat, `
*DAFTAR HASH*
\`\`\`
${entries.map(([key, value], index) => `${index + 1}. ${value.locked ? `(Terkunci) ${key}` : key} : ${value.text}`).join('\n')}
\`\`\`
`.trim(), null, { mentions })
}

handler.help = ['listcmd']
handler.tags = ['tools']
handler.command = ['listcmd']

export default handler
