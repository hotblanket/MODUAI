import React, { useState, useRef, useEffect } from "react";
import { Send, Image as ImageIcon, MessageSquare, Code, Brain, Trash2, Bot, User, Sparkles, Loader2, Plus, Menu, X, Settings2, Terminal, BookOpen, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { chatWithGemini, generateImageWithGemini } from "./services/geminiService";
import { cn } from "./lib/utils";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  type: "text" | "image";
  timestamp: Date;
  model?: "Gemini" | "ChatGPT" | "Claude";
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  mode: "chat" | "image" | "problem" | "coding";
  model: "Gemini" | "ChatGPT" | "Claude";
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    return [{
      id: "default",
      title: "새로운 대화",
      mode: "chat",
      model: "Gemini",
      messages: [
        {
          id: "1",
          role: "ai",
          content: "안녕하세요! 'MODU AI'입니다. 어떤 도움을 드릴까요?\n\n대화, 코딩, 문제 풀이, 그리고 이미지 생성까지 무엇이든 물어보세요! 👋",
          type: "text",
          timestamp: new Date(),
          model: "Gemini",
        },
      ],
      createdAt: new Date(),
    }];
  });
  const [activeSessionId, setActiveSessionId] = useState("default");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [input, setInput] = useState("");

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession.messages;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeSessionId]);

  const setMode = (mode: ChatSession["mode"]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, mode } : s));
  };

  const setModel = (model: ChatSession["model"]) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, model } : s));
  };

  const createNewChat = (mode: ChatSession["mode"] = "chat", model: ChatSession["model"] = "Gemini") => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "새로운 대화",
      mode,
      model,
      messages: [
        {
          id: "1",
          role: "ai",
          content: `안녕하세요! ${model} 엔진을 사용한 ${mode === "chat" ? "대화" : mode === "image" ? "이미지 생성" : mode === "problem" ? "문제 풀이" : "코딩"} 모드를 시작합니다. 무엇을 도와드릴까요?`,
          type: "text",
          timestamp: new Date(),
          model,
        },
      ],
      createdAt: new Date(),
    };
    if (isMobile) setIsSidebarOpen(false);
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      type: "text",
      timestamp: new Date(),
    };

    // Update title if it's the first real message
    const isFirstRealMessage = activeSession.messages.length === 1 && activeSession.messages[0].role === "ai";
    const newTitle = isFirstRealMessage ? (input.length > 20 ? input.substring(0, 20) + "..." : input) : activeSession.title;

    setSessions(prev => prev.map(s => 
      s.id === activeSessionId 
        ? { ...s, title: newTitle, messages: [...s.messages, userMessage] }
        : s
    ));
    
    setInput("");
    setIsLoading(true);

    try {
      // Check if user wants an image
      const imageKeywords = ["그려줘", "그림", "이미지", "생성", "생성해", "draw", "generate image"];
      const isImageRequest = imageKeywords.some((keyword) => input.toLowerCase().includes(keyword));

      if (isImageRequest || activeSession.mode === "image") {
        const imageUrl = await generateImageWithGemini(input);
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: imageUrl,
          type: "image",
          timestamp: new Date(),
          model: activeSession.model,
        };
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId 
            ? { ...s, messages: [...s.messages, aiMessage] }
            : s
        ));
      } else {
        const history = messages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.type === "text" ? m.content : "[이미지 메시지]" }],
        }));
        
        const response = await chatWithGemini(input, history as any, activeSession.model);
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: response || "죄송합니다. 답변을 생성하지 못했습니다.",
          type: "text",
          timestamp: new Date(),
          model: activeSession.model,
        };
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId 
            ? { ...s, messages: [...s.messages, aiMessage] }
            : s
        ));
      }
    } catch (error: any) {
      let errorText = "죄송합니다. 현재 요청을 처리하는 중에 문제가 발생했습니다. 일시적인 네트워크 오류일 수 있으니 잠시 후 다시 시도해 주세요.";
      
      const errorString = error?.message || String(error);
      if (errorString.includes("429") || errorString.includes("RESOURCE_EXHAUSTED")) {
        errorText = "죄송합니다. 현재 사용 가능한 할당량(Quota)을 모두 소진했습니다. 잠시 후 다시 시도하시거나, [설정 > 비밀번호] 패널에서 결제가 활성화된 API 키를 선택해 주세요. (무료 티어는 사용량이 제한될 수 있습니다.)";
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: errorText,
        type: "text",
        timestamp: new Date(),
        model: activeSession.model,
      };
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: [...s.messages, errorMessage] }
          : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const getModelIcon = (modelName?: string) => {
    switch (modelName) {
      case "ChatGPT": return <div className="w-full h-full bg-[#10A37F] flex items-center justify-center text-white font-bold text-[10px]">GPT</div>;
      case "Claude": return <div className="w-full h-full bg-[#D97757] flex items-center justify-center text-white font-bold text-[10px]">C</div>;
      default: return <Sparkles size={20} className="text-[#FFD700]" />;
    }
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      clearChat();
      return;
    }
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (activeSessionId === id) {
      setActiveSessionId(newSessions[0].id);
    }
  };

  const clearChat = () => {
    setSessions(prev => prev.map(s => 
      s.id === activeSessionId 
        ? {
            ...s,
            title: "새로운 대화",
            messages: [
              {
                id: "1",
                role: "ai",
                content: "대화내용이 초기화되었습니다. 다시 무엇을 도와드릴까요?",
                type: "text",
                timestamp: new Date(),
                model: s.model,
              }
            ]
          }
        : s
    ));
  };

  return (
    <div className="flex h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans selection:bg-[#FF6B6B]/20 overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            drag={isMobile ? "x" : false}
            dragConstraints={{ left: -300, right: 0 }}
            dragElastic={0.05}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50) setIsSidebarOpen(false);
            }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "w-72 border-r border-[#1A1A1A10] bg-white flex flex-col z-40 transition-all duration-300",
              isMobile ? "fixed inset-y-0 left-0" : "relative"
            )}
          >
            <div className="p-4 border-b border-[#1A1A1A10]">
              <button
                onClick={() => createNewChat("chat")}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1A1A1A] text-white rounded-2xl hover:bg-black transition-all active:scale-95 font-semibold shadow-lg shadow-[#1A1A1A]/10"
              >
                <Plus size={18} /> 새 채팅 시작
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="px-3 pb-2 text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest">Recent Chats</div>
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setActiveSessionId(session.id);
                    if (isMobile) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl transition-all group text-left",
                    activeSessionId === session.id
                      ? "bg-[#1A1A1A]/5 text-[#1A1A1A] font-semibold"
                      : "text-[#1A1A1A]/60 hover:bg-[#1A1A1A]/2 font-medium"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={16} className={cn(activeSessionId === session.id ? "text-[#1A1A1A]" : "text-[#1A1A1A]/30")} />
                    <span className="truncate text-sm">{session.title}</span>
                  </div>
                  <X 
                    size={14} 
                    className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity hover:text-[#FF4A4A]" 
                    onClick={(e) => deleteSession(session.id, e)}
                  />
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-[#1A1A1A10] bg-[#FDFCFB]/50">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF6B6B] to-[#FFD700] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  User
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#1A1A1A]">Beta Tester</p>
                  <p className="text-[10px] text-[#1A1A1A]/40">MODU AI Pro Plan</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[#1A1A1A10] bg-white/80 backdrop-blur-md sticky top-0 z-10 transition-all shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#1A1A1A]/5 rounded-xl transition-all active:scale-95 text-[#1A1A1A]/60"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-white shadow-md shadow-[#1A1A1A]/10 overflow-hidden">
                {getModelIcon(activeSession.model)}
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">MODU AI <span className="text-[10px] text-[#FF6B6B] font-black align-middle ml-1">BETA</span></h1>
                <p className="text-[9px] text-[#1A1A1A]/50 uppercase tracking-[0.2em] font-medium transition-opacity hover:opacity-100">AI Engine: {activeSession.model}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className="p-2.5 hover:bg-[#1A1A1A]/5 rounded-xl transition-all group active:scale-95 text-[#1A1A1A]/40 hover:text-[#1A1A1A]"
              title="모드 설정"
            >
              <Settings2 size={20} />
            </button>
            <button
              onClick={clearChat}
              className="p-2.5 hover:bg-[#1A1A1A]/5 rounded-xl transition-all group active:scale-95 text-[#1A1A1A]/40 hover:text-[#FF4A4A]"
              title="대화 초기화"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </header>

        {/* Outer body to wrap Chat and Right Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Chat Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto scroll-smooth py-10 px-4 md:px-0 bg-[#FDFCFB]"
          >
            <div className="max-w-3xl mx-auto space-y-8 pb-32">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className={cn(
                      "flex gap-4 group",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-transform duration-300 group-hover:scale-105 shadow-sm overflow-hidden",
                      message.role === "user" 
                        ? "bg-[#F0F2F5] border-transparent text-[#1A1A1A]" 
                        : "bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-[#1A1A1A]/20"
                    )}>
                      {message.role === "user" ? <User size={20} /> : getModelIcon(message.model)}
                    </div>

                    <div className={cn(
                      "flex flex-col max-w-[85%]",
                      message.role === "user" ? "items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "px-5 py-3.5 rounded-3xl transition-all shadow-sm",
                        message.role === "user"
                          ? "bg-white text-[#1A1A1A] rounded-tr-none border border-[#1A1A1A]/10 shadow-[#1A1A1A]/5"
                          : "bg-[#FFFFFF] text-[#1A1A1A] rounded-tl-none border border-[#1A1A1A]/10"
                      )}>
                        {message.type === "image" ? (
                          <div className="space-y-4">
                            <img 
                              src={message.content} 
                              alt="AI Generated" 
                              className="rounded-2xl w-full max-w-sm shadow-md hover:scale-[1.02] transition-transform duration-500 cursor-zoom-in"
                              referrerPolicy="no-referrer"
                            />
                            <p className="text-xs opacity-50 italic font-medium">이미지 생성이 완료되었습니다.</p>
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none prose-headings:font-bold prose-a:text-[#FF6B6B] break-words leading-relaxed selection:bg-[#FF6B6B]/30">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || "");
                                  return !inline && match ? (
                                    <div className="rounded-xl overflow-hidden my-4 border border-[#1A1A1A]/10 shadow-sm">
                                      <div className="bg-[#1A1A1A] px-4 py-1.5 text-[10px] text-white/50 font-bold uppercase tracking-widest flex justify-between items-center">
                                        <span>{match[1]}</span>
                                        <button className="hover:text-white transition-colors text-[9px] bg-white/10 px-2 py-0.5 rounded">Copy</button>
                                      </div>
                                      <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{ margin: 0, borderRadius: 0, fontSize: "12px", padding: "16px" }}
                                        {...props}
                                      >
                                        {String(children).replace(/\n$/, "")}
                                      </SyntaxHighlighter>
                                    </div>
                                  ) : (
                                    <code className={cn("bg-[#1A1A1A]/5 px-1.5 py-0.5 rounded text-[#FF6B6B] font-bold", className)} {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-[#1A1A1A]/30 mt-2 px-1 font-medium bg-[#1A1A1A]/5 rounded px-2 py-0.5 self-start">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4 items-start"
                >
                  <div className="w-10 h-10 rounded-2xl bg-[#1A1A1A] flex items-center justify-center shrink-0 border-2 border-[#1A1A1A] relative shadow-lg overflow-hidden">
                    {getModelIcon(activeSession.model)}
                    <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse"></div>
                  </div>
                  <div className="flex flex-col space-y-2 mt-2">
                    <div className="h-3.5 w-48 bg-[#1A1A1A]/10 rounded-full animate-pulse"></div>
                    <div className="h-3.5 w-32 bg-[#1A1A1A]/5 rounded-full animate-pulse delay-75"></div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Right Sidebar Overlay for Mobile */}
          <AnimatePresence>
            {isMobile && isRightPanelOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsRightPanelOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
              />
            )}
          </AnimatePresence>

          {/* Right Sidebar (Mode Selection) */}
          <AnimatePresence>
            {isRightPanelOpen && (
              <motion.aside
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={cn(
                  "w-80 border-l border-[#1A1A1A10] bg-white p-6 flex flex-col z-40 transition-all duration-300",
                  isMobile ? "fixed inset-y-0 right-0" : "relative"
                )}
              >
                <div className="flex items-center justify-between mb-8 text-[#1A1A1A]">
                  <h2 className="text-sm font-bold uppercase tracking-widest px-1">Model & Mode</h2>
                  <button onClick={() => setIsRightPanelOpen(false)} className="text-[#1A1A1A]/30 hover:text-[#1A1A1A]">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* AI Model Selection */}
                  <section>
                    <h3 className="text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest mb-3 px-1">Select AI Model</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: "Gemini", color: "from-[#4B90FF] to-[#8E4BFF]", desc: "Google's powerful model" },
                        { id: "ChatGPT", color: "from-[#10A37F] to-[#0D8A6A]", desc: "OpenAI's smart logic" },
                        { id: "Claude", color: "from-[#D97757] to-[#B35234]", desc: "Anthropic's creative flow" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setModel(m.id as any)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left",
                            activeSession.model === m.id
                              ? "bg-[#1A1A1A] border-[#1A1A1A] text-white"
                              : "bg-white border-[#1A1A1A10] hover:border-[#1A1A1A30]"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-xl bg-gradient-to-tr flex items-center justify-center text-[10px] font-black shadow-sm",
                            m.color
                          )}>
                            {m.id === "Gemini" ? <Sparkles size={14} className="text-white" /> : m.id[0]}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{m.id}</p>
                            <p className={cn(
                              "text-[9px]",
                              activeSession.model === m.id ? "text-white/60" : "text-[#1A1A1A]/40"
                            )}>{m.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Mode Selection */}
                  <section>
                    <h3 className="text-[10px] font-bold text-[#1A1A1A]/40 uppercase tracking-widest mb-3 px-1">Current Mode</h3>
                    <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: "chat", icon: <MessageSquare size={14} className="text-blue-500" />, label: "대화 모드" },
                      { id: "image", icon: <ImageIcon size={14} className="text-purple-500" />, label: "그림 생성" },
                      { id: "problem", icon: <Brain size={14} className="text-orange-500" />, label: "문제 풀이" },
                      { id: "coding", icon: <Terminal size={14} className="text-emerald-500" />, label: "코딩 도우미" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id as any)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left",
                          activeSession.mode === m.id
                            ? "bg-[#1A1A1A] border-[#1A1A1A] text-white"
                            : "bg-white border-[#1A1A1A10] hover:border-[#1A1A1A30]"
                        )}
                      >
                        <div className={cn(
                          "p-1.5 rounded-lg",
                          activeSession.mode === m.id ? "bg-white/10" : "bg-[#1A1A1A]/5"
                        )}>
                          {m.icon}
                        </div>
                        <p className="text-xs font-bold">{m.label}</p>
                      </button>
                    ))}
                    </div>
                  </section>
                </div>

                <div className="mt-auto pt-10">
                  <div className="p-5 rounded-[32px] bg-gradient-to-br from-[#1A1A1A] to-[#333] text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <Lightbulb size={60} />
                    </div>
                    <h3 className="text-sm font-bold mb-2">Pro Tip</h3>
                    <p className="text-[11px] text-white/70 leading-relaxed font-medium">
                      채팅창에 "그려줘"를 입력하면 자동으로 이미지 생성 모드로 전환됩니다.
                    </p>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#FDFCFB] via-[#FDFCFB]/95 to-transparent pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">

            <div className="relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`${activeSession.model}에게 무엇이든 물어보세요...`}
                className="w-full bg-white border-2 border-[#1A1A1A]/10 rounded-[32px] px-8 py-5 pr-36 focus:outline-none focus:border-[#1A1A1A] transition-all min-h-[72px] max-h-48 resize-none shadow-2xl shadow-[#1A1A1A]/10 group-hover:border-[#1A1A1A]/20"
                rows={1}
              />
              <div className="absolute right-4 bottom-4 flex items-center gap-2">
                <button
                  onClick={() => setInput(input + " 그림 그려줘")}
                  className="p-3 text-[#1A1A1A]/40 hover:text-[#1A1A1A] hover:bg-[#1A1A1A]/5 rounded-2xl transition-all active:scale-90"
                  title="이미지 생성 프롬프트 추가"
                >
                  <ImageIcon size={22} />
                </button>
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "p-3 rounded-2xl transition-all flex items-center justify-center shadow-lg active:scale-90",
                    isLoading || !input.trim()
                      ? "bg-[#1A1A1A]/5 text-[#1A1A1A]/20 cursor-not-allowed"
                      : "bg-[#1A1A1A] text-white hover:bg-black shadow-[#1A1A1A]/20"
                  )}
                >
                  <Send size={22} />
                </button>
              </div>
            </div>
            <p className="text-center text-[9px] text-[#1A1A1A]/40 mt-4 font-bold uppercase tracking-widest">
              Unified Platform • Active: {activeSession.model}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
