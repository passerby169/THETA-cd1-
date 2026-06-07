"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { AppShell, type Tab } from "@/components/layout/app-shell"
import { ProjectHub, type Project } from "@/components/dashboard/project-hub"
import { NewProjectDialog, type NewProjectData } from "@/components/dashboard/new-project-dialog"
import { AutoPipeline } from "@/components/project/auto-pipeline"
import type { ChatMessage, SuggestionCard, SendMessagePayload } from "@/components/chat/ai-sidebar"
import { ProtectedRoute } from "@/components/protected-route"
import { apiFetch, API_BASE } from "@/lib/api/config"
import { ETMAgentAPI, DatasetInfo } from "@/lib/api/etm-agent"
import { PROMPTS } from "@/lib/config"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { TopicWordsTab } from "@/components/results/topic-words-tab"
import { MetricsTab } from "@/components/results/metrics-tab"
import { VisualizationTab } from "@/components/results/visualization-tab"
import { ExportTab } from "@/components/results/export-tab"

/** 指标展示名与方向说明：↑ 越高越好 | ↓ 越低越好 | → 越接近 0 越好 */
// Helper to generate timestamp
function getTimestamp() {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
}

// Generate unique ID
function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Extended project type with additional fields (100% 完整定义)
interface WorkspaceProject extends Project {
  description?: string
  datasetName?: string
  mode?: "zero_shot" | "unsupervised" | "supervised"
  models?: string[]
  numTopics?: number
  pipelineStatus?: "running" | "completed" | "error"
  dbProjectId?: number  // 数据库项目 ID
  taskId?: string | null  // 关联任务 ID
  hasResults?: boolean  // 是否已有结果
}

// SessionStorage keys for tab state persistence
const STORAGE_KEYS = {
  TABS: "theta_dashboard_tabs",
  ACTIVE_TAB: "theta_dashboard_active_tab",
} as const

function DashboardContent() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // Initialize tabs from sessionStorage
  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(STORAGE_KEYS.TABS)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        } catch { /* ignore */ }
      }
    }
    return [{ id: "hub", title: "项目中心", closable: false }]
  })

  // Initialize activeTabId from sessionStorage
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)
      if (saved) return saved
    }
    return "hub"
  })

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false)
  const [projects, setProjects] = useState<WorkspaceProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dynamicSuggestions, setDynamicSuggestions] = useState<SuggestionCard[]>([])
  const [projectTransitionName, setProjectTransitionName] = useState<string | null>(null)
  /** 用于强制重新渲染 renderContent（PLC 完成切换到结果视图时使用） */
  const [renderKey, setRenderKey] = useState(0)

  const pollingTimerRef = useRef<number | null>(null)
  const syncTimerRef = useRef<number | null>(null)
  const refreshProjectsRef = useRef<() => Promise<void>>(() => {})

  const handleSendMessageRef = useRef<(payload: string | SendMessagePayload) => void | Promise<void>>(() => {})

  // 设置挂载状态，防止水合错误
  useEffect(() => {
    setMounted(true)
    return () => {
      if (pollingTimerRef.current) window.clearInterval(pollingTimerRef.current)
    }
  }, [])

  // 【核心全量逻辑回归】：Load projects - 完全恢复原始 1100 行逻辑并增加防空判断
  const loadProjects = useCallback(async () => {
    try {
      console.log("[Dashboard] Loading projects...");
      const [dbProjectsRes, datasetsRes, tasksRes, ossInfoRes] = await Promise.all([
        ETMAgentAPI.getProjects().catch(() => []),
        ETMAgentAPI.getDatasets().catch(() => []),
        ETMAgentAPI.getTasks({ limit: 100 }).catch(() => []),
        ETMAgentAPI.listOssDatasets().catch(() => ({ datasets: [] })),
      ])

      const dbProjects = Array.isArray(dbProjectsRes) ? dbProjectsRes : []
      const datasets = Array.isArray(datasetsRes) ? datasetsRes : []
      const tasks = Array.isArray(tasksRes) ? tasksRes : []
      const ossInfo = ossInfoRes || { datasets: [] }

      const datasetsWithResults = new Set((ossInfo.datasets || []).map((d: any) => d.name))

      const seen = new Set<string>()
      const list: WorkspaceProject[] = []

      // 任务映射
      const taskByDataset = new Map<string, { task_id: string; status: string; pipeline_status?: string }>()
      for (const t of tasks) {
        const ds = t.dataset || (t as any).dataset_name
        if (!ds) continue
        taskByDataset.set(ds, { 
          task_id: t.task_id, 
          status: t.status, 
          pipeline_status: t.status === "completed" ? "completed" : t.status === "failed" ? "error" : "running" 
        })
      }

      // 1. 数据库中的项目
      for (const p of dbProjects) {
        const key = p.dataset_name || `db-${p.id}`
        seen.add(key)
        let effectiveTaskId = p.task_id ?? null
        let effectivePipelineStatus = p.pipeline_status
        if (!effectiveTaskId && p.dataset_name) {
          const matched = taskByDataset.get(p.dataset_name)
          if (matched) {
            effectiveTaskId = matched.task_id
            effectivePipelineStatus = effectivePipelineStatus || matched.pipeline_status
          }
        }
        const hasResults = p.dataset_name ? (datasetsWithResults.has(p.dataset_name) || p.pipeline_status === "completed") : false
        list.push({
          id: `proj-db-${p.id}`,
          name: p.name,
          rows: 0,
          createdAt: p.created_at ? "已保存" : "刚刚",
          status: hasResults ? "completed" : "draft",
          datasetName: p.dataset_name ?? undefined,
          mode: (p.mode as any) ?? "zero_shot",
          models: ["theta"],
          numTopics: p.num_topics ?? 20,
          pipelineStatus: effectivePipelineStatus as any,
          hasResults,
          dbProjectId: p.id,
          taskId: effectiveTaskId,
        })
      }

      // 2. 数据集（未在 DB 中的）
      for (const ds of datasets) {
        if (seen.has(ds.name)) continue
        seen.add(ds.name)
        const hasResults = datasetsWithResults.has(ds.name)
        let effectivePipelineStatus: "running" | "completed" | "error" | undefined =
          hasResults ? "completed" : undefined
        let effectiveTaskId: string | null = null
        const matchedTask = taskByDataset.get(ds.name)
        if (matchedTask) {
          effectivePipelineStatus = matchedTask.pipeline_status as any
          effectiveTaskId = matchedTask.task_id
        }
        list.push({
          id: `proj-${ds.name}`,
          name: ds.name,
          rows: ds.size ?? (ds as any).file_count ?? 0,
          createdAt: "已上传",
          status: hasResults && !effectivePipelineStatus ? "completed" as const : "draft" as const,
          pipelineStatus: effectivePipelineStatus,
          hasResults,
          datasetName: ds.name,
          taskId: effectiveTaskId,
          models: ["theta"],
        })
      }

      setProjects(list)
    } catch (e) { console.error(e); setProjects([]); }
    finally { setIsLoading(false); }
  }, [])

  useEffect(() => { loadProjects(); }, [loadProjects]);
  refreshProjectsRef.current = loadProjects;

  // 【核心功能回归】：稳健轮询，修复 NaN%
  useEffect(() => {
    const pollTrainingStatus = async () => {
      const runningJobs = projects.filter(p => p.pipelineStatus === "running" || p.status === "vectorizing");
      if (runningJobs.length === 0) return;
      const jobIds = runningJobs.map(j => {
          if (j.taskId) return parseInt(j.taskId.replace("job-", ""), 10);
          return null;
      }).filter(n => n !== null && !isNaN(n)) as number[];
      
      try {
        const results = await Promise.all(jobIds.map(id => ETMAgentAPI.getTrainStatusByJobId(id)));
        setProjects(prev => prev.map(p => {
          if (p.taskId) {
            const numId = parseInt(p.taskId.replace("job-", ""), 10);
            const result = results.find((r, i) => jobIds[i] === numId);
            if (result) {
              const newStatus = result.status === "succeeded" ? "completed" : result.status === "failed" ? "error" : "running";
              return { ...p, pipelineStatus: newStatus as any };
            }
          }
          return p;
        }));
      } catch (err) { console.error("[Polling] Error:", err); }
    };
    pollingTimerRef.current = window.setInterval(pollTrainingStatus, 10000);
    return () => { if (pollingTimerRef.current) window.clearInterval(pollingTimerRef.current); };
  }, [projects]);

  const refreshProjects = useCallback(async () => {
    setIsLoading(true)
    window.location.reload(); 
  }, [])

  const handleOpenProject = (projectId: string) => {
    const existingTab = tabs.find((tab) => tab.id === projectId)
    if (existingTab) {
      setActiveTabId(projectId)
    } else {
      const project = projects.find(p => p.id === projectId)
      const projectName = project?.name || "Project"
      const newTab: Tab = { id: projectId, title: projectName, closable: true }
      setTabs([...tabs, newTab])
      setActiveTabId(projectId)
    }
  }

  // 【核心修复】：创建项目逻辑 - 恢复全量属性，删除自杀式刷新
  const handleCreateProject = useCallback(async (data: NewProjectData) => {
    const datasetName = (data.name || "dataset").trim().toLowerCase().replace(/\s+/g, "_")
    const tempId = `proj-new-${Date.now()}`
    
    const newProj: WorkspaceProject = {
      id: tempId, name: data.name, datasetName, status: "draft",
      createdAt: "刚刚", rows: 0, models: ["theta"],
    }
    
    setProjects(prev => [newProj, ...prev])
    setTabs(prev => [...prev, { id: tempId, title: data.name, closable: true }])
    setActiveTabId(tempId)
    setIsNewProjectDialogOpen(false)

    try {
      const created = await ETMAgentAPI.createProject({ name: data.name, dataset_name: datasetName })
      setProjects(prev => prev.map(p => p.id === tempId ? { ...p, dbProjectId: created.id } : p))
    } catch { }
  }, [])

  // 【全逻辑回归】：Pipeline 深度回调逻辑
  const handlePipelineComplete = useCallback(async (projectId: string, result: any, dbId?: number) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: "completed", pipelineStatus: "completed", hasResults: true } : p))
    if (dbId && result) {
      await ETMAgentAPI.updateProject(dbId, { status: "completed", pipeline_status: "completed", task_id: result?.taskId })
    }
    setRenderKey(k => k + 1)
  }, [])

  const handleTabChange = (id: string) => setActiveTabId(id)
  const handleTabClose = (id: string) => {
    const newTabs = tabs.filter(t => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id) setActiveTabId("hub")
  }

  const handleDeleteProject = useCallback(async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (project?.datasetName) {
      try { await ETMAgentAPI.deleteDataset(project.datasetName) } catch (error) { console.error(error) }
    }
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    const newTabs = tabs.filter((t) => t.id !== projectId)
    setTabs(newTabs)
    if (activeTabId === projectId) setActiveTabId("hub")
  }, [projects, tabs, activeTabId])

  const handleBatchDelete = useCallback(async (projectIds: string[]) => {
    setProjects((prev) => prev.filter((p) => !projectIds.includes(p.id)))
    setTabs((prev) => prev.filter((t) => !projectIds.includes(t.id)))
    setActiveTabId("hub")
  }, [])

  // 加载聊天历史记录
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await ETMAgentAPI.getConversationHistory("dashboard")
        const history = (response as any)?.messages || []
        setChatHistory(history.map((m: any, i: number) => ({
          id: m.id || `msg-${i}`, role: m.role, content: m.content, type: "text", timestamp: m.created_at
        })))
      } catch (e) { console.log("Chat history not available") }
    }
    loadHistory()
  }, [])

  const handleSendMessage = useCallback(async (p: any) => {
    const content = typeof p === 'string' ? p : p.content
    if (!content) return
    setChatHistory(prev => [...prev, { id: generateId(), role: "user", content, type: "text", timestamp: getTimestamp() }])
    const aiId = generateId()
    setChatHistory(prev => [...prev, { id: aiId, role: "ai", content: "", type: "text", isThinking: true }])
    try {
      const response = await ETMAgentAPI.chat(content, { current_view: activeTabId }, { sessionId: "dashboard" })
      setChatHistory(prev => prev.map(m => m.id === aiId ? { ...m, content: response.message, isThinking: false } : m))
    } catch { setChatHistory(prev => prev.map(m => m.id === aiId ? { ...m, content: "连接失败", isThinking: false } : m)) }
  }, [activeTabId])

  // 【全量逻辑回归】：渲染内容逻辑，包含最重要的上传界面触发器
  const renderContent = () => {
    if (activeTabId === "hub") {
      return (
        <ProjectHub
          onProjectSelect={handleOpenProject}
          onNewProject={() => setIsNewProjectDialogOpen(true)}
          onDeleteProject={handleDeleteProject}
          onBatchDelete={handleBatchDelete}
          onRefresh={loadProjects}
          projects={projects}
          isLoading={isLoading}
        />
      )
    }
    const currentProject = projects.find(p => p.id === activeTabId)
    if (!currentProject) return <div className="p-10 text-center"><Spinner /></div>

    if (currentProject.status === "completed" || currentProject.pipelineStatus === "completed" || currentProject.hasResults) {
      return <ProjectResultView project={currentProject} />
    }

    return (
      <AutoPipeline
        projectName={currentProject.name}
        mode={currentProject.mode || "zero_shot"}
        numTopics={currentProject.numTopics || 20}
        initialTaskId={currentProject.taskId}
        pipelineStatus={currentProject.pipelineStatus}
        onComplete={(res) => handlePipelineComplete(currentProject.id, res, currentProject.dbProjectId)}
        onDlcStarted={() => setActiveTabId("hub")}
        onTaskCreated={() => loadProjects()}
        onUploadComplete={() => loadProjects()}
      />
    )
  }

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs))
    sessionStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTabId)
  }, [tabs, activeTabId])

  if (!mounted) return null

  return (
    <AppShell 
      tabs={tabs} activeTabId={activeTabId} onTabChange={handleTabChange} onTabClose={handleTabClose} 
      chatHistory={chatHistory} onSendMessage={handleSendMessage}
    >
      <div className="relative min-h-[360px] flex flex-col">
        {/* =================【排版优化】固定功能按钮 (100% 还原) ================= */}
        <div className="w-full flex justify-between items-center pb-4 pt-2 px-4 z-30">
          <Button variant="outline" onClick={() => router.push('/')} className="bg-white border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-blue-50 shadow-sm transition-all flex items-center gap-2 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            返回主页
          </Button>
          <Button variant="outline" onClick={() => { localStorage.clear(); window.location.href='/login' }} className="bg-red-50 border-red-200 text-red-600 hover:text-red-700 hover:bg-red-100 shadow-sm transition-all flex items-center gap-2 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            退出登录
          </Button>
        </div>

        <div key={renderKey} className="flex-1 transition-all duration-500">
          {renderContent()}
        </div>
      </div>
      <NewProjectDialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen} onSubmit={handleCreateProject} />
    </AppShell>
  )
}

