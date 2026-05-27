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
let botStatus = "MENUNGGU SCAN QR"; // Indikator status
let loadingPercent = "0%";

// ==========================================
// 1. NYALAKAN SERVER WEB LEBIH DULU
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server Web API langsung berjalan di port ${PORT}`);
});

app.get('/', (req, res) => {
    if (botStatus === "READY") {
        res.send('<h1 style="color:green; text-align:center; margin-top:50px;">✅ Bot Sudah Terhubung ke WhatsApp!</h1><p style="text-align:center;">Sistem siap digunakan untuk mencatat keuangan.</p>');
    } else if (botStatus === "PROSES LOGIN" || botStatus.includes("LOADING")) {
        res.send(`<h1 style="color:orange; text-align:center; margin-top:50px;">⏳ Sedang Sinkronisasi WhatsApp... (${loadingPercent})</h1>
        <p style="text-align:center; max-width:600px; margin:auto; line-height: 1.6;">
        Anda sudah berhasil tertaut dengan WhatsApp.<br>
        Saat ini bot sedang mengunduh riwayat pesan Anda.<br><br>
        <span style="background:#fff3cd; padding:10px; border-radius:5px; display:inline-block; border: 1px solid #ffeeba;">
        <b>⚠️ PENTING:</b> Proses ini memakan waktu <b>5 hingga 10 menit</b> di server Render gratisan. Mohon jangan ditutup atau disingkirkan dari Perangkat Tertaut.
        </span><br><br>
        Refresh (F5) halaman ini untuk melihat update persentase.
        </p>`);
    } else if (currentQR) {
        let qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}`;
        res.send(`
            <div style="text-align: center; font-family: sans-serif; margin-top: 50px;">
                <h2>Scan QR Code di Bawah Ini:</h2>
                <img src="${qrImageUrl}" alt="WhatsApp QR Code" style="border: 2px solid #ccc; border-radius: 10px; padding: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                <p style="margin-top:20px; font-size:18px;">Status: <b>${botStatus}</b></p>
                <p>Refresh halaman ini jika QR code gagal/kadaluarsa.</p>
            </div>
        `);
    } else {
        res.send(`<h2 style="text-align:center; margin-top:50px;">Sedang memuat sistem WhatsApp... Status: ${botStatus}</h2><p style="text-align:center;">Silakan refresh (F5) dalam 1-2 menit.</p>`);
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

// EVENT 0: Membaca progress loading dari WhatsApp
client.on('loading_screen', (percent, message) => {
    botStatus = "LOADING";
    loadingPercent = `${percent}%`;
    console.log(`⏳ LOADING WA: ${percent}% - ${message}`);
});

// EVENT 1: Minta QR Code
client.on('qr', (qr) => {
    currentQR = qr;
    botStatus = "MENUNGGU SCAN QR";
    console.log('✅ QR BARU SIAP! Buka URL Render Anda di browser.');
});

// EVENT 2: Sukses Scan (Tapi belum selesai loading)
client.on('authenticated', () => {
    currentQR = "";
    botStatus = "PROSES LOGIN";
    console.log('⏳ BERHASIL SCAN! Sedang melakukan sinkronisasi chat. Mohon tunggu...');
});

// EVENT 3: Gagal Scan
client.on('auth_failure', msg => {
    botStatus = "GAGAL LOGIN";
    console.error('❌ Gagal autentikasi:', msg);
});

// EVENT 4: Loading Selesai, Bot Siap 100%
client.on('ready', () => {
    isConnected = true;
    botStatus = "READY";
    console.log('🚀 BOT WA SUDAH READY DAN SIAP MEMBALAS PESAN!');
});

// EVENT 5: WA Terputus dari HP
client.on('disconnected', (reason) => {
    isConnected = false;
    botStatus = "TERPUTUS";
    console.log('❌ WA Terputus karena:', reason);
    client.initialize(); 
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

        if (GAS_WEBHOOK_URL !== 'MASUKKAN_URL_GOOGLE_APPS_SCRIPT_ANDA_DISINI') {
            await axios.post(GAS_WEBHOOK_URL, payload);
        }
    } catch (error) {
        console.error('Error GAS:', error);
    }
});

// Mulai memuat browser chrome 
client.initialize();
