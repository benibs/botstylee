import db from '../lib/database.js'
import { proto, generateWAMessage, areJidsSameUser } from '@whiskeysockets/baileys'

export async function all(m, chatUpdate) {
	if (m.isBaileys || !m.message || !m.msg || !m.msg.fileSha256) return
	const stickerCommands = db.data?.sticker || {}
	const hash = Buffer.from(m.msg.fileSha256).toString('base64')
	if (!(hash in stickerCommands)) return

	const { text, mentionedJid = [] } = stickerCommands[hash]
	const message = await generateWAMessage(m.chat, { text, mentions: mentionedJid }, {
		userJid: this.user.id || this.user.jid,
		quoted: m.quoted && m.quoted.fakeObj
	})
	message.key.fromMe = areJidsSameUser(m.sender, this.user.id || this.user.jid)
	message.key.id = m.key.id
	message.pushName = m.pushName
	if (m.isGroup) message.key.participant = message.participant = m.sender

	this.ev.emit('messages.upsert', {
		...chatUpdate,
		messages: [proto.WebMessageInfo.fromObject(message)],
		type: 'append'
	})
}
