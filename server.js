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
    service: "travis-openrouter-proxy",
    live_web_enabled: true
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

    const userMessage = message.trim();

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
            content:
              "You are TRAVIS, a helpful AI assistant for a Greek-speaking user. Reply clearly in Greek. " +
              "If the user asks for current, recent, breaking, live, time-sensitive, news, price, weather, sports, stock, or web-dependent information, use web search before answering. " +
              "When web search is used, give a concise answer grounded in the search results and include source links when available."
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        tools: [
          { type: "openrouter:web_search" }
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
      return res.status(500).json({
        error: "Empty reply from OpenRouter",
        details: data
      });
    }

    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.listen(PORT, () => {
  console.log(`TRAVIS backend listening on port ${PORT}`);
});
