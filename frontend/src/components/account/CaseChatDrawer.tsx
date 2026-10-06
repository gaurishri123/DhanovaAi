"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Sparkles,
  Bot,
  User,
  RefreshCw,
} from "lucide-react";
import { sendCaseChat } from "@/lib/api";
import { ChatMessage } from "@/types/account";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface CaseChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  riskScore: number;
}

export const CaseChatDrawer: React.FC<CaseChatDrawerProps> = ({
  isOpen,
  onClose,
  accountId,
  accountName,
  riskScore,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatSource, setChatSource] = useState<"live" | "mock" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Initialize greeting on open
  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      initializedRef.current = true;
      setMessages([
        {
          id: "msg_init",
          sender: "assistant",
          text: `Hello Officer. I am the Dhanova AI Forensic Assistant. I have loaded full context for case ${accountId} (${accountName}, Risk Score: ${riskScore}/100). How can I assist your investigation?`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, accountId, accountName, riskScore]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendCaseChat(accountId, q);
      setChatSource(res.source);
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "assistant",
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: "assistant",
        text: "I was unable to retrieve a response from the reasoning service. Please check backend connection.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "Summarize this account's suspicious activity",
    "Does this account show structuring under ₹10,000?",
    "Is this account part of a coordinated fraud ring?",
    "What is the recommended statutory hold action?",
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Drawer */}
      <div className="relative z-50 w-full max-w-lg bg-slate-900/95 border-l border-slate-800 shadow-2xl flex flex-col h-full backdrop-blur-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-md shadow-indigo-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">Gemini Case Intelligence</h3>
                {chatSource === "live" ? (
                  <Badge variant="cyan" size="sm" className="text-[10px] py-0">
                    Live Gemini
                  </Badge>
                ) : (
                  <Badge variant="secondary" size="sm" className="text-[10px] py-0">
                    Model Bridge
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Context: {accountId} ({riskScore}/100)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => {
            const isUser = m.sender === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-3 text-xs leading-relaxed ${
                  isUser ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isUser
                      ? "bg-blue-600 text-white"
                      : "bg-indigo-600/30 border border-indigo-500/40 text-indigo-300"
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div
                  className={`p-3.5 rounded-2xl max-w-[85%] ${
                    isUser
                      ? "bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-900/20"
                      : "bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-none shadow-lg"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  <div
                    className={`text-[10px] mt-1.5 ${
                      isUser ? "text-blue-200 text-right" : "text-slate-500"
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-indigo-400 p-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Analyzing case parameters and SHAP vectors...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors text-left truncate max-w-full"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              id="case-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Gemini about this account's risk factors..."
              className="flex-1 text-xs bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <Button
              id="case-chat-send-btn"
              type="submit"
              size="sm"
              disabled={loading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 rounded-xl h-auto"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
