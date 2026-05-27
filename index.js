const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==========================================
// PENGATURAN UTAMA
// ==========================================
// PASTIKAN GANTI DENGAN URL WEBHOOK CODE.GS ANDA!
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxUjD8FMi8mqbP6GqLi-vsmt7EjhOjXHZuV3Tws_LTmMbVxUcCBOZlVNkzYLiYrmjKzqw/exec';
const PORT = process.env.PORT || 10000; // Render menggunakan port 10000

console.log('Memulai browser Chrome... Mohon tunggu 1-2 menit hingga QR Code muncul.');

// Inisialisasi WhatsApp Client (Dioptimasi untuk RAM kecil / Render Free)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Jurus ampuh anti-hang di Render
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('=========================================');
    console.log('✅ SCAN QR CODE INI DI WHATSAPP ANDA:');
    console.log('=========================================');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot WhatsApp CatetDuit Berhasil Terhubung!');
});

// MENANGKAP PESAN MASUK & MENGIRIM KE GOOGLE SHEET
client.on('message', async msg => {
    try {
        let chat = await msg.getChat();
        
        let payload = {
            sender: chat.id._serialized, 
            message: msg.body, 
            type: chat.isGroup ? "group" : "chat",
            participant: chat.isGroup ? msg.author : msg.from 
        };

        console.log(`[Pesan Masuk] Dari: ${payload.sender} | Teks: ${payload.message}`);

        if (GAS_WEBHOOK_URL !== 'MASUKKAN_URL_GOOGLE_APPS_SCRIPT_ANDA_DISINI') {
            await axios.post(GAS_WEBHOOK_URL, payload);
        }

    } catch (error) {
        console.error('Error saat meneruskan ke GAS:', error);
    }
});

client.initialize();

// API ENDPOINT UNTUK MENERIMA BALASAN DARI GAS
app.post('/send-message', async (req, res) => {
    try {
        const { target, text } = req.body;

        if (!target || !text) {
            return res.status(400).json({ status: false, message: 'Target dan teks wajib diisi' });
        }

        await client.sendMessage(target, text);
        console.log(`[Berhasil Membalas] Ke: ${target}`);
        res.json({ status: true, message: 'Pesan terkirim' });

    } catch (error) {
        console.error('Gagal mengirim pesan:', error);
        res.status(500).json({ status: false, error: error.toString() });
    }
});

// Jalankan Server API
app.listen(PORT, () => {
    console.log(`Server API Bot berjalan di port ${PORT}`);
});
