import express from "express";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "50mb" }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set on the server. Please check the Secrets panel.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Gemini API endpoint (non-streaming)
app.post("/api/gemini/generate", async (req, res) => {
  try {
    const { model, contents, config } = req.body;

    let ai: GoogleGenAI;
    try {
      ai = getGeminiClient();
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }

    let activeModel = model || "gemini-3.8-flash";
    let response;

    try {
      const primaryCall = ai.models.generateContent({
        model: activeModel,
        contents,
        config: {
          ...config,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      if (activeModel === "gemini-3.8-flash") {
        const timeout = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("PRIMARY_TIMEOUT")), 3500)
        );
        response = await Promise.race([primaryCall, timeout]);
      } else {
        response = await primaryCall;
      }
    } catch (primaryError: any) {
      const errMsg = primaryError?.message || "";
      const isCapacityError = 
        errMsg === "PRIMARY_TIMEOUT" ||
        primaryError?.status === 503 || 
        primaryError?.status === 429 || 
        errMsg.includes("503") || 
        errMsg.includes("UNAVAILABLE") || 
        errMsg.includes("high demand") || 
        errMsg.includes("RESOURCE_EXHAUSTED");

      if (isCapacityError && activeModel !== "gemini-3.1-flash-lite") {
        console.warn(`Primary model ${activeModel} capacity limit (${primaryError?.status || primaryError?.message || '503'}). Falling back to gemini-3.1-flash-lite...`);
        activeModel = "gemini-3.1-flash-lite";
        response = await ai.models.generateContent({
          model: activeModel,
          contents,
          config,
        });
      } else {
        throw primaryError;
      }
    }

    res.json({ text: response.text, model: activeModel });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let msg = error?.message || "An error occurred while calling Gemini API";
    if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
      msg = "Beacon AI is currently experiencing high demand. Please try again in a few moments.";
    }
    res.status(error.status || 500).json({ error: msg });
  }
});

// Gemini API endpoint (streaming)
app.post("/api/gemini/stream", async (req, res) => {
  try {
    const { model, contents, config } = req.body;

    let ai: GoogleGenAI;
    try {
      ai = getGeminiClient();
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }

    let activeModel = model || "gemini-3.8-flash";
    let result;

    try {
      const primaryStreamCall = ai.models.generateContentStream({
        model: activeModel,
        contents,
        config: {
          ...config,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      if (activeModel === "gemini-3.8-flash") {
        const timeout = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("PRIMARY_TIMEOUT")), 3500)
        );
        result = await Promise.race([primaryStreamCall, timeout]);
      } else {
        result = await primaryStreamCall;
      }
    } catch (primaryError: any) {
      const errMsg = primaryError?.message || "";
      const isCapacityError = 
        errMsg === "PRIMARY_TIMEOUT" ||
        primaryError?.status === 503 || 
        primaryError?.status === 429 || 
        errMsg.includes("503") || 
        errMsg.includes("UNAVAILABLE") || 
        errMsg.includes("high demand") || 
        errMsg.includes("RESOURCE_EXHAUSTED");

      if (isCapacityError && activeModel !== "gemini-3.1-flash-lite") {
        console.warn(`Primary stream model ${activeModel} capacity limit (${primaryError?.status || primaryError?.message || '503'}). Falling back to gemini-3.1-flash-lite...`);
        activeModel = "gemini-3.1-flash-lite";
        result = await ai.models.generateContentStream({
          model: activeModel,
          contents,
          config,
        });
      } else {
        throw primaryError;
      }
    }

    // Headers set only once generator is successfully acquired
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Gemini Stream Error:", error);
    let msg = error?.message || "An error occurred while calling Gemini API";
    if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
      msg = "Beacon AI is currently experiencing high demand. Please try again in a few moments.";
    }
    if (!res.headersSent) {
      res.status(error.status || 500).json({ error: msg });
    } else {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  }
});

// Setup server
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  if (isProd) {
    // Serve static files from the 'dist' directory
    app.use(express.static(path.join(__dirname, "dist")));
    
    // Handle SPA routing
    app.get("*", (req, res) => {
      // Don't intercept API routes
      if (req.path.startsWith("/api/")) return;
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  } else {
    // Vite middleware for development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${port} (${isProd ? "production" : "development"})`);
  });
}

startServer();
