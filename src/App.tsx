import {
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Download,
  ExternalLink,
  HardDrive,
  LayoutDashboard,
  Loader2,
  Mic2,
  MonitorCog,
  Play,
  Plus,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  Video,
  X,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Platform = "douyin" | "xiaohongshu" | "wechat";
type WorkMode = "manual" | "auto";

type StageKey = "input" | "script" | "voice" | "video" | "publish";
type ModelTypeKey = "llm" | "asr" | "tts" | "avatar";

type StageState = Record<StageKey, { label: string; status: string; message?: string; updatedAt?: string }>;

type AdapterProtocol = {
  id: string;
  version: string;
  label: string;
};

type ModelRecord = {
  id: string;
  catalogId?: string;
  name: string;
  type: string;
  runtime: string;
  pathRef: string;
  modelPlazaPath?: string;
  selected?: boolean;
  bundleRole?: string;
  license?: string;
  source?: string;
  endpoint?: string;
  status: string;
  note: string;
  healthMessage?: string;
  installGuide?: string;
  protocolStatus?: string;
  protocolMessage?: string;
  adapterProtocol?: AdapterProtocol;
  testResult?: { status: string; message: string; testedAt: string };
};

type ModelCatalogItem = {
  id: string;
  name: string;
  type: string;
  runtime: string;
  defaultPath: string;
  recommended: boolean;
  description: string;
  installGuide: string;
  adapterProtocol?: AdapterProtocol;
};

type ApiProviderCatalogItem = {
  id: string;
  name: string;
  capabilities: string[];
  envKey: string;
  endpoint: string;
  defaultModel?: string;
  models?: string[];
  description: string;
  setupGuide: string;
};

type ApiProviderRecord = ApiProviderCatalogItem & {
  id: string;
  providerId: string;
  status: string;
  maskedKey: string;
  hasKey: boolean;
  model?: string;
  healthMessage?: string;
  testResult?: { status: string; message: string; testedAt: string };
};

type ToastState = {
  message: string;
  tone: "success" | "error";
};

type Asset = {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  authStatus?: string;
  provider?: string;
  authScope?: string;
  cloneStatus?: string;
  createdAt: string;
  qualityReport?: { status: string; notes: string[]; metrics?: Record<string, number | string | boolean | undefined> };
};

type VideoSettings = {
  engine: "musetalk" | "latentsync" | "preview";
  cropMode: "mediapipe" | "default";
  parsingMode: "jaw" | "raw";
  upperBoundaryRatio: number;
  extraMargin: number;
  facePad: number;
  lowerPad: number;
  batchSize: number;
  leftCheekWidth: number;
  rightCheekWidth: number;
};

type ScriptVersion = {
  id: string;
  projectId: string;
  versionNo: number;
  label: string;
  sourceInputSnapshot: string;
  requirementsSnapshot: string;
  scriptText: string;
  title: string;
  outline?: string[];
  tags?: string[];
  platformCopies?: Record<string, { title: string; body: string; checklist?: string[] }>;
  modelInfo?: { type?: string; modelName?: string; providerName?: string; model?: string; metrics?: Record<string, number | string | boolean | undefined> } | null;
  createdAt: string;
  status: string;
  isCurrent?: boolean;
};

type AudioVersion = {
  id: string;
  projectId: string;
  versionNo: number;
  label: string;
  sourceScriptVersionId: string;
  voiceId: string;
  voiceName: string;
  audioUri: string;
  audioPath?: string;
  duration: number;
  transcriptText?: string;
  modelInfo?: { type?: string; modelName?: string; providerName?: string; model?: string; metrics?: Record<string, number | string | boolean | undefined> } | null;
  adapter?: string;
  note?: string;
  createdAt: string;
  status: string;
  isCurrent?: boolean;
};

type Project = {
  id: string;
  title: string;
  inputText: string;
  sourceText: string;
  requirements: string;
  manualScript: boolean;
  reviewEnabled: boolean;
  mode?: WorkMode;
  platforms: Platform[];
  avatarAssetId: string;
  voiceId: string;
  scriptModelId?: string;
  selectedScriptVersionId?: string;
  selectedAudioVersionId?: string;
  selectedVideoVersionId?: string;
  scriptVersions?: ScriptVersion[];
  audioVersions?: AudioVersion[];
  videoVersions?: VideoVersion[];
  videoSettings: VideoSettings;
  status: string;
  activeQueueId?: string;
  lastError?: string;
  currentStage: StageKey;
  currentStep: StageKey;
  progress?: ProgressState;
  stageState: StageState;
  sourceAnalysis: {
    links: Array<{ id: string; url: string; platform: string; status: string; title?: string; message?: string }>;
    transcripts: Array<{ text: string; status: string }>;
    notes: string[];
  };
  artifacts: {
    audio?: { uri: string; path: string; duration: number; adapter: string; note?: string };
    script?: {
      title: string;
      outline: string[];
      script: string;
      tags: string[];
      platformCopies: Record<string, { title: string; body: string; checklist?: string[] }>;
      modelInfo?: { type?: string; modelName?: string; providerName?: string; model?: string; metrics?: Record<string, number | string | boolean | undefined> } | null;
    };
    subtitles?: { uri: string; path: string; format: string };
    video?: {
      uri: string;
      path: string;
      duration: number;
      adapter: string;
      subtitlesEmbedded?: boolean;
      visibleCaptions?: boolean;
      qualityReport?: { status: string; notes: string[] };
    };
  };
  versions?: VideoVersion[];
  createdAt: string;
  updatedAt: string;
};

type SourceExtractResponse = {
  extractionId?: string;
  id?: string;
  inputText: string;
  extractedText?: string;
  transcriptText?: string;
  title?: string;
  sourceUrl?: string;
  mediaUri?: string;
  detectedType?: "text" | "video_asr" | "link_metadata" | "link";
  kind?: "text" | "video_asr" | "link_metadata" | "link";
  status?: string;
  notes?: string[];
  sourceAnalysis?: Project["sourceAnalysis"];
};

type ProgressState = {
  percent: number;
  label: string;
  stage?: StageKey;
  status?: string;
  queueId?: string;
  updatedAt?: string;
};

type QueueItem = {
  id: string;
  projectId: string;
  type: string;
  label: string;
  status: string;
  progress?: ProgressState;
  position?: number;
  attempts?: number;
  lastError?: string;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  finishedAt?: string;
};

type ResourceSnapshot = {
  status: "ok" | "warning" | "blocked";
  freeGb: number;
  totalGb: number;
  freeRatio: number;
  load1: number;
  cpuCount: number;
  queuedCount: number;
  runningCount: number;
  rssGb: number;
  heapUsedGb: number;
  updatedAt: string;
};

type VideoVersion = {
  id: string;
  projectId?: string;
  versionNo?: number;
  label: string;
  variantLabel?: string;
  abGroupId?: string;
  sourceQueueId?: string;
  sourceAudioVersionId?: string;
  sourceScriptVersionId?: string;
  avatarAssetId?: string;
  videoUri?: string;
  videoPath?: string;
  duration?: number;
  resolution?: string;
  status?: string;
  isCurrent?: boolean;
  createdAt: string;
  videoSettings: VideoSettings;
  artifact: {
    video: { uri: string; path: string; duration: number; adapter: string };
    subtitles?: { uri: string; path: string; format: string } | null;
  };
  qualityReport?: { status: string; notes: string[] } | null;
};

type PublishRecord = {
  id: string;
  projectId: string;
  projectTitle: string;
  platform: Platform;
  platformLabel: string;
  status: string;
  publishUrl: string;
  videoUri: string;
  title: string;
  body: string;
  createdAt: string;
  publishedAt?: string;
  workUrl?: string;
};

type JobRecord = {
  id: string;
  projectId: string;
  step: string;
  status: string;
  message: string;
  createdAt: string;
  updatedAt?: string;
};

type FlowAction = { label: string; path: string; body?: unknown };

type State = {
  projects: Project[];
  avatarAssets: Asset[];
  voices: Asset[];
  models: ModelRecord[];
  modelCatalog: ModelCatalogItem[];
  apiProviderCatalog: ApiProviderCatalogItem[];
  apiProviders: ApiProviderRecord[];
  jobs: JobRecord[];
  queueItems: QueueItem[];
  resource?: ResourceSnapshot;
  publishRecords: PublishRecord[];
  modelHome: string;
  settings?: { defaultTextModelId?: string; defaultModelIds?: Partial<Record<ModelTypeKey, string>> };
};

const emptyState: State = {
  projects: [],
  avatarAssets: [],
  voices: [],
  models: [],
  modelCatalog: [],
  apiProviderCatalog: [],
  apiProviders: [],
  jobs: [],
  queueItems: [],
  resource: undefined,
  publishRecords: [],
  modelHome: "",
  settings: {}
};

const navItems = [
  { id: "tasks", label: "任务中心", icon: LayoutDashboard },
  { id: "assets", label: "素材库", icon: Video },
  { id: "voices", label: "音色库", icon: Mic2 },
  { id: "models", label: "模型中心", icon: MonitorCog },
  { id: "publish", label: "发布历史", icon: Send }
] as const;

const stageOrder: StageKey[] = ["input", "script", "voice", "video", "publish"];
const platformLabels: Record<Platform, string> = { douyin: "抖音", xiaohongshu: "小红书", wechat: "公众号" };
const stageCopy: Record<StageKey, { title: string; description: string }> = {
  input: { title: "输入", description: "确认原始文本和生成要求。" },
  script: { title: "生成口播文案", description: "基于输入生成或保存口播文案版本。" },
  voice: { title: "生成口播音频", description: "选择文案版本和音色，生成可试听音频版本。" },
  video: { title: "视频合成", description: "选择音频版本和数字人素材，生成可预览视频版本。" },
  publish: { title: "发布", description: "选择视频版本和渠道，生成发布记录。" }
};
const stageActionMap: Partial<Record<StageKey, FlowAction>> = {
  script: { label: "生成口播文案", path: "generate-script" },
  voice: { label: "生成口播音频", path: "synthesize-speech" },
  video: { label: "生成视频", path: "render-video" }
};
const modelTypeTabs: Array<{ id: ModelTypeKey; label: string }> = [
  { id: "llm", label: "LLM" },
  { id: "asr", label: "ASR" },
  { id: "tts", label: "TTS" },
  { id: "avatar", label: "数字人" }
];
const modelTypeLabels: Record<ModelTypeKey, string> = {
  llm: "文本模型",
  asr: "ASR",
  tts: "TTS",
  avatar: "数字人"
};
const defaultVideoSettings: VideoSettings = {
  engine: "musetalk",
  cropMode: "mediapipe",
  parsingMode: "jaw",
  upperBoundaryRatio: 0.5,
  extraMargin: 0,
  facePad: 0.12,
  lowerPad: 0.03,
  batchSize: 1,
  leftCheekWidth: 90,
  rightCheekWidth: 90
};
const videoSettingTips: Record<keyof VideoSettings, string> = {
  engine: "MuseTalk 用于当前本地口型生成；Preview 只做快速占位预览。",
  cropMode: "MediaPipe 会按人脸关键点裁下半脸，通常比默认框更稳。",
  parsingMode: "jaw 会融合下巴和脸颊，raw 改动范围更小但贴片感可能更强。",
  upperBoundaryRatio: "数值越大，替换区域越靠下；嘴带动太多脸时调高到 0.53-0.56。",
  extraMargin: "向下增加下巴区域；下巴被切或嘴底部不自然时加到 4-8。",
  facePad: "左右脸颊扩展；嘴像贴片时加到 0.14-0.16，脸变形时降到 0.10。",
  lowerPad: "底部扩展；下唇和下巴过渡生硬时加到 0.04-0.06。",
  batchSize: "Mac 上建议保持 1，调大更快但更容易占内存。",
  leftCheekWidth: "jaw 模式下左脸保护宽度；脸颊被改坏时适当调大。",
  rightCheekWidth: "jaw 模式下右脸保护宽度；脸颊被改坏时适当调大。"
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    throw new Error(rawMessage === "Failed to fetch"
      ? "无法连接本地服务。请确认页面地址和服务地址一致，并刷新页面后重试；如果是手机访问，不要使用 localhost。"
      : rawMessage || "网络请求失败。");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "请求失败" }));
    throw new Error(body.error || "请求失败");
  }
  return response.json();
}

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function isQueuedResponse(value: unknown): value is { queued: true; queueItem: QueueItem } {
  return Boolean(value && typeof value === "object" && "queued" in value && (value as { queued?: unknown }).queued === true);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function stageDone(status = "") {
  return ["done", "ready", "video_ready", "completed"].some((item) => status.includes(item));
}

function stageRunning(status = "") {
  return status === "queued" || status === "running" || status.includes("running");
}

function isActiveQueue(item?: QueueItem) {
  return Boolean(item && ["queued", "running"].includes(item.status));
}

function isStageKey(value?: string): value is StageKey {
  return Boolean(value && stageOrder.includes(value as StageKey));
}

function getCurrentStage(project: Project): StageKey {
  if (isStageKey(project.progress?.stage) && ["queued", "running"].includes(project.progress.status || "")) return project.progress.stage;
  const runningStage = stageOrder.find((stage) => stageRunning(project.stageState?.[stage]?.status));
  if (runningStage) return runningStage;
  if (isStageKey(project.currentStage)) return project.currentStage;
  const pendingStage = stageOrder.find((stage) => !stageDone(project.stageState?.[stage]?.status || ""));
  return pendingStage || "publish";
}

function getNextAction(project: Project, videoSettings: VideoSettings): FlowAction | undefined {
  const current = getCurrentStage(project);
  if (stageRunning(project.stageState?.[current]?.status)) return undefined;
  if (current === "video") return { label: "生成视频", path: "render-video", body: { videoSettings } };
  return stageActionMap[current];
}

function progressValue(project: Project) {
  if (typeof project.progress?.percent === "number" && ["queued", "running", "failed"].includes(project.progress.status || "")) {
    return project.progress.percent;
  }
  const done = stageOrder.filter((stage) => stageDone(project.stageState?.[stage]?.status || "")).length;
  return Math.round((done / stageOrder.length) * 100);
}

function statusText(status = "") {
  const dictionary: Record<string, string> = {
    created: "已创建",
    pending: "待执行",
    queued: "排队中",
    running: "执行中",
    done: "完成",
    ready: "就绪",
    review: "待确认",
    completed: "完成",
    paused: "已暂停",
    input_ready: "输入就绪",
    script_ready: "口播文案就绪",
    voice_ready: "音频就绪",
    video_ready: "视频就绪",
    waiting_review: "待确认",
    approved: "已确认",
    deleted: "已删除",
    installed: "已安装",
    configured: "已配置",
    passed: "通过",
    warning: "需关注",
    failed: "失败",
    blocked: "已阻止",
    cancelled: "已取消",
    ok: "正常",
    missing: "缺失"
  };
  return dictionary[status] || status || "待执行";
}

function videoSettingsSummary(settings?: VideoSettings) {
  if (!settings) return "";
  return `${settings.cropMode} / ${settings.parsingMode} / upper ${settings.upperBoundaryRatio} / face ${settings.facePad}`;
}

export function App() {
  const [state, setState] = useState<State>(emptyState);
  const [view, setView] = useState<(typeof navItems)[number]["id"]>("tasks");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string, tone: ToastState["tone"] = "success") {
    setToast({ message, tone });
  }

  async function refresh(showSpinner = false) {
    if (showSpinner) setLoading(true);
    const data = await request<State>("/api/state");
    setState(data);
    setSelectedProjectId((current) => current || data.projects[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    refresh(true).catch((error) => {
      showToast(error.message, "error");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setToast(null);
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const hasActiveQueue = state.queueItems.some(isActiveQueue);
    const hasRunningProject = state.projects.some((project) => (
      ["queued", "running"].includes(project.status) || Object.values(project.stageState || {}).some((stage) => stageRunning(stage.status))
    ));
    if (!busy && !hasRunningProject && !hasActiveQueue) return;
    const timer = window.setInterval(() => {
      refresh().catch((error) => showToast(error.message, "error"));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [busy, state.projects, state.queueItems]);

  async function action<T>(label: string, runner: () => Promise<T>) {
    setBusy(label);
    try {
      const result = await runner();
      await refresh();
      showToast(isQueuedResponse(result) ? `${label}已提交队列` : `${label}已完成`, "success");
      return result;
    } catch (error) {
      await refresh().catch(() => undefined);
      showToast(error instanceof Error ? error.message : "操作失败", "error");
    } finally {
      setBusy("");
    }
  }

  const selectedProject = useMemo(
    () => state.projects.find((project) => project.id === selectedProjectId) || state.projects[0],
    [state.projects, selectedProjectId]
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><UserRound size={22} /></div>
          <div><strong>数字人视频工厂</strong><span>任务式内容生产</span></div>
        </div>
        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={cx("nav-item", view === item.id && "active")} onClick={() => setView(item.id)}>
                <Icon size={18} />{item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">手动流 · 自动流 · 阶段产物可回看</p><h1>{navItems.find((item) => item.id === view)?.label}</h1></div>
          <button className="icon-button" onClick={() => refresh(true)} aria-label="刷新">
            {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
        </header>

        {toast && (
          <div className={cx("toast", toast.tone === "error" && "error")} role="status" aria-live="polite">
            {toast.tone === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)}>关闭</button>
          </div>
        )}

        {view === "tasks" && (
          <TaskCenter
            state={state}
            selectedProject={selectedProject}
            setSelectedProjectId={setSelectedProjectId}
            selectedProjectId={selectedProjectId}
            busy={busy}
            action={action}
            refresh={refresh}
          />
        )}
        {view === "assets" && <AssetManager title="数字人素材" kind="avatar" items={state.avatarAssets} refresh={refresh} action={action} />}
        {view === "voices" && <AssetManager title="音色库" kind="voice" items={state.voices} refresh={refresh} action={action} />}
        {view === "models" && <ModelCenter state={state} action={action} />}
        {view === "publish" && <PublishHistory records={state.publishRecords} projects={state.projects} action={action} />}
      </main>
    </div>
  );
}

function TaskCenter(props: {
  state: State;
  selectedProject?: Project;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  busy: string;
  action: <T>(label: string, runner: () => Promise<T>) => Promise<T | undefined>;
  refresh: () => Promise<void>;
}) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const allChecked = props.state.projects.length > 0 && props.state.projects.every((project) => checkedSet.has(project.id));

  useEffect(() => {
    setCheckedIds((current) => current.filter((id) => props.state.projects.some((project) => project.id === id)));
  }, [props.state.projects]);

  const toggleAll = (checked: boolean) => {
    setCheckedIds(checked ? props.state.projects.map((project) => project.id) : []);
  };

  const toggleOne = (projectId: string, checked: boolean) => {
    setCheckedIds((current) => checked ? Array.from(new Set([...current, projectId])) : current.filter((id) => id !== projectId));
  };

  async function deleteChecked() {
    if (!checkedIds.length) return;
    if (!window.confirm(`删除选中的 ${checkedIds.length} 个任务？`)) return;
    const ids = [...checkedIds];
    await props.action("批量删除任务", async () => {
      await Promise.all(ids.map((id) => request(`/api/projects/${id}`, { method: "DELETE" })));
      return { ok: true };
    });
    if (ids.includes(props.selectedProjectId)) props.setSelectedProjectId("");
    setCheckedIds([]);
  }

  return (
    <div className="task-layout">
      <section className="task-main">
        <SourceExtractionTool
          selectedProject={props.selectedProject}
          action={props.action}
          onUseAsDraft={setDraftInput}
        />
        <TaskComposer state={props.state} action={props.action} onCreated={props.setSelectedProjectId} draftInput={draftInput} onDraftConsumed={() => setDraftInput("")} />
        <div className="section-head task-list-head">
          <div><p className="eyebrow">任务</p><h2>任务列表</h2></div>
          <span className="count-pill">{props.state.projects.length}</span>
        </div>
        <div className="bulk-toolbar">
          <label className="checkbox-pill">
            <input type="checkbox" checked={allChecked} onChange={(event) => toggleAll(event.target.checked)} />
            全选
          </label>
          <button className="ghost-button danger" disabled={!checkedIds.length} onClick={deleteChecked}><Trash2 size={15} />删除所选</button>
          {checkedIds.length > 0 && <small>已选 {checkedIds.length} 个</small>}
        </div>
        <div className="task-list">
          {props.state.projects.map((project) => {
            const deleteProject = () => {
              if (!window.confirm(`删除任务「${project.title}」？`)) return;
              if (props.selectedProjectId === project.id) props.setSelectedProjectId("");
              props.action("删除任务", () => request(`/api/projects/${project.id}`, { method: "DELETE" }));
            };
            return (
              <article key={project.id} className={cx("task-row", props.selectedProjectId === project.id && "active")}>
                <input
                  className="task-check"
                  type="checkbox"
                  aria-label={`选择任务 ${project.title}`}
                  checked={checkedSet.has(project.id)}
                  onChange={(event) => toggleOne(project.id, event.target.checked)}
                />
                <button className="task-select" onClick={() => props.setSelectedProjectId(project.id)}>
                  <div>
                    <strong>{project.title}</strong>
                    <small>{formatDate(project.createdAt)} · 当前：{project.stageState?.[getCurrentStage(project)]?.label || getCurrentStage(project)} · {statusText(project.stageState?.[getCurrentStage(project)]?.status || project.status)}</small>
                  </div>
                  <StageDots project={project} />
                </button>
                <button className="task-delete" onClick={deleteProject} aria-label={`删除任务 ${project.title}`}><Trash2 size={15} /></button>
              </article>
            );
          })}
          {props.state.projects.length === 0 && <EmptyState text="还没有任务。输入需求后可以直接开始生成。" />}
        </div>
      </section>
      <TaskDetail project={props.selectedProject} state={props.state} busy={props.busy} action={props.action} />
    </div>
  );
}

function extractionStepsFor(status: "idle" | "running" | "done" | "failed") {
  const labels = [
    ["input", "输入链接/文本"],
    ["detect", "识别类型"],
    ["extract", "提取/下载"],
    ["asr", "ASR"],
    ["result", "解析结果"]
  ] as const;
  if (status === "idle") return labels.map(([id, label], index) => ({ id, label, status: index === 0 ? "done" as const : "pending" as const }));
  if (status === "done") return labels.map(([id, label]) => ({ id, label, status: "done" as const }));
  if (status === "failed") return labels.map(([id, label], index) => ({ id, label, status: index < 2 ? "done" as const : index === 2 ? "failed" as const : "pending" as const }));
  return labels.map(([id, label], index) => ({ id, label, status: index < 2 ? "done" as const : index === 2 ? "running" as const : "pending" as const }));
}

function SourceExtractionTool({
  selectedProject,
  action,
  onUseAsDraft
}: {
  selectedProject?: Project;
  action: AppAction;
  onUseAsDraft: (text: string) => void;
}) {
  const [sourceText, setSourceText] = useState("");
  const [result, setResult] = useState<SourceExtractResponse | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const extractedText = result?.extractedText || result?.inputText || "";
  const extractionId = result?.extractionId || result?.id || "";

  async function extract() {
    const source = sourceText.trim();
    if (!source) return;
    setStatus("running");
    setResult(null);
    const response = await action("解析链接", () => request<SourceExtractResponse>("/api/source-extractions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceText: source })
    }));
    if (response?.extractedText || response?.inputText) {
      setResult(response);
      setStatus("done");
    } else {
      setStatus("failed");
    }
  }

  async function applyToProject() {
    if (!selectedProject || !extractionId) return;
    await action("推送解析结果", () => request(`/api/projects/${selectedProject.id}/input/apply-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractionId, mode })
    }));
  }

  return (
    <section className="source-tool">
      <div className="section-head">
        <div><p className="eyebrow">链接解析</p><h2>独立解析工具</h2></div>
        <StatusBadge status={status === "done" ? "done" : status === "failed" ? "failed" : status === "running" ? "running" : "pending"} />
      </div>
      <div className="extract-control">
        <input
          aria-label="链接解析输入"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder="粘贴抖音分享文本、视频链接或普通文本"
        />
        <button type="button" className="secondary-button" disabled={status === "running" || !sourceText.trim()} onClick={extract}>
          {status === "running" ? <Loader2 className="spin" size={16} /> : <Download size={16} />}提取
        </button>
      </div>
      <ExtractProgress steps={extractionStepsFor(status)} />
      {result && (
        <div className="source-result">
          <div>
            <strong>{result.title || result.detectedType || result.kind || "解析结果"}</strong>
            <small>{result.sourceUrl || result.notes?.[0] || "可推送到原始输入"}</small>
          </div>
          <p>{extractedText}</p>
          <div className="source-apply-row">
            <select aria-label="推送策略" value={mode} onChange={(event) => setMode(event.target.value as "append" | "replace")}>
              <option value="append">追加到当前输入</option>
              <option value="replace">覆盖当前输入</option>
            </select>
            <button className="primary-button" disabled={!selectedProject || !extractionId} onClick={applyToProject}><Send size={16} />推送到当前任务</button>
            <button className="ghost-button" disabled={!extractedText} onClick={() => onUseAsDraft(extractedText)}>填入新任务输入</button>
          </div>
        </div>
      )}
    </section>
  );
}

function TaskComposer({ state, action, onCreated, draftInput, onDraftConsumed }: { state: State; action: AppAction; onCreated: (id: string) => void; draftInput: string; onDraftConsumed: () => void }) {
  const [title, setTitle] = useState("");
  const [inputText, setInputText] = useState("");
  const [requirements, setRequirements] = useState("");
  const [mode, setMode] = useState<WorkMode>("manual");
  const [scriptModelId, setScriptModelId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [avatarAssetId, setAvatarAssetId] = useState("");
  useEffect(() => {
    setScriptModelId((current) => current || state.settings?.defaultTextModelId || state.models.find((model) => model.type === "llm")?.id || "");
  }, [state.settings?.defaultTextModelId, state.models]);

  useEffect(() => {
    if (!draftInput) return;
    setInputText((current) => current ? `${current.trim()}\n\n${draftInput}` : draftInput);
    onDraftConsumed();
  }, [draftInput, onDraftConsumed]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    let createdProjectId = "";
    await action(mode === "auto" ? "创建并自动生成" : "创建手动任务", async () => {
      const project = await request<Project>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          inputText,
          requirements,
          scriptModelId,
          manualScript: false,
          mode,
          reviewEnabled: mode === "manual",
          voiceId: mode === "auto" ? voiceId : "",
          avatarAssetId: mode === "auto" ? avatarAssetId : "",
          platforms: Object.keys(platformLabels)
        })
      });
      createdProjectId = project.id;
      if (mode === "auto") {
        return request(`/api/projects/${project.id}/run-all`, { method: "POST" });
      }
      return project;
    });
    if (createdProjectId) onCreated(createdProjectId);
    setTitle("");
    setInputText("");
    setRequirements("");
    setScriptModelId(state.settings?.defaultTextModelId || "");
  }

  return (
    <section className="composer">
      <form onSubmit={submit}>
        <div className="mode-switch" role="group" aria-label="任务模式">
          <button type="button" className={cx(mode === "manual" && "active")} onClick={() => setMode("manual")}>手动模式</button>
          <button type="button" className={cx(mode === "auto" && "active")} onClick={() => setMode("auto")}>全自动模式</button>
        </div>
        <label>
          <span>任务标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="可选；不填会自动生成短标题" />
        </label>
        <label>
          <span>原始输入</span>
          <textarea required value={inputText} onChange={(event) => setInputText(event.target.value)} placeholder="输入主题、需求、参考信息" />
        </label>
        <div className={cx("composer-grid", mode === "manual" && "compact")}>
          <label><span>生成要求</span><input value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="语气、时长、平台风格、受众" /></label>
          <TextModelSelect state={state} value={scriptModelId} onChange={setScriptModelId} />
          {mode === "auto" && (
            <>
              <label><span>音色</span><select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">默认音色</option>{state.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
              <label><span>数字人素材</span><select value={avatarAssetId} onChange={(event) => setAvatarAssetId(event.target.value)}><option value="">默认预览</option>{state.avatarAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
            </>
          )}
        </div>
        <div className="toolbar-row">
          <button className="primary-button" disabled={!inputText.trim()}><Play size={17} />{mode === "auto" ? "创建并自动生成" : "创建手动任务"}</button>
        </div>
      </form>
    </section>
  );
}

function providerTextModelValue(provider: ApiProviderRecord) {
  return `provider:${provider.id}`;
}

function normalizeTextModelValue(state: State, value = "") {
  const fallback = state.settings?.defaultTextModelId || state.models.find((model) => model.type === "llm")?.id || "";
  const selected = value || fallback;
  if (!selected.startsWith("provider:")) return selected;
  const providerKey = selected.replace("provider:", "");
  const provider = state.apiProviders.find((item) => item.id === providerKey || item.providerId === providerKey);
  return provider ? providerTextModelValue(provider) : selected;
}

function defaultModelIdForType(state: State, type: ModelTypeKey) {
  if (type === "llm") return normalizeTextModelValue(state, state.settings?.defaultTextModelId || state.settings?.defaultModelIds?.llm || "");
  const configured = state.settings?.defaultModelIds?.[type] || "";
  if (configured.startsWith("provider:")) {
    const providerKey = configured.replace("provider:", "");
    const provider = state.apiProviders.find((item) => (item.id === providerKey || item.providerId === providerKey) && item.capabilities?.includes(type));
    if (provider) return providerTextModelValue(provider);
  }
  const exists = state.models.some((model) => model.id === configured && model.type === type);
  return exists ? configured : state.models.find((model) => model.type === type)?.id || "";
}

function defaultModelLabelForType(state: State, type: ModelTypeKey) {
  const id = defaultModelIdForType(state, type);
  if (id.startsWith("provider:")) {
    const providerId = id.replace("provider:", "");
    const provider = state.apiProviders.find((item) => item.id === providerId || item.providerId === providerId);
    return provider ? `${provider.name} · ${provider.model || "未设置模型"}` : "未选择";
  }
  return state.models.find((model) => model.id === id && model.type === type)?.name || "未选择";
}

function providersForType(state: State, type: ModelTypeKey) {
  return state.apiProviders.filter((provider) => provider.hasKey && provider.model && provider.capabilities?.includes(type));
}

function TextModelSelect({ state, value, onChange }: { state: State; value: string; onChange: (value: string) => void }) {
  const localModels = state.models.filter((model) => model.type === "llm");
  const providers = providersForType(state, "llm");
  const selected = normalizeTextModelValue(state, value);
  return (
    <label>
      <span>文本模型</span>
      <select value={selected} onChange={(event) => onChange(event.target.value)}>
        {localModels.length > 0 && (
          <optgroup label="本地模型">
            {localModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          </optgroup>
        )}
        {providers.length > 0 && (
          <optgroup label="云端 Provider">
            {providers.map((provider) => <option key={provider.id} value={providerTextModelValue(provider)}>{provider.name} · {provider.model}</option>)}
          </optgroup>
        )}
      </select>
    </label>
  );
}

function TypedModelSelect({ state, type, models, value, onChange }: { state: State; type: Exclude<ModelTypeKey, "llm" | "avatar">; models: ModelRecord[]; value: string; onChange: (value: string) => void }) {
  const providers = providersForType(state, type);
  const selected = value || defaultModelIdForType(state, type);
  return (
    <label>
      <span>模型</span>
      <select value={selected} onChange={(event) => onChange(event.target.value)}>
        {models.length > 0 && (
          <optgroup label="本地模型">
            {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          </optgroup>
        )}
        {providers.length > 0 && (
          <optgroup label="云端 Provider">
            {providers.map((provider) => <option key={provider.id} value={providerTextModelValue(provider)}>{provider.name} · {provider.model}</option>)}
          </optgroup>
        )}
      </select>
    </label>
  );
}

function ExtractProgress({ steps }: { steps: Array<{ id: string; label: string; status: "pending" | "running" | "done" | "failed" }> }) {
  return (
    <div className="extract-progress" aria-label="提取进度">
      {steps.map((step) => (
        <span key={step.id} className={cx("extract-step", step.status)}>
          {step.status === "running" && <Loader2 className="spin" size={13} />}
          {step.status === "done" && <CheckCircle2 size={13} />}
          {step.status === "failed" && <XCircle size={13} />}
          {step.status === "pending" && <span className="pending-dot" />}
          {step.label}
        </span>
      ))}
    </div>
  );
}

type AppAction = <T>(label: string, runner: () => Promise<T>) => Promise<T | undefined>;

function TaskDetail({ project, state, busy, action }: { project?: Project; state: State; busy: string; action: AppAction }) {
  const [script, setScript] = useState("");
  const [scriptModelId, setScriptModelId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [avatarAssetId, setAvatarAssetId] = useState("");
  const [videoSettings, setVideoSettings] = useState<VideoSettings>(defaultVideoSettings);
  const currentStage = project ? getCurrentStage(project) : "input";
  const [activeStage, setActiveStage] = useState<StageKey>(currentStage);
  const [selectedScriptVersionId, setSelectedScriptVersionId] = useState("");
  const [selectedAudioVersionId, setSelectedAudioVersionId] = useState("");
  const [selectedVideoVersionId, setSelectedVideoVersionId] = useState("");
  const lastAutoStageRef = useRef<StageKey>(currentStage);
  const currentVersionId = (project?.videoVersions || project?.versions || []).find((version) => version.isCurrent)?.id || "";

  useEffect(() => {
    setScript(project?.artifacts.script?.script || project?.inputText || "");
    setScriptModelId(project?.scriptModelId || state.settings?.defaultTextModelId || state.models.find((model) => model.type === "llm")?.id || "");
    setVoiceId(project?.voiceId || "");
    setAvatarAssetId(project?.avatarAssetId || "");
  }, [project?.id, project?.artifacts.script?.script, project?.scriptModelId, project?.voiceId, project?.avatarAssetId, project?.inputText, state.settings?.defaultTextModelId, state.models]);

  useEffect(() => {
    setActiveStage(currentStage);
    lastAutoStageRef.current = currentStage;
    setSelectedScriptVersionId(project?.selectedScriptVersionId || project?.scriptVersions?.[0]?.id || "");
    setSelectedAudioVersionId(project?.selectedAudioVersionId || project?.audioVersions?.[0]?.id || "");
    setSelectedVideoVersionId(project?.selectedVideoVersionId || (project?.videoVersions || project?.versions || [])[0]?.id || "");
  }, [project?.id]);

  useEffect(() => {
    setActiveStage((selectedStage) => {
      if (project?.mode === "manual" && selectedStage !== currentStage) return selectedStage;
      return selectedStage === lastAutoStageRef.current ? currentStage : selectedStage;
    });
    lastAutoStageRef.current = currentStage;
  }, [currentStage, project?.mode]);

  useEffect(() => {
    setVideoSettings({ ...defaultVideoSettings, ...(project?.videoSettings || {}) });
  }, [project?.id, currentVersionId]);

  useEffect(() => {
    if (!project) return;
    if (project.selectedScriptVersionId) setSelectedScriptVersionId(project.selectedScriptVersionId);
    if (project.selectedAudioVersionId) setSelectedAudioVersionId(project.selectedAudioVersionId);
    if (project.selectedVideoVersionId) setSelectedVideoVersionId(project.selectedVideoVersionId);
  }, [project?.selectedScriptVersionId, project?.selectedAudioVersionId, project?.selectedVideoVersionId]);

  if (!project) return <aside className="task-detail"><EmptyState text="选择任务后查看阶段和视频。" /></aside>;
  const currentProject = project;

  const runStage = (label: string, path: string, body?: unknown) =>
    action(label, () => request<Project>(`/api/projects/${currentProject.id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }));

  const saveScript = () =>
    action("保存口播文案", () => request<Project>(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script, voiceId, scriptModelId, changedStage: "script" })
    }));

  const saveVoice = () =>
    action("保存音色", () => request<Project>(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, changedStage: "voice" })
    }));

  const saveVideoSetup = () =>
    action("保存视频设置", () => request<Project>(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarAssetId, videoSettings, changedStage: "video" })
    }));

  const generateVoice = () =>
    action("生成口播音频", async () => {
      await request<Project>(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, selectedScriptVersionId, changedStage: "voice" })
      });
      return request(`/api/projects/${project.id}/synthesize-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptVersionId: selectedScriptVersionId })
      });
    });

  const generateVideo = () =>
    action("生成视频", async () => {
      await request<Project>(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarAssetId, selectedAudioVersionId, videoSettings, changedStage: "video" })
      });
      return request(`/api/projects/${project.id}/render-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoSettings, audioVersionId: selectedAudioVersionId })
      });
    });

  async function preparePublish(platform: Platform) {
    const record = await action("准备发布", () => request<PublishRecord>(`/api/projects/${currentProject.id}/publish/${platform}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoVersionId: selectedVideoVersionId })
    }));
    if (record) {
      await navigator.clipboard.writeText(`标题：${record.title}\n\n正文：\n${record.body}\n\n视频：${window.location.origin}${record.videoUri}`);
      window.open(record.publishUrl, "_blank");
    }
  }

  const activeQueue = state.queueItems.find((item) => item.projectId === project.id && isActiveQueue(item));
  const latestQueue = activeQueue || state.queueItems.find((item) => item.projectId === project.id);
  const taskBusy = Boolean(activeQueue);
  const selectedVoice = state.voices.find((voice) => voice.id === voiceId);
  const selectedAsset = state.avatarAssets.find((asset) => asset.id === avatarAssetId);

  return (
    <aside className="task-detail">
      <div className="detail-title">
        <div>
          <p className="eyebrow">当前任务 · {project.mode === "auto" ? "全自动模式" : "手动模式"}</p>
          <h2>{project.title}</h2>
          <small>{formatDate(project.createdAt)}</small>
        </div>
        <button className="text-button danger-text" disabled={taskBusy} onClick={() => action("删除任务", () => request(`/api/projects/${project.id}`, { method: "DELETE" }))}><Trash2 size={14} />删除</button>
      </div>
      <StepNavigator
        project={project}
        currentStage={currentStage}
        activeStage={activeStage}
        onSelect={setActiveStage}
      />
      <StageWorkspace
        project={project}
        state={state}
        activeStage={activeStage}
        busy={busy}
        taskBusy={taskBusy}
        latestQueue={latestQueue}
        action={action}
        runStage={runStage}
        script={script}
        setScript={setScript}
        saveScript={saveScript}
        scriptModelId={scriptModelId}
        setScriptModelId={setScriptModelId}
        selectedScriptVersionId={selectedScriptVersionId}
        setSelectedScriptVersionId={setSelectedScriptVersionId}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        selectedVoice={selectedVoice}
        saveVoice={saveVoice}
        generateVoice={generateVoice}
        selectedAudioVersionId={selectedAudioVersionId}
        setSelectedAudioVersionId={setSelectedAudioVersionId}
        avatarAssetId={avatarAssetId}
        setAvatarAssetId={setAvatarAssetId}
        selectedAsset={selectedAsset}
        videoSettings={videoSettings}
        setVideoSettings={setVideoSettings}
        saveVideoSetup={saveVideoSetup}
        generateVideo={generateVideo}
        selectedVideoVersionId={selectedVideoVersionId}
        setSelectedVideoVersionId={setSelectedVideoVersionId}
        preparePublish={preparePublish}
      />
    </aside>
  );
}

function StepNavigator({
  project,
  currentStage,
  activeStage,
  onSelect
}: {
  project: Project;
  currentStage: StageKey;
  activeStage: StageKey;
  onSelect: (stage: StageKey) => void;
}) {
  const unlocked = (stage: StageKey) => {
    if (stage === "input") return true;
    if (stage === "script") return Boolean(project.inputText?.trim());
    if (stage === "voice") return Boolean(project.scriptVersions?.length || project.artifacts.script);
    if (stage === "video") return Boolean(project.audioVersions?.length || project.artifacts.audio);
    if (stage === "publish") return Boolean((project.videoVersions || project.versions || []).length || project.artifacts.video);
    return false;
  };
  return (
    <nav className="step-nav" aria-label="任务步骤">
      {stageOrder.map((stage, index) => {
        const state = project.stageState?.[stage];
        const disabled = !unlocked(stage);
        return (
          <button key={stage} disabled={disabled} className={cx("step-tab", activeStage === stage && "active", currentStage === stage && "current", disabled && "locked")} onClick={() => onSelect(stage)}>
            <span className="step-index">{index + 1}</span>
            <span><strong>{state?.label || stageCopy[stage].title}</strong><small>{statusText(state?.status || "pending")}</small></span>
          </button>
        );
      })}
    </nav>
  );
}

function StageWorkspace({
  project,
  state,
  activeStage,
  busy,
  taskBusy,
  latestQueue,
  action,
  runStage,
  script,
  setScript,
  saveScript,
  scriptModelId,
  setScriptModelId,
  selectedScriptVersionId,
  setSelectedScriptVersionId,
  voiceId,
  setVoiceId,
  selectedVoice,
  saveVoice,
  generateVoice,
  selectedAudioVersionId,
  setSelectedAudioVersionId,
  avatarAssetId,
  setAvatarAssetId,
  selectedAsset,
  videoSettings,
  setVideoSettings,
  saveVideoSetup,
  generateVideo,
  selectedVideoVersionId,
  setSelectedVideoVersionId,
  preparePublish
}: {
  project: Project;
  state: State;
  activeStage: StageKey;
  busy: string;
  taskBusy: boolean;
  latestQueue?: QueueItem;
  action: AppAction;
  runStage: (label: string, path: string, body?: unknown) => Promise<Project | { queued: true; queueItem: QueueItem } | undefined>;
  script: string;
  setScript: (value: string) => void;
  saveScript: () => Promise<Project | undefined>;
  scriptModelId: string;
  setScriptModelId: (value: string) => void;
  selectedScriptVersionId: string;
  setSelectedScriptVersionId: (value: string) => void;
  voiceId: string;
  setVoiceId: (value: string) => void;
  selectedVoice?: Asset;
  saveVoice: () => Promise<Project | undefined>;
  generateVoice: () => Promise<unknown>;
  selectedAudioVersionId: string;
  setSelectedAudioVersionId: (value: string) => void;
  avatarAssetId: string;
  setAvatarAssetId: (value: string) => void;
  selectedAsset?: Asset;
  videoSettings: VideoSettings;
  setVideoSettings: React.Dispatch<React.SetStateAction<VideoSettings>>;
  saveVideoSetup: () => Promise<Project | undefined>;
  generateVideo: () => Promise<unknown>;
  selectedVideoVersionId: string;
  setSelectedVideoVersionId: (value: string) => void;
  preparePublish: (platform: Platform) => Promise<void>;
}) {
  const stage = project.stageState?.[activeStage];
  const queueStage = latestQueue?.progress?.stage || project.progress?.stage;
  const showQueue = latestQueue && (isActiveQueue(latestQueue) || queueStage === activeStage);
  const publishRecords = state.publishRecords.filter((record) => record.projectId === project.id).slice(0, 6);
  const scriptVersions = project.scriptVersions || [];
  const audioVersions = project.audioVersions || [];
  const videoVersions = project.videoVersions || project.versions || [];
  const selectedScriptVersion = scriptVersions.find((version) => version.id === selectedScriptVersionId) || scriptVersions[0];
  const selectedAudioVersion = audioVersions.find((version) => version.id === selectedAudioVersionId) || audioVersions[0];
  const selectedVideoVersion = videoVersions.find((version) => version.id === selectedVideoVersionId) || videoVersions[0];

  return (
    <section className="step-panel">
      <div className="step-panel-head">
        <div>
          <p className="eyebrow">步骤 {stageOrder.indexOf(activeStage) + 1}</p>
          <h3>{stage?.label || stageCopy[activeStage].title}</h3>
          <small>{stageCopy[activeStage].description}</small>
        </div>
        <StatusBadge status={stage?.status || "pending"} />
      </div>
      {showQueue && <QueuePanel queueItem={latestQueue} project={project} action={action} />}

      {activeStage === "input" && (
        <div className="step-body">
          <OutputItem title="原始输入" status={project.stageState?.input?.status} meta={formatDate(project.createdAt)}>
            <p>{project.inputText || "暂无输入内容。"}</p>
            {project.requirements && <small>生成要求：{project.requirements}</small>}
          </OutputItem>
          <div className="step-actions">
            {!project.reviewEnabled && <ActionButton label="自动生成到视频" busy={busy} disabled={taskBusy} onClick={() => runStage("自动生成", "run-all")} />}
            <ActionButton label="生成口播文案" busy={busy} disabled={taskBusy || !project.inputText.trim()} onClick={() => runStage("生成口播文案", "generate-script", { scriptModelId })} />
          </div>
        </div>
      )}

      {activeStage === "script" && (
        <div className="step-body">
          <OutputItem title="当前输入" status={project.stageState?.input?.status} meta={project.requirements || "无额外要求"}>
            <p>{project.inputText || "暂无输入内容。"}</p>
          </OutputItem>
          <TextModelSelect state={state} value={scriptModelId} onChange={setScriptModelId} />
          <textarea value={script} onChange={(event) => setScript(event.target.value)} />
          {project.artifacts.script?.modelInfo && <small>生成模型：{project.artifacts.script.modelInfo.providerName || project.artifacts.script.modelInfo.modelName || project.artifacts.script.modelInfo.model || "文本模型"}</small>}
          {project.artifacts.script?.tags?.length ? <small>标签：{project.artifacts.script.tags.join(" / ")}</small> : null}
          <div className="step-actions">
            <button className="ghost-button" onClick={saveScript}><Settings2 size={15} />保存为新版本</button>
            <ActionButton label="生成口播文案" busy={busy} disabled={taskBusy} onClick={() => runStage("生成口播文案", "generate-script", { scriptModelId })} />
            {scriptVersions.length > 0 && <ActionButton label="生成口播音频" busy={busy} disabled={taskBusy} onClick={generateVoice} />}
          </div>
          <ScriptVersionList versions={scriptVersions} selectedId={selectedScriptVersionId} onSelect={(id) => {
            setSelectedScriptVersionId(id);
            const next = scriptVersions.find((version) => version.id === id);
            if (next) setScript(next.scriptText || "");
          }} />
        </div>
      )}

      {activeStage === "voice" && (
        <div className="step-body">
          <VersionSelect
            label="口播文案版本"
            value={selectedScriptVersionId}
            onChange={(id) => {
              setSelectedScriptVersionId(id);
              const next = scriptVersions.find((version) => version.id === id);
              if (next) setScript(next.scriptText || "");
            }}
            versions={scriptVersions}
            getMeta={(version) => version.title || formatDate(version.createdAt)}
          />
          <OutputItem title="当前文案输入" status={selectedScriptVersion?.status || "pending"} meta={selectedScriptVersion?.label || "未选择"}>
            <p>{selectedScriptVersion?.scriptText || "请先生成口播文案版本。"}</p>
          </OutputItem>
          <div className="field-row">
            <label><span>音色</span><select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">默认音色</option>{state.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
            <button className="secondary-button align-end" onClick={saveVoice}><Mic2 size={16} />保存音色</button>
          </div>
          <VoiceSample asset={selectedVoice} />
          <OutputItem title="当前音频预览" status={selectedAudioVersion?.status || project.stageState?.voice?.status} meta={selectedAudioVersion ? `${selectedAudioVersion.label} · ${selectedAudioVersion.duration}s` : "未生成"}>
            {selectedAudioVersion ? (
              <>
                <audio controls src={selectedAudioVersion.audioUri} />
                {selectedAudioVersion.voiceName && <small>音色：{selectedAudioVersion.voiceName}</small>}
              </>
            ) : <p>选择音色后点击生成口播音频。</p>}
          </OutputItem>
          <div className="step-actions">
            <ActionButton label="生成口播音频" busy={busy} disabled={taskBusy || !selectedScriptVersion} onClick={generateVoice} />
          </div>
          <AudioVersionList versions={audioVersions} scriptVersions={scriptVersions} selectedId={selectedAudioVersionId} onSelect={setSelectedAudioVersionId} />
        </div>
      )}

      {activeStage === "video" && (
        <div className="step-body">
          <VersionSelect
            label="口播音频版本"
            value={selectedAudioVersionId}
            onChange={setSelectedAudioVersionId}
            versions={audioVersions}
            getMeta={(version) => `${version.voiceName || "默认音色"} · ${version.duration}s`}
          />
          <OutputItem title="当前音频输入" status={selectedAudioVersion?.status || "pending"} meta={selectedAudioVersion?.label || "未选择"}>
            {selectedAudioVersion ? <audio controls src={selectedAudioVersion.audioUri} /> : <p>请先生成口播音频版本。</p>}
          </OutputItem>
          <div className="field-row">
            <label><span>数字人素材</span><select value={avatarAssetId} onChange={(event) => setAvatarAssetId(event.target.value)}><option value="">默认预览</option>{state.avatarAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
            <button className="secondary-button align-end" onClick={saveVideoSetup}><Settings2 size={16} />保存设置</button>
          </div>
          <AvatarSample asset={selectedAsset} />
          <VideoSettingsEditor videoSettings={videoSettings} setVideoSettings={setVideoSettings} />
          <div className="preset-row">
            <button className="ghost-button" onClick={() => setVideoSettings(defaultVideoSettings)}>推荐参数</button>
            <code>MediaPipe / jaw / upper 0.50 / margin 0</code>
          </div>
          <div className="video-surface">
            {selectedVideoVersion ? <video src={selectedVideoVersion.artifact.video.uri} controls /> : <EmptyState text="视频生成后会显示在这里。" />}
          </div>
          <div className="step-actions">
            <ActionButton label="生成视频" busy={busy} disabled={taskBusy || !selectedAudioVersion} onClick={generateVideo} />
          </div>
          <VideoVersionPanel project={project} versions={videoVersions} selectedId={selectedVideoVersionId} onSelect={setSelectedVideoVersionId} busy={busy} action={action} />
        </div>
      )}

      {activeStage === "publish" && (
        <div className="step-body">
          <VersionSelect
            label="发布视频版本"
            value={selectedVideoVersionId}
            onChange={setSelectedVideoVersionId}
            versions={videoVersions}
            getMeta={(version) => `${formatDate(version.createdAt)} · ${videoSettingsSummary(version.videoSettings)}`}
          />
          <div className="video-surface">
            {selectedVideoVersion ? <video src={selectedVideoVersion.artifact.video.uri} controls /> : <EmptyState text="视频生成后再进入发布。" />}
          </div>
          <div className="publish-buttons">
            {(Object.keys(platformLabels) as Platform[]).map((platform) => <button key={platform} className="primary-link" disabled={!selectedVideoVersion} onClick={() => preparePublish(platform)}><ExternalLink size={16} />{platformLabels[platform]}</button>)}
            {selectedVideoVersion && <a className="secondary-button" href={selectedVideoVersion.artifact.video.uri} download><Download size={16} />下载视频</a>}
          </div>
          <div className="output-list">
            {publishRecords.length ? publishRecords.map((record) => (
              <OutputItem key={record.id} title={record.platformLabel} status={record.status} meta={formatDate(record.createdAt)}>
                <p>{record.title}</p>
                <small>{record.workUrl || "未记录作品地址"}</small>
              </OutputItem>
            )) : <EmptyState text="还没有发布记录。选择平台后会生成发布文案和入口。" />}
          </div>
        </div>
      )}
    </section>
  );
}

function VoiceSample({ asset }: { asset?: Asset }) {
  if (!asset) return <EmptyState text="未选择音色，生成时会使用默认音色。" />;
  return (
    <article className="media-sample compact">
      <div><strong>{asset.name}</strong><small>{asset.mimeType || asset.provider || "local"} · {formatDate(asset.createdAt)}</small></div>
      <audio controls src={asset.uri} />
    </article>
  );
}

function AvatarSample({ asset }: { asset?: Asset }) {
  if (!asset) return <EmptyState text="未选择数字人素材，生成时会使用默认预览素材。" />;
  return (
    <article className="media-sample">
      <video controls muted preload="metadata" src={asset.uri} />
      <div>
        <strong>{asset.name}</strong>
        <small>{asset.mimeType || "video"} · {formatDate(asset.createdAt)}</small>
        {asset.qualityReport && <QualitySummary report={asset.qualityReport} />}
      </div>
    </article>
  );
}

function VideoSettingsEditor({ videoSettings, setVideoSettings }: { videoSettings: VideoSettings; setVideoSettings: React.Dispatch<React.SetStateAction<VideoSettings>> }) {
  return (
    <div className="param-grid">
      <label><span>渲染引擎</span><select value={videoSettings.engine} title={videoSettingTips.engine} onChange={(event) => setVideoSettings((current) => ({ ...current, engine: event.target.value as VideoSettings["engine"] }))}><option value="musetalk">MuseTalk</option><option value="latentsync">LatentSync</option><option value="preview">预览</option></select><small className="param-help">{videoSettingTips.engine}</small></label>
      <label><span>裁剪方式</span><select value={videoSettings.cropMode} title={videoSettingTips.cropMode} onChange={(event) => setVideoSettings((current) => ({ ...current, cropMode: event.target.value as VideoSettings["cropMode"] }))}><option value="mediapipe">MediaPipe</option><option value="default">默认</option></select><small className="param-help">{videoSettingTips.cropMode}</small></label>
      <label><span>融合模式</span><select value={videoSettings.parsingMode} title={videoSettingTips.parsingMode} onChange={(event) => setVideoSettings((current) => ({ ...current, parsingMode: event.target.value as VideoSettings["parsingMode"] }))}><option value="jaw">jaw</option><option value="raw">raw</option></select><small className="param-help">{videoSettingTips.parsingMode}</small></label>
      <label><span>上边界</span><input type="number" min="0.35" max="0.65" step="0.01" value={videoSettings.upperBoundaryRatio} title={videoSettingTips.upperBoundaryRatio} onChange={(event) => setVideoSettings((current) => ({ ...current, upperBoundaryRatio: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.upperBoundaryRatio}</small></label>
      <label><span>下巴边距</span><input type="number" min="0" max="40" step="1" value={videoSettings.extraMargin} title={videoSettingTips.extraMargin} onChange={(event) => setVideoSettings((current) => ({ ...current, extraMargin: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.extraMargin}</small></label>
      <label><span>脸颊扩展</span><input type="number" min="0.04" max="0.24" step="0.01" value={videoSettings.facePad} title={videoSettingTips.facePad} onChange={(event) => setVideoSettings((current) => ({ ...current, facePad: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.facePad}</small></label>
      <label><span>底部扩展</span><input type="number" min="0" max="0.12" step="0.01" value={videoSettings.lowerPad} title={videoSettingTips.lowerPad} onChange={(event) => setVideoSettings((current) => ({ ...current, lowerPad: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.lowerPad}</small></label>
      <label><span>批大小</span><input type="number" min="1" max="4" step="1" value={videoSettings.batchSize} title={videoSettingTips.batchSize} onChange={(event) => setVideoSettings((current) => ({ ...current, batchSize: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.batchSize}</small></label>
      <label><span>左脸宽度</span><input type="number" min="40" max="140" step="5" value={videoSettings.leftCheekWidth} title={videoSettingTips.leftCheekWidth} onChange={(event) => setVideoSettings((current) => ({ ...current, leftCheekWidth: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.leftCheekWidth}</small></label>
      <label><span>右脸宽度</span><input type="number" min="40" max="140" step="5" value={videoSettings.rightCheekWidth} title={videoSettingTips.rightCheekWidth} onChange={(event) => setVideoSettings((current) => ({ ...current, rightCheekWidth: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.rightCheekWidth}</small></label>
    </div>
  );
}

function FlowOverview({
  project,
  currentStage,
  nextAction,
  busy,
  activeQueue,
  onRunNext
}: {
  project: Project;
  currentStage: StageKey;
  nextAction?: { label: string; path: string; body?: unknown };
  busy: string;
  activeQueue?: QueueItem;
  onRunNext: () => void;
}) {
  const stage = project.stageState?.[currentStage];
  const running = stageRunning(stage?.status) || isActiveQueue(activeQueue);
  const progressLabel = activeQueue?.progress?.label || project.progress?.label || stage?.message || "等待下一步操作。";
  return (
    <section className="flow-overview" aria-live="polite">
      <div className="flow-head">
        <div>
          <p className="eyebrow">流程定位</p>
          <h3>{stage?.label || currentStage} · {statusText(stage?.status)}</h3>
          <small>{progressLabel}</small>
        </div>
        <div className="flow-progress">
          <strong>{progressValue(project)}%</strong>
          <span>总进度</span>
        </div>
      </div>
      <div className="progress-track"><span style={{ width: `${progressValue(project)}%` }} /></div>
      <div className="next-step-row">
        <span>{running ? "当前任务正在队列中，页面会自动刷新状态。" : nextAction ? `建议下一步：${nextAction.label}` : "当前流程已到可发布阶段。"}</span>
        {nextAction && <button className="primary-button" disabled={Boolean(busy) || running} onClick={onRunNext}>{busy === nextAction.label ? <Loader2 className="spin" size={16} /> : <Play size={16} />}{nextAction.label}</button>}
      </div>
    </section>
  );
}

function ResourceStrip({ resource, queueItems }: { resource?: ResourceSnapshot; queueItems: QueueItem[] }) {
  const active = queueItems.filter(isActiveQueue);
  return (
    <section className="resource-strip">
      <div>
        <Cpu size={17} />
        <strong>本机资源</strong>
        <span>{resource ? `${statusText(resource.status)} · 可用 ${resource.freeGb}GB / ${resource.totalGb}GB · 负载 ${resource.load1}` : "等待检测"}</span>
      </div>
      <div>
        <ShieldCheck size={17} />
        <strong>队列保护</strong>
        <span>运行 {active.filter((item) => item.status === "running").length} · 等待 {active.filter((item) => item.status === "queued").length}</span>
      </div>
    </section>
  );
}

function QueuePanel({ queueItem, project, action }: { queueItem?: QueueItem; project: Project; action: AppAction }) {
  if (!queueItem && !project.lastError) return null;
  const active = isActiveQueue(queueItem);
  const failed = queueItem?.status === "failed" || project.status === "failed";
  const percent = queueItem?.progress?.percent ?? project.progress?.percent ?? 0;
  const label = queueItem?.progress?.label || project.progress?.label || project.lastError || "暂无队列状态。";
  return (
    <section className="queue-panel">
      <div className="section-head">
        <div><p className="eyebrow">执行队列</p><h3>{queueItem?.label || "最近任务"}</h3></div>
        <StatusBadge status={queueItem?.status || project.status} />
      </div>
      <div className="queue-meta">
        <span>{queueItem?.status === "queued" ? `队列第 ${queueItem.position || 1} 位` : statusText(queueItem?.status || project.status)}</span>
        {queueItem?.attempts ? <span>第 {queueItem.attempts} 次执行</span> : null}
        {queueItem?.updatedAt ? <span>{formatDate(queueItem.updatedAt)}</span> : null}
      </div>
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      <small>{label}</small>
      {(failed || active) && (
        <div className="queue-actions">
          {failed && queueItem && <button className="ghost-button" onClick={() => action("重试任务", () => request(`/api/queue/${queueItem.id}/retry`, { method: "POST" }))}><RotateCcw size={15} />重试</button>}
          {active && queueItem?.status === "queued" && <button className="ghost-button danger" onClick={() => action("取消任务", () => request(`/api/queue/${queueItem.id}/cancel`, { method: "POST" }))}><XCircle size={15} />取消</button>}
        </div>
      )}
      {(queueItem?.lastError || project.lastError) && <p className="error-note"><AlertTriangle size={14} />{queueItem?.lastError || project.lastError}</p>}
    </section>
  );
}

function AssetQualityPanel({ asset }: { asset?: Asset }) {
  if (!asset) {
    return (
      <section className="quality-panel">
        <div className="section-head"><div><p className="eyebrow">素材质检</p><h3>数字人素材</h3></div><StatusBadge status="pending" /></div>
        <small>当前任务未选择数字人素材，会使用预览画面或后端兜底素材。</small>
      </section>
    );
  }
  const report = asset.qualityReport;
  const metrics = report?.metrics || {};
  return (
    <section className="quality-panel">
      <div className="section-head">
        <div><p className="eyebrow">素材质检</p><h3>{asset.name}</h3></div>
        <StatusBadge status={report?.status || "pending"} />
      </div>
      <div className="quality-metrics">
        {metrics.width && metrics.height ? <span>{metrics.width}x{metrics.height}</span> : null}
        {metrics.fps ? <span>{metrics.fps}fps</span> : null}
        {metrics.duration ? <span>{Math.round(Number(metrics.duration))}s</span> : null}
        {metrics.faceHits !== undefined ? <span>人脸 {String(metrics.faceHits)}/{String(metrics.faceSamples || 0)}</span> : null}
      </div>
      <ul>
        {(report?.notes || ["等待质检结果。"]).slice(0, 4).map((note, index) => <li key={index}>{note}</li>)}
      </ul>
    </section>
  );
}

function VersionSelect<T extends { id: string; label: string; createdAt: string }>({
  label,
  value,
  onChange,
  versions,
  getMeta
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  versions: T[];
  getMeta: (version: T) => string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value || versions[0]?.id || ""} onChange={(event) => onChange(event.target.value)} disabled={!versions.length}>
        {versions.length ? versions.map((version) => (
          <option key={version.id} value={version.id}>{version.label} · {getMeta(version)}</option>
        )) : <option value="">暂无版本</option>}
      </select>
    </label>
  );
}

function ScriptVersionList({ versions, selectedId, onSelect }: { versions: ScriptVersion[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="version-panel">
      <div className="section-head">
        <div><p className="eyebrow">输出版本</p><h3>口播文案版本</h3></div>
        <span className="count-pill">{versions.length}</span>
      </div>
      <div className="version-list">
        {versions.length ? versions.map((version) => (
          <article className={cx("version-row", version.id === selectedId && "current")} key={version.id}>
            <div>
              <strong>{version.label} · {version.title}</strong>
              <small>{formatDate(version.createdAt)} · {version.modelInfo?.providerName || version.modelInfo?.modelName || version.modelInfo?.model || "文本模型"}</small>
              <p>{version.scriptText}</p>
            </div>
            <div className="version-actions">
              <button className="text-button" onClick={() => onSelect(version.id)}>{version.id === selectedId ? "已选择" : "选择"}</button>
            </div>
          </article>
        )) : <EmptyState text="还没有口播文案版本。" />}
      </div>
    </section>
  );
}

function AudioVersionList({ versions, scriptVersions, selectedId, onSelect }: { versions: AudioVersion[]; scriptVersions: ScriptVersion[]; selectedId: string; onSelect: (id: string) => void }) {
  const scriptLabel = (id: string) => scriptVersions.find((version) => version.id === id)?.label || "未关联文案";
  return (
    <section className="version-panel">
      <div className="section-head">
        <div><p className="eyebrow">输出版本</p><h3>口播音频版本</h3></div>
        <span className="count-pill">{versions.length}</span>
      </div>
      <div className="version-list">
        {versions.length ? versions.map((version) => (
          <article className={cx("version-row", version.id === selectedId && "current")} key={version.id}>
            <div>
              <strong>{version.label} · {version.voiceName || "默认音色"}</strong>
              <small>{formatDate(version.createdAt)} · 来自 {scriptLabel(version.sourceScriptVersionId)} · {version.duration}s</small>
              <audio controls src={version.audioUri} />
            </div>
            <div className="version-actions">
              <button className="text-button" onClick={() => onSelect(version.id)}>{version.id === selectedId ? "已选择" : "选择"}</button>
            </div>
          </article>
        )) : <EmptyState text="还没有口播音频版本。" />}
      </div>
    </section>
  );
}

function VideoVersionPanel({ project, versions, selectedId, onSelect, busy, action }: { project: Project; versions: VideoVersion[]; selectedId: string; onSelect: (id: string) => void; busy: string; action: AppAction }) {
  if (!versions.length) return null;
  const latestAbGroup = versions.find((version) => version.abGroupId)?.abGroupId;
  const abVersions = latestAbGroup ? versions.filter((version) => version.abGroupId === latestAbGroup).slice(0, 3) : [];
  const visible = latestAbGroup ? versions.filter((version) => version.abGroupId === latestAbGroup || version.id === selectedId || version.isCurrent).slice(0, 6) : versions.slice(0, 8);
  const deleteVersion = (version: VideoVersion) => {
    if (!window.confirm(`删除视频版本「${version.label}${version.variantLabel ? ` · ${version.variantLabel}` : ""}」？`)) return;
    action("删除版本", () => request(`/api/projects/${project.id}/versions/${version.id}`, { method: "DELETE" }));
  };
  return (
    <section className="version-panel">
      <div className="section-head">
        <div><p className="eyebrow">输出版本</p><h3>视频版本</h3></div>
        <span className="count-pill">{versions.length}</span>
      </div>
      {abVersions.length > 1 && (
        <div className="ab-compare-grid">
          {abVersions.map((version) => (
            <article key={version.id}>
              <video src={version.artifact.video.uri} controls preload="metadata" />
              <strong>{version.variantLabel || version.label}</strong>
              <small>{videoSettingsSummary(version.videoSettings)}</small>
            </article>
          ))}
        </div>
      )}
      <div className="version-list">
        {visible.map((version) => (
          <article className={cx("version-row", version.id === selectedId && "current")} key={version.id}>
            <div>
              <strong>{version.label}{version.variantLabel ? ` · ${version.variantLabel}` : ""}</strong>
              <small>{formatDate(version.createdAt)} · {videoSettingsSummary(version.videoSettings)}</small>
              {version.qualityReport?.notes?.[0] && <p>{version.qualityReport.notes[0]}</p>}
            </div>
            <div className="version-actions">
              <a className="table-link" href={version.artifact.video.uri} target="_blank" rel="noreferrer">打开</a>
              <a className="table-link" href={version.artifact.video.uri} download>下载</a>
              <button className="text-button" disabled={Boolean(busy)} onClick={() => {
                onSelect(version.id);
                if (!version.isCurrent) action("切换版本", () => request(`/api/projects/${project.id}/versions/${version.id}/use`, { method: "POST" }));
              }}>{version.id === selectedId ? "已选择" : "选择"}</button>
              <button className="text-button danger-text" disabled={Boolean(busy)} onClick={() => deleteVersion(version)}>删除</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StageTimeline({ project, currentStage }: { project: Project; currentStage: StageKey }) {
  return (
    <div className="stage-timeline">
      {stageOrder.map((stage) => (
        <div key={stage} className={cx("stage-node", project.stageState?.[stage]?.status, currentStage === stage && "current")}>
          <span>{project.stageState?.[stage]?.label || stage}</span>
          <small>{statusText(project.stageState?.[stage]?.status || "pending")}</small>
          {project.stageState?.[stage]?.message && <em>{project.stageState[stage].message}</em>}
        </div>
      ))}
    </div>
  );
}

function StageOutputs({ project, publishRecords }: { project: Project; publishRecords: PublishRecord[] }) {
  const projectPublishRecords = publishRecords.filter((record) => record.projectId === project.id).slice(0, 3);
  return (
    <section className="stage-output-block">
      <div className="section-head"><div><p className="eyebrow">阶段产出</p><h3>每一步输出</h3></div></div>
      <div className="output-list">
        <OutputItem
          title="输入"
          status={project.stageState?.input?.status}
          meta={formatDate(project.createdAt)}
        >
          <p>{project.inputText || "暂无输入内容。"}</p>
          {project.requirements && <small>要求：{project.requirements}</small>}
        </OutputItem>

        <OutputItem
          title="口播文案"
          status={project.stageState?.script?.status}
          meta={project.artifacts.script?.title || "未生成"}
        >
          {project.artifacts.script ? (
            <>
              <p>{project.artifacts.script.script}</p>
              {project.artifacts.script.tags?.length ? <small>标签：{project.artifacts.script.tags.join(" / ")}</small> : null}
            </>
          ) : <p>暂无口播文案。点击生成口播文案后会显示完整内容。</p>}
        </OutputItem>

        <OutputItem
          title="音色/TTS"
          status={project.stageState?.voice?.status}
          meta={project.artifacts.audio ? `${project.artifacts.audio.duration}s · ${project.artifacts.audio.adapter}` : "未生成"}
        >
          {project.artifacts.audio ? (
            <>
              <audio controls src={project.artifacts.audio.uri} />
              {project.artifacts.audio.note && <small>{project.artifacts.audio.note}</small>}
            </>
          ) : <p>暂无口播音频。点击生成口播后会出现播放器。</p>}
        </OutputItem>

        <OutputItem
          title="视频生成"
          status={project.stageState?.video?.status}
          meta={project.artifacts.video ? `${project.artifacts.video.duration}s · ${project.artifacts.video.adapter}` : "未生成"}
        >
          {project.artifacts.video ? (
            <>
              <a className="table-link" href={project.artifacts.video.uri} target="_blank" rel="noreferrer">打开视频产物</a>
              {project.artifacts.subtitles && <a className="table-link" href={project.artifacts.subtitles.uri} target="_blank" rel="noreferrer">查看字幕</a>}
            </>
          ) : <p>暂无视频。点击生成视频后会在下方播放器显示。</p>}
        </OutputItem>

        <OutputItem
          title="发布"
          status={project.stageState?.publish?.status}
          meta={`${projectPublishRecords.length} 条记录`}
        >
          {projectPublishRecords.length ? projectPublishRecords.map((record) => (
            <p key={record.id}>{record.platformLabel}：{record.status} · {record.workUrl || "未填写作品地址"}</p>
          )) : <p>暂无发布准备记录。视频生成后可选择平台生成发布信息。</p>}
        </OutputItem>
      </div>
    </section>
  );
}

function OutputItem({
  title,
  status,
  meta,
  children
}: {
  title: string;
  status?: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="output-item">
      <div className="output-item-head">
        <div><strong>{title}</strong>{meta && <small>{meta}</small>}</div>
        <StatusBadge status={status || "pending"} />
      </div>
      <div className="output-content">{children}</div>
    </article>
  );
}

function RecentJobs({ jobs }: { jobs: JobRecord[] }) {
  return (
    <section className="job-log-block">
      <div className="section-head"><div><p className="eyebrow">执行记录</p><h3>最近动作</h3></div></div>
      <div className="job-log">
        {jobs.length ? jobs.map((job) => (
          <div className="job-row" key={job.id}>
            <StatusBadge status={job.status} />
            <div>
              <strong>{job.message}</strong>
              <small>{job.step} · {formatDate(job.createdAt)}</small>
            </div>
          </div>
        )) : <EmptyState text="还没有执行记录。" />}
      </div>
    </section>
  );
}

function StageDots({ project }: { project: Project }) {
  return <div className="stage-dots">{stageOrder.map((stage) => <span key={stage} className={cx(project.stageState?.[stage]?.status)} />)}</div>;
}

function AudioRecorder({ onRecorded, label = "录制音频" }: { onRecorded: (file: File) => void; label?: string }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type });
        onRecorded(file);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法启动麦克风。");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <span className="recording-control">
      <button type="button" className={cx("ghost-button", recording && "danger")} onClick={recording ? stopRecording : startRecording}>
        {recording ? <X size={15} /> : <Mic2 size={15} />}{recording ? "停止录制" : label}
      </button>
      {error && <small>{error}</small>}
    </span>
  );
}

function AssetManager({ title, kind, items, refresh, action }: { title: string; kind: "avatar" | "voice"; items: Asset[]; refresh: () => Promise<void>; action: AppAction }) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const filtered = items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  const uploadUrl = kind === "avatar" ? "/api/assets/avatar-videos" : "/api/voices/reference-samples";
  const endpointFor = (id: string) => kind === "avatar" ? `/api/assets/avatar-videos/${id}` : `/api/voices/reference-samples/${id}`;
  const entityLabel = kind === "avatar" ? "数字人素材" : "参考音色";
  const managerEyebrow = kind === "avatar" ? "素材管理" : "克隆参考音色";
  const nameLabel = kind === "avatar" ? "素材名称" : "音色名称";
  const fileLabel = kind === "avatar" ? "选择视频" : "选择参考音频";
  const uploadLabel = kind === "avatar" ? "上传素材" : "上传参考音色";
  const allChecked = filtered.length > 0 && filtered.every((item) => checkedIds.includes(item.id));

  useEffect(() => {
    setCheckedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.append("name", name || file.name);
    body.append("file", file);
    await fetch(uploadUrl, { method: "POST", body });
    setName("");
    setFile(null);
    await refresh();
  }

  function toggleAll(checked: boolean) {
    const filteredIds = filtered.map((item) => item.id);
    setCheckedIds((current) => checked
      ? Array.from(new Set([...current, ...filteredIds]))
      : current.filter((id) => !filteredIds.includes(id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setCheckedIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));
  }

  function deleteItem(item: Asset) {
    if (!window.confirm(`删除${entityLabel}「${item.name}」？`)) return;
    action(`删除${entityLabel}`, () => request(endpointFor(item.id), { method: "DELETE" }));
  }

  async function deleteChecked() {
    if (!checkedIds.length) return;
    if (!window.confirm(`删除选中的 ${checkedIds.length} 个${entityLabel}？`)) return;
    const ids = [...checkedIds];
    await action(`批量删除${entityLabel}`, async () => {
      await Promise.all(ids.map((id) => request(endpointFor(id), { method: "DELETE" })));
      return { ok: true };
    });
    setCheckedIds([]);
  }

  function startEdit(item: Asset) {
    setEditingId(item.id);
    setEditingName(item.name);
  }

  function cancelEdit() {
    setEditingId("");
    setEditingName("");
  }

  async function saveEdit(item: Asset) {
    const nextName = editingName.trim();
    if (!nextName) return;
    await action(`编辑${entityLabel}`, () => request(endpointFor(item.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName })
    }));
    cancelEdit();
  }

  return (
    <section className="manager-page">
      <div className="manager-toolbar">
        <div><p className="eyebrow">{managerEyebrow}</p><h2>{title}</h2>{kind === "voice" && <small>只保存用于克隆的参考音色；任务生成的口播音频不会进入这里。</small>}</div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称" />
      </div>
      <form className="upload-strip" onSubmit={submit}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={nameLabel} />
        <label className="file-chip"><Upload size={16} />{file ? file.name : fileLabel}<input type="file" accept={kind === "avatar" ? "video/*" : "audio/*"} onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        {kind === "voice" && <AudioRecorder label="录制参考音色" onRecorded={setFile} />}
        <button className="primary-button" disabled={!file}><Plus size={16} />{uploadLabel}</button>
      </form>
      <div className="bulk-toolbar manager-bulk-toolbar">
        <label className="checkbox-pill">
          <input type="checkbox" checked={allChecked} onChange={(event) => toggleAll(event.target.checked)} />
          全选
        </label>
        <button className="ghost-button danger" disabled={!checkedIds.length} onClick={deleteChecked}><Trash2 size={15} />删除所选</button>
        {checkedIds.length > 0 && <small>已选 {checkedIds.length} 个</small>}
      </div>
      <DataTable
        columns={["", nameLabel, kind === "avatar" ? "预览" : "试听", "创建时间", "操作"]}
        template="42px minmax(220px, 1.2fr) minmax(180px, .9fr) 120px 150px"
        rows={filtered.map((item) => [
          <input className="table-check" type="checkbox" aria-label={`选择${entityLabel} ${item.name}`} checked={checkedIds.includes(item.id)} onChange={(event) => toggleOne(item.id, event.target.checked)} />,
          editingId === item.id ? (
            <span className="inline-edit">
              <input value={editingName} onChange={(event) => setEditingName(event.target.value)} aria-label={`${entityLabel}名称`} />
              <button className="icon-mini" onClick={() => saveEdit(item)} aria-label="保存" disabled={!editingName.trim()}><Save size={14} /></button>
              <button className="icon-mini" onClick={cancelEdit} aria-label="取消"><X size={14} /></button>
            </span>
          ) : (
            <span className="asset-title"><strong>{item.name}</strong><small>{item.mimeType || item.provider || "local"}</small></span>
          ),
          <MediaPreview item={item} kind={kind} />,
          formatDate(item.createdAt),
          <span className="table-actions">
            <button className="text-button" onClick={() => startEdit(item)}><Pencil size={14} />编辑</button>
            <button className="text-button danger-text" onClick={() => deleteItem(item)}><Trash2 size={14} />删除</button>
          </span>
        ])}
      />
    </section>
  );
}

function MediaPreview({ item, kind }: { item: Asset; kind: "avatar" | "voice" }) {
  if (kind === "avatar") {
    return <video className="table-media" src={item.uri} controls muted preload="metadata" />;
  }
  return <audio className="table-audio" src={item.uri} controls preload="metadata" />;
}

function QualitySummary({ report }: { report?: Asset["qualityReport"] }) {
  if (!report) return <StatusBadge status="pending" />;
  return (
    <span className="quality-summary">
      <StatusBadge status={report.status} />
      {report.notes?.[0] && <small>{report.notes[0]}</small>}
    </span>
  );
}

function ModelCenter({ state, action }: { state: State; action: AppAction }) {
  const [activeType, setActiveType] = useState<ModelTypeKey>("llm");
  const visibleModels = state.models.filter((model) => model.type !== "media");
  const modelsByType = (type: ModelTypeKey) => visibleModels.filter((model) => model.type === type);
  const localTextModels = state.models.filter((model) => model.type === "llm");
  const cloudTextProviders = state.apiProviders.filter((provider) => provider.capabilities?.includes("llm"));
  const defaultTextModelId = state.settings?.defaultTextModelId || "";
  const selectedValue = normalizeTextModelValue(state, defaultTextModelId);
  const activeModels = modelsByType(activeType);
  const activeDefaultId = defaultModelIdForType(state, activeType);
  const activeDefaultLabel = defaultModelLabelForType(state, activeType);
  return (
    <section className="manager-page">
      <div className="manager-toolbar">
        <div><p className="eyebrow">模型中心</p><h2>模型选择与测试</h2></div>
        <span className="count-pill">{modelTypeLabels[activeType]}默认：{activeDefaultLabel}</span>
      </div>
      <div className="model-type-tabs" role="tablist" aria-label="模型分类">
        {modelTypeTabs.map((tab) => (
          <button key={tab.id} role="tab" className={cx(activeType === tab.id && "active")} onClick={() => setActiveType(tab.id)}>
            {tab.label}<span>{modelsByType(tab.id).length}</span>
          </button>
        ))}
      </div>

      {activeType === "llm" ? (
        <div className="model-choice-layout">
          <section className="model-panel">
            <div className="model-panel-head">
              <div><p className="eyebrow">Local</p><h3>本地文本模型</h3></div>
              <HardDrive size={18} />
            </div>
            <ModelInventory
              models={localTextModels}
              emptyText="还没有本地文本模型。"
              renderActions={(model) => {
                const selected = activeDefaultId === model.id;
                return (
                  <>
                    {selected && <span className="default-pill">默认</span>}
                    <button className="ghost-button" disabled={selected} onClick={() => action("选择本地模型", () => request("/api/models/select", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ modelId: model.id })
                    }))}>设为默认</button>
                  </>
                );
              }}
            />
          </section>

          <CloudProviderManager
            state={state}
            type="llm"
            providers={cloudTextProviders}
            selectedValue={selectedValue}
            action={action}
          />
          <LlmTypeTestPanel state={state} action={action} />
        </div>
      ) : activeType === "asr" || activeType === "tts" ? (
        <div className="model-choice-layout">
          <section className="model-panel">
            <div className="model-panel-head">
              <div><p className="eyebrow">Local</p><h3>本地{modelTypeLabels[activeType]}模型</h3></div>
              <span className="count-pill">{activeModels.length}</span>
            </div>
            <ModelInventory
              models={activeModels}
              emptyText={`还没有本地${modelTypeLabels[activeType]}模型。`}
              renderActions={(model) => {
                const selected = activeDefaultId === model.id;
                return (
                  <>
                    {selected && <span className="default-pill">默认</span>}
                    <button className="ghost-button" disabled={selected} onClick={() => action(`选择${modelTypeLabels[activeType]}模型`, () => request("/api/models/select", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ modelId: model.id })
                    }))}>设为默认</button>
                  </>
                );
              }}
            />
          </section>
          <CloudProviderManager
            state={state}
            type={activeType}
            providers={state.apiProviders.filter((provider) => provider.capabilities?.includes(activeType))}
            selectedValue={activeDefaultId}
            action={action}
          />
          <ModelTypeTestPanel type={activeType} models={activeModels} state={state} action={action} />
        </div>
      ) : (
        <div className="model-type-layout">
          <section className="model-panel">
            <div className="model-panel-head">
              <div><p className="eyebrow">{modelTypeLabels[activeType]}</p><h3>可用模型</h3></div>
              <span className="count-pill">{activeModels.length}</span>
            </div>
            <ModelInventory
              models={activeModels}
              emptyText={`还没有${modelTypeLabels[activeType]}模型。`}
              renderActions={(model) => {
                const selected = activeDefaultId === model.id;
                return (
                  <>
                    {selected && <span className="default-pill">默认</span>}
                    <button className="ghost-button" disabled={selected} onClick={() => action(`选择${modelTypeLabels[activeType]}模型`, () => request("/api/models/select", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ modelId: model.id })
                    }))}>设为默认</button>
                  </>
                );
              }}
            />
          </section>
          <ModelTypeTestPanel type={activeType} models={activeModels} state={state} action={action} />
        </div>
      )}
    </section>
  );
}

function ModelInventory({
  models,
  emptyText,
  renderActions
}: {
  models: ModelRecord[];
  emptyText: string;
  renderActions?: (model: ModelRecord) => React.ReactNode;
}) {
  return (
    <div className="inventory-list compact">
      {models.map((model) => (
        <article className="inventory-row model-choice-row" key={model.id}>
          <div>
            <strong>{model.name}</strong>
          </div>
          {renderActions && <div className="model-actions">{renderActions(model)}</div>}
        </article>
      ))}
      {models.length === 0 && <EmptyState text={emptyText} />}
    </div>
  );
}

function LlmTypeTestPanel({ state, action }: { state: State; action: AppAction }) {
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("请用一句话说明你能帮我做什么。");
  const [result, setResult] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    setModelId((current) => current || defaultModelIdForType(state, "llm"));
  }, [state]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTesting(true);
    try {
      const response = await action("测试文本模型", () => request<{ text: string }>("/api/model-tests/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, prompt })
      }));
      if (response?.text) setResult(response.text);
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="model-test-panel" onSubmit={submit}>
      <div><p className="eyebrow">Test</p><h3>文本模型测试</h3></div>
      <TextModelSelect state={state} value={modelId} onChange={setModelId} />
      <label><span>输入文本</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
      <button className="primary-button" disabled={testing || !prompt.trim()}>{testing ? <Loader2 className="spin" size={16} /> : <Play size={16} />}{testing ? "测试中" : "发送测试"}</button>
      {result && <OutputItem title="模型回复" status="done"><p>{result}</p></OutputItem>}
    </form>
  );
}

function ModelTypeTestPanel({ type, models, state, action }: { type: Exclude<ModelTypeKey, "llm">; models: ModelRecord[]; state: State; action: AppAction }) {
  const defaultModelId = defaultModelIdForType(state, type);
  if (type === "asr") return <AsrTypeTestPanel state={state} models={models} defaultModelId={defaultModelId} action={action} />;
  if (type === "tts") return <TtsTypeTestPanel state={state} models={models} defaultModelId={defaultModelId} voices={state.voices} action={action} />;
  return <AvatarTypeTestPanel models={models} defaultModelId={defaultModelId} assets={state.avatarAssets} action={action} />;
}

function AsrTypeTestPanel({ state, models, defaultModelId, action }: { state: State; models: ModelRecord[]; defaultModelId: string; action: AppAction }) {
  const [modelId, setModelId] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    setModelId((current) => current || defaultModelId || models[0]?.id || "");
  }, [defaultModelId, models]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!audio) return;
    setTesting(true);
    try {
      const body = new FormData();
      body.append("modelId", modelId);
      body.append("audio", audio);
      const response = await action("测试 ASR", () => request<{ text: string }>("/api/model-tests/asr", { method: "POST", body }));
      if (response?.text) setText(response.text);
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="model-test-panel" onSubmit={submit}>
      <div><p className="eyebrow">Test</p><h3>ASR 测试</h3></div>
      <TypedModelSelect state={state} type="asr" models={models} value={modelId} onChange={setModelId} />
      <div className="test-file-row">
        <label className="file-chip"><Upload size={16} />{audio ? audio.name : "上传音频"}<input type="file" accept="audio/*" onChange={(event) => setAudio(event.target.files?.[0] || null)} /></label>
        <AudioRecorder onRecorded={setAudio} />
      </div>
      <button className="primary-button" disabled={testing || !audio || !modelId}>{testing ? <Loader2 className="spin" size={16} /> : <Play size={16} />}{testing ? "转写中" : "开始转写"}</button>
      {text && <OutputItem title="转写结果" status="done"><p>{text}</p></OutputItem>}
    </form>
  );
}

function TtsTypeTestPanel({ state, models, defaultModelId, voices, action }: { state: State; models: ModelRecord[]; defaultModelId: string; voices: Asset[]; action: AppAction }) {
  const [modelId, setModelId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [cloudVoice, setCloudVoice] = useState("alloy");
  const [referenceAudio, setReferenceAudio] = useState<File | null>(null);
  const [text, setText] = useState("这是一次音色克隆测试，请生成自然清晰的中文口播。");
  const [audioUri, setAudioUri] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    setModelId((current) => current || defaultModelId || models[0]?.id || "");
    setVoiceId((current) => current || voices[0]?.id || "");
  }, [defaultModelId, models, voices]);
  const selectedIsCloud = modelId.startsWith("provider:");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTesting(true);
    try {
      const body = new FormData();
      body.append("modelId", modelId);
      body.append("text", text);
      if (selectedIsCloud) body.append("cloudVoice", cloudVoice || "alloy");
      if (voiceId) body.append("voiceId", voiceId);
      if (referenceAudio) body.append("referenceAudio", referenceAudio);
      const response = await action("测试 TTS", () => request<{ audio?: { uri: string } }>("/api/model-tests/tts", { method: "POST", body }));
      if (response?.audio?.uri) setAudioUri(response.audio.uri);
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="model-test-panel" onSubmit={submit}>
      <div><p className="eyebrow">Test</p><h3>TTS 测试</h3></div>
      <TypedModelSelect state={state} type="tts" models={models} value={modelId} onChange={setModelId} />
      {selectedIsCloud ? (
        <label><span>云端音色 ID</span><input value={cloudVoice} onChange={(event) => setCloudVoice(event.target.value)} placeholder="例如 alloy / verse / 自定义 voice id" /></label>
      ) : (
        <>
          <label><span>参考音色</span><select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">使用上传/录制音频</option>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
          <div className="test-file-row">
            <label className="file-chip"><Upload size={16} />{referenceAudio ? referenceAudio.name : "上传参考音频"}<input type="file" accept="audio/*" onChange={(event) => setReferenceAudio(event.target.files?.[0] || null)} /></label>
            <AudioRecorder label="录制参考音频" onRecorded={setReferenceAudio} />
          </div>
        </>
      )}
      <label><span>合成文本</span><textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
      <button className="primary-button" disabled={testing || !text.trim() || !modelId || (!selectedIsCloud && !voiceId && !referenceAudio)}>{testing ? <Loader2 className="spin" size={16} /> : <Play size={16} />}{testing ? "生成中" : "生成试听"}</button>
      {audioUri && <OutputItem title="试听音频" status="done"><audio controls src={audioUri} /></OutputItem>}
    </form>
  );
}

function AvatarTypeTestPanel({ models, defaultModelId, assets, action }: { models: ModelRecord[]; defaultModelId: string; assets: Asset[]; action: AppAction }) {
  const [modelId, setModelId] = useState("");
  const [avatarAssetId, setAvatarAssetId] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [settings, setSettings] = useState<VideoSettings>(defaultVideoSettings);
  const [videoUri, setVideoUri] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    setModelId((current) => current || defaultModelId || models[0]?.id || "");
    setAvatarAssetId((current) => current || assets[0]?.id || "");
  }, [defaultModelId, models, assets]);
  const selectedModel = models.find((model) => model.id === modelId);
  const isLatentSync = (selectedModel?.catalogId || selectedModel?.id || "").toLowerCase().includes("latent");

  function updateSetting<K extends keyof VideoSettings>(key: K, value: VideoSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTesting(true);
    try {
      const body = new FormData();
      body.append("modelId", modelId);
      body.append("avatarAssetId", avatarFile ? "" : avatarAssetId);
      body.append("videoSettings", JSON.stringify(settings));
      if (avatarFile) body.append("avatar", avatarFile);
      if (audio) body.append("audio", audio);
      const response = await action("测试数字人模型", () => request<{ video?: { uri: string } }>("/api/model-tests/avatar", { method: "POST", body }));
      if (response?.video?.uri) setVideoUri(response.video.uri);
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="model-test-panel" onSubmit={submit}>
      <div><p className="eyebrow">Test</p><h3>数字人模型测试</h3></div>
      <label><span>模型</span><select value={modelId} onChange={(event) => setModelId(event.target.value)}>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
      <label><span>数字人素材</span><select value={avatarAssetId} onChange={(event) => setAvatarAssetId(event.target.value)}><option value="">使用上传素材</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
      <div className="test-file-row">
        <label className="file-chip"><Upload size={16} />{avatarFile ? avatarFile.name : "上传人物视频"}<input type="file" accept="video/*" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} /></label>
        <label className="file-chip"><Upload size={16} />{audio ? audio.name : "上传驱动音频"}<input type="file" accept="audio/*" onChange={(event) => setAudio(event.target.files?.[0] || null)} /></label>
        <AudioRecorder label="录制驱动音频" onRecorded={setAudio} />
      </div>
      <div className="param-grid model-test-params">
        {!isLatentSync && (
          <>
            <label><span>裁剪模式</span><select value={settings.cropMode} onChange={(event) => updateSetting("cropMode", event.target.value as VideoSettings["cropMode"])}><option value="mediapipe">MediaPipe</option><option value="default">默认框</option></select></label>
            <label><span>解析模式</span><select value={settings.parsingMode} onChange={(event) => updateSetting("parsingMode", event.target.value as VideoSettings["parsingMode"])}><option value="jaw">jaw</option><option value="raw">raw</option></select></label>
          </>
        )}
        <label><span>上边界</span><input type="number" min="0.35" max="0.65" step="0.01" value={settings.upperBoundaryRatio} onChange={(event) => updateSetting("upperBoundaryRatio", Number(event.target.value))} /></label>
        <label><span>脸部扩展</span><input type="number" min="0.04" max="0.24" step="0.01" value={settings.facePad} onChange={(event) => updateSetting("facePad", Number(event.target.value))} /></label>
        {!isLatentSync && <label><span>下巴扩展</span><input type="number" min="0" max="40" step="1" value={settings.extraMargin} onChange={(event) => updateSetting("extraMargin", Number(event.target.value))} /></label>}
      </div>
      <button className="primary-button" disabled={testing || !modelId || (!avatarAssetId && !avatarFile) || !audio}>{testing ? <Loader2 className="spin" size={16} /> : <Play size={16} />}{testing ? "生成中" : "生成测试视频"}</button>
      {videoUri && <OutputItem title="测试视频" status="done"><video className="test-video" controls src={videoUri} /></OutputItem>}
    </form>
  );
}

function CloudProviderManager({ state, type, providers, selectedValue, action }: { state: State; type: Exclude<ModelTypeKey, "avatar">; providers: ApiProviderRecord[]; selectedValue: string; action: AppAction }) {
  const catalog = state.apiProviderCatalog.filter((provider) => provider.capabilities?.includes(type));
  const initialCatalog = catalog.find((provider) => !provider.id.startsWith("custom")) || catalog[0];
  const [formOpen, setFormOpen] = useState(false);
  const [providerId, setProviderId] = useState(initialCatalog?.id || "");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(initialCatalog?.endpoint || "");
  const [modelChoice, setModelChoice] = useState(initialCatalog?.defaultModel || "__custom");
  const [customModel, setCustomModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const selectedCatalog = catalog.find((provider) => provider.id === providerId) || initialCatalog;
  const modelOptions = selectedCatalog?.models || [];
  const model = modelChoice === "__custom" ? customModel.trim() : modelChoice;

  useEffect(() => {
    if (!providerId && initialCatalog) {
      setProviderId(initialCatalog.id);
      setEndpoint(initialCatalog.endpoint || "");
      setModelChoice(initialCatalog.defaultModel || "__custom");
      setCustomModel("");
    }
  }, [providerId, initialCatalog]);

  function loadCatalog(item: ApiProviderCatalogItem, configured?: ApiProviderRecord) {
    const nextModel = configured?.model || item.defaultModel || "";
    setProviderId(item.id);
    setEndpoint(configured?.endpoint || item.endpoint || "");
    setApiKey("");
    if (item.models?.includes(nextModel)) {
      setModelChoice(nextModel);
      setCustomModel("");
    } else {
      setModelChoice("__custom");
      setCustomModel(nextModel);
    }
    setFormOpen(true);
  }

  function changeProvider(nextProviderId: string) {
    const nextCatalog = catalog.find((provider) => provider.id === nextProviderId);
    if (!nextCatalog) return;
    const configured = providers.find((provider) => provider.providerId === nextCatalog.id);
    loadCatalog(nextCatalog, configured);
  }

  async function configure() {
    setSaving(true);
    try {
      const result = await action("保存云模型", () => request("/api/providers/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, apiKey, endpoint, model })
      }));
      if (result) {
        setFormOpen(false);
        setApiKey("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider(provider: ApiProviderRecord) {
    if (!window.confirm(`删除云模型「${provider.name} · ${provider.model || "未设置模型"}」？`)) return;
    setDeletingId(provider.id);
    try {
      const result = await action("删除云模型", () => request(`/api/providers/${provider.id}`, { method: "DELETE" }));
      if (result && providerId === provider.providerId) {
        setFormOpen(false);
      }
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="model-panel">
      <div className="model-panel-head">
        <div><p className="eyebrow">Cloud</p><h3>云端{modelTypeLabels[type]}模型</h3></div>
        <button className="primary-button" onClick={() => initialCatalog && loadCatalog(initialCatalog)}><Plus size={16} />新增云模型</button>
      </div>

      {formOpen && selectedCatalog && (
        <div className="provider-form">
          <div className="provider-form-grid">
            <label><span>Provider</span><select value={providerId} onChange={(event) => changeProvider(event.target.value)}>
              {catalog.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
            </select></label>
            <label><span>模型 ID</span><select value={modelChoice} onChange={(event) => setModelChoice(event.target.value)}>
              {modelOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              <option value="__custom">自定义模型 ID</option>
            </select></label>
            {modelChoice === "__custom" && <label><span>自定义模型 ID</span><input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="例如 qwen-plus / deepseek-chat" /></label>}
            <label><span>Endpoint</span><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://.../v1/chat/completions" /></label>
            <label><span>API Key</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={selectedCatalog.envKey} /></label>
          </div>
          <div className="provider-form-actions">
            <button className="ghost-button" onClick={() => setFormOpen(false)}><X size={15} />取消</button>
            <button className="primary-button" disabled={saving || !endpoint.trim() || !model} onClick={configure}>{saving ? <Loader2 className="spin" size={15} /> : <Save size={15} />}{saving ? "保存中" : "保存"}</button>
          </div>
        </div>
      )}

      <div className="inventory-list compact">
        {providers.map((provider) => {
          const selected = providerTextModelValue(provider) === selectedValue;
          const catalogItem = catalog.find((item) => item.id === provider.providerId);
          return (
            <article className="inventory-row model-choice-row" key={provider.id}>
              <div>
                <strong>{provider.name}</strong>
                <small>{provider.model || "未设置模型 ID"}</small>
              </div>
              <div className="provider-actions">
                <StatusBadge status={provider.status} />
                {selected && <span className="default-pill">默认</span>}
                <button className="ghost-button" onClick={() => catalogItem && loadCatalog(catalogItem, provider)}><Pencil size={15} />编辑</button>
                <button className="ghost-button" disabled={selected || !provider.hasKey} onClick={() => action(`选择云端${modelTypeLabels[type]}模型`, () => request(`/api/providers/${provider.id}/select`, { method: "POST" }))}>设为默认</button>
                <button className="ghost-button danger" disabled={deletingId === provider.id} onClick={() => deleteProvider(provider)}>{deletingId === provider.id ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}删除</button>
              </div>
            </article>
          );
        })}
        {providers.length === 0 && <EmptyState text={`还没有云端${modelTypeLabels[type]}模型。点击“新增云模型”配置 Provider。`} />}
      </div>
    </section>
  );
}

function PublishHistory({ records, projects, action }: { records: PublishRecord[]; projects: Project[]; action: AppAction }) {
  function markPublished(record: PublishRecord) {
    const workUrl = window.prompt("粘贴已发布作品地址；如果没有，可以留空使用平台作品列表。", record.workUrl || "");
    if (workUrl === null) return;
    action("记录作品地址", () =>
      request(`/api/publish-records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published", workUrl })
      })
    );
  }

  function deleteRecord(record: PublishRecord) {
    if (!window.confirm(`删除 ${record.platformLabel} 的发布记录？`)) return;
    action("删除发布记录", () => request(`/api/publish-records/${record.id}`, { method: "DELETE" }));
  }

  return (
    <section className="manager-page">
      <div className="manager-toolbar"><div><p className="eyebrow">发布记录</p><h2>平台发布历史</h2></div><span className="count-pill">{records.length}</span></div>
      <DataTable
        columns={["任务", "平台", "状态", "时间", "入口"]}
        rows={records.map((record) => [
          projects.find((item) => item.id === record.projectId)?.title || record.projectTitle,
          record.platformLabel,
          record.status,
          record.publishedAt ? formatDate(record.publishedAt) : formatDate(record.createdAt),
          <span className="table-actions"><a className="table-link" href={record.workUrl || record.publishUrl} target="_blank" rel="noreferrer">打开</a><button className="text-button" onClick={() => markPublished(record)}>记录地址</button><button className="text-button danger-text" onClick={() => deleteRecord(record)}>删除</button></span>
        ])}
      />
      {records.length === 0 && <EmptyState text="还没有发布记录。任务详情里点击平台发布后会生成记录。" />}
    </section>
  );
}

