import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Message = { role: "user" | "assistant"; content: string };

// System prompt with live context
const SYSTEM_PROMPT = `You are AgriPrice AI — a smart agricultural market assistant for Tamil Nadu farmers and traders.

You help with:
- Current vegetable prices across Tamil Nadu mandis (Koyambedu, Salem, Coimbatore, Madurai etc.)
- Price predictions for the next 10 days
- Weather impact on vegetable prices
- Best time to buy/sell vegetables
- Market insights and trading tips
- Storage and transport advice

You have access to real market data from data.gov.in Agmarknet.
Always give practical, actionable advice. Use ₹ for prices. Be concise and friendly.
When asked about prices, mention the district/mandi if known.`;

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const updateMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessages(prev => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  };

  // Fetch live price context from Supabase
  const getLivePriceContext = async (): Promise<string> => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      const { data } = await supabase
        .from("price_data")
        .select("price, mandi_name, mandi_location, recorded_at, commodities(name)")
        .gte("recorded_at", yesterday)
        .eq("source", "agmarknet_gov_in")
        .order("recorded_at", { ascending: false })
        .limit(50);

      if (!data || data.length === 0) return "";

      // Group by commodity → latest price
      const priceMap: Record<string, { price: number; mandi: string; dist: string }> = {};
      for (const row of data) {
        const name = (row.commodities as any)?.name;
        if (name && !priceMap[name]) {
          priceMap[name] = {
            price: Number(row.price),
            mandi: row.mandi_name?.split("(")[0].trim() || "",
            dist: row.mandi_location || "",
          };
        }
      }

      const lines = Object.entries(priceMap)
        .map(([veg, d]) => `${veg}: ₹${d.price.toFixed(2)}/kg at ${d.mandi}, ${d.dist}`)
        .join("\n");

      return lines ? `\n\nLIVE MARKET PRICES (${today}):\n${lines}` : "";
    } catch { return ""; }
  };

  // Fetch predictions context
  const getPredictionContext = async (query: string): Promise<string> => {
    try {
      // Check if query mentions a vegetable
      const vegs = ["Tomato","Onion","Potato","Brinjal","Cabbage","Cauliflower","Carrot","Beans","Capsicum","Lady Finger","Drumstick","Pumpkin"];
      const mentioned = vegs.find(v => query.toLowerCase().includes(v.toLowerCase()));
      if (!mentioned) return "";

      const { data: comm } = await supabase
        .from("commodities").select("id").eq("name", mentioned).single();
      if (!comm) return "";

      const { data: preds } = await supabase
        .from("predictions")
        .select("predicted_price, prediction_date, confidence_score")
        .eq("commodity_id", comm.id)
        .gte("prediction_date", new Date().toISOString().split("T")[0])
        .order("prediction_date")
        .limit(7);

      if (!preds || preds.length === 0) return "";

      const lines = preds
        .map(p => `  ${p.prediction_date}: ₹${Number(p.predicted_price).toFixed(2)}/kg (${Math.round((p.confidence_score || 0.85) * 100)}% confidence)`)
        .join("\n");

      return `\n\n${mentioned.toUpperCase()} 7-DAY FORECAST:\n${lines}`;
    } catch { return ""; }
  };

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // Cancel any previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userMsg: Message = { role: "user", content: input };
    const currentMessages = [...messagesRef.current, userMsg];
    updateMessages(() => currentMessages);
    setIsLoading(true);
    setError(null);

    // Add empty assistant message for streaming
    updateMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      // Get live context in parallel
      const [priceCtx, predCtx] = await Promise.all([
        getLivePriceContext(),
        getPredictionContext(input),
      ]);

      const systemWithContext = SYSTEM_PROMPT + priceCtx + predCtx;

      // Call Anthropic API directly with streaming
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          stream: true,
          system: systemWithContext,
          messages: currentMessages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]" || !data) continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.delta?.text || parsed.delta?.content?.[0]?.text || "";
            if (delta) {
              fullContent += delta;
              updateMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullContent };
                return updated;
              });
            }
          } catch (_ignore) { /* skip malformed chunks */ }
        }
      }

    } catch (e: any) {
      if (e.name === "AbortError") return;
      console.error("AI Chat error:", e);

      // Remove empty assistant message
      updateMessages(prev => prev.filter((_, i) => {
        if (i === prev.length - 1 && prev[i].role === "assistant" && !prev[i].content) return false;
        return true;
      }));

      // Friendly error messages
      const msg = e.message || "";
      if (msg.includes("401") || msg.includes("api-key")) {
        setError("AI API key not configured. Add VITE_ANTHROPIC_API_KEY to frontend .env");
      } else if (msg.includes("529") || msg.includes("overloaded")) {
        setError("AI is busy right now — please try again in a moment.");
      } else {
        setError("Failed to get response. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    messagesRef.current = [];
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
