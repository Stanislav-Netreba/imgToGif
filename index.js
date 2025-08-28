require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const Jimp = require('jimp');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const https = require('https');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg'); // для конвертації відео в gif

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
	partials: [Partials.Message, Partials.Channel],
});

client.on('ready', () => {
	console.log(`✅ Logged in as ${client.user.tag}`);
});

// Функція для завантаження файлу через https
function downloadFile(url, dest) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest);
		https
			.get(url, (response) => {
				response.pipe(file);
				file.on('finish', () => {
					file.close(resolve);
				});
			})
			.on('error', (err) => {
				fs.unlink(dest, () => reject(err));
			});
	});
}

// Функція для конвертації відео в GIF
function convertVideoToGif(videoPath, gifPath) {
	return new Promise((resolve, reject) => {
		ffmpeg(videoPath)
			.output(gifPath)
			.outputOptions('-vf', 'fps=10,scale=320:-1:flags=lanczos')
			.on('end', resolve)
			.on('error', reject)
			.run();
	});
}

client.on('messageCreate', async (message) => {
	console.log('📩 New message received:', message.content);

	// Якщо це бот або немає reference (відповіді) — ігноруємо
	if (message.author.bot || !message.reference) {
		// console.log('⛔ Ignored (bot or no reply)');
		return;
	}

	// Маємо команду "порно!" в новому повідомленні
	if (message.content.toLowerCase() !== 'порно!') {
		// console.log('❌ Message is not the expected command.');
		return;
	}

	const originalMessage = await message.fetchReference();

	// Перевіряємо чи оригінальне повідомлення має вкладення
	if (!originalMessage.attachments.size) {
		console.log('❗ No attachments in replied message.');
		await message.reply('Ти маєш відповісти на повідомлення, яке містить файл для конвертації.');
		return;
	}

	// Лог інформація про вкладення
	const attachment = originalMessage.attachments.first();
	const url = attachment.url;
	console.log('🔗 Attachment URL:', url);

	const cleanUrl = url.split('?')[0];
	const ext = path.extname(cleanUrl).toLowerCase();
	console.log('🧩 File extension:', ext);

	if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
		console.log('⚠️ Unsupported file type.');
		await message.reply('Будь ласка, надішли PNG, JPG для конвертації.');
		return;
	}

	let tempFiles = [];
	console.log('🚀 Starting file conversion...');

	const sentMessage = await message.reply('Процес пішов, якщо комп згорить буду плакать');
	await message.channel.sendTyping(); // бот покаже "друкує" під час обробки

	try {
		if (['.png', '.jpg', '.jpeg'].includes(ext)) {
			console.log('🖼️ Converting image to GIF...');
			const image = await Jimp.read(url);
			const width = image.bitmap.width;
			const height = image.bitmap.height;

			const encoder = new GIFEncoder(width, height);
			const filePath = `./temp_${Date.now()}.gif`;
			tempFiles.push(filePath);

			const writeStream = fs.createWriteStream(filePath);
			encoder.createReadStream().pipe(writeStream);

			encoder.start();
			encoder.setRepeat(0); // безкінечне повторення
			encoder.setDelay(500); // 500 мс між кадрами
			encoder.setQuality(10);

			for (let i = 0; i < 5; i++) {
				encoder.addFrame(image.bitmap.data);
			}

			encoder.finish();

			await new Promise((resolve, reject) => {
				writeStream.on('finish', resolve);
				writeStream.on('error', reject);
			});

			console.log('✅ Image to GIF conversion finished.');
			await message.reply({ files: [filePath] });
		} else {
			await message.reply('Поки що цей формат файлу не підтримується');
			/*
			console.log('🎥 Converting video to GIF...');
			const videoPath = `./temp_${Date.now()}.mp4`;
			tempFiles.push(videoPath);

			await downloadFile(url, videoPath);

			const gifPath = `./temp_${Date.now()}.gif`;
			tempFiles.push(gifPath);

			await convertVideoToGif(videoPath, gifPath);

			console.log('✅ Video to GIF conversion finished.');
			await message.reply({ files: [gifPath] });*/
		}

		// Видаляємо службове повідомлення "процес пішов..."
		await sentMessage.delete();
	} catch (err) {
		console.error('🔥 Error during conversion:', err);
		await message.reply('Сталася помилка при обробці файлу.');
	} finally {
		// Чистимо тимчасові файли
		console.log('🧹 Cleaning up temporary files...');
		for (const file of tempFiles) {
			try {
				if (fs.existsSync(file)) {
					console.log('🗑️ Deleting:', file);
					fs.unlinkSync(file);
				}
			} catch (err) {
				console.error('❗ Error deleting file:', file, err);
			}
		}
	}
});

client.login(process.env.DISCORD_TOKEN);
