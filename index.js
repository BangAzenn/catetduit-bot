const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// ==========================================
// PENGATURAN UTAMA
// ==========================================
// Masukkan URL Webhook Google Apps Script Anda di sini!
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxUjD8FMi8mqbP6GqLi-vsmt7EjhOjXHZuV3Tws_LTmMbVxUcCBOZlVNkzYLiYrmjKzqw/exec';
const PORT = process.env.PORT || 3000;

// Inisialisasi WhatsApp Client (Cocok untuk Shared Hosting/VPS)
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions'],
        headless: true
    }
});

client.on('qr', (qr) => {
    console.log('SCAN QR CODE INI DI WHATSAPP ANDA:');
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
            sender: chat.id._serialized, // Target balasan (Bisa nomor pribadi atau ID Grup)
            message: msg.body, // Isi pesan (Misal: beli kopi 5k)
            type: chat.isGroup ? "group" : "chat",
            participant: chat.isGroup ? msg.author : msg.from // Menangkap Nomor Asli pengirim di Grup!
        };

        console.log(`Pesan masuk dari: ${payload.sender}, Teks: ${payload.message}`);

        // Teruskan data ke Google Apps Script
        if (GAS_WEBHOOK_URL !== 'MASUKKAN_URL_GOOGLE_APPS_SCRIPT_ANDA_DISINI') {
            await axios.post(GAS_WEBHOOK_URL, payload);
        }

    } catch (error) {
        console.error('Error saat meneruskan ke GAS:', error);
    }
});

client.initialize();

// ==========================================
// API ENDPOINT UNTUK MENERIMA BALASAN DARI GAS
// ==========================================
// Endpoint ini yang akan dipanggil oleh Google Sheet untuk membalas WA
app.post('/send-message', async (req, res) => {
    try {
        const { target, text } = req.body;

        if (!target || !text) {
            return res.status(400).json({ status: false, message: 'Target dan teks wajib diisi' });
        }

        // Proses pengiriman pesan WA
        await client.sendMessage(target, text);

        console.log(`Berhasil membalas ke: ${target}`);
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
