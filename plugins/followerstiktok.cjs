var axios = require('axios')

const DAY_MS = 24 * 60 * 60 * 1000
const COOLDOWN_KEY = 'followerstiktokCooldown'

function normalizeUsername(input) {
	var username = String(input || '').trim()
	username = username.replace(/^https?:\/\/[^/]+\//i, '').replace(/^@/, '').replace(/\?.*$/, '').replace(/\/.*$/, '')
	return username.trim()
}

function extractJsonValue(json) {
	if (!json) return null
	return json.data || json.result || json.results || json.follower || json.followers || json
}

function getFollowerCount(json) {
	var value = extractJsonValue(json)
	if (typeof value === 'number') return value
	if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value)
	if (value && typeof value === 'object') {
		return value.followerCount ?? value.followers ?? value.count ?? value.total ?? null
	}
	return null
}

function getApiKey() {
	return process.env.CHOCODATA_API_KEY || global.APIKeys?.['https://api.chocodata.com/api/v1/'] || ''
}

var handler = async (m, { conn, text, args, usedPrefix, command }) => {
	var rawInput = String(text || args?.join(' ') || '').trim()
	if (!rawInput) {
		throw `Contoh penggunaan:\n${usedPrefix}${command} tiktok\n${usedPrefix}${command} https://www.tiktok.com/@tiktok`
	}

	var username = normalizeUsername(rawInput)
	if (!username) throw 'Username atau link TikTok tidak valid.'

	if (!global.db?.data) throw 'Database bot belum siap. Silakan coba lagi.'
	var database = global.db.data
	database.users[m.sender] = database.users[m.sender] || {}
	database.users[m.sender][COOLDOWN_KEY] = database.users[m.sender][COOLDOWN_KEY] || {}
	database.game = database.game || {}
	database.game[COOLDOWN_KEY] = database.game[COOLDOWN_KEY] || {}

	var now = Date.now()
	var normalizedKey = username.toLowerCase()
	var userCooldown = database.users[m.sender][COOLDOWN_KEY]
	var targetCooldown = database.game[COOLDOWN_KEY]

	if (userCooldown.lastUsed && now - Number(userCooldown.lastUsed) < DAY_MS) {
		var remaining = DAY_MS - (now - Number(userCooldown.lastUsed))
		var hours = Math.ceil(remaining / (60 * 60 * 1000))
		throw `Kamu sudah menggunakan fitur ini hari ini.\nCoba lagi sekitar ${hours} jam lagi.`
	}

	if (targetCooldown[normalizedKey] && now - Number(targetCooldown[normalizedKey]) < DAY_MS) {
		var targetRemaining = DAY_MS - (now - Number(targetCooldown[normalizedKey]))
		var targetHours = Math.ceil(targetRemaining / (60 * 60 * 1000))
		throw `Akun TikTok @${username} sudah digunakan hari ini.\nCoba lagi sekitar ${targetHours} jam lagi.`
	}

	var apiKey = getApiKey()
	if (!apiKey) throw 'API key Chocodata belum dikonfigurasi.'

	var profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`
	var endpoint = new URL('https://api.chocodata.com/api/v1/tiktok/follower')
	endpoint.searchParams.set('api_key', apiKey)
	endpoint.searchParams.set('username', username)
	endpoint.searchParams.set('url', profileUrl)
	endpoint.searchParams.set('count', '1')
	endpoint.searchParams.set('country', 'us')

	await m.reply('Sedang mengambil data follower TikTok...')

	var response
	try {
		response = await axios.get(endpoint.toString(), {
			timeout: 30000,
			headers: {
				Accept: 'application/json',
				'User-Agent': 'BOTSTYLEE/1.0'
			},
			validateStatus: status => status >= 200 && status < 500
		})
	} catch (error) {
		throw `Gagal terhubung ke Chocodata: ${error.code || error.message}`
	}

	if (response.status < 200 || response.status >= 300) {
		throw `Chocodata gagal memproses permintaan (${response.status}).`
	}

	var json = response.data
	var followerCount = getFollowerCount(json)

	userCooldown.lastUsed = now
	userCooldown.username = username
	targetCooldown[normalizedKey] = now

	var resultText = `*「 FOLLOWERS TIKTOK 」*\n\n`
		+ `*Akun:* @${username}\n`
		+ `*Follower:* ${followerCount == null ? '-' : Number(followerCount).toLocaleString('id-ID')}\n`
		+ `*Negara:* US\n`
		+ `*Jumlah:* 1\n`
		+ `*Profil:* ${profileUrl}`

	await m.reply(resultText.trim())
}

handler.help = ['followersTikTok', 'followerstiktok'].map(v => v + ' <username/link>')
handler.tags = ['booster']
handler.command = /^(followers?(?:tiktok)?|ttfollowers?|followerstiktok)$/i
handler.limit = 1

module.exports = handler
