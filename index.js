const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal'); // Tambahan pembuat QR di Terminal
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// URL Webhook GAS (Sudah diisi dengan URL asli Anda)
const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxUjD8FMi8mqbP6GqLi-vsmt7EjhOjXHZuV3Tws_LTmMbVxUcCBOZlVNkzYLiYrmjKzqw/exec';
const PORT = process.env.PORT || 10000; 

let currentQR = ""; 
let isConnected = false;
let botStatus = "MENUNGGU SCAN QR"; 
let loadingPercent = "0%";

// ==========================================
// 1. SERVER WEB (Tetap menyala di background)
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server Web API langsung berjalan di port ${PORT}`);
});

app.get('/', (req, res) => {
    res.send('<h1>Bot WhatsApp Berjalan di VPS</h1><p>Status: ' + botStatus + '</p><p><b>Silakan cek Terminal SSH VPS Anda untuk melakukan Scan QR Code.</b></p>');
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
// 2. INISIALISASI WHATSAPP 
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
            '--single-process'
        ]
    }
});

client.on('loading_screen', (percent, message) => {
    botStatus = "LOADING";
    loadingPercent = `${percent}%`;
    console.log(`⏳ SINKRONISASI WA: ${percent}% - Jangan dimatikan...`);
});

// EVENT 1: Minta QR Code (DIMUNCULKAN DI TERMINAL VPS)
client.on('qr', (qr) => {
    currentQR = qr;
    botStatus = "MENUNGGU SCAN QR";
    console.log('\n==================================================');
    console.log('✅ QR BARU SIAP! SCAN KOTAK DI BAWAH INI:');
    console.log('==================================================\n');
    qrcode.generate(qr, { small: true }); // Cetak QR di layar hitam
});

client.on('authenticated', () => {
    currentQR = "";
    botStatus = "PROSES LOGIN";
    console.log('\n✅ BERHASIL SCAN! Sedang melakukan sinkronisasi chat. Mohon tunggu...');
});

client.on('auth_failure', msg => {
    console.error('❌ Gagal autentikasi:', msg);
});

client.on('ready', () => {
    isConnected = true;
    botStatus = "READY";
    console.log('\n🚀 BOT WA SUDAH READY DAN SIAP MEMBALAS PESAN!\n');
});

client.on('disconnected', (reason) => {
    isConnected = false;
    botStatus = "TERPUTUS";
    console.log('❌ WA Terputus karena:', reason);
    client.initialize(); 
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

client.initialize();
