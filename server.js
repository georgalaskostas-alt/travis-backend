import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "travis-openrouter-proxy"
  });
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Missing or invalid message" });
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY on server" });
    }

    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://travis-ios-ai.local",
        "X-Title": "TRAVIS IOS AI"
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "You are TRAVIS, a helpful AI assistant for a Greek-speaking user. Reply clearly in Greek."
          },
          {
            role: "user",
            content: message.trim()
          }
        ],
        temperature: 0.7
      })
    });

    const data = await openRouterResponse.json();

    if (!openRouterResponse.ok) {
      return res.status(openRouterResponse.status).json({
        error: "OpenRouter request failed",
        details: data
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({ error: "Empty reply from OpenRouter" });
    }

    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`TRAVIS backend listening on port ${PORT}`);
});
