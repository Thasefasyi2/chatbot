// JADI3.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
const fetch = require('node-fetch');

let isConnected = false;

// --- Inisialisasi Client WhatsApp ---
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    },
    authStrategy: new LocalAuth({ dataPath: "." }),
});

// --- Event: QR Code ---
client.on('qr', (qr) => {
    isConnected = false;
    qrcode.generate(qr, { small: true });
    io.emit('qr', qr);
});

// --- Event: Client Ready ---
client.on('ready', () => {
    console.log('Client is ready!');
    isConnected = true;
    io.emit('ready');
});

// --- Event: Client Disconnected ---
client.on('disconnected', (reason) => {
    console.log('Client disconnected:', reason);
    isConnected = false;
    io.emit('disconnected');
    client.initialize();
});

// --- Event: Menerima Pesan Masuk ---
client.on('message', async (message) => {
    if (!message.fromMe) {
        const webhookURL = 'https://ape-climbing-reindeer.ngrok-free.app/webhook-test/cf309893-635b-4ab4-80db-917f0001aa33';
        const requestBody = {
            mensagem: message.body,
            number: message.from
        };

        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                console.error('Error sending to webhook:', response.statusText);
                const responseText = await response.text();
                console.error('Response Body:', responseText);
            }
        } catch (error) {
            console.error('Error sending to webhook:', error);
        }
    }
});

// --- API: Status koneksi ---
app.use(cors());

app.get('/status', (req, res) => {
    res.json({ isConnected: isConnected });
});

// --- API: Halaman Utama ---
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname });
});

// --- API: Ambil socket.io.js ---
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(require.resolve('socket.io-client/dist/socket.io.js'));
});

// --- API: Mengirim Pesan ke WhatsApp ---
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

    try {
        const sentMessage = await client.sendMessage(chatId, message);
        res.status(200).json({ 
            status: 'success', 
            message: 'Pesan terkirim!',
            messageId: sentMessage.id
        });
    } catch (err) {
        console.error('Gagal mengirim pesan:', err);
        res.status(500).json({ 
            status: 'error', 
            message: 'Gagal mengirim pesan' 
        });
    }
});

// --- Mulai Server ---
server.listen(3333, () => {
    console.log('Server is running on port 3333');
});

// --- Initialize WhatsApp Client ---
client.initialize();