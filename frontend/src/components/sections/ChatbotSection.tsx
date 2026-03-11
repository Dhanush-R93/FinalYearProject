import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Send, Bot, User, Loader2, MessageSquare, RefreshCw, Sparkles, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIChat } from "@/hooks/useAIChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const quickPrompts = [
  { text: "What's the price of tomatoes?", emoji: "🍅" },
  { text: "Predict onion prices for next week", emoji: "📈" },
  { text: "Best time to sell potatoes?", emoji: "🥔" },
  { text: "Compare prices across mandis", emoji: "🏪" },
  { text: "Storage tips for vegetables", emoji: "❄️" },
  { text: "Give me market insights", emoji: "💡" },
];

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 p-2 h-8 w-8 rounded-lg bg-primary text-primary-foreground">
        <Bot className="h-4 w-4" />
      </div>
      <div className="bg-muted rounded-xl px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function ChatbotSection() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useAIChat();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleVoiceResult = useCallback((text: string) => {
    setInputValue(text);
    toast.success("Voice captured! Tap send or keep editing.");
  }, []);

  const { isListening, isSupported: micSupported, startListening, stopListening } = useSpeechRecognition(handleVoiceResult);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [inputValue]);

  const handleSend = async (text?: string) => {
    const messageText = text || inputValue;
    if (!messageText.trim() || isLoading) return;

    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    await sendMessage(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section id="chatbot" className="py-16 bg-muted/30">
      <div className="container px-4">
        <div className="section-header">
          <div className="badge-primary mb-4">
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </div>
          <h2 className="section-title">AgriPrice AI Chat</h2>
          <p className="section-description">
            Get instant answers about market prices, predictions, and farming advice
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="card-elevated overflow-hidden">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="relative p-2 rounded-lg bg-primary text-primary-foreground">
                  <Bot className="h-5 w-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-price-up border-2 border-background" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">AgriPrice AI</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {isLoading ? (
                        <span className="text-price-up font-medium">Typing...</span>
                      ) : (
                        "Online • Powered by Gemini"
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <span className="text-[10px] text-muted-foreground mr-2">
                    {messages.filter(m => m.role === "user").length} messages
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={clearMessages} className="text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-[28rem] overflow-y-auto p-6 space-y-4 scroll-smooth">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 bg-primary/10 rounded-2xl rotate-6" />
                    <div className="absolute inset-0 bg-primary/5 rounded-2xl -rotate-3" />
                    <div className="relative flex items-center justify-center w-full h-full bg-muted rounded-2xl">
                      <MessageSquare className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <p className="text-foreground font-medium mb-1">How can I help you today?</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Ask about prices, predictions, storage tips, and more
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg mx-auto">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt.text}
                        onClick={() => handleSend(prompt.text)}
                        disabled={isLoading}
                        className="text-left p-3 rounded-xl bg-background border border-border hover:border-primary/30 hover:bg-primary/5 text-sm text-foreground transition-all disabled:opacity-50 group"
                      >
                        <span className="text-lg mb-1 block">{prompt.emoji}</span>
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
                          {prompt.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.role === "user" ? "flex-row-reverse" : ""
                  )}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 p-2 h-8 w-8 rounded-lg",
                      message.role === "user"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-table:text-xs">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <TypingIndicator />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick follow-ups after response */}
            {messages.length > 0 && !isLoading && messages[messages.length - 1]?.role === "assistant" && (
              <div className="px-6 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
                {["Tell me more", "Compare mandis", "Price trends"].map((followUp) => (
                  <button
                    key={followUp}
                    onClick={() => handleSend(followUp)}
                    className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-border bg-background">
              <div className="flex gap-3 items-end">
                {micSupported && (
                  <Button
                    type="button"
                    variant={isListening ? "destructive" : "outline"}
                    size="icon"
                    className={cn("rounded-xl h-12 w-12 flex-shrink-0", isListening && "animate-pulse")}
                    onClick={isListening ? stopListening : startListening}
                    disabled={isLoading}
                    title={isListening ? "Stop listening" : "Speak your query"}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={isListening ? "Listening..." : "Ask about prices, predictions, or tips..."}
                  className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background min-h-[48px] max-h-[120px] transition-colors"
                  rows={1}
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isLoading}
                  className="btn-primary px-4 rounded-xl h-12"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                AI can make mistakes. Verify important decisions with local experts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}