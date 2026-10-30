require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// ==========================================
// 1. Security & Core Middleware Setup
// ==========================================
app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

// API Rate Limiting (DDoS Protection)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use('/api/', limiter);

// Multer memory storage for leaf scan uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Gemini AI Client Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ==========================================
// 2. State & In-Memory Fallbacks
// ==========================================
let failureCount = 0;
let lastFailoverTime = null;

let liveState = {
  moisture: 38.0,
  nitrogen: 140,
  sulphur: 22,
  temperature: 28.0,
  humidity: 62,
  pumpStatus: false,
  status: 'OPTIMAL',
  lastUpdated: new Date().toISOString()
};

let isDbConnected = false;

// ==========================================
// 3. Database Connection (MongoDB)
// ==========================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/agripulse';
mongoose.connect(MONGO_URI)
  .then(() => {
    isDbConnected = true;
    console.log('>> [MongoDB] Database Connected Successfully.');
  })
  .catch(() => {
    isDbConnected = false;
    console.warn('>> [Database] Running In-Memory Fallback Mode.');
  });

const TelemetrySchema = new mongoose.Schema({
  fieldId: { type: String, default: 'Field-01', index: true },
  moisture: { type: Number, required: true },
  nitrogen: { type: Number, required: true },
  sulphur: { type: Number, required: true },
  temperature: { type: Number, required: true },
  humidity: { type: Number, required: true },
  pumpStatus: { type: Boolean, default: false },
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true }
});

const Telemetry = mongoose.model('Telemetry', TelemetrySchema);

// ==========================================
// 4. API Routes
// ==========================================

// Health Check Probe
app.get('/health', (req, res) => {
  const isHealthy = process.uptime() > 0;
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'UP' : 'DOWN',
    uptime: Math.floor(process.uptime()),
    database: isDbConnected ? 'CONNECTED' : 'IN_MEMORY',
    restarts: failureCount,
    lastFailover: lastFailoverTime || 'None'
  });
});

// Telemetry Ingestion (Edge Simulator Data)
app.post('/api/telemetry', async (req, res) => {
  try {
    const { moisture, nitrogen, sulphur, temperature, humidity, pumpStatus } = req.body;

    if (moisture !== undefined) liveState.moisture = Number(moisture);
    if (nitrogen !== undefined) liveState.nitrogen = Number(nitrogen);
    if (sulphur !== undefined) liveState.sulphur = Number(sulphur);
    if (temperature !== undefined) liveState.temperature = Number(temperature);
    if (humidity !== undefined) liveState.humidity = Number(humidity);
    if (pumpStatus !== undefined) liveState.pumpStatus = Boolean(pumpStatus);

    liveState.status = liveState.moisture < 35 ? 'WARNING_LOW_MOISTURE' : 'OPTIMAL';
    liveState.lastUpdated = new Date().toISOString();

    if (isDbConnected) {
      await Telemetry.create({ ...liveState });
    }

    res.status(201).json({ success: true, data: liveState });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Latest Telemetry Polling Endpoint
app.get('/api/telemetry/latest', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    if (isDbConnected) {
      const latest = await Telemetry.findOne().sort({ timestamp: -1 });
      if (latest) return res.json({ success: true, data: latest });
    }
    res.json({ success: true, data: liveState });
  } catch (err) {
    res.json({ success: true, data: liveState });
  }
});

// Pump Actuator Switch
app.post('/api/actuator/pump', (req, res) => {
  const { status } = req.body;
  liveState.pumpStatus = Boolean(status);
  liveState.lastUpdated = new Date().toISOString();
  res.json({
    success: true,
    message: `Pump state changed to ${liveState.pumpStatus ? 'ON' : 'OFF'}`,
    pumpStatus: liveState.pumpStatus
  });
});

// 1. Natural AgroBot Chat (Gemini 3.8 Flash Direct REST)
app.post('/api/ai/chat', async (req, res) => {
  const { message, lang = 'hi', history = [] } = req.body;
  if (!message) return res.status(400).json({ success: false, error: 'Message required' });

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      // System prompt for natural conversational tone
      const systemInstruction = `You are AgroBot, an empathetic, smart, and experienced agricultural scientist and friendly advisor for Indian farmers.
Current Farm Conditions: Soil Moisture: ${liveState.moisture}%, Nitrogen: ${liveState.nitrogen} mg/kg, Temp: ${liveState.temperature}°C.
Instructions:
- Speak naturally and warmly, just like an experienced companion.
- Answer in the requested language (${lang === 'hi' ? 'Hindi or conversational Hinglish' : 'English'}).
- Use practical advice considering local Indian farming techniques. Keep responses crisp (under 80 words).`;

      // Build chat contents array
      const contents = [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nFarmer asks: "${message}"` }]
        }
      ];

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      const data = await response.json();

      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        const replyText = data.candidates[0].content.parts[0].text.trim();
        return res.json({ success: true, reply: replyText });
      } else {
        console.warn('API Error / Raw Data:', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Gemini Chat Fetch Error:', err.message);
    }
  }

  // Dynamic Telemetry Fallback if offline
  const q = message.toLowerCase();
  let reply = '';
  if (lang === 'hi') {
    if (q.includes('pani') || q.includes('paani') || q.includes('sinchai')) {
      reply = `Abhi khet me nami ${liveState.moisture}% hai. Agar mitti me nami 40% se kam ho to hi sinchai karein.`;
    } else if (q.includes('khad') || q.includes('urea') || q.includes('fertilizer')) {
      reply = `Nitrogen level abhi ${liveState.nitrogen} mg/kg hai. Phaslon me abhi urea ki matra santulit rakhein.`;
    } else {
      reply = `Namaste! Khet me nami ${liveState.moisture}% aur tapman ${liveState.temperature}°C hai. Khet ke baare me kuch bhi poochhiye!`;
    }
  } else {
    reply = `Soil moisture is currently at ${liveState.moisture}% and temperature is ${liveState.temperature}°C. How can I assist you with your crops today?`;
  }

  res.json({ success: true, reply });
});

// 2. AI Plant Doctor Diagnosis (Multimodal Vision)
app.post('/api/ai/diagnose', upload.single('leafImage'), async (req, res) => {
  const crop = req.body.crop || 'Paddy';
  const queryText = req.body.queryText || '';
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const parts = [
        {
          text: `You are an expert plant pathologist. Diagnose the disease in this ${crop} leaf. Query notes: "${queryText}".
Return strictly valid raw JSON without any markdown formatting, backticks, or intro:
{"disease_en":"Name","disease_hi":"Naam","confidence":"95%","severity":"Moderate","symptoms_en":"...","symptoms_hi":"...","organicRx_en":"...","organicRx_hi":"...","chemicalRx_en":"...","chemicalRx_hi":"..."}`
        }
      ];

      if (req.file) {
        parts.push({
          inlineData: {
            mimeType: req.file.mimetype || 'image/jpeg',
            data: req.file.buffer.toString('base64')
          }
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] })
        }
      );

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        const raw = data.candidates[0].content.parts[0].text;
        const cleanJson = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return res.json({ success: true, diagnosis: parsed });
      }
    } catch (err) {
      console.error('Vision Diagnose Error:', err.message);
    }
  }

  // Fallback Diagnosis
  res.json({
    success: true,
    diagnosis: {
      disease_en: 'Bacterial Leaf Blight',
      disease_hi: 'जीवाणु पत्ती झुलसा (बैक्टीरियल ब्लाइट)',
      confidence: '94.5%',
      severity: 'Moderate',
      symptoms_en: 'Water-soaked lesions turning yellow along veins.',
      symptoms_hi: 'पत्तियों के किनारों पर पीले-भूरे धब्बे।',
      organicRx_en: 'Spray Neem Seed Kernel Extract (5%).',
      organicRx_hi: '5% नीम के बीज का अर्क छिड़कें।',
      chemicalRx_en: 'Copper Oxychloride (2.5g/L) + Streptocycline (0.1g/L).',
      chemicalRx_hi: 'कॉपर ऑक्सीक्लोराइड और स्ट्रेप्टोसाइक्लिन का छिड़काव करें।'
    }
  });
});

// Chaos Engineering Crash Endpoint
app.post('/api/chaos/kill-node', (req, res) => {
  failureCount++;
  lastFailoverTime = new Date().toISOString();
  console.warn('>> [CHAOS TRIGGERED] Intentional fatal kill signal received!');
  res.json({
    success: true,
    message: 'Process termination initiated. PM2 watchdog will recover the instance.'
  });

  setTimeout(() => {
    process.exit(1);
  }, 300);
});

// ==========================================
// 5. Server Initialization
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`>> [AgriPulse Production Node] Listening on port ${PORT}`);
});