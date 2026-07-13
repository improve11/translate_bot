const { Telegraf } = require('telegraf');
const translate = require('@vitalets/google-translate-api');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
    console.error('❌ Токен бота не найден! Проверьте файл .env');
    process.exit(1);
}

const bot = new Telegraf(TOKEN);

// ---------- Работа с файлом пользователей (без изменений) ----------
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

let users = {};
if (fs.existsSync(USERS_FILE)) {
    try {
        const raw = fs.readFileSync(USERS_FILE);
        users = JSON.parse(raw);
        console.log(`✅ Загружены настройки для ${Object.keys(users).length} пользователей`);
    } catch (e) {
        console.error('❌ Ошибка чтения users.json:', e.message);
        users = {};
    }
} else {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('📁 Создан файл users.json');
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getUserSettings(userId) {
    if (!users[userId]) {
        users[userId] = {
            targetLang: 'en',
            sourceLang: 'auto',
            autoDetect: true
        };
        saveUsers();
    }
    return users[userId];
}

function updateUserSettings(userId, newSettings) {
    if (!users[userId]) users[userId] = {};
    Object.assign(users[userId], newSettings);
    saveUsers();
}

const SUPPORTED_LANGUAGES = {
    'en': 'Английский',
    'ru': 'Русский',
    'es': 'Испанский',
    'fr': 'Французский',
    'de': 'Немецкий',
    'it': 'Итальянский',
    'pt': 'Португальский',
    'ja': 'Японский',
    'zh': 'Китайский',
    'ar': 'Арабский',
    'hi': 'Хинди',
    'ko': 'Корейский'
};

function isLanguageSupported(langCode) {
    return langCode === 'auto' || SUPPORTED_LANGUAGES.hasOwnProperty(langCode);
}

function getLanguagesList() {
    let list = 'Поддерживаемые языки (код – название):\n';
    for (const [code, name] of Object.entries(SUPPORTED_LANGUAGES)) {
        list += `  /setlang ${code} – ${name}\n`;
    }
    return list;
}

// ---------- Команды ----------
bot.start((ctx) => {
    const userId = ctx.from.id;
    getUserSettings(userId);
    ctx.reply(`🤖 Привет! Я бот-переводчик.

Я переведу любой текст на нужный вам язык.

📌 Команды:
/start – показать это сообщение
/help – помощь и список команд
/setlang <код> – установить язык перевода (например, /setlang ru)
/mylang – показать текущие настройки
/setfrom <код> – установить исходный язык (по умолчанию автоопределение)
/autodetect – включить автоопределение исходного языка (режим по умолчанию)
/languages – список доступных языков

Просто отправьте мне текст, и я переведу его на ваш целевой язык.`);
});

bot.help((ctx) => {
    ctx.reply(`📖 *Помощь*

• Установите целевой язык: /setlang <код>
• Установите исходный язык: /setfrom <код> (или автоопределение)
• Включите автоопределение: /autodetect
• Посмотрите текущие настройки: /mylang
• Список языков: /languages

Пример: /setlang ru – переводить на русский.

Если включено автоопределение, я сам определю язык входящего текста.`, { parse_mode: 'Markdown' });
});

bot.command('setlang', (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        ctx.reply('❌ Укажите код языка, например: /setlang ru');
        return;
    }
    const langCode = args[1].toLowerCase();
    if (!isLanguageSupported(langCode)) {
        ctx.reply(`❌ Язык "${langCode}" не поддерживается. Используйте /languages для списка.`);
        return;
    }
    updateUserSettings(userId, { targetLang: langCode });
    const langName = SUPPORTED_LANGUAGES[langCode] || langCode;
    ctx.reply(`✅ Целевой язык установлен на *${langName}* (${langCode})`, { parse_mode: 'Markdown' });
});

bot.command('setfrom', (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        ctx.reply('❌ Укажите код языка, например: /setfrom en');
        return;
    }
    const langCode = args[1].toLowerCase();
    if (!isLanguageSupported(langCode) && langCode !== 'auto') {
        ctx.reply(`❌ Язык "${langCode}" не поддерживается. Используйте /languages для списка.`);
        return;
    }
    const autoDetect = (langCode === 'auto');
    updateUserSettings(userId, { sourceLang: langCode, autoDetect: autoDetect });
    const langName = (langCode === 'auto') ? 'автоопределение' : (SUPPORTED_LANGUAGES[langCode] || langCode);
    ctx.reply(`✅ Исходный язык установлен на *${langName}* (${langCode})`, { parse_mode: 'Markdown' });
});

bot.command('autodetect', (ctx) => {
    const userId = ctx.from.id;
    updateUserSettings(userId, { sourceLang: 'auto', autoDetect: true });
    ctx.reply('✅ Автоопределение исходного языка включено.');
});

bot.command('mylang', (ctx) => {
    const userId = ctx.from.id;
    const settings = getUserSettings(userId);
    const targetName = SUPPORTED_LANGUAGES[settings.targetLang] || settings.targetLang;
    const sourceName = settings.autoDetect ? 'автоопределение' : (SUPPORTED_LANGUAGES[settings.sourceLang] || settings.sourceLang);
    ctx.reply(`📊 *Ваши настройки:*
• Целевой язык: ${targetName} (${settings.targetLang})
• Исходный язык: ${sourceName} (${settings.sourceLang})
• Автоопределение: ${settings.autoDetect ? '✅ включено' : '❌ выключено'}`, { parse_mode: 'Markdown' });
});

bot.command('languages', (ctx) => {
    ctx.reply(getLanguagesList());
});

// ---------- Обработка текстовых сообщений (перевод) ----------
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // Игнорируем команды (они уже обработаны выше)
    if (text.startsWith('/')) return;

    const settings = getUserSettings(userId);
    const target = settings.targetLang;
    const source = settings.autoDetect ? 'auto' : settings.sourceLang;

    try {
        const result = await translate(text, { to: target, from: source });
        let detectedFrom = result.from.language.iso;
        let fromName = SUPPORTED_LANGUAGES[detectedFrom] || detectedFrom;

        if (detectedFrom === target) {
            ctx.reply(`⚠️ Текст уже на языке "${fromName}". Перевод не требуется.`);
            return;
        }

        let reply = `🔄 *Перевод:*\n${result.text}`;
        if (settings.autoDetect) {
            reply += `\n\n🔍 Определён исходный язык: *${fromName}* (${detectedFrom})`;
        }
        reply += `\n🎯 Целевой язык: *${SUPPORTED_LANGUAGES[target] || target}* (${target})`;
        ctx.reply(reply, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Ошибка перевода:', error);
        ctx.reply('❌ Не удалось перевести текст. Проверьте, что язык поддерживается, и попробуйте ещё раз.');
    }
});

// ---------- Запуск ----------
bot.launch()
    .then(() => console.log('🤖 Бот-переводчик запущен (telegraf)'))
    .catch(err => console.error('Ошибка запуска:', err));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));