import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Message = { role: "user" | "assistant"; content: string };

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

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

  const getLivePriceContext = async (): Promise<string> => {
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("price_data")
        .select("price, mandi_name, mandi_location, recorded_at, commodities(name)")
        .gte("recorded_at", yesterday)
        .order("recorded_at", { ascending: false })
        .limit(60);
      if (!data || data.length === 0) return "";
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
      const today = new Date().toLocaleDateString("en-IN");
      const lines = Object.entries(priceMap)
        .map(([v, d]) => `${v}: ₹${d.price.toFixed(2)}/kg (${d.dist})`)
        .join(", ");
      return lines ? ` Today's prices (${today}): ${lines}.` : "";
    } catch { return ""; }
  };

  const getPredictionContext = async (query: string): Promise<string> => {
    try {
      const vegs = ["Tomato","Onion","Potato","Brinjal","Cabbage","Cauliflower","Carrot","Beans","Capsicum","Lady Finger","Drumstick","Pumpkin"];
      const mentioned = vegs.find(v => query.toLowerCase().includes(v.toLowerCase()));
      if (!mentioned) return "";
      const { data: comm } = await supabase.from("commodities").select("id").eq("name", mentioned).single();
      if (!comm) return "";
      const { data: preds } = await supabase
        .from("predictions")
        .select("predicted_price, prediction_date")
        .eq("commodity_id", comm.id)
        .gte("prediction_date", new Date().toISOString().split("T")[0])
        .order("prediction_date").limit(7);
      if (!preds?.length) return "";
      const lines = preds.map(p => `${p.prediction_date}: ₹${Number(p.predicted_price).toFixed(0)}`).join(", ");
      return ` ${mentioned} 7-day forecast: ${lines}.`;
    } catch { return ""; }
  };

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userMsg: Message = { role: "user", content: input };
    const currentMessages = [...messagesRef.current, userMsg];
    updateMessages(() => [...currentMessages, { role: "assistant", content: "" }]);
    setIsLoading(true);
    setError(null);

    try {
      const [priceCtx, predCtx] = await Promise.all([
        getLivePriceContext(),
        getPredictionContext(input),
      ]);

      const systemPrompt = `You are AgriPrice AI — a smart agricultural market assistant for Tamil Nadu farmers and traders. You help with vegetable prices, market predictions, weather impact on crops, best time to sell, and farming tips. Always give practical advice. Use ₹ for prices. Be concise and friendly.${priceCtx}${predCtx}`;

      const response = await fetch(`${BACKEND}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: currentMessages,
          system: systemPrompt,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`Server error ${response.status}`);
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
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.delta?.text || parsed.content?.[0]?.text || "";
            if (delta) {
              fullContent += delta;
              updateMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullContent };
                return updated;
              });
            }
          } catch (_e) { /* skip */ }
        }
      }

      if (!fullContent) {
        updateMessages(prev => prev.filter((_, i) => !(i === prev.length - 1 && prev[i].content === "")));
        setError("No response received. Please try again.");
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      updateMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
      setError("Failed to connect to AI. Make sure backend is running on port 8000.");
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
