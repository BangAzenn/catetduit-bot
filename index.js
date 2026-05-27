const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// PASTIKAN GANTI DENGAN URL WEBHOOK CODE.GS ANDA!
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxUjD8FMi8mqbP6GqLi-vsmt7EjhOjXHZuV3Tws_LTmMbVxUcCBOZlVNkzYLiYrmjKzqw/exec';
const PORT = process.env.PORT || 10000; 

let currentQR = ""; 
let isConnected = false;

// ==========================================
// 1. NYALAKAN SERVER WEB LEBIH DULU (ANTI 502 BAD GATEWAY)
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server Web API langsung berjalan di port ${PORT}`);
});

app.get('/', (req, res) => {
    if (isConnected) {
        res.send('<h1>✅ Bot Sudah Terhubung ke WhatsApp!</h1><p>Sistem siap digunakan.</p>');
    } else if (currentQR) {
        let qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}`;
        res.send(`
            <div style="text-align: center; font-family: sans-serif; margin-top: 50px;">
                <h2>Scan QR Code di Bawah Ini:</h2>
                <img src="${qrImageUrl}" alt="WhatsApp QR Code" style="border: 2px solid #ccc; border-radius: 10px; padding: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <p>Refresh halaman ini jika QR code gagal/kadaluarsa.</p>
            </div>
        `);
    } else {
        res.send('<h2 style="text-align:center; margin-top:50px;">Sedang memuat sistem WhatsApp... Silakan refresh (F5) dalam 1-2 menit.</h2>');
    }
});

app.post('/send-message', async (req, res) => {
    try {
        const { target, text } = req.body;
        if (!target || !text) return res.status(400).json({ status: false, message: 'Invalid data' });
        
        await client.sendMessage(target, text);
        res.json({ status: true, message: 'Pesan terkirim' });
    } catch (error) {
        res.status(500).json({ status: false, error: error.toString() });
    }
});

// ==========================================
// 2. INISIALISASI WHATSAPP SETELAH SERVER WEB AMAN
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', 
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process' // Optimasi ekstra agar RAM Render tidak penuh
        ]
    }
});

client.on('qr', (qr) => {
    currentQR = qr;
    console.log('✅ QR BARU SIAP! Buka URL Render Anda di browser.');
});

client.on('ready', () => {
    isConnected = true;
    currentQR = "";
    console.log('✅ Bot WhatsApp CatetDuit Berhasil Terhubung!');
});

client.on('message', async msg => {
    try {
        let chat = await msg.getChat();
        let payload = {
            sender: chat.id._serialized, 
            message: msg.body, 
            type: chat.isGroup ? "group" : "chat",
            participant: chat.isGroup ? msg.author : msg.from 
        };

        if (GAS_WEBHOOK_URL !== 'MASUKKAN_URL_GOOGLE_APPS_SCRIPT_ANDA_DISINI') {
            await axios.post(GAS_WEBHOOK_URL, payload);
        }
    } catch (error) {
        console.error('Error GAS:', error);
    }
});

// Mulai memuat browser chrome (proses paling berat)
client.initialize();
