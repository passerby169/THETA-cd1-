"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play, Sparkles, BrainCircuit, MessageSquare, Paperclip, Send,
  CheckCircle2, Eye, EyeOff, Loader2, AlertCircle, ChevronLeft,
  ChevronRight, FileSpreadsheet, MessageCircle, BarChart3, FileDown,
  Shield, Globe, FileText, Minus, Plus, Infinity, Zap, Mail, User, Lock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LineChart, Line, XAxis, ResponsiveContainer } from "recharts"
import { ETMAgentAPI } from "@/lib/api/etm-agent"
import type { ChatMessage } from "@/components/chat/ai-sidebar"
import { TypingMessage } from "@/components/typing-message"
import { useCyclingTypewriter } from "@/hooks/use-cycling-typewriter"
import { ParticlesBg } from "@/components/particles-bg"

/** 工具函数 */
function getTimestamp() { return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) }
function generateId() { return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }

const LANDING_GREETING = "您好！我已经准备好分析您的数据。请上传文件或直接提问。"

/** 100% 还原：首页循环展示文案 */
const HERO_TYPEWRITER_PHRASES = [
  "数据清洗与预处理", "主题模型 (ETM) 训练与评估", "智能对话与 AI 科研助手",
  "任务中心 · 异步训练与监控", "可视化与结果导出", "从上传到洞察的一站式分析",
  "多数据集管理与协作", "深度主题发现与词云展示",
]

/** 100% 还原：使用教程四步 */
const HOW_IT_WORKS_STEPS = [
  { 
    title: "多源数据，一键清洗", titleEn: "Data Ingestion", 
    text: "支持拖拽上传 Excel、CSV、PDF 及 JSONL 等多格式文件。系统将自动识别字段并完成智能清洗，让繁琐的数据预处理一步到位。", 
    icon: FileSpreadsheet 
  },
  { 
    title: "自然语言，对话分析", titleEn: "Interactive Analysis", 
    text: "无需编程，对话即分析。只需用自然语言提问（如「分析近三个月负面情绪的主题」），AI 即可实时解析数据并生成可视化的深度洞察。", 
    icon: MessageCircle 
  },
  { 
    title: "图表交互，深挖归因", titleEn: "Drill-down Insight", 
    text: "图表即入口，点击即可追溯原因。发现数据异常或波峰？直接点击图表上的关键点，AI 将自动定位原始文本，并解读数据波动背后的具体成因。", 
    icon: BarChart3 
  },
  { 
    title: "学术级报告，一键导出", titleEn: "Export & Reporting", 
    text: "支持下载高清矢量图与完整分析文档。输出格式符合学术出版标准，无缝衔接您的论文撰写或行业研报制作。", 
    icon: FileDown 
  },
]

/** 100% 还原：场景化分析实验室 (上三下二布局数据) */
const SCENARIO_LAB_ROW1 = [
  { title: "心理健康与精细情感图谱", titleEn: "Mental Health", tags: ["精神疾病类型", "负面情感检测"], icon: BrainCircuit },
  { title: "金融合规与客诉风险洞察", titleEn: "Financial Compliance", tags: ["FCPB 投诉分析", "风险洞察"], icon: Shield },
  { title: "数字内容安全与净化", titleEn: "Content Safety", tags: ["仇恨言论识别", "垃圾账户过滤"], icon: MessageSquare },
]
const SCENARIO_LAB_ROW2 = [
  { title: "跨语言与多文化语义分析", titleEn: "Cross-Lingual", tags: ["多语言混合处理", "德语专业文本"], icon: Globe },
  { title: "长文本宏观语义理解", titleEn: "Long-Context", tags: ["政治演讲全篇解析", "长帖语义聚合"], icon: FileText },
]

/** 100% 还原：价格方案数据 */
const PRICING_PLANS = [
  { name: "入门", desc: "个人课程作业", priceMonth: 0, priceYear: 0, features: ["小规模数据分析", "基础主题建模", "社区支持", "数据保存 7 天"], recommended: false },
  { name: "专业", desc: "科研与学术项目", priceMonth: 99, priceYear: 999, features: ["大规模数据处理", "完整 ETM 模型功能", "导出高清矢量图", "优先算力调度", "数据永久保存"], recommended: true },
  { name: "企业", desc: "团队协作与定制", priceMonth: 299, priceYear: 2999, features: ["多用户协作管理", "私有化模型部署", "API 定制开发", "专属学术顾问", "SLA 服务保障"], recommended: false },
]

