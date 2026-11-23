var axios = require('axios')

const DAY_MS = 24 * 60 * 60 * 1000
const COOLDOWN_KEY = 'followerstiktokCooldown'
const inFlightUsers = new Set()
const inFlightAccounts = new Set()

function parseTikTokUsername(input) {
	var value = String(input || '').trim()
	if (/^https?:\/\//i.test(value)) {
		try {
			var url = new URL(value)
			if (!/(^|\.)tiktok\.com$/i.test(url.hostname)) return ''
			value = url.pathname.split('/').filter(Boolean)[0] || ''
		} catch {
			return ''
		}
	}
	value = value.replace(/^@/, '').trim()
	return /^[A-Za-z0-9._]{2,24}$/.test(value) ? value : ''
}

function getApiConfig() {
	var baseUrl = global.APIs?.chocodata || 'https://api.chocodata.com/api/v1/'
	var normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
	var apiKey = process.env.CHOCODATA_API_KEY || global.APIKeys?.[baseUrl] || global.APIKeys?.[normalizedBase]
	return { baseUrl: normalizedBase, apiKey }
}

function formatResult(data, username) {
	var result = data?.data ?? data?.result ?? data
	var count = result?.followerCount ?? result?.follower_count ?? result?.followersCount ?? result?.followers_count
	var lines = [`*「 TIKTOK FOLLOWERS 」*`, '', `*Akun:* @${username}`]

	if (count !== undefined && count !== null) {
		lines.push(`*Follower:* ${Number(count).toLocaleString('id-ID')}`)
	}

	if (Array.isArray(result)) {
		lines.push(`*Data diterima:* ${result.length}`)
		result.slice(0, 30).forEach((item, index) => {
			var name = item?.username || item?.uniqueId || item?.unique_id || item?.nickname || item?.name
			if (name) lines.push(`${index + 1}. ${String(name).slice(0, 80)}`)
		})
	} else if (count === undefined || count === null) {
		var readable = JSON.stringify(result, null, 2)
		if (readable) lines.push('', '```json', readable.slice(0, 2500), '```')
	}

	return lines.join('\n')
}

var handler = async (m, { conn, text, args, usedPrefix = '.', command = 'followerstiktok' }) => {
	var input = String(text || args?.join(' ') || '').trim()
	if (!input) throw `Masukkan username atau link profil TikTok.\nContoh: ${usedPrefix}${command} tiktok`

	var username = parseTikTokUsername(input)
	if (!username) throw 'Username atau link profil TikTok tidak valid.'

	var database = global.db?.data
	if (!database) throw 'Database bot belum siap, coba lagi sebentar.'

	var { baseUrl, apiKey } = getApiConfig()
	if (!apiKey) throw 'API key Botstylee belum dikonfigurasi. Atur BOTSTYLEE_API_KEY atau API key Botstylee di config.js.'

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
		throw `Akun TikTok @${username} sudah dicek hari ini. Coba lagi sekitar ${accountWaitHours} jam lagi.`
	}

	if (inFlightUsers.has(m.sender)) throw 'Permintaan dari nomor WhatsApp ini sedang diproses.'
	if (inFlightAccounts.has(accountKey)) throw `Permintaan untuk @${username} sedang diproses.`
	inFlightUsers.add(m.sender)
	inFlightAccounts.add(accountKey)

	try {
		var endpoint = new URL('tiktok/follower', baseUrl)
		endpoint.searchParams.set('api_key', apiKey)
		endpoint.searchParams.set('username', username)
		endpoint.searchParams.set('url', `https://www.tiktok.com/@${username}`)
		endpoint.searchParams.set('count', '30')
		endpoint.searchParams.set('country', 'us')

		var response
		try {
			response = await axios.get(endpoint.toString(), {
				timeout: 30000,
				headers: { Accept: 'application/json' }
			})
		} catch (error) {
			var status = error.response?.status
			if (status) throw `Botstylee menolak permintaan (HTTP ${status}). Periksa API key dan endpoint.`
			if (error.code === 'ECONNABORTED') throw 'Permintaan ke Botstylee timeout. Coba lagi nanti.'
			throw 'Tidak dapat terhubung ke Botstylee. Coba lagi nanti.'
		}

		var result = response.data
		if (result?.success === false || result?.error) {
			throw typeof result.error === 'string' ? `Botstylee: ${result.error}` : 'Botstylee tidak berhasil mengambil data akun tersebut.'
		}

		// Gunakan kuota hanya setelah API berhasil merespons.
		userCooldown.lastUsed = now
		userCooldown.username = username
		accountCooldown[accountKey] = now

		await conn.reply(m.chat, formatResult(result, username), m)
	} finally {
		inFlightUsers.delete(m.sender)
		inFlightAccounts.delete(accountKey)
	}
}

handler.help = ['followerstiktok <username/link>']
handler.tags = ['booster']
handler.command = /^(followerstiktok|ttfollowers?)$/i
handler.limit = 1

module.exports = handler
