/****************************
 * EBARIMT AI COACH BOT
 * Full MVP – Ready to run
 ****************************/

require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

/* =========================
   ENV CHECK
========================= */
if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN .env файлд байхгүй байна");
  process.exit(1);
}

/* =========================
   TELEGRAM BOT
========================= */
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🤖 Bot is running...");

/* =========================
   /start
========================= */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Сайн байна уу!\nЕбаримтаа **зураг** болгон илгээвэл би:\n• МОНОС, EMART г.м зөв танина\n• Дүн, огноо гаргана\n• Зардал болгож хадгална ✅"
  );
});

/* =========================
   🇲🇳 MERCHANT MAP (HARD RULES)
========================= */
const merchantCategoryMap = {
  // 🛒 Эмийн сан / Дэлгүүр
  "монос": "🛒 Дэлгүүр",
  "monos": "🛒 Дэлгүүр",
  "эмийн сан": "🛒 Дэлгүүр",

  "emart": "🛒 Дэлгүүр",
  "e mart": "🛒 Дэлгүүр",
  "нomin": "🛒 Дэлгүүр",
  "nomin": "🛒 Дэлгүүр",
  "cu": "🛒 Дэлгүүр",
  "gs25": "🛒 Дэлгүүр",

  // 🍜 Хоол (ЗӨВХӨН эдгээр)
  "restaurant": "🍜 Хоол",
  "cafe": "🍜 Хоол",
  "coffee": "🍜 Хоол",
  "kfc": "🍜 Хоол",
  "burger": "🍜 Хоол",

  // ⛽ Шатахуун
  "petrovis": "⛽ Шатахуун",
  "sod mongol": "⛽ Шатахуун"
};
// ===== USER OVERRIDES =====
const OVERRIDE_FILE = "./merchant_overrides.json";

function loadOverrides() {
  if (!fs.existsSync(OVERRIDE_FILE)) return {};
  return JSON.parse(fs.readFileSync(OVERRIDE_FILE));
}

function saveOverride(merchantKey, category) {
  const overrides = loadOverrides();
  overrides[merchantKey] = category;
  fs.writeFileSync(OVERRIDE_FILE, JSON.stringify(overrides, null, 2));
}

/* =========================
   CATEGORY DECIDER
========================= */
function decideCategory(text) {
  const t = text.toLowerCase();
  const overrides = loadOverrides();

  // 1️⃣ User засвар ДАВУУ ЭРХТЭЙ
  for (const key in overrides) {
    if (t.includes(key)) {
      return overrides[key];
    }
  }

  // 2️⃣ Default merchant map
  for (const key in merchantCategoryMap) {
    if (t.includes(key)) {
      return merchantCategoryMap[key];
    }
  }

  return null; // → GPT fallback
}
/* =========================
   OCR (TEMP – FAKE)
   – дараа real OCR-оор солино
========================= */
function fakeOcr() {
  return `
МОНОС ЭМИЙН САН
Нийт дүн: 27500
НӨАТ: 2500
2026-04-06
`;
}

/* =========================
   PARSE RECEIPT
========================= */
function parseReceipt(text) {
  const amountMatch =
    text.match(/(нийт|total|дүн|cash)[^\d]*(\d{3,})/i);

  const dateMatch =
    text.match(/\d{4}[-./]\d{2}[-./]\d{2}/);

  return {
    amount: amountMatch ? Number(amountMatch[2]) : null,
    date: dateMatch ? dateMatch[0].replace(/[./]/g, "-") : null
  };
}

/* =========================
   GPT FALLBACK (only if needed)
========================= */
async function gptCategorize(text) {
  console.log("🧠 GPT ангилалт дуудаж байна...");

  const prompt = `
Чи Монгол хэрэглэгчийн зардлыг ангилна.

Ебаримт:
"${text}"

Ангиллууд:
- Хоол
- Дэлгүүр
- Шатахуун
- Тээвэр
- Түрээс
- Ажлын
- Хувийн

Зөвхөн нэг үг буцаа.
`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  );

  return res.data.choices[0].message.content.trim();
}

/* =========================
   SAVE EXPENSE (LOCAL JSON)
========================= */
function saveExpense(expense) {
  const filePath = "./expenses.json";

  let data = [];
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath));
  }

  data.push(expense);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
