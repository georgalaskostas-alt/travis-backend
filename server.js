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
    live_web_enabled: true,
    structured_output_enabled: true
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
              "Always return valid JSON matching the required schema. " +
              "The field 'reply' must contain the final Greek answer for the user. " +
              "The field 'usedWebSearch' must be true if live/current web information was used. " +
              "The field 'sources' must contain up to 5 distinct sources with title and url. " +
              "If no reliable sources are available, return an empty sources array."
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        tools: [
          { type: "openrouter:web_search" }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "travis_response",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reply: {
                  type: "string",
                  description: "The assistant's final answer in Greek."
                },
                usedWebSearch: {
                  type: "boolean",
                  description: "Whether web search was used."
                },
                sources: {
                  type: "array",
                  description: "List of web sources used for the answer.",
                  items: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "Human-readable source title."
                      },
                      url: {
                        type: "string",
                        description: "Source URL."
                      }
                    },
                    required: ["title", "url"],
                    additionalProperties: false
                  }
                }
              },
              required: ["reply", "usedWebSearch", "sources"],
              additionalProperties: false
            }
          }
        },
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

    const rawContent = data?.choices?.[0]?.message?.content;

    if (!rawContent) {
      return res.status(500).json({
        error: "Empty reply from OpenRouter",
        details: data
      });
    }

    let parsed;
    try {
      parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch (parseError) {
      return res.status(500).json({
        error: "Failed to parse structured model output",
        rawContent,
        details: parseError instanceof Error ? parseError.message : String(parseError)
      });
    }

    const reply =
      typeof parsed?.reply === "string" ? parsed.reply.trim() : "";

    const usedWebSearch = Boolean(parsed?.usedWebSearch);

    const sources = Array.isArray(parsed?.sources)
      ? parsed.sources
          .filter((source) => source && typeof source.title === "string" && typeof source.url === "string")
          .map((source) => ({
            title: source.title.trim(),
            url: source.url.trim()
          }))
          .filter((source) => source.title && source.url)
          .slice(0, 5)
      : [];

    if (!reply) {
      return res.status(500).json({
        error: "Structured output missing reply",
        details: parsed
      });
    }

    return res.json({
      reply,
      usedWebSearch,
      sources
    });
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