function DataTable({ columns, rows, template }: { columns: string[]; rows: Array<Array<React.ReactNode>>; template?: string }) {
  const gridTemplateColumns = template || `repeat(${columns.length}, minmax(0, 1fr))`;
  return (
    <div className="data-table">
      <div className="data-head" style={{ gridTemplateColumns }}>{columns.map((column, index) => <span key={`${column}-${index}`}>{column}</span>)}</div>
      {rows.map((row, index) => <div className="data-row" key={index} style={{ gridTemplateColumns }}>{row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}</div>)}
      {rows.length === 0 && <EmptyState text="暂无数据。" />}
    </div>
  );
}

function ActionButton({ label, busy, onClick, danger, disabled }: { label: string; busy: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  const Icon = danger
    ? Trash2
    : label.includes("口播")
      ? Mic2
      : label.includes("视频")
        ? Video
        : label.includes("确认")
          ? CheckCircle2
          : label.includes("自动")
            ? Play
            : Settings2;
  return <button className={cx("secondary-button", danger && "danger")} onClick={onClick} disabled={Boolean(busy) || disabled}>{busy === label ? <Loader2 className="spin" size={16} /> : <Icon size={16} />}{label}</button>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={cx(
    "status-badge",
    ["done", "ready", "video_ready", "configured", "installed", "passed", "completed", "ok"].some((item) => status.includes(item)) && "ready",
    (status.includes("running") || status.includes("queued")) && "running",
    (status.includes("failed") || status.includes("blocked")) && "failed",
    status.includes("warning") && "warning",
    status.includes("pending") || status.includes("not") ? "muted" : undefined
  )}>{statusText(status)}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}