/** 100% 还原：FAQ 数据 */
const FAQ_ITEMS = [
  { q: "Theta 到底是什么？不需要编程也能用吗？", a: "Theta 是一个专为社会科学研究设计的 AI 分析平台。我们致力于降低科研门槛，您完全不需要编程基础。通过直观的对话界面，即可完成从数据清洗、主题建模到深度文本挖掘的全流程工作。" },
  { q: "我的数据安全吗？会被用于训练 AI 吗？", a: "这是我们最重视的原则。我们遵循严格的数据隐私协议。您上传的数据经过加密处理，仅供您当次分析使用，绝不会将您的私有数据用于训练公共模型。" },
  { q: "生成图表可以直接用于论文发表吗？", a: "完全可以。Theta 生成的所有可视化图表均符合主流学术期刊的出版标准。此外，我们还会提供详细的算法引用说明，方便您在论文的方法论部分准确撰写。" },
  { q: "支持多大的文件？支持哪些语言？", a: "支持最高 500MB 的 CSV/Excel 文件处理。深度支持中文、英文及中英混合分析，同时兼容德语、法语等 20+ 种主流语言的语义理解。" },
]

export default function LandingPage() {
  const router = useRouter()
  // 【完整状态定义 - 一个不落】
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState("")
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null)
  const [howItWorksStep, setHowItWorksStep] = useState(0)
  const [pricingMode, setPricingMode] = useState<"per-use" | "monthly" | "yearly">("per-use")
  const [showCiteModal, setShowCiteModal] = useState(false)
  
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [modalMode, setModalMode] = useState<"login" | "register">("login")

  // 登录表单状态 (identifier 定义补齐)
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // 注册表单状态
  const [regUsername, setRegUsername] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")
  const [regCode, setRegCode] = useState("")
  const [countdown, setCountdown] = useState(0)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [regError, setRegError] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [regSuccess, setRegSuccess] = useState(false)

  // AI 状态
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInputValue, setChatInputValue] = useState("")
  const [isAiLoading, setIsAiLoading] = useState(false)

  const { displayedText: typewriterText } = useCyclingTypewriter({ phrases: HERO_TYPEWRITER_PHRASES, typingSpeed: 90, deleteSpeed: 60, holdDuration: 1600, loop: true })

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem("access_token")
    if (token) {
      setIsLoggedIn(true)
      const userStr = localStorage.getItem("user")
      if (userStr) {
        try { setUserName(JSON.parse(userStr).username || "研究员") } catch { setUserName("研究员") }
      }
    }
  }, [])

  useEffect(() => { if (countdown > 0) { const t = setTimeout(() => setCountdown(countdown - 1), 1000); return () => clearTimeout(t) } }, [countdown])

  const handleLogout = () => {
    localStorage.removeItem("access_token"); localStorage.removeItem("user")
    setIsLoggedIn(false); window.location.reload()
  }

  // --- 逻辑函数：强制指向公网 IP 8000 ---
  const handleSendCode = async () => {
    if (!regEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) return alert("邮箱格式错误")
    setIsSendingCode(true)
    try {
      const res = await fetch("http://47.96.154.95:8000/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail }),
      })
      if (res.ok) { setCountdown(60); alert("验证码已发送至您的邮箱") }
      else { const d = await res.json(); alert(d.detail || "发送失败") }
    } catch { alert("连接服务器失败") } finally { setIsSendingCode(false) }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoggingIn(true); setLoginError("")
    try {
      const fd = new URLSearchParams(); fd.append("username", identifier); fd.append("password", password)
      const res = await fetch("http://47.96.154.95:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: fd,
      })
      if (res.ok) {
        const d = await res.json(); localStorage.setItem("access_token", d.access_token);
        localStorage.setItem("user", JSON.stringify({ username: identifier }));
        window.location.href = "/dashboard"
      } else { setLoginError("账号或密码错误") }
    } catch { setLoginError("后端连接失败") } finally { setIsLoggingIn(false) }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); if (regPassword !== regConfirm) return alert("两次密码不一致");
    setIsRegistering(true)
    try {
      const res = await fetch("http://47.96.154.95:8000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername, email: regEmail, password: regPassword, code: regCode }),
      })
      if (res.ok) {
        setRegSuccess(true); setTimeout(() => { setModalMode("login"); setRegSuccess(false) }, 1500)
      } else { const d = await res.json(); alert(d.detail || "注册失败") }
    } catch { alert("连接服务器失败") } finally { setIsRegistering(false) }
  }

  const handleLandingChatSend = useCallback(async (content: string) => {
    if (!content.trim() || isAiLoading) return
    setChatHistory(p => [...p, { id: generateId(), role: "user", content, type: "text", timestamp: getTimestamp() }])
    setChatInputValue(""); setIsAiLoading(true)
    const aiId = generateId()
    setChatHistory(p => [...p, { id: aiId, role: "ai", content: "", type: "text", timestamp: getTimestamp() }])
    try {
      let full = ""
      for await (const chunk of ETMAgentAPI.chatStream(content, "landing")) {
        if (chunk.type === "content" && chunk.content) {
          full += chunk.content; setChatHistory(p => p.map(m => m.id === aiId ? { ...m, content: full } : m))
        }
      }
    } catch { setChatHistory(p => p.map(m => m.id === aiId ? { ...m, content: "AI 暂时无法回复。" } : m)) }
    finally { setIsAiLoading(false) }
  }, [isAiLoading])

  if (!mounted) return null

  // 导航处理
  const scrollTo = (id: string) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }) }

  return (
    <div className="min-h-screen relative overflow-x-hidden" onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })} onMouseLeave={() => setMousePos(null)}>
      
      {/* 1. 背景层：【修复】必须 pointer-events-none 防止挡住点击 */}
      <div className="page-bg-effect pointer-events-none" aria-hidden>
        <div className="page-bg-effect__gradient" /><div className="page-bg-effect__dots" />
        <div className="page-bg-effect__orb page-bg-effect__orb--1" />
        <div className="page-bg-effect__orb page-bg-effect__orb--2" />
        <div className="page-bg-effect__orb page-bg-effect__orb--3" />
        <div className="page-bg-effect__orb page-bg-effect__orb--4" />
        <div className="page-bg-effect__orb page-bg-effect__orb--5" />
      </div>
      <ParticlesBg zIndex={-1} opacity={0.4} color="59, 130, 246" count={80} />
      {mousePos && <div className="page-bg-effect__mouse-glow pointer-events-none" style={{ left: mousePos.x, top: mousePos.y }} aria-hidden />}

      {/* 2. 100% 还原 Header + 修复交互 */}
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sticky top-0 z-[100] bg-white/98 backdrop-blur-md border-b border-slate-200 h-16 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center cursor-pointer hover:opacity-80 transition-all" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <img src="/theta-logo.png" className="h-9 w-auto" alt="Logo" />
          </div>
          <nav className="hidden md:flex gap-8">
            <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="text-sm font-medium text-slate-600 hover:text-blue-600 cursor-pointer hover:-translate-y-0.5 transition-all">首页</button>
            <button onClick={() => scrollTo('core-features')} className="text-sm font-medium text-slate-600 hover:text-blue-600 cursor-pointer hover:-translate-y-0.5 transition-all">关于THETA</button>
            <button onClick={() => router.push('/cases')} className="text-sm font-medium text-slate-600 hover:text-blue-600 cursor-pointer hover:-translate-y-0.5 transition-all">案例库</button>
            <a href="https://codesoul-co.github.io/THETA" target="_blank" className="text-sm font-medium text-slate-600 hover:text-blue-600 cursor-pointer hover:-translate-y-0.5 transition-all">文档</a>
            <button onClick={() => router.push('/team')} className="text-sm font-medium text-slate-600 hover:text-blue-600 cursor-pointer hover:-translate-y-0.5 transition-all">团队成员</button>
            <button onClick={() => scrollTo('faq')} className="text-sm font-medium text-slate-600 hover:text-blue-600 cursor-pointer hover:-translate-y-0.5 transition-all">帮助中心</button>
          </nav>
          <div className="flex items-center gap-4">
            <a href="https://github.com/CodeSoul-co/THETA" target="_blank" className="cursor-pointer hover:opacity-70 transition-all"><img src="/github-mark.svg" className="w-5 h-5" /></a>
            <a href="https://huggingface.co/organizations/CodeSoulco" target="_blank" className="cursor-pointer hover:opacity-70 transition-all"><img src="https://huggingface.co/front/assets/huggingface_logo-noborder.svg" className="w-5 h-5" /></a>
            <span className="w-px h-5 bg-slate-200" aria-hidden />
            {isLoggedIn ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-blue-600">欢迎, {userName}</span>
                <Button onClick={() => window.location.href="/dashboard"} className="bg-blue-600 text-white rounded-lg px-4 h-9 cursor-pointer shadow-sm">进入工作台</Button>
                <Button variant="ghost" onClick={handleLogout} className="text-red-500 h-9 px-3 cursor-pointer">退出</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" className="text-slate-700 h-9 cursor-pointer" onClick={() => { setModalMode("login"); setShowLoginModal(true); }}>登录</Button>
                <Button className="bg-blue-600 text-white rounded-lg px-4 h-9 cursor-pointer shadow-md" onClick={() => { setModalMode("register"); setShowLoginModal(true); }}>免费注册</Button>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* 3. 100% 还原 Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/20 to-white pb-10 flex flex-col min-h-[calc(100vh-4rem)]">
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 flex-1 grid lg:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight">零代码社科文本挖掘工作台</h1>
            <p className="text-xl text-blue-600 mb-8 min-h-[3rem] font-medium">{typewriterText}<span className="inline-block w-1 h-6 bg-blue-500 animate-pulse ml-1" /></p>
            <p className="text-lg text-slate-600 mb-10 max-w-xl leading-relaxed">从数据清洗到深度洞察，AI 驱动的全流程科研助手。上传数据，对话式交互，即刻获取专业分析结果。</p>
            <div className="flex gap-4">
              <Button size="lg" onClick={() => { setModalMode("login"); setShowLoginModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-10 shadow-xl rounded-xl cursor-pointer">立即开始分析</Button>
              <Button size="lg" variant="outline" className="bg-white rounded-xl hover:bg-slate-50 cursor-pointer"><Play className="w-4 h-4 mr-2" />观看演示</Button>
            </div>
            <div className="flex items-center gap-12 mt-12 pt-8 border-t border-slate-200">
               {[{ v: "10K+", l: "研究者信赖" }, { v: "500+", l: "分析模型" }, { v: "99.2%", l: "准确率" }].map(s => <div key={s.l}><p className="text-3xl font-black text-blue-600">{s.v}</p><p className="text-sm font-medium text-slate-500 uppercase tracking-widest">{s.l}</p></div>)}
            </div>
          </motion.div>

          {/* AI 演示框 */}
          <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="flex justify-end relative z-20">
            <div className="w-[560px] h-[520px] bg-white rounded-[32px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden ring-1 ring-slate-100">
              <div className="p-5 bg-slate-50 border-b flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"><img src="/ai-avatar.png" className="w-[140%] h-[140%] object-contain" /></div><span className="font-bold text-slate-800">猫咪科学家</span></div><span className="text-xs text-green-500 font-bold flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>● 在线</span></div>
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white/50 backdrop-blur-sm">
                {chatHistory.length === 0 ? <div className="bg-slate-100 p-4 rounded-2xl text-sm text-slate-700 leading-relaxed shadow-sm border border-slate-50">{LANDING_GREETING}</div> : 
                  chatHistory.map(m => (
                    <div key={m.id} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                      <div className={`p-4 rounded-2xl max-w-[85%] text-sm shadow-sm ${m.role==='user'?'bg-blue-600 text-white rounded-tr-none':'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200'}`}>{m.content}</div>
                    </div>
                  ))
                }
              </div>
              <div className="p-5 border-t bg-slate-50/50 flex gap-2">
                <Input value={chatInputValue} onChange={e=>setChatInputValue(e.target.value)} placeholder="分析近三个月的情绪趋势..." className="rounded-2xl bg-white border-slate-200 h-12 focus:ring-2 focus:ring-blue-500 transition-all" onKeyDown={e=>e.key==='Enter'&&handleChat(chatInputValue)} />
                <Button onClick={()=>handleChat(chatInputValue)} className="bg-blue-600 text-white h-12 w-12 rounded-2xl shadow-md hover:bg-blue-700 cursor-pointer"><Send className="w-5 h-5" /></Button>
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* 跑马灯背景 */}
        <div className="page-bg-effect__ghost-text mt-auto opacity-5 py-6 pointer-events-none select-none"><div className="page-bg-effect__ghost-text-track flex whitespace-nowrap text-[100px] font-black uppercase tracking-tighter">THETA · AI ANALYSIS · SOCIAL SCIENCE · RESEARCH · </div></div>
      </section>

      {/* 4. 100% 还原：核心功能引擎 (3个模块) */}
      <section id="core-features" className="py-32 bg-white relative z-20 border-t">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20"><h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">核心功能引擎：重构社科研究生产力</h2><p className="text-slate-600 max-w-2xl mx-auto text-lg leading-relaxed">遵循严谨学术范式，大语言模型与主题模型的深度融合，打造一站式研究工作流。</p></div>
          
          {/* 模块1 */}
          <div className="grid lg:grid-cols-2 gap-20 items-center mb-32">
            <div className="space-y-8"><h3 className="text-3xl font-bold text-slate-900">全栈式主题建模</h3><p className="text-slate-600 text-xl leading-relaxed">不再受限于单一模型。Theta 集成了从统计学到最新深度学习的完整算法库，灵活适配各类语料。</p><p className="text-blue-600 font-mono font-bold text-sm uppercase tracking-widest">LDA · ETM · CTM · DTM · BERTopic</p></div>
            <div className="rounded-[40px] overflow-hidden shadow-2xl border-8 border-slate-50 aspect-video"><img src="/1.png" className="w-full h-full object-cover" /></div>
          </div>
          
          {/* 模块2 */}
          <div className="grid lg:grid-cols-2 gap-20 items-center mb-32">
            <div className="order-2 lg:order-1 rounded-[40px] overflow-hidden shadow-2xl border-8 border-slate-50 aspect-video"><img src="/2.png" className="w-full h-full object-cover" /></div>
            <div className="order-1 lg:order-2 space-y-8"><h3 className="text-2xl font-bold text-slate-900">云端即时数据处理</h3><p className="text-slate-600 text-xl leading-relaxed">告别繁琐的本地环境配置、Python 库依赖与算力瓶颈。零配置快速上手，在线交互式处理，安全云端算力保障。</p></div>
          </div>

          {/* 模块3 */}
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8"><h3 className="text-3xl font-bold text-slate-900">交互式 AI 科学家</h3><p className="text-slate-600 text-xl leading-relaxed">它不仅是一个图表生成器，更是一位深谙学术规范的合作者。提供非模板化深度解读与多轮追问。</p>
              <ul className="space-y-6">{["非模板化深度解读", "图表级多轮追问", "研究假设辅助验证"].map(t => <li key={t} className="flex items-center gap-4 text-slate-800 text-lg font-semibold"><div className="bg-green-500 rounded-full p-1"><CheckCircle2 className="text-white w-6 h-6 shrink-0"/></div>{t}</li>)}</ul>
            </div>
            <div className="rounded-[40px] overflow-hidden shadow-2xl border-8 border-slate-50 aspect-video"><img src="/3.png" className="w-full h-full object-cover" /></div>
          </div>
        </div>
      </section>

      {/* 5. 100% 还原：使用教程步奏 */}
      <section id="how-it-works" className="py-32 bg-slate-50 relative z-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-20 text-slate-900">四步完成从数据到洞察</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {HOW_IT_WORKS_STEPS.map((s, i) => (
              <Card key={i} className="p-10 text-left border-none shadow-xl hover:shadow-2xl transition-all rounded-[32px] bg-white group hover:-translate-y-2">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-blue-600 group-hover:text-white transition-colors"><s.icon className="w-8 h-8"/></div>
                <h4 className="font-bold mb-4 text-slate-900 text-xl">{s.title}</h4><p className="text-slate-500 text-sm leading-relaxed">{s.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 6. 100% 还原：场景化分析实验室 (上三下二) */}
      <section id="scenario-lab" className="py-32 bg-white relative z-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-20 text-slate-900">场景化分析实验室</h2>
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            {SCENARIO_LAB_ROW1.map((c, i) => (
              <Card key={i} className="p-10 hover:border-blue-400 transition-all cursor-pointer group rounded-[32px] border-slate-100 shadow-sm hover:shadow-xl">
                <div className="flex justify-between mb-6"><h4 className="font-bold text-2xl text-slate-900 text-left">{c.title}</h4><c.icon className="text-blue-600 w-8 h-8"/></div>
                <p className="text-blue-500 text-xs mb-6 font-bold uppercase tracking-widest text-left">{c.titleEn}</p>
                <div className="flex flex-wrap gap-2 mb-10">{c.tags.map(t => <span key={t} className="px-4 py-1.5 bg-slate-100 text-slate-500 text-xs rounded-full font-bold">{t}</span>)}</div>
                <Button variant="outline" className="w-full rounded-2xl h-12 group-hover:bg-blue-600 group-hover:text-white transition-all font-bold cursor-pointer">开启分析模板</Button>
              </Card>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
             {SCENARIO_LAB_ROW2.map((c, i) => (
               <Card key={i} className="p-10 hover:border-blue-400 transition-all cursor-pointer group rounded-[32px] border-slate-100 shadow-sm hover:shadow-xl">
                 <div className="flex justify-between mb-6"><h4 className="font-bold text-2xl text-slate-900 text-left">{c.title}</h4><c.icon className="text-blue-600 w-8 h-8"/></div>
                 <Button variant="outline" className="w-full rounded-2xl h-12 group-hover:bg-blue-600 group-hover:text-white transition-all font-bold cursor-pointer">Load Template</Button>
               </Card>
             ))}
          </div>
        </div>
      </section>

      {/* 7. 100% 还原：价格方案 (带月/年切换) */}
      <section id="pricing" className="py-32 bg-slate-50 relative z-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-12 text-slate-900">匹配您的研究需求</h2>
          <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-slate-200/60 mb-16">
            <button onClick={() => setPricingMode("monthly")} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${pricingMode === "monthly" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"}`}>按月付费</button>
            <button onClick={() => setPricingMode("yearly")} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${pricingMode === "yearly" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"}`}>按年付费</button>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {PRICING_PLANS.map((p, i) => (
              <Card key={i} className={`p-10 flex flex-col rounded-[40px] transition-all ${p.recommended?'ring-4 ring-blue-500 shadow-2xl relative scale-110 z-10 bg-white':'bg-white border-slate-200 shadow-lg'}`}>
                {p.recommended && <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] px-6 py-1.5 rounded-full font-black tracking-widest shadow-xl uppercase">热门</span>}
                <h4 className="font-bold text-2xl mb-4 text-slate-900">{p.name}</h4>
                <div className="text-5xl font-black text-slate-900 mb-8">¥{pricingMode==='yearly' ? p.priceMonth*10 : p.priceMonth}<span className="text-base text-slate-400 font-normal">/{pricingMode==='yearly'?'年':'月'}</span></div>
                <ul className="flex-1 space-y-4 text-sm text-slate-600 mb-10 text-left">{p.features.map(f => <li key={f} className="flex items-center gap-3 font-bold"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0"/>{f}</li>)}</ul>
                <Button onClick={()=>setShowLoginModal(true)} variant={p.recommended?'default':'outline'} className={`rounded-2xl h-14 text-lg font-black cursor-pointer ${p.recommended?'bg-blue-600 text-white hover:bg-blue-700':'hover:bg-slate-50'}`}>立即选购</Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 8. 100% 还原：FAQ */}
      <section id="faq" className="py-32 bg-white relative z-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-16 text-slate-900">常见问题 FAQ</h2>
          <div className="space-y-6 text-left">
             {FAQ_ITEMS.map((f, i) => (
               <Card key={i} className="p-8 cursor-pointer rounded-3xl border-slate-100 shadow-sm transition-all hover:border-blue-200" onClick={() => setFaqOpenIndex(faqOpenIndex === i ? null : i)}>
                  <div className="flex justify-between items-center font-bold text-slate-800 text-lg">{f.q}{faqOpenIndex === i ? <Minus className="w-6 h-6"/> : <Plus className="w-6 h-6"/>}</div>
                  <AnimatePresence>{faqOpenIndex === i && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><p className="mt-6 text-slate-500 leading-relaxed border-t border-slate-50 pt-6 text-base">{f.a}</p></motion.div>)}</AnimatePresence>
               </Card>
             ))}
          </div>
        </div>
      </section>

      {/* 9. 100% 还原：五列页脚 */}
      <footer className="py-24 border-t bg-slate-50 relative z-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-5 gap-16">
          <div className="col-span-2"><img src="/codesoul-logo.png" className="h-12 opacity-90 mb-8" /><p className="text-slate-500 text-lg leading-relaxed">Theta：洞见，先于思考。致力于为全球社会科学研究者提供最前沿的零代码分析技术。</p></div>
          <div><h5 className="font-bold text-slate-900 mb-6">产品</h5><ul className="space-y-4 text-sm text-slate-500"><li>功能更新</li><li>API 文档</li><li>开发者中心</li></ul></div>
          <div><h5 className="font-bold text-slate-900 mb-6">支持</h5><ul className="space-y-4 text-sm text-slate-500"><li>帮助中心</li><li>学术交流</li><li>GitHub</li></ul></div>
          <div><h5 className="font-bold text-slate-900 mb-6">关于</h5><ul className="space-y-4 text-sm text-slate-500"><li>愿景使命</li><li>联系我们</li><li>法律协议</li></ul></div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-10 border-t border-slate-200 text-center text-sm text-slate-400 font-medium">© {new Date().getFullYear()} THETA 平台 · 零代码社科文本挖掘系统</div>
      </footer>

      {/* 10. 100% 还原并增强：登录注册弹窗 */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="bg-white sm:max-w-md border-none shadow-2xl rounded-[32px] p-0 overflow-hidden">
          <DialogHeader className="p-10 pb-6 bg-slate-50">
            <DialogTitle className="text-3xl font-black text-center text-slate-900">{modalMode==='login'?'欢迎回来':'注册账号'}</DialogTitle>
            <DialogDescription className="text-center text-slate-500 mt-3 text-sm">注册立享顶级 A10 GPU 算力</DialogDescription>
          </DialogHeader>
          <div className="p-10 pt-6">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-10">
              <button className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${modalMode==='login'?'bg-white shadow text-blue-600':'text-slate-500'}`} onClick={()=>setModalMode('login')}>登录</button>
              <button className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${modalMode==='register'?'bg-white shadow text-blue-600':'text-slate-500'}`} onClick={()=>setModalMode('register')}>注册</button>
            </div>
            {modalMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-6">
                {loginError && <Alert variant="destructive" className="rounded-2xl"><AlertDescription>{loginError}</AlertDescription></Alert>}
                <div className="space-y-2"><Label className="ml-2 font-bold text-xs uppercase tracking-widest">账号</Label><Input value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="用户名或邮箱" className="h-14 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 text-base" /></div>
                <div className="space-y-2"><Label className="ml-2 font-bold text-xs uppercase tracking-widest">密码</Label><Input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" className="h-14 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 text-base" /></div>
                <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 text-white text-lg font-black shadow-xl hover:bg-blue-700 cursor-pointer" disabled={isLoggingIn}>{isLoggingIn ? <Loader2 className="animate-spin" /> : "登录系统"}</Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && <Alert variant="destructive" className="rounded-xl"><AlertDescription>{regError}</AlertDescription></Alert>}
                {regSuccess ? ( <div className="text-center py-10"><CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6 animate-bounce"/><p className="font-black text-2xl text-slate-900">注册成功！</p></div> ) : (
                  <>
                    <Input placeholder="用户名 (3-50位)" value={regUsername} onChange={e=>setRegUsername(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-none" />
                    <Input placeholder="电子邮箱" value={regEmail} onChange={e=>setRegEmail(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-none" />
                    <div className="flex gap-2">
                      <Input placeholder="6位验证码" value={regCode} onChange={e=>setRegCode(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-none" maxLength={6} />
                      <Button type="button" onClick={handleSendCode} disabled={countdown>0 || isSendingCode} className="h-12 rounded-xl bg-slate-900 text-white px-6 font-bold cursor-pointer">{countdown>0?`${countdown}s`:'获取'}</Button>
                    </div>
                    <Input type="password" placeholder="设置密码" value={regPassword} onChange={e=>setRegPassword(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-none" />
                    <Input type="password" placeholder="确认密码" value={regConfirm} onChange={e=>setRegConfirm(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-none" />
                    <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black mt-6 shadow-xl hover:bg-blue-700 cursor-pointer" disabled={isRegistering}>立即开启研究</Button>
                  </>
                )}
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}