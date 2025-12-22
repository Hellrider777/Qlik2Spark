import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { convertQlikChunk } from './llm-service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Convert endpoint
app.post('/api/convert', async (req, res) => {
  console.log('\n📥 [API] Received conversion request');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

  try {
    const { qlikCode, context } = req.body;

    if (!qlikCode) {
      console.log('❌ [API] Missing qlikCode in request');
      return res.status(400).json({
        success: false,
        error: 'qlikCode is required',
      });
    }

    console.log(
      `📊 Request details: ${qlikCode.length} chars, context: ${
        context || 'none'
      }`
    );
    console.log('🔄 Calling LLM service...');

    const result = await convertQlikChunk(qlikCode, context);

    if (result.success) {
      console.log('✅ [API] Conversion successful, sending response');
    } else {
      console.log('❌ [API] Conversion failed:', result.error);
    }

    res.json(result);
  } catch (error) {
    console.error('❌ [API] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Qlik2Spark API server running on http://localhost:${PORT}`);
  console.log(`✅ Gemini API configured: ${!!process.env.GEMINI_API_KEY}`);
});
