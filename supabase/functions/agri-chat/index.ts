// supabase/functions/agri-chat/index.ts
// ─────────────────────────────────────────
// NLP Agricultural Chatbot — Supabase Edge Function
//
// Provides multilingual (en/hi/ta/te) advisory on:
//   - Crop prices and forecasts
//   - Best time to sell / store
//   - Mandi arbitrage opportunities
//   - Weather impact on prices
//   - Storage & post-harvest advice
//
// Deploy: supabase functions deploy agri-chat

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const BACKEND_URL       = Deno.env.get("BACKEND_URL") ?? "http://localhost:8000";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Agricultural domain system prompt ──────────────────────────
const SYSTEM_PROMPT = `You are AgriBot, an expert agricultural market advisor for Indian farmers and traders.

Your expertise:
- Vegetable and crop price analysis using LSTM AI forecasting
- Agmarknet (Mandi) price data interpretation  
- Seasonal price patterns (Kharif/Rabi/Zaid seasons)
- Post-harvest storage strategies to maximize profit
- Mandi arbitrage opportunities (buy low in one market, sell high in another)
- Weather impact on crop prices
- Government schemes: MSP, PM-KISAN, e-NAM platform
- Multilingual support (English, Hindi, Tamil, Telugu)

Response guidelines:
- Give specific, actionable advice (e.g., "Tomato prices in Tamil Nadu are expected to rise 12% next week — hold stock if possible")
- Mention INR/quintal prices when discussing prices
- Reference real government data sources (Agmarknet, data.gov.in)
- Keep responses concise (3-5 sentences max unless detailed analysis requested)
- If asked in Hindi/Tamil/Telugu, respond in the same language
- Always end advisory responses with one key action farmers should take

Personality: Knowledgeable but warm and approachable — like a trusted local expert.`;


serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, commodity, state } = await req.json();

    // ── Optionally enrich with live price context ───────────────
    let priceContext = "";
    if (commodity) {
      try {
        const priceRes = await fetch(
          `${BACKEND_URL}/prices/live?commodity=${encodeURIComponent(commodity)}&state=${encodeURIComponent(state ?? "")}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          const latest = priceData.prices?.[0];
          if (latest) {
            priceContext = `\n[Live data: ${commodity} modal price today = ₹${latest.modal_price}/quintal in ${latest.mandi} (${latest.state})]`;
          }
        }
      } catch (_) { /* timeout — proceed without price context */ }
    }

    // ── Optionally fetch 7-day prediction context ───────────────
    let forecastContext = "";
    if (commodity) {
      try {
        const predRes = await fetch(`${BACKEND_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commodity, state, horizon: 7 }),
          signal: AbortSignal.timeout(8000),
        });
        if (predRes.ok) {
          const predData = await predRes.json();
          const preds = predData.predictions?.slice(0, 3) ?? [];
          if (preds.length > 0) {
            forecastContext = `\n[AI Forecast: ${preds.map((p: any) =>
              `${p.date}: ₹${p.predicted_price_inr_quintal}/q`
            ).join(", ")}]`;
          }
        }
      } catch (_) { /* proceed without forecast context */ }
    }

    const enrichedSystem = SYSTEM_PROMPT + priceContext + forecastContext;

    // ── Stream from Claude ──────────────────────────────────────
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key":         ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system:     enrichedSystem,
        messages:   messages ?? [],
        stream:     true,
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error ${claudeRes.status}: ${err}`);
    }

    // ── Transform Anthropic SSE → OpenAI-compatible SSE ────────
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            try {
              const event = JSON.parse(trimmed.slice(6));
              // Extract text delta from content_block_delta events
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta"
              ) {
                const openAIChunk = JSON.stringify({
                  choices: [{ delta: { content: event.delta.text } }],
                });
                controller.enqueue(
                  new TextEncoder().encode(`data: ${openAIChunk}\n\n`)
                );
              }
            } catch (_) {}
          }
        }
      },
      flush(controller) {
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      },
    });

    return new Response(claudeRes.body!.pipeThrough(transformStream), {
      headers: {
        ...corsHeaders,
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });

  } catch (err) {
    console.error("agri-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
