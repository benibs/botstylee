var axios = require('axios')

const DAY_MS = 24 * 60 * 60 * 1000
const COOLDOWN_KEY = 'followersigCooldown'
const inFlightUsers = new Set()
const inFlightAccounts = new Set()

function parseInstagramUsername(input) {
	var value = String(input || '').trim()
	if (/^https?:\/\//i.test(value)) {
		try {
			var url = new URL(value)
			if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return ''
			value = url.pathname.split('/').filter(Boolean)[0] || ''
		} catch {
			return ''
		}
	}
	value = value.replace(/^@/, '').trim()
	return /^[A-Za-z0-9._]{1,30}$/.test(value) ? value : ''
}

function getApiConfig() {
	var baseUrl = global.APIs?.chocodata || 'https://api.chocodata.com/api/v1/'
	var normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
	var apiKey = process.env.CHOCODATA_API_KEY || global.APIKeys?.[baseUrl] || global.APIKeys?.[normalizedBase]
	return { baseUrl: normalizedBase, apiKey }
}

function summarizeResponse(data, username) {
	var result = data?.data ?? data?.result ?? data
	var lines = ['*「 INSTAGRAM FOLLOWERS 」*', '', `*Akun:* @${username}`]
	var count = result?.followerCount ?? result?.follower_count ?? result?.followersCount ?? result?.followers_count
	if (count !== undefined && count !== null) lines.push(`*Follower:* ${Number(count).toLocaleString('id-ID')}`)

	var followers = Array.isArray(result) ? result :
		(Array.isArray(result?.users) ? result.users :
		Array.isArray(result?.followers) ? result.followers :
		Array.isArray(result?.items) ? result.items : null)

	if (followers) {
		lines.push(`*Data diterima:* ${followers.length}`)
		followers.slice(0, 30).forEach((item, index) => {
			var handle = item?.username || item?.user_name || item?.handle
			var displayName = item?.full_name || item?.fullName || item?.name
			if (handle || displayName) {
				lines.push(`${index + 1}. ${handle ? `@${String(handle).slice(0, 60)}` : String(displayName).slice(0, 60)}${displayName && handle ? ` (${String(displayName).slice(0, 60)})` : ''}`)
			}
		})
	}

	var nextCursor = result?.next_max_id ?? result?.nextMaxId ?? result?.max_id ?? result?.next_cursor
	if (nextCursor) lines.push('', `*Cursor berikutnya:* ${String(nextCursor).slice(0, 200)}`)

	if (lines.length === 3) {
		var readable = JSON.stringify(result, null, 2)
		if (readable) lines.push('', '```json', readable.slice(0, 2500), '```')
	}
	return lines.join('\n')
}

var handler = async (m, { conn, text, args, usedPrefix = '.', command = 'followersig' }) => {
	var inputParts = String(text || args?.join(' ') || '').trim().split(/\s+/).filter(Boolean)
	if (!inputParts.length) {
		throw `Masukkan username atau link profil Instagram.\nContoh: ${usedPrefix}${command} beni_230\nUntuk mengambil halaman lanjutan: ${usedPrefix}${command} beni_230 <max_id>`
	}

	var username = parseInstagramUsername(inputParts[0])
	if (!username) throw 'Username atau link profil Instagram tidak valid.'
	var maxId = inputParts[1] || ''

	var database = global.db?.data
	if (!database) throw 'Database bot belum siap, coba lagi sebentar.'

	var { baseUrl, apiKey } = getApiConfig()
	if (!apiKey) throw 'API key Chocodata belum dikonfigurasi. Atur CHOCODATA_API_KEY atau API key Chocodata di config.js.'

	database.users = database.users || {}
	database.users[m.sender] = database.users[m.sender] || {}
	database.users[m.sender][COOLDOWN_KEY] = database.users[m.sender][COOLDOWN_KEY] || {}
	database.game = database.game || {}
	database.game[COOLDOWN_KEY] = database.game[COOLDOWN_KEY] || {}

	var now = Date.now()
	var accountKey = username.toLowerCase()
	var userCooldown = database.users[m.sender][COOLDOWN_KEY]
	var accountCooldown = database.game[COOLDOWN_KEY]
	var userLastUsed = Number(userCooldown.lastUsed) || 0
	var accountLastUsed = Number(accountCooldown[accountKey]) || 0

	if (now - userLastUsed < DAY_MS) {
		var waitHours = Math.ceil((DAY_MS - (now - userLastUsed)) / (60 * 60 * 1000))
		throw `Nomor WhatsApp ini sudah memakai fitur hari ini. Coba lagi sekitar ${waitHours} jam lagi.`
	}
	if (now - accountLastUsed < DAY_MS) {
		var accountWaitHours = Math.ceil((DAY_MS - (now - accountLastUsed)) / (60 * 60 * 1000))
		throw `Akun Instagram @${username} sudah dicek hari ini. Coba lagi sekitar ${accountWaitHours} jam lagi.`
	}
	if (inFlightUsers.has(m.sender)) throw 'Permintaan dari nomor WhatsApp ini sedang diproses.'
	if (inFlightAccounts.has(accountKey)) throw `Permintaan untuk @${username} sedang diproses.`

	inFlightUsers.add(m.sender)
	inFlightAccounts.add(accountKey)
	try {
		var endpoint = new URL('instagram/follower', baseUrl)
		endpoint.searchParams.set('api_key', apiKey)
		endpoint.searchParams.set('username', username)
		endpoint.searchParams.set('url', `https://www.instagram.com/${encodeURIComponent(username)}/`)
		endpoint.searchParams.set('count', '30')
		endpoint.searchParams.set('max_id', maxId)
		endpoint.searchParams.set('country', 'us')

		var response
		try {
			response = await axios.get(endpoint.toString(), {
				timeout: 30000,
				headers: { Accept: 'application/json' }
			})
		} catch (error) {
			var status = error.response?.status
			if (status) throw `Chocodata menolak permintaan (HTTP ${status}). Periksa API key dan endpoint.`
			if (error.code === 'ECONNABORTED') throw 'Permintaan ke Chocodata timeout. Coba lagi nanti.'
			throw 'Tidak dapat terhubung ke Chocodata. Coba lagi nanti.'
		}

		var result = response.data
		if (result?.success === false || result?.error) {
			throw typeof result.error === 'string' ? `Chocodata: ${result.error}` : 'Chocodata tidak berhasil mengambil data akun tersebut.'
		}

		// Pakai kuota hanya ketika API sukses merespons.
		userCooldown.lastUsed = now
		userCooldown.username = username
		accountCooldown[accountKey] = now

		await conn.reply(m.chat, summarizeResponse(result, username), m)
	} finally {
		inFlightUsers.delete(m.sender)
		inFlightAccounts.delete(accountKey)
	}
}

handler.help = ['followersig <username/link>']
handler.tags = ['booster']
handler.command = /^(followersig|igfollowers?)$/i
handler.limit = 1

module.exports = handler
