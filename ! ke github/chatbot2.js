require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

// === FIXED: fetch untuk CommonJS (support Node < 18 & >= 18)
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

let isConnected = false;

// === INISIALISASI WHATSAPP CLIENT ===
const client = new Client({
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' // Ubah jika pakai OS lain
  },
  authStrategy: new LocalAuth({ dataPath: '.' })
});

// === QR CODE ===
client.on('qr', (qr) => {
  isConnected = false;
  qrcode.generate(qr, { small: true });
  io.emit('qr', qr);
});

// === SIAP ===
client.on('ready', () => {
  console.log('✅ WhatsApp client siap!');
  isConnected = true;
  io.emit('ready');
});

// === DISKONEK ===
client.on('disconnected', (reason) => {
  console.log('⚠️ Terputus:', reason);
  isConnected = false;
  io.emit('disconnected');
  client.initialize();
});

// === PESAN MASUK ===
client.on('message', async (message) => {
  if (message.fromMe) return;

  const pesan = message.body;
  const pengirim = message.from;

  if (pesan.includes('!ell')) {
    const systemPrompt = `
anda adalah virtual asisten elisya
here is current date/time = ${new Date().toISOString()}
saat anda menjawab, hilangkan <think></think>
`.trim();

    const fullPrompt = `${systemPrompt}\n\nUser: ${pesan}`;
    const balasan = await callAIModel(fullPrompt);

    try {
      const chatId = pengirim.includes('@c.us') ? pengirim : `${pengirim}@c.us`;
      await client.sendMessage(chatId, balasan);
      console.log(`📤 Balasan terkirim ke ${pengirim}`);
    } catch (err) {
      console.error('❌ Gagal kirim:', err);
    }
  } else {
    console.log(`ℹ️ Pesan dilewati: ${pesan}`);
  }
});

// === PANGGIL AI GROQ ===
async function callAIModel(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-r1-distill-llama-70b',
        messages: [
          {
            role: 'system',
            content:
              'anda adalah virtual asisten elisya.\nsaat anda menjawab, hilangkan <think></think>'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('💡 AI BALASAN:', data.choices[0].message.content.trim());
      return data.choices[0].message.content.trim();
    } else {
      console.error('🧠 Groq API error:', data);
      return '⚠️ AI sedang bermasalah.';
    }
  } catch (error) {
    console.error('💥 Gagal konek ke Groq:', error);
    return '⚠️ Sistem sedang gangguan.';
  }
}

// === API STATUS ===
app.get('/status', (req, res) => {
  res.json({ isConnected });
});

// === JALANKAN ===
client.initialize();
server.listen(3000, () => {
  console.log('🚀 Server aktif di http://localhost:3000');
});