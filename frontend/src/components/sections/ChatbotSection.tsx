import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, RefreshCw, Sparkles, Mic, MicOff, X, TrendingUp, CloudRain, ShoppingCart, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIChat } from "@/hooks/useAIChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const QUICK_PROMPTS = [
  { text: "What are today's tomato prices?", emoji: "🍅", icon: TrendingUp },
  { text: "Predict onion prices for next week", emoji: "📈", icon: TrendingUp },
  { text: "Will rain affect vegetable prices?", emoji: "🌧️", icon: CloudRain },
  { text: "Best vegetables to sell this week?", emoji: "💡", icon: Sparkles },
  { text: "Compare Salem vs Coimbatore prices", emoji: "🏪", icon: ShoppingCart },
  { text: "Storage tips for tomatoes", emoji: "❄️", icon: Package },
];

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
        <Bot className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map(delay => (
            <span key={delay} className="h-2 w-2 rounded-full bg-primary/50 animate-bounce"
              style={{ animationDelay: `${delay}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isLast }: { message: { role: string; content: string }; isLast: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm",
        isUser ? "bg-secondary" : "bg-primary"
      )}>
        {isUser
          ? <User className="h-4 w-4 text-secondary-foreground" />
          : <Bot className="h-4 w-4 text-primary-foreground" />}
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[80%] px-4 py-3 text-sm leading-relaxed shadow-sm",
        isUser
          ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
          : "bg-muted text-foreground rounded-2xl rounded-tl-none"
      )}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none
            prose-p:my-1 prose-ul:my-1 prose-li:my-0.5
            prose-strong:font-semibold prose-code:text-xs
            prose-headings:text-sm prose-headings:font-bold prose-headings:my-1">
            <ReactMarkdown>{message.content || "▊"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatbotSection() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useAIChat();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  const handleVoiceResult = useCallback((text: string) => {
    setInputValue(text);
    toast.success("Voice captured!");
  }, []);

  const { isListening, isSupported: micSupported, startListening, stopListening } =
    useSpeechRecognition(handleVoiceResult);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    setShowQuickPrompts(false);
    await sendMessage(text);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleQuickPrompt = (text: string) => {
    setShowQuickPrompts(false);
    sendMessage(text);
  };

  const hasMessages = messages.length > 0;

  return (
    <section id="ai-chat" className="py-16">
      <div className="container px-4">

        {/* Header */}
        <div className="section-header">
          <div className="badge-primary mb-4">
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </div>
          <h2 className="section-title">AgriPrice AI Chat</h2>
          <p className="section-description">
            Ask about live vegetable prices, predictions, weather impact, and market tips
          </p>
        </div>

        {/* Chat container */}
        <div className="max-w-3xl mx-auto">
          <div className="card-elevated rounded-3xl overflow-hidden flex flex-col" style={{ height: "600px" }}>

            {/* Chat header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background"/>
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">AgriPrice AI</p>
                  <p className="text-xs text-green-500 font-medium">● Online · Real-time market data</p>
                </div>
              </div>
              {hasMessages && (
                <button onClick={() => { clearMessages(); setShowQuickPrompts(true); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 px-3 py-1.5 rounded-xl transition-all">
                  <RefreshCw className="h-3 w-3" />
                  New chat
                </button>
              )}
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {!hasMessages && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-lg mb-1">Hello! I'm AgriPrice AI 👋</p>
                    <p className="text-muted-foreground text-sm max-w-sm">
                      Ask me about vegetable prices, market predictions, weather impact, or trading tips.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} isLast={i === messages.length - 1} />
              ))}

              {isLoading && messages[messages.length - 1]?.role !== "assistant" && <TypingIndicator />}

              {error && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Error</p>
                    <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            {showQuickPrompts && !hasMessages && (
              <div className="px-5 pb-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Quick questions:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map(p => (
                    <button key={p.text} onClick={() => handleQuickPrompt(p.text)}
                      className="flex items-center gap-1.5 text-xs bg-muted hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30 px-3 py-2 rounded-xl transition-all font-medium text-muted-foreground">
                      <span>{p.emoji}</span>
                      <span className="max-w-[160px] truncate">{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-border p-4">
              <div className={cn(
                "flex items-end gap-3 bg-muted/50 rounded-2xl px-4 py-3 transition-all",
                "focus-within:bg-muted focus-within:ring-1 focus-within:ring-primary/30"
              )}>
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about prices, predictions, market tips..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-32 leading-relaxed"
                  style={{ minHeight: "24px" }}
                />
                <div className="flex items-center gap-2 shrink-0">
                  {micSupported && (
                    <button onClick={isListening ? stopListening : startListening}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        isListening
                          ? "bg-red-500/10 text-red-500 animate-pulse"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}>
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                  <button onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      inputValue.trim() && !isLoading
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    )}>
                    {isLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Powered by Claude AI · Real-time Tamil Nadu market data
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