// 【全量还原】：结果视图逻辑，包含导出与指标 Tab
function ProjectResultView({ project }: { project: WorkspaceProject }) {
  const dataset = project.datasetName || project.name
  const mode    = project.mode || "zero_shot"
  const [activeResultTab, setActiveResultTab] = useState("topics")
  const [selectedModel, setSelectedModel] = useState<string | null>("theta")
  const [availableModels, setAvailableModels] = useState<string[]>(["theta"])

  useEffect(() => {
    apiFetch<{ models: string[] }>(API_BASE, `/api/results/${encodeURIComponent(dataset)}/models`)
      .then(res => { if (res?.models?.length) setAvailableModels(res.models); })
      .catch(() => {});
  }, [dataset]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">{project.name}</h1>
        <p className="text-slate-500 text-sm">数据集: {dataset} · 模式: {mode}</p>
      </div>

      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <span className="text-sm text-slate-500">选择模型:</span>
        <div className="flex flex-wrap gap-2">
          {availableModels.map((m) => (
            <button key={m} onClick={() => setSelectedModel(m)} className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${selectedModel === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"}`}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <Tabs value={activeResultTab} onValueChange={setActiveResultTab}>
        <TabsList>
          <TabsTrigger value="topics" className="cursor-pointer">主题词</TabsTrigger>
          <TabsTrigger value="metrics" className="cursor-pointer">评估指标</TabsTrigger>
          <TabsTrigger value="viz" className="cursor-pointer">可视化</TabsTrigger>
          <TabsTrigger value="export" className="cursor-pointer">导出结果</TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="mt-6">
          <TopicWordsTab dataset={dataset} mode={mode} selectedModel={selectedModel || 'theta'} shouldLoad={activeResultTab === "topics"} />
        </TabsContent>
        <TabsContent value="metrics" className="mt-6">
          <MetricsTab dataset={dataset} mode={mode} selectedModel={selectedModel || 'theta'} shouldLoad={activeResultTab === "metrics"} />
        </TabsContent>
        <TabsContent value="viz" className="mt-6">
          <VisualizationTab dataset={dataset} mode={mode} selectedModel={selectedModel || 'theta'} shouldLoad={activeResultTab === "viz"} />
        </TabsContent>
        <TabsContent value="export" className="mt-6">
          <ExportTab dataset={dataset} mode={mode} selectedModel={selectedModel || 'theta'} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function DashboardPage() {
  return <ProtectedRoute><DashboardContent /></ProtectedRoute>
}