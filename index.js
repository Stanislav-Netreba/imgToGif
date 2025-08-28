require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const Jimp = require('jimp');
const GIFEncoder = require('gifencoder');
const { WritableStreamBuffer } = require('stream-buffers');

const path = require('path');
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
	partials: [Partials.Message, Partials.Channel],
});

const SUPPORTED_EXTS = ['.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 1024 * 1024;

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
	if (message.author.bot || !message.reference || message.content.toLowerCase() !== 'порно!') {
		return;
	}

	const originalMessage = await message.fetchReference();

	if (!originalMessage.attachments.size) {
		return await message.reply('Ти маєш відповісти на повідомлення, яке містить картинку');
	}

	const attachment = originalMessage.attachments.first();
	const url = attachment.url;
	const fileSize = attachment.size;

	if (fileSize > MAX_FILE_SIZE) {
		return await message.reply(`Файл завеликий, максимум 1 МБ`);
	}

	const ext = path.extname(url.split('?')[0]).toLowerCase();

	if (!SUPPORTED_EXTS.includes(ext)) {
		return await message.reply('Будь ласка, надішли PNG або JPG для конвертації.');
	}

	const sentMessage = await message.reply('Процес пішов, якщо комп згорить буду плакать');
	await message.channel.sendTyping();

	try {
		const image = await Jimp.read(url);
		const width = image.bitmap.width;
		const height = image.bitmap.height;

		const encoder = new GIFEncoder(width, height);
		const streamBuffer = new WritableStreamBuffer();

		encoder.createReadStream().pipe(streamBuffer);

		encoder.start();
		encoder.setRepeat(0);
		encoder.setDelay(500);
		encoder.setQuality(10);

		for (let i = 0; i < 5; i++) {
			encoder.addFrame(image.bitmap.data);
		}

		encoder.finish();

		await new Promise((resolve) => {
			streamBuffer.on('finish', resolve);
		});

		const buffer = streamBuffer.getContents();

		await message.reply({ files: [{ attachment: buffer, name: 'output.gif' }] });

		await sentMessage.delete();
	} catch (err) {
		console.error('Error during conversion:', err);
		await message.reply('Сталася помилка при обробці файлу.');
	}
});

client.login(process.env.DISCORD_TOKEN);