function getMonthlyReport(year, month) {
  const filePath = "./expenses.json";
  if (!fs.existsSync(filePath)) return null;

  const data = JSON.parse(fs.readFileSync(filePath));

  const filtered = data.filter(e => {
    if (!e.date) return false;
    return e.date.startsWith(`${year}-${month}`);
  });

  let total = 0;
  const byCategory = {};

  for (const e of filtered) {
    total += e.amount || 0;
    byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
  }

  return {
    total,
    byCategory
  };
}
async function generateCoachAdvice(report) {
  let summary = "Ангиллын задаргаа:\n";
  for (const cat in report.byCategory) {
    summary += `${cat}: ${report.byCategory[cat]}₮\n`;
  }

  const prompt = `
Чи Монгол хэрэглэгчид урам өгдөг, ойлгомжтой санхүүгийн coach.

Сарын зардлын мэдээлэл:
Нийт: ${report.total}₮
${summary}

Хэрэглэгчид:
- зэмлэхгүй
- бодит зөвлөгөө
- богино, хэрэгтэй тайлбар өг
`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    }
  );

  return res.data.choices[0].message.content.trim();
}
/* =========================
   PHOTO HANDLER
========================= */
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, "📸 Ебаримтыг уншиж байна...");

  // 1️⃣ OCR
  const ocrText = fakeOcr();

  // 2️⃣ Дүн + огноо
  const parsed = parseReceipt(ocrText);

  // 3️⃣ Ангилал
  let category = decideCategory(ocrText);
  if (!category) {
    category = await gptCategorize(ocrText);
  }

  // 4️⃣ EXPENSE OBJECT ← ЧИНИЙ ОДОО ДУТУУ БАЙСАН ХЭСЭГ
  const expense = {
    merchant: "МОНОС",
    category,
    amount: parsed.amount,
    date: parsed.date
  };

  // 5️⃣ Хадгалах
  saveExpense({
    ...expense,
    userId: msg.from.id,
    createdAt: new Date().toISOString()
  });

  // 6️⃣ Хэрэглэгчид харуулах
  await bot.sendMessage(
    chatId,
    `✅ **Зардал бүртгэгдлээ**\n\n` +
    `🏪 ${expense.merchant}\n` +
    `📂 ${expense.category}\n` +
    `💰 ${expense.amount}₮\n` +
    `📅 ${expense.date}\n\n` +
    `⚠️ Энэ зөв үү?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Зөв", callback_data: "ok" },
            { text: "✏️ Засах", callback_data: "fix" }
          ]
        ]
      }
    }
  );
});
bot.on("callback_query", async (query) => {
  // ✅ Telegram-д “авлаа” гэж хариулна
  await bot.answerCallbackQuery(query.id);

  const chatId = query.message.chat.id;

  // ✅ ЗӨВ дарсан үед
  if (query.data === "ok") {
    await bot.sendMessage(chatId, "✅ Ойлголоо, энэ ангиллыг баталгаажууллаа.");

    // (хүсвэл энд keyboard-ийг устгаж болно)
    return;
  }

  // ✏️ Засах дарсан үед
  if (query.data === "fix") {
    await bot.sendMessage(chatId, "Ямар ангилал вэ?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🛒 Дэлгүүр", callback_data: "cat:🛒 Дэлгүүр" }],
          [{ text: "🍜 Хоол", callback_data: "cat:🍜 Хоол" }],
          [{ text: "⛽ Шатахуун", callback_data: "cat:⛽ Шатахуун" }],
          [{ text: "🚕 Тээвэр", callback_data: "cat:🚕 Тээвэр" }],
          [{ text: "💸 Хувийн", callback_data: "cat:💸 Хувийн" }]
        ]
      }
    });
    return;
  }

  // 🏷️ Ангилал сонгосон үед
  if (query.data.startsWith("cat:")) {
    const category = query.data.split("cat:")[1];
    const merchantKey = "monos"; // түр, дараа OCR-оос dynamic болгоно

    saveOverride(merchantKey, category);

    await bot.sendMessage(
      chatId,
      `✅ Заслаа!\nДараагийн удаа *МОНОС → ${category}* гэж автоматаар танина ✅`,
      { parse_mode: "Markdown" }
    );
    return;
  }
});
bot.onText(/\/april/, async (msg) => {
  const chatId = msg.chat.id;

  const report = getMonthlyReport("2026", "04");

  if (!report) {
    await bot.sendMessage(chatId, "4-р сарын зардлын мэдээлэл олдсонгүй ❌");
    return;
  }

  let message = `📊 *2026 оны 4-р сарын тайлан*\n\n`;
  message += `💰 *Нийт зардал:* ${report.total.toLocaleString()}₮\n\n`;
  message += `*Ангиллаар:*\n`;

  for (const cat in report.byCategory) {
    message += `${cat} – ${report.byCategory[cat].toLocaleString()}₮\n`;
  }

  await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

  // 🤖 AI Coach
  const advice = await generateCoachAdvice(report);

  await bot.sendMessage(
    chatId,
    `🤖 *AI Coach зөвлөгөө:*\n${advice}`,
    { parse_mode: "Markdown" }
  );
});
