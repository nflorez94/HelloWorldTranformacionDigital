require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mongoose = require('mongoose');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3001;

// Configuración de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Conexión a MongoDB establecida'))
.catch(err => console.error('Error al conectar a MongoDB:', err));

// Definición del modelo Token
const tokenSchema = new mongoose.Schema({
  originalValue: { type: String, required: true },
  tokenValue: { type: String, required: true, unique: true }
});

const Token = mongoose.model('Token', tokenSchema);

// Middleware para parsear JSON
app.use(bodyParser.json());

// Función para generar un token aleatorio
function generateToken() {
  return crypto.randomBytes(4).toString('hex');
}

// Función para anonimizar el mensaje
async function anonymizeMessage(message) {
  // Patrones para identificar PII
  const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const phonePattern = /\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;

  // Reemplazar PII con tokens
  let anonymized = message;
  const tokensMap = {};

  const replaceWithToken = (match) => {
    const token = generateToken();
    tokensMap[token] = match;
    return token;
  };

  anonymized = anonymized.replace(namePattern, replaceWithToken);
  anonymized = anonymized.replace(emailPattern, replaceWithToken);
  anonymized = anonymized.replace(phonePattern, replaceWithToken);

  console.log('Tokens generados:', tokensMap);

  // Guardar tokens en la base de datos
  for (const [token, originalValue] of Object.entries(tokensMap)) {
    try {
      const result = await Token.findOneAndUpdate(
        { tokenValue: token },
        { originalValue: originalValue },
        { upsert: true, new: true }
      );
      console.log(`Token guardado en BD: ${token} -> ${originalValue}`);
    } catch (error) {
      console.error(`Error al guardar token en BD: ${token}`, error);
    }
  }

  // Verificar tokens guardados
  for (const [token, originalValue] of Object.entries(tokensMap)) {
    const storedToken = await Token.findOne({ tokenValue: token });
    if (storedToken) {
      console.log(`Token verificado en BD: ${token} -> ${storedToken.originalValue}`);
    } else {
      console.warn(`Token no encontrado en BD: ${token}`);
    }
  }

  return anonymized;
}

// Función para desanonimizar el mensaje
async function deanonymizeMessage(anonymizedMessage) {
  let deanonymized = anonymizedMessage;
  const tokens = anonymizedMessage.match(/[a-f0-9]{8}/g) || [];

  for (const token of tokens) {
    const originalValue = await Token.findOne({ tokenValue: token });
    if (originalValue) {
      // Usamos una expresión regular para reemplazar el token exacto
      const regex = new RegExp(token, 'g');
      deanonymized = deanonymized.replace(regex, originalValue.originalValue);
    }
  }

  return deanonymized;
}

// Función para interactuar con ChatGPT
async function chatWithGPT(prompt) {
  const appendedPrompt = `${prompt}\n\nEn la respuesta debe devolver todos los datos personales usados, nombres, teléfonos, correos, etc.`;
  
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "Eres un asistente útil que siempre incluye los datos personales mencionados en la consulta en tu respuesta." },
      { role: "user", content: appendedPrompt }
    ],
  });
  return completion.choices[0].message.content;
}

// Nuevo endpoint secureChatGPT
app.post('/secureChatGPT', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Se requiere un prompt' });
  }

  try {
    const anonymizedPrompt = await anonymizeMessage(prompt);
    console.log('Prompt anonimizado:', anonymizedPrompt);

    let response;
    try {
      const anonymizedResponse = await chatWithGPT(anonymizedPrompt);
      console.log('Respuesta anonimizada:', anonymizedResponse);
      response = await deanonymizeMessage(anonymizedResponse);
      console.log('Respuesta desanonimizada:', response);
    } catch (openAIError) {
      if (openAIError.error && openAIError.error.code === 'insufficient_quota') {
        console.warn('Cuota de API de OpenAI excedida, usando respuesta alternativa');
        response = await fallbackResponse(prompt);
      } else {
        throw openAIError;
      }
    }

    res.json({ response });
  } catch (error) {
    console.error('Error en secureChatGPT:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud', details: error.message });
  }
});

// Función para respuesta alternativa
async function fallbackResponse(prompt) {
  return `Lo siento, no puedo procesar tu solicitud en este momento debido a limitaciones técnicas. Tu mensaje fue: "${prompt}". En una respuesta normal, incluiría todos los datos personales mencionados en la consulta.`;
}

// Endpoint para anonimizar
app.post('/anonymize', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Se requiere un mensaje' });
  }

  const anonymizedMessage = await anonymizeMessage(message);
  res.json({ anonymizedMessage });
});

// Endpoint para desanonimizar
app.post('/deanonymize', async (req, res) => {
  const { anonymizedMessage } = req.body;
  if (!anonymizedMessage) {
    return res.status(400).json({ error: 'Se requiere un mensaje anonimizado' });
  }

  try {
    const deanonymizedMessage = await deanonymizeMessage(anonymizedMessage);
    res.json({ deanonymizedMessage });
  } catch (error) {
    console.error('Error al desanonimizar:', error);
    res.status(500).json({ error: 'Error al desanonimizar el mensaje' });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});