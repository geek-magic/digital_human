import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Copy,
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
  Scissors,
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

type StageState = Record<StageKey, { label: string; status: string; message?: string; queuedAt?: string; startedAt?: string; finishedAt?: string; durationMs?: number; updatedAt?: string }>;

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
  engine: "musetalk";
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
    links: Array<{ id: string; url: string; platform: string; status: string; title?: string; message?: string; videoUri?: string; audioUri?: string; videoPath?: string; audioPath?: string }>;
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

type SourceExtractionStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  outputText?: string;
  outputJson?: Record<string, string | number | boolean | null> | null;
  url?: string;
  mediaUri?: string;
  mediaType?: string;
  message?: string;
  updatedAt?: string;
};

type SourceExtractResponse = {
  extractionId?: string;
  id?: string;
  inputText?: string;
  extractedText?: string;
  transcriptText?: string;
  title?: string;
  sourceUrl?: string;
  mediaUri?: string;
  detectedType?: "text" | "video_asr" | "link_metadata" | "link";
  kind?: "text" | "video_asr" | "link_metadata" | "link";
  status?: string;
  error?: string;
  steps?: SourceExtractionStep[];
  notes?: string[];
  sourceAnalysis?: Project["sourceAnalysis"];
};

type ProgressState = {
  percent: number;
  label: string;
  stage?: StageKey;
  status?: string;
  queueId?: string;
  resultVersionId?: string;
  resultVersionLabel?: string;
  artifactUri?: string;
  artifactType?: string;
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
  videoPath?: string;
  videoVersionLabel?: string;
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
const visibleStageOrder: StageKey[] = ["script", "voice", "video", "publish"];
const platformLabels: Record<Platform, string> = { douyin: "抖音", xiaohongshu: "小红书", wechat: "公众号" };
const stageCopy: Record<StageKey, { title: string; description: string }> = {
  input: { title: "输入", description: "确认原始文本和生成要求。" },
  script: { title: "生成口播文案", description: "基于输入生成或保存口播文案版本。" },
  voice: { title: "生成口播音频", description: "选择文案版本和音色，生成可试听音频版本。" },
  video: { title: "视频合成", description: "选择音频版本和数字人素材，生成可用的视频版本。" },
  publish: { title: "发布", description: "选择视频版本和渠道，打开平台发布入口并复制素材。" }
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
const requirementTemplates = [
  {
    id: "douyin-knowledge",
    label: "抖音知识口播",
    value: "生成一条抖音知识分享口播，开头要有强钩子，语言直接、有节奏，控制在30-45秒，结尾引导评论或收藏。"
  },
  {
    id: "xiaohongshu-planting",
    label: "小红书种草",
    value: "生成一条小红书种草风格口播，语气真实、有体验感，先讲痛点再讲解决方案，避免硬广，结尾给出适用人群。"
  },
  {
    id: "product-intro",
    label: "产品介绍",
    value: "生成一条产品介绍口播，突出核心卖点、适用场景和具体收益，表达克制可信，不夸张承诺，控制在45秒以内。"
  },
  {
    id: "course-lead",
    label: "课程引流",
    value: "生成一条课程引流口播，先指出目标用户常见误区，再给出方法框架，最后自然引导用户了解课程或私信咨询。"
  },
  {
    id: "local-life",
    label: "本地生活",
    value: "生成一条本地生活口播，突出地点、体验、价格或服务亮点，语气像真实探店推荐，结尾提示适合什么人去。"
  }
] as const;
const videoSettingTips: Record<keyof VideoSettings, string> = {
  engine: "MuseTalk 用于当前本地口型生成；失败时会直接标记失败，不生成无效占位视频。",
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

function isSubmittedResponse(value: unknown): value is { submitted: true; queueItem: QueueItem } {
  return Boolean(value && typeof value === "object" && "submitted" in value && (value as { submitted?: unknown }).submitted === true);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function compactDisplay(value = "", max = 24) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function formatDurationMs(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "未开始";
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}小时${minutes}分`;
  if (minutes) return `${minutes}分${seconds.toString().padStart(2, "0")}秒`;
  return `${seconds}秒`;
}

function stageDurationMs(stage?: StageState[StageKey]) {
  if (!stage) return undefined;
  if (typeof stage.durationMs === "number") return stage.durationMs;
  if (stageRunning(stage.status) && stage.startedAt) return Date.now() - new Date(stage.startedAt).getTime();
  if (stage.startedAt && stage.finishedAt) return new Date(stage.finishedAt).getTime() - new Date(stage.startedAt).getTime();
  return undefined;
}

function taskDurationMs(project: Project) {
  const stageTotal = stageOrder.reduce((sum, stage) => sum + (stageDurationMs(project.stageState?.[stage]) || 0), 0);
  if (stageTotal > 0) return stageTotal;
  const active = ["queued", "running"].includes(project.status) || Object.values(project.stageState || {}).some((stage) => stageRunning(stage.status));
  const end = active ? new Date().toISOString() : project.updatedAt;
  return Math.max(0, new Date(end).getTime() - new Date(project.createdAt).getTime());
}

function stageDone(status = "") {
  return ["done", "ready", "video_ready", "completed"].some((item) => status.includes(item));
}

function stageRunning(status = "") {
  return status === "queued" || status === "running" || status.includes("running");
}

function canEnterStage(project: Project, stage: StageKey) {
  if (stage === "input") return true;
  if (stage === "script") return Boolean(project.inputText?.trim());
  if (stage === "voice") return Boolean(project.scriptVersions?.length || project.artifacts.script);
  if (stage === "video") return Boolean(project.audioVersions?.length || project.artifacts.audio);
  if (stage === "publish") return Boolean((project.videoVersions || project.versions || []).length || project.artifacts.video);
  return false;
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

function getVisibleStage(project: Project): StageKey {
  const current = getCurrentStage(project);
  return current === "input" ? "script" : current;
}

function getNextAction(project: Project, videoSettings: VideoSettings): FlowAction | undefined {
  const current = getCurrentStage(project);
  if (current === "input") return stageActionMap.script;
  if (stageRunning(project.stageState?.[current]?.status)) return undefined;
  if (current === "video") return { label: "生成视频", path: "render-video", body: { videoSettings } };
  return stageActionMap[current];
}

function progressValue(project: Project) {
  if (typeof project.progress?.percent === "number" && ["queued", "running", "failed"].includes(project.progress.status || "")) {
    return project.progress.percent;
  }
  const done = visibleStageOrder.filter((stage) => stageDone(project.stageState?.[stage]?.status || "")).length;
  return Math.round((done / visibleStageOrder.length) * 100);
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
    ready_for_manual_publish: "待手动确认",
    publish_payload_ready: "发布素材已准备",
    published: "已发布",
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
  const [, setClock] = useState(Date.now());

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
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
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
      showToast(isQueuedResponse(result)
        ? `${label}已提交队列`
        : isSubmittedResponse(result)
          ? `${label}已开始执行`
          : `${label}已完成`, "success");
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
  const [draftInputText, setDraftInputText] = useState("");
  const [activeTab, setActiveTab] = useState<"extract" | "create">("create");
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
      return request("/api/projects/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
    });
    if (ids.includes(props.selectedProjectId)) props.setSelectedProjectId("");
    setCheckedIds([]);
  }

  return (
    <div className="task-layout">
      <section className="task-main">
        <div className="task-tabs" role="tablist" aria-label="任务工作区">
          <button type="button" className={cx(activeTab === "extract" && "active")} role="tab" aria-selected={activeTab === "extract"} onClick={() => setActiveTab("extract")}>
            链接解析
          </button>
          <button type="button" className={cx(activeTab === "create" && "active")} role="tab" aria-selected={activeTab === "create"} onClick={() => setActiveTab("create")}>
            创建任务
          </button>
        </div>
        {activeTab === "extract" ? (
          <div className="task-tab-panel extract-tab" role="tabpanel">
            <SourceExtractionTool action={props.action} />
          </div>
        ) : (
          <div className="task-tab-panel create-tab" role="tabpanel">
            <TaskComposer
              state={props.state}
              action={props.action}
              onCreated={props.setSelectedProjectId}
              inputText={draftInputText}
              setInputText={setDraftInputText}
              busy={props.busy}
            />
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
                        <small>{formatDate(project.createdAt)} · 总耗时 {formatDurationMs(taskDurationMs(project))} · 当前：{project.stageState?.[getCurrentStage(project)]?.label || getCurrentStage(project)} · {statusText(project.stageState?.[getCurrentStage(project)]?.status || project.status)}</small>
                      </div>
                      <StageDots project={project} />
                    </button>
                    <button className="task-delete" onClick={deleteProject} aria-label={`删除任务 ${project.title}`}><Trash2 size={15} /></button>
                  </article>
                );
              })}
              {props.state.projects.length === 0 && <EmptyState text="还没有任务。输入需求后可以直接开始生成。" />}
            </div>
          </div>
        )}
      </section>
      <TaskDetail project={props.selectedProject} state={props.state} busy={props.busy} action={props.action} />
    </div>
  );
}

function extractionStepsFor(status: "idle" | "running" | "done" | "failed") {
  const labels = [
    ["link", "提取链接"],
    ["type", "识别类型"],
    ["extract", "提取/下载"],
    ["asr", "ASR 转写"],
    ["result", "解析结果"]
  ] as const;
  if (status === "idle") return labels.map(([id, label]) => ({ id, label, status: "pending" as const }));
  if (status === "done") return labels.map(([id, label]) => ({ id, label, status: "done" as const }));
  if (status === "failed") return labels.map(([id, label], index) => ({ id, label, status: index < 2 ? "done" as const : index === 2 ? "failed" as const : "pending" as const }));
  return labels.map(([id, label], index) => ({ id, label, status: index < 2 ? "done" as const : index === 2 ? "running" as const : "pending" as const }));
}

function SourceExtractionTool({
  action
}: {
  action: AppAction;
}) {
  const [sourceText, setSourceText] = useState("");
  const [result, setResult] = useState<SourceExtractResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [expanded, setExpanded] = useState(true);
  const [mediaName, setMediaName] = useState("");
  const extractedText = result?.extractedText || result?.inputText || "";
  const extractionId = result?.extractionId || result?.id || "";
  const mediaLinks = result?.sourceAnalysis?.links?.filter((link) => link.videoUri || link.audioUri) || [];
  const steps = result?.steps?.length
    ? result.steps.map((step) => ({ id: step.key, label: step.label, status: step.status }))
    : extractionStepsFor(status);

  useEffect(() => {
    if (!result || mediaName.trim()) return;
    const firstTitle = result.title || result.sourceAnalysis?.links?.find((link) => link.title)?.title || "";
    if (firstTitle) setMediaName(compactDisplay(firstTitle, 18));
  }, [result, mediaName]);

  async function waitForExtraction(id: string) {
    let latest: SourceExtractResponse | null = null;
    for (let attempt = 0; attempt < 1800; attempt += 1) {
      const response = await request<SourceExtractResponse>(`/api/source-extractions/${id}`);
      latest = response;
      setResult(response);
      const nextStatus = response.status === "failed" ? "failed" : response.status === "done" ? "done" : "running";
      setStatus(nextStatus);
      if (response.status === "done") return response;
      if (response.status === "failed") throw new Error(response.error || response.notes?.[0] || "链接解析失败。");
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    throw new Error("链接解析仍在运行，请稍后查看结果或重试。");
  }

  async function extract() {
    const source = sourceText.trim();
    if (!source) return;
    setExpanded(true);
    setStatus("running");
    setResult(null);
    const response = await action("解析链接", async () => {
      const started = await request<SourceExtractResponse>("/api/source-extractions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: source })
      });
      setResult(started);
      const id = started.extractionId || started.id || "";
      if (!id) throw new Error("后端未返回解析任务 ID。");
      return waitForExtraction(id);
    });
    if (!response?.extractedText && !response?.inputText && response?.status !== "done") {
      setStatus("failed");
    }
  }

  async function copyExtractedText() {
    if (!extractedText.trim()) return;
    await action("复制解析文本", async () => {
      await copyTextToClipboard(extractedText.trim());
      return { ok: true };
    });
  }

  async function saveExtractionMedia(kind: "avatar" | "voice", linkId = "") {
    if (!extractionId) return;
    const fallbackName = result?.title || result?.sourceAnalysis?.links?.find((link) => link.title)?.title || "链接解析媒体";
    const name = (mediaName || compactDisplay(fallbackName, 18)).trim();
    await action(kind === "avatar" ? "保存为素材" : "保存为音色", () => request(kind === "avatar"
      ? `/api/source-extractions/${extractionId}/save-avatar`
      : `/api/source-extractions/${extractionId}/save-voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, linkId })
    }));
  }

  return (
    <section className={cx("source-tool", !expanded && "collapsed")}>
      <div className="section-head">
        <div><p className="eyebrow">链接解析</p><h2>独立解析工具</h2></div>
        <div className="source-head-actions">
          <StatusBadge status={status === "done" ? "done" : status === "failed" ? "failed" : status === "running" ? "running" : "pending"} />
          <button
            type="button"
            className="ghost-button source-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown className={cx(expanded && "rotate-180")} size={16} />
            {expanded ? "折叠" : "展开"}
          </button>
        </div>
      </div>
      {expanded && (
        <>
          <div className="extract-control">
            <textarea
              aria-label="链接解析输入"
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="粘贴抖音分享文本、视频链接或普通文本"
            />
            <button type="button" className="secondary-button" disabled={status === "running" || !sourceText.trim()} onClick={extract}>
              {status === "running" ? <Loader2 className="spin" size={16} /> : <Download size={16} />}提取
            </button>
          </div>
          <ExtractProgress steps={steps} />
          <SourceExtractionTimeline
            result={result}
            fallbackSteps={extractionStepsFor(status)}
            extractedText={extractedText}
            canApply={Boolean(extractedText && result?.status === "done")}
            onApply={copyExtractedText}
          />
          {result?.status === "done" && mediaLinks.length > 0 && (
            <div className="source-save-panel">
              <div>
                <strong>保存解析媒体</strong>
                <small>视频可保存到素材库，音频可保存到音色库。</small>
              </div>
              <label><span>名称</span><input value={mediaName} onChange={(event) => setMediaName(event.target.value)} placeholder="素材或音色名称" /></label>
              <div className="source-save-actions">
                {mediaLinks.map((link) => (
                  <div key={link.id} className="source-save-row">
                    <span>{compactDisplay(link.title || link.url, 28)}</span>
                    {link.videoUri && <button type="button" className="ghost-button" onClick={() => saveExtractionMedia("avatar", link.id)}><Video size={15} />保存为素材</button>}
                    {link.audioUri && <button type="button" className="ghost-button" onClick={() => saveExtractionMedia("voice", link.id)}><Mic2 size={15} />保存为音色</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {!expanded && (
        <button
          type="button"
          className="source-collapsed-summary"
          onClick={() => setExpanded(true)}
          aria-label="展开链接解析"
        >
          <span>{result?.extractedText ? "已有解析结果，可展开查看。" : "粘贴抖音、小红书或网页链接，提取文本后复制最终文本。"}</span>
          <ChevronDown size={16} />
        </button>
      )}
    </section>
  );
}

function SourceExtractionTimeline({
  result,
  fallbackSteps,
  extractedText,
  canApply,
  onApply
}: {
  result: SourceExtractResponse | null;
  fallbackSteps: Array<{ id: string; label: string; status: "pending" | "running" | "done" | "failed" }>;
  extractedText: string;
  canApply: boolean;
  onApply: () => void;
}) {
  const resultSteps = result?.steps?.length
    ? result.steps
    : fallbackSteps.map((step) => ({ key: step.id, label: step.label, status: step.status }));
  return (
    <div className="source-step-list" aria-label="链接解析产物">
      {resultSteps.map((step, index) => (
        <SourceStepCard
          key={step.key || index}
          step={step}
          isFinal={step.key === "result"}
          finalText={extractedText}
          canApply={canApply}
          onApply={onApply}
        />
      ))}
    </div>
  );
}

function SourceStepCard({
  step,
  isFinal,
  finalText,
  canApply,
  onApply
}: {
  step: SourceExtractionStep;
  isFinal: boolean;
  finalText: string;
  canApply: boolean;
  onApply: () => void;
}) {
  const text = isFinal ? (finalText || step.outputText || "") : (step.outputText || "");
  const hasMedia = Boolean(step.mediaUri);
  return (
    <article className={cx("source-step-card", step.status)}>
      <div className="source-step-head">
        <span className="source-step-index">{step.status === "running" ? <Loader2 className="spin" size={14} /> : step.status === "failed" ? <XCircle size={14} /> : step.status === "done" ? <CheckCircle2 size={14} /> : "•"}</span>
        <div>
          <strong>{step.label}</strong>
          <small>{step.message || statusText(step.status)}</small>
        </div>
      </div>
      {step.url && <a className="source-url" href={step.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />{step.url}</a>}
      {hasMedia && (
        step.mediaType === "video"
          ? <video className="source-media" controls src={step.mediaUri} />
          : <audio className="source-audio" controls src={step.mediaUri} />
      )}
      {text && <pre className="source-output">{text}</pre>}
      {step.outputJson && Object.keys(step.outputJson).length > 0 && (
        <div className="source-kv">
          {Object.entries(step.outputJson).map(([key, value]) => (
            value === "" || value === null || value === undefined ? null : <span key={key}><b>{key}</b>{String(value)}</span>
          ))}
        </div>
      )}
      {isFinal && (
        <div className="source-final-actions">
          <button className="primary-button" disabled={!canApply} onClick={onApply}><Copy size={16} />复制</button>
          {!canApply && <small>{finalText ? "可复制最终文本。" : "最终文本生成后可复制。"}</small>}
        </div>
      )}
    </article>
  );
}

function TaskComposer({
  state,
  action,
  onCreated,
  inputText,
  setInputText,
  busy
}: {
  state: State;
  action: AppAction;
  onCreated: (id: string) => void;
  inputText: string;
  setInputText: (value: string) => void;
  busy: string;
}) {
  const [title, setTitle] = useState("");
  const [requirements, setRequirements] = useState("");
  const [mode, setMode] = useState<WorkMode>("manual");
  const [scriptModelId, setScriptModelId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [avatarAssetId, setAvatarAssetId] = useState("");
  useEffect(() => {
    setScriptModelId((current) => current || state.settings?.defaultTextModelId || state.models.find((model) => model.type === "llm")?.id || "");
  }, [state.settings?.defaultTextModelId, state.models]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    let createdProjectId = "";
    const actionLabel = mode === "auto" ? "创建任务并提交自动流程" : "创建任务";
    await action(actionLabel, async () => {
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
  const submitLabel = mode === "auto" ? "创建并自动生成" : "创建手动任务";
  const submitting = busy === "创建任务" || busy === "创建任务并提交自动流程";
  const applyRequirementTemplate = (templateId: string) => {
    const template = requirementTemplates.find((item) => item.id === templateId);
    if (template) setRequirements(template.value);
  };

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
          <span>输入内容</span>
          <textarea required value={inputText} onChange={(event) => setInputText(event.target.value)} placeholder="输入主题、需求、参考信息" />
        </label>
        <div className={cx("composer-grid", mode === "manual" && "compact")}>
          <label><span>生成要求模板</span><select value="" onChange={(event) => applyRequirementTemplate(event.target.value)}><option value="">选择模板</option>{requirementTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
          <label><span>生成要求</span><input value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="语气、时长、平台风格、受众" /></label>
          <TextModelSelect state={state} value={scriptModelId} onChange={setScriptModelId} />
          {mode === "auto" && (
            <>
              <label><span>音色</span><select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">默认音色</option>{state.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
              <label><span>数字人素材</span><select value={avatarAssetId} onChange={(event) => setAvatarAssetId(event.target.value)}><option value="">请选择数字人素材</option>{state.avatarAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
            </>
          )}
        </div>
        <div className="toolbar-row">
          <button className="primary-button" disabled={submitting || !inputText.trim()}>
            {submitting ? <Loader2 className="spin" size={17} /> : <Play size={17} />}
            {submitting ? "创建中" : submitLabel}
          </button>
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

function ExtractProgress({ steps }: { steps: Array<{ id: string; label: string; status: "pending" | "running" | "done" | "failed" | "skipped" }> }) {
  return (
    <div className="extract-progress" aria-label="提取进度">
      {steps.map((step) => (
        <span key={step.id} className={cx("extract-step", step.status)}>
          {step.status === "running" && <Loader2 className="spin" size={13} />}
          {step.status === "done" && <CheckCircle2 size={13} />}
          {step.status === "failed" && <XCircle size={13} />}
          {(step.status === "pending" || step.status === "skipped") && <span className="pending-dot" />}
          {step.label}
        </span>
      ))}
    </div>
  );
}

type AppAction = <T>(label: string, runner: () => Promise<T>) => Promise<T | undefined>;

function TaskDetail({ project, state, busy, action }: { project?: Project; state: State; busy: string; action: AppAction }) {
  const [inputText, setInputText] = useState("");
  const [requirements, setRequirements] = useState("");
  const [scriptModelId, setScriptModelId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [avatarAssetId, setAvatarAssetId] = useState("");
  const [videoSettings, setVideoSettings] = useState<VideoSettings>(defaultVideoSettings);
  const currentStage = project ? getVisibleStage(project) : "script";
  const [activeStage, setActiveStage] = useState<StageKey>(currentStage);
  const [selectedScriptVersionId, setSelectedScriptVersionId] = useState("");
  const [selectedAudioVersionId, setSelectedAudioVersionId] = useState("");
  const [selectedVideoVersionId, setSelectedVideoVersionId] = useState("");
  const [publishDraft, setPublishDraft] = useState<PublishRecord | null>(null);
  const lastAutoStageRef = useRef<StageKey>(currentStage);
  const currentVersionId = (project?.videoVersions || project?.versions || []).find((version) => version.isCurrent)?.id || "";

  useEffect(() => {
    setInputText(project?.inputText || "");
    setRequirements(project?.requirements || "");
    setScriptModelId(project?.scriptModelId || state.settings?.defaultTextModelId || state.models.find((model) => model.type === "llm")?.id || "");
    setVoiceId(project?.voiceId || "");
    setAvatarAssetId(project?.avatarAssetId || "");
  }, [project?.id, project?.scriptModelId, project?.voiceId, project?.avatarAssetId, project?.inputText, project?.requirements, state.settings?.defaultTextModelId, state.models]);

  useEffect(() => {
    setActiveStage(currentStage);
    lastAutoStageRef.current = currentStage;
    setSelectedScriptVersionId(project?.selectedScriptVersionId || project?.scriptVersions?.[0]?.id || "");
    setSelectedAudioVersionId(project?.selectedAudioVersionId || project?.audioVersions?.[0]?.id || "");
    setSelectedVideoVersionId(project?.selectedVideoVersionId || (project?.videoVersions || project?.versions || [])[0]?.id || "");
    setPublishDraft(null);
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

  const saveInputConfig = (changedStage: StageKey = "script") =>
    request<Project>(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputText, requirements, scriptModelId, changedStage })
    });

  const generateScript = () =>
    action("生成口播文案", async () => {
      await saveInputConfig("script");
      return request(`/api/projects/${project.id}/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptModelId, inputText, requirements })
      });
    });

  const saveScript = () =>
    action("保存口播文案", () => request<Project>(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: inputText, inputText, requirements, voiceId, scriptModelId, changedStage: "script" })
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
        body: JSON.stringify({ scriptVersionId: selectedScriptVersionId, voiceId })
      });
    });

  const importAudioVersion = (file?: File) =>
    action(file ? "保存音频版本" : "保存原始音频", async () => {
      const body = new FormData();
      if (file) body.append("audio", file);
      if (selectedScriptVersionId) body.append("scriptVersionId", selectedScriptVersionId);
      return request(`/api/projects/${project.id}/audio-versions/import`, {
        method: "POST",
        body
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
        body: JSON.stringify({ videoSettings, audioVersionId: selectedAudioVersionId, avatarAssetId })
      });
    });

  const generateVideoPreview = () =>
    action("生成3秒预览", async () => {
      await request<Project>(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarAssetId, selectedAudioVersionId, videoSettings, changedStage: "video" })
      });
      return request(`/api/projects/${project.id}/render-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoSettings, audioVersionId: selectedAudioVersionId, avatarAssetId })
      });
    });

  async function preparePublish(platform: Platform) {
    const payload = await action("打开发布入口", () => request<PublishRecord>(`/api/projects/${currentProject.id}/publish/${platform}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoVersionId: selectedVideoVersionId })
    }));
    if (payload) {
      setPublishDraft(payload);
      await navigator.clipboard.writeText(`标题：${payload.title}\n\n正文：\n${payload.body}\n\n视频：${window.location.origin}${payload.videoUri}`);
      window.open(payload.publishUrl, "_blank");
    }
  }

  async function recordPublished(platform: Platform) {
    const workUrl = window.prompt(`粘贴${platformLabels[platform]}已发布作品地址。没有地址就先不要记录。`, "");
    if (!workUrl?.trim()) return;
    await action("记录发布结果", () => request(`/api/projects/${currentProject.id}/publish-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channels: [platform],
        videoVersionId: selectedVideoVersionId,
        status: "published",
        workUrl: workUrl.trim()
      })
    }));
  }

  const activeQueue = state.queueItems.find((item) => item.projectId === project.id && isActiveQueue(item));
  const latestQueue = activeQueue || state.queueItems.find((item) => item.projectId === project.id);
  const taskBusy = Boolean(activeQueue);
  const selectedVoice = state.voices.find((voice) => voice.id === voiceId);
  const selectedAsset = state.avatarAssets.find((asset) => asset.id === avatarAssetId);
  const goNextStage = () => {
    const nextStage = visibleStageOrder[visibleStageOrder.indexOf(activeStage) + 1];
    if (nextStage && canEnterStage(project, nextStage)) setActiveStage(nextStage);
  };

  return (
    <aside className="task-detail">
      <div className="detail-title">
        <div>
          <p className="eyebrow">当前任务 · {project.mode === "auto" ? "全自动模式" : "手动模式"}</p>
          <h2>{project.title}</h2>
          <small>{formatDate(project.createdAt)} · 总耗时 {formatDurationMs(taskDurationMs(project))}</small>
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
        inputText={inputText}
        setInputText={setInputText}
        requirements={requirements}
        setRequirements={setRequirements}
        saveScript={saveScript}
        generateScript={generateScript}
        scriptModelId={scriptModelId}
        setScriptModelId={setScriptModelId}
        selectedScriptVersionId={selectedScriptVersionId}
        setSelectedScriptVersionId={setSelectedScriptVersionId}
        voiceId={voiceId}
        setVoiceId={setVoiceId}
        selectedVoice={selectedVoice}
        saveVoice={saveVoice}
        generateVoice={generateVoice}
        importAudioVersion={importAudioVersion}
        selectedAudioVersionId={selectedAudioVersionId}
        setSelectedAudioVersionId={setSelectedAudioVersionId}
        avatarAssetId={avatarAssetId}
        setAvatarAssetId={setAvatarAssetId}
        selectedAsset={selectedAsset}
        videoSettings={videoSettings}
        setVideoSettings={setVideoSettings}
        saveVideoSetup={saveVideoSetup}
        generateVideo={generateVideo}
        generateVideoPreview={generateVideoPreview}
        selectedVideoVersionId={selectedVideoVersionId}
        setSelectedVideoVersionId={setSelectedVideoVersionId}
        publishDraft={publishDraft}
        preparePublish={preparePublish}
        recordPublished={recordPublished}
        onGoNext={goNextStage}
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
  return (
    <nav className="step-nav" aria-label="任务步骤">
      {visibleStageOrder.map((stage, index) => {
        const state = project.stageState?.[stage];
        const disabled = !canEnterStage(project, stage);
        const meta = stage === "publish"
          ? statusText(state?.status || "pending")
          : `${statusText(state?.status || "pending")} · ${formatDurationMs(stageDurationMs(state))}`;
        return (
          <button key={stage} disabled={disabled} className={cx("step-tab", activeStage === stage && "active", currentStage === stage && "current", disabled && "locked")} onClick={() => onSelect(stage)}>
            <span className="step-index">{index + 1}</span>
            <span><strong>{state?.label || stageCopy[stage].title}</strong><small>{meta}</small></span>
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
  inputText,
  setInputText,
  requirements,
  setRequirements,
  saveScript,
  generateScript,
  scriptModelId,
  setScriptModelId,
  selectedScriptVersionId,
  setSelectedScriptVersionId,
  voiceId,
  setVoiceId,
  selectedVoice,
  saveVoice,
  generateVoice,
  importAudioVersion,
  selectedAudioVersionId,
  setSelectedAudioVersionId,
  avatarAssetId,
  setAvatarAssetId,
  selectedAsset,
  videoSettings,
  setVideoSettings,
  saveVideoSetup,
  generateVideo,
  generateVideoPreview,
  selectedVideoVersionId,
  setSelectedVideoVersionId,
  publishDraft,
  preparePublish,
  recordPublished,
  onGoNext
}: {
  project: Project;
  state: State;
  activeStage: StageKey;
  busy: string;
  taskBusy: boolean;
  latestQueue?: QueueItem;
  action: AppAction;
  runStage: (label: string, path: string, body?: unknown) => Promise<Project | { queued: true; queueItem: QueueItem } | { submitted: true; queueItem: QueueItem } | undefined>;
  inputText: string;
  setInputText: (value: string) => void;
  requirements: string;
  setRequirements: (value: string) => void;
  saveScript: () => Promise<Project | undefined>;
  generateScript: () => Promise<unknown>;
  scriptModelId: string;
  setScriptModelId: (value: string) => void;
  selectedScriptVersionId: string;
  setSelectedScriptVersionId: (value: string) => void;
  voiceId: string;
  setVoiceId: (value: string) => void;
  selectedVoice?: Asset;
  saveVoice: () => Promise<Project | undefined>;
  generateVoice: () => Promise<unknown>;
  importAudioVersion: (file?: File) => Promise<unknown>;
  selectedAudioVersionId: string;
  setSelectedAudioVersionId: (value: string) => void;
  avatarAssetId: string;
  setAvatarAssetId: (value: string) => void;
  selectedAsset?: Asset;
  videoSettings: VideoSettings;
  setVideoSettings: React.Dispatch<React.SetStateAction<VideoSettings>>;
  saveVideoSetup: () => Promise<Project | undefined>;
  generateVideo: () => Promise<unknown>;
  generateVideoPreview: () => Promise<unknown>;
  selectedVideoVersionId: string;
  setSelectedVideoVersionId: (value: string) => void;
  publishDraft: PublishRecord | null;
  preparePublish: (platform: Platform) => Promise<void>;
  recordPublished: (platform: Platform) => Promise<void>;
  onGoNext: () => void;
}) {
  const stage = project.stageState?.[activeStage];
  const queueStage = latestQueue?.progress?.stage || project.progress?.stage;
  const stageQueues = state.queueItems
    .filter((item) => item.projectId === project.id && (item.progress?.stage || queueStage) === activeStage)
    .slice(0, 8);
  const activeStageQueues = stageQueues.filter(isActiveQueue);
  const stageQueue = activeStageQueues[0] || (latestQueue && isActiveQueue(latestQueue) && queueStage === activeStage ? latestQueue : undefined);
  const stageProgress = stageQueue?.progress || project.progress;
  const showStageProgress = Boolean(activeStageQueues.length || stageQueue);
  const publishRecords = state.publishRecords.filter((record) => record.projectId === project.id).slice(0, 6);
  const scriptVersions = project.scriptVersions || [];
  const audioVersions = project.audioVersions || [];
  const videoVersions = project.videoVersions || project.versions || [];
  const selectedScriptVersion = scriptVersions.find((version) => version.id === selectedScriptVersionId) || scriptVersions[0];
  const selectedAudioVersion = audioVersions.find((version) => version.id === selectedAudioVersionId) || audioVersions[0];
  const selectedVideoVersion = videoVersions.find((version) => version.id === selectedVideoVersionId) || videoVersions[0];
  const nextStage = visibleStageOrder[visibleStageOrder.indexOf(activeStage) + 1];
  const canGoNext = project.mode === "manual" && Boolean(nextStage && canEnterStage(project, nextStage));
  const copyPublishField = (value: string) => navigator.clipboard?.writeText(value).catch(() => undefined);
  const savingScript = busy === "保存口播文案";
  const savingVoice = busy === "保存音色";
  const savingVideoSetup = busy === "保存视频设置";
  const savingSourceAudio = busy === "保存原始音频";
  const openingPublish = busy === "打开发布入口";
  const recordingPublish = busy === "记录发布结果";
  const applyRequirementTemplate = (templateId: string) => {
    const template = requirementTemplates.find((item) => item.id === templateId);
    if (template) setRequirements(template.value);
  };

  return (
    <section className="step-panel">
      {project.mode === "manual" && nextStage && (
        <div className="step-next-row">
          <button className="secondary-button" disabled={!canGoNext} onClick={onGoNext}>
            下一步：{stageCopy[nextStage].title}
          </button>
        </div>
      )}
      {showStageProgress && (
        <div className="step-inline-status">
          <div className="step-runtime" aria-live="polite">
            <div>
              {activeStageQueues.length > 1 ? <span>{activeStageQueues.length} 个任务进行中</span> : <span>{stageQueue?.status === "queued" ? `排队第 ${stageQueue.position || 1} 位` : "正在执行"}</span>}
              {stageQueue?.attempts ? <span>第 {stageQueue.attempts} 次执行</span> : null}
              {stageQueue?.createdAt ? <span>已耗时 {formatDurationMs(Date.now() - new Date(stageQueue.createdAt).getTime())}</span> : null}
            </div>
            <small>{stageProgress?.label || "正在处理当前步骤。"}</small>
            <div className="progress-track"><span style={{ width: `${stageProgress?.percent ?? progressValue(project)}%` }} /></div>
          </div>
        </div>
      )}
      {["script", "voice", "video"].includes(activeStage) && <StageTaskPanel queueItems={stageQueues} action={action} />}

      {activeStage === "input" && (
        <div className="step-body">
          <OutputItem title="输入内容" status={project.stageState?.input?.status} meta={formatDate(project.createdAt)}>
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
          <label><span>输入内容</span><textarea value={inputText} onChange={(event) => setInputText(event.target.value)} /></label>
          <label><span>生成要求模板</span><select value="" onChange={(event) => applyRequirementTemplate(event.target.value)}><option value="">选择模板</option>{requirementTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
          <label><span>生成要求</span><input value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="语气、时长、平台风格、受众" /></label>
          <TextModelSelect state={state} value={scriptModelId} onChange={setScriptModelId} />
          {project.artifacts.script?.modelInfo && <small>生成模型：{project.artifacts.script.modelInfo.providerName || project.artifacts.script.modelInfo.modelName || project.artifacts.script.modelInfo.model || "文本模型"}</small>}
          <div className="step-actions">
            <button className="ghost-button" disabled={savingScript} onClick={saveScript}>
              {savingScript ? <Loader2 className="spin" size={15} /> : <Settings2 size={15} />}
              {savingScript ? "保存中" : "保存为口播文案"}
            </button>
            <ActionButton label="生成口播文案" busy={busy} disabled={!inputText.trim()} onClick={generateScript} />
          </div>
          <ScriptVersionList project={project} versions={scriptVersions} action={action} onSelect={(id) => {
            setSelectedScriptVersionId(id);
            const next = scriptVersions.find((version) => version.id === id);
            if (next) {
              setInputText(next.scriptText || "");
              setRequirements(next.requirementsSnapshot || requirements);
            }
          }} />
        </div>
      )}

      {activeStage === "voice" && (
        <div className="step-body">
          <VersionSelect
            label="口播文案版本"
            value={selectedScriptVersionId}
            onChange={setSelectedScriptVersionId}
            versions={scriptVersions}
            getMeta={(version) => version.title || formatDate(version.createdAt)}
          />
          <OutputItem title="当前文案输入" status={selectedScriptVersion?.status || "pending"} meta={selectedScriptVersion?.label || "未选择"}>
            <p>{selectedScriptVersion?.scriptText || "请先生成口播文案版本。"}</p>
          </OutputItem>
          <div className="field-row">
            <label><span>音色</span><select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">默认音色</option>{state.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
            <button className="secondary-button align-end" disabled={savingVoice} onClick={saveVoice}>
              {savingVoice ? <Loader2 className="spin" size={16} /> : <Mic2 size={16} />}
              {savingVoice ? "保存中" : "保存音色"}
            </button>
          </div>
          <VoiceSample asset={selectedVoice} />
          <div className="step-actions">
            <ActionButton label="生成口播音频" busy={busy} disabled={!selectedScriptVersion} onClick={generateVoice} />
            <button className="ghost-button" disabled={savingSourceAudio || !project.sourceAnalysis?.links?.some((link) => link.audioUri)} onClick={() => importAudioVersion()}>
              {savingSourceAudio ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
              {savingSourceAudio ? "保存中" : "保存原始音频"}
            </button>
            <label className="file-chip"><Upload size={16} />上传音频保存<input type="file" accept="audio/*" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importAudioVersion(file);
              event.currentTarget.value = "";
            }} /></label>
            <AudioRecorder label="录制并保存" onRecorded={(file) => importAudioVersion(file)} />
          </div>
          <AudioVersionList project={project} versions={audioVersions} scriptVersions={scriptVersions} selectedId={selectedAudioVersionId} onSelect={setSelectedAudioVersionId} action={action} />
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
            <label><span>数字人素材</span><select value={avatarAssetId} onChange={(event) => setAvatarAssetId(event.target.value)}><option value="">请选择数字人素材</option>{state.avatarAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
            <button className="secondary-button align-end" disabled={savingVideoSetup} onClick={saveVideoSetup}>
              {savingVideoSetup ? <Loader2 className="spin" size={16} /> : <Settings2 size={16} />}
              {savingVideoSetup ? "保存中" : "保存设置"}
            </button>
          </div>
          <AvatarSample asset={selectedAsset} />
          <VideoSettingsEditor videoSettings={videoSettings} setVideoSettings={setVideoSettings} />
          <div className="preset-row">
            <button className="ghost-button" onClick={() => setVideoSettings(defaultVideoSettings)}>推荐参数</button>
            <code>智能裁剪 / 稳定融合 / 上边界 0.50</code>
          </div>
          <div className="video-surface">
            {selectedVideoVersion ? <video src={selectedVideoVersion.artifact.video.uri} controls /> : <EmptyState text="视频生成后会显示在这里。" />}
          </div>
          <div className="step-actions">
            <ActionButton label="生成3秒预览" busy={busy} disabled={!selectedAudioVersion || !selectedAsset} onClick={generateVideoPreview} />
            <ActionButton label="生成视频" busy={busy} disabled={!selectedAudioVersion || !selectedAsset} onClick={generateVideo} />
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
            {(Object.keys(platformLabels) as Platform[]).map((platform) => (
              <button key={platform} className="primary-link" disabled={openingPublish || !selectedVideoVersion} onClick={() => preparePublish(platform)}>
                {openingPublish ? <Loader2 className="spin" size={16} /> : <ExternalLink size={16} />}
                {openingPublish ? "打开中" : platformLabels[platform]}
              </button>
            ))}
            {selectedVideoVersion && <a className="secondary-button" href={selectedVideoVersion.artifact.video.uri} download><Download size={16} />下载视频</a>}
          </div>
          <small>点击平台会生成该平台发布草稿、复制完整发布素材并打开创作者后台；平台表单仍需用户确认后粘贴或上传。</small>
          {publishDraft && (
            <OutputItem title={`${publishDraft.platformLabel}发布草稿`} status={publishDraft.status} meta={publishDraft.videoVersionLabel || "当前视频版本"}>
              <div className="publish-draft-grid">
                <label><span>标题</span><input readOnly value={publishDraft.title} /><button className="ghost-button" onClick={() => copyPublishField(publishDraft.title)}>复制</button></label>
                <label><span>正文</span><textarea readOnly value={publishDraft.body} /><button className="ghost-button" onClick={() => copyPublishField(publishDraft.body)}>复制</button></label>
                <label><span>视频地址</span><input readOnly value={`${window.location.origin}${publishDraft.videoUri}`} /><button className="ghost-button" onClick={() => copyPublishField(`${window.location.origin}${publishDraft.videoUri}`)}>复制</button></label>
                {publishDraft.videoPath && <label><span>本地文件</span><input readOnly value={publishDraft.videoPath} /><button className="ghost-button" onClick={() => copyPublishField(publishDraft.videoPath || "")}>复制</button></label>}
              </div>
            </OutputItem>
          )}
          <div className="publish-buttons">
            {(Object.keys(platformLabels) as Platform[]).map((platform) => (
              <button key={platform} className="ghost-button" disabled={recordingPublish || !selectedVideoVersion} onClick={() => recordPublished(platform)}>
                {recordingPublish && <Loader2 className="spin" size={15} />}
                {recordingPublish ? "记录中" : `记录${platformLabels[platform]}结果`}
              </button>
            ))}
          </div>
          <div className="output-list">
            {publishRecords.length ? publishRecords.map((record) => (
              <OutputItem key={record.id} title={record.platformLabel} status={record.status} meta={formatDate(record.createdAt)}>
                <p>{record.title}</p>
                <small>{record.workUrl || "未记录作品地址"}</small>
              </OutputItem>
            )) : <EmptyState text="还没有发布记录。发布完成后到发布历史里记录作品地址。" />}
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
  if (!asset) return <EmptyState text="请选择数字人素材后再生成视频。" />;
  return (
    <article className="media-sample avatar-sample">
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
    <details className="advanced-settings">
      <summary><Settings2 size={15} />高级参数</summary>
      <div className="param-grid">
        <label><span>裁剪方式</span><select value={videoSettings.cropMode} title={videoSettingTips.cropMode} onChange={(event) => setVideoSettings((current) => ({ ...current, cropMode: event.target.value as VideoSettings["cropMode"] }))}><option value="mediapipe">智能裁剪</option><option value="default">默认</option></select><small className="param-help">{videoSettingTips.cropMode}</small></label>
        <label><span>融合模式</span><select value={videoSettings.parsingMode} title={videoSettingTips.parsingMode} onChange={(event) => setVideoSettings((current) => ({ ...current, parsingMode: event.target.value as VideoSettings["parsingMode"] }))}><option value="jaw">稳定融合</option><option value="raw">轻量融合</option></select><small className="param-help">{videoSettingTips.parsingMode}</small></label>
        <label><span>上边界</span><input type="number" min="0.35" max="0.65" step="0.01" value={videoSettings.upperBoundaryRatio} title={videoSettingTips.upperBoundaryRatio} onChange={(event) => setVideoSettings((current) => ({ ...current, upperBoundaryRatio: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.upperBoundaryRatio}</small></label>
        <label><span>下巴边距</span><input type="number" min="0" max="40" step="1" value={videoSettings.extraMargin} title={videoSettingTips.extraMargin} onChange={(event) => setVideoSettings((current) => ({ ...current, extraMargin: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.extraMargin}</small></label>
        <label><span>脸颊扩展</span><input type="number" min="0.04" max="0.24" step="0.01" value={videoSettings.facePad} title={videoSettingTips.facePad} onChange={(event) => setVideoSettings((current) => ({ ...current, facePad: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.facePad}</small></label>
        <label><span>底部扩展</span><input type="number" min="0" max="0.12" step="0.01" value={videoSettings.lowerPad} title={videoSettingTips.lowerPad} onChange={(event) => setVideoSettings((current) => ({ ...current, lowerPad: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.lowerPad}</small></label>
        <label><span>批大小</span><input type="number" min="1" max="4" step="1" value={videoSettings.batchSize} title={videoSettingTips.batchSize} onChange={(event) => setVideoSettings((current) => ({ ...current, batchSize: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.batchSize}</small></label>
        <label><span>左脸宽度</span><input type="number" min="40" max="140" step="5" value={videoSettings.leftCheekWidth} title={videoSettingTips.leftCheekWidth} onChange={(event) => setVideoSettings((current) => ({ ...current, leftCheekWidth: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.leftCheekWidth}</small></label>
        <label><span>右脸宽度</span><input type="number" min="40" max="140" step="5" value={videoSettings.rightCheekWidth} title={videoSettingTips.rightCheekWidth} onChange={(event) => setVideoSettings((current) => ({ ...current, rightCheekWidth: Number(event.target.value) }))} /><small className="param-help">{videoSettingTips.rightCheekWidth}</small></label>
      </div>
    </details>
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
  const progressMeta = currentStage === "publish"
    ? progressLabel
    : `${progressLabel} · 当前阶段耗时 ${formatDurationMs(stageDurationMs(stage))}`;
  return (
    <section className="flow-overview" aria-live="polite">
      <div className="flow-head">
        <div>
          <p className="eyebrow">流程定位</p>
          <h3>{stage?.label || currentStage} · {statusText(stage?.status)}</h3>
          <small>{progressMeta}</small>
        </div>
        <div className="flow-progress">
          <strong>{progressValue(project)}%</strong>
          <span>总进度 · {formatDurationMs(taskDurationMs(project))}</span>
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

function StageTaskPanel({ queueItems, action }: { queueItems: QueueItem[]; action: AppAction }) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const retryTask = (item: QueueItem) => action("重试执行任务", () => request(`/api/queue/${item.id}/retry`, { method: "POST" }));
  const cancelTask = (item: QueueItem) => action("取消执行任务", () => request(`/api/queue/${item.id}/cancel`, { method: "POST" }));
  const clearableIds = queueItems.filter((item) => ["completed", "cancelled"].includes(item.status)).map((item) => item.id);
  const collapsedSet = new Set(collapsedIds);
  const activeCount = queueItems.filter(isActiveQueue).length;
  const toggleTask = (id: string) => {
    setCollapsedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const clearFinished = () => action("清理执行记录", () => request("/api/queue/clear", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: clearableIds })
  }));
  return (
    <section className="stage-task-panel">
      <div className="section-head">
        <div><p className="eyebrow">任务</p><h3>并行执行任务</h3></div>
        <div className="stage-task-head-actions">
          {clearableIds.length > 0 && <button className="text-button" onClick={clearFinished}>清理已完成</button>}
          <button className="text-button" onClick={() => setCollapsed((value) => !value)}>{collapsed ? "展开全部" : "收起全部"}</button>
          <span className="count-pill">{queueItems.length}</span>
        </div>
      </div>
      {collapsed ? (
        <button type="button" className="stage-task-summary" onClick={() => setCollapsed(false)}>
          <span>{queueItems.length ? `${queueItems.length} 个任务，${activeCount} 个执行中` : "当前阶段还没有执行任务。"}</span>
          <ChevronDown size={16} />
        </button>
      ) : <div className="stage-task-list">
        {queueItems.length ? queueItems.map((item) => {
          const elapsedFrom = item.startedAt || item.createdAt;
          const finishedAt = item.finishedAt ? new Date(item.finishedAt).getTime() : Date.now();
          const elapsed = elapsedFrom ? Math.max(0, finishedAt - new Date(elapsedFrom).getTime()) : 0;
          const itemCollapsed = collapsedSet.has(item.id);
          return (
            <article className={cx("stage-task-row", itemCollapsed && "collapsed")} key={item.id}>
              <StatusBadge status={item.status} />
              <div>
                <button type="button" className="stage-task-title" onClick={() => toggleTask(item.id)} aria-expanded={!itemCollapsed}>
                  <strong>{item.label}{item.progress?.resultVersionLabel ? ` · ${item.progress.resultVersionLabel}` : ""}</strong>
                  <ChevronDown className={cx(itemCollapsed && "rotate-180")} size={15} />
                </button>
                <small>
                  {statusText(item.status)}
                  {item.attempts ? ` · 第 ${item.attempts} 次执行` : ""}
                  {elapsedFrom ? ` · 耗时 ${formatDurationMs(elapsed)}` : ""}
                  {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ""}
                </small>
                {!itemCollapsed && (
                  <>
                    <small>{item.lastError || item.progress?.label || "等待执行。"}</small>
                    {item.progress?.artifactUri && item.progress.artifactType === "audio" && <audio controls src={item.progress.artifactUri} />}
                    <div className="progress-track"><span style={{ width: `${item.progress?.percent || 0}%` }} /></div>
                  </>
                )}
              </div>
              <div className={cx("stage-task-actions", itemCollapsed && "compact")}>
                <button className="text-button" onClick={() => toggleTask(item.id)}>{itemCollapsed ? "展开" : "收起"}</button>
                {["failed", "cancelled"].includes(item.status) && <button className="text-button" onClick={() => retryTask(item)}>重试</button>}
                {item.status === "queued" && <button className="text-button danger-text" onClick={() => cancelTask(item)}>取消</button>}
              </div>
            </article>
          );
        }) : (
          <EmptyState text="当前阶段还没有执行任务。提交生成后会在这里显示进度、结果和失败原因。" />
        )}
      </div>}
    </section>
  );
}

function AssetQualityPanel({ asset }: { asset?: Asset }) {
  if (!asset) {
    return (
      <section className="quality-panel">
        <div className="section-head"><div><p className="eyebrow">素材质检</p><h3>数字人素材</h3></div><StatusBadge status="pending" /></div>
        <small>当前任务未选择数字人素材，请先在视频合成步骤选择可用素材。</small>
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

function ScriptVersionList({ project, versions, onSelect, action }: { project: Project; versions: ScriptVersion[]; onSelect: (id: string) => void; action: AppAction }) {
  const deleteVersion = (version: ScriptVersion) => {
    if (!window.confirm(`删除口播文案版本「${version.label}」？`)) return;
    action("删除口播文案版本", () => request(`/api/projects/${project.id}/script-versions/${version.id}`, { method: "DELETE" }));
  };
  return (
    <section className="version-panel">
      <div className="section-head">
        <div><p className="eyebrow">输出版本</p><h3>口播文案版本</h3></div>
        <span className="count-pill">{versions.length}</span>
      </div>
      <div className="version-list">
        {versions.length ? versions.map((version) => (
          <article className="version-row" key={version.id}>
            <div>
              <strong>{version.label} · {version.title}</strong>
              <small>{formatDate(version.createdAt)} · {version.modelInfo?.providerName || version.modelInfo?.modelName || version.modelInfo?.model || "文本模型"}</small>
              <p>{version.scriptText}</p>
            </div>
            <div className="version-actions">
              <button className="text-button" onClick={() => onSelect(version.id)}>载入到输入</button>
              <button className="text-button danger-text" onClick={() => deleteVersion(version)}>删除</button>
            </div>
          </article>
        )) : <EmptyState text="还没有口播文案版本。" />}
      </div>
    </section>
  );
}

function AudioVersionList({ project, versions, scriptVersions, selectedId, onSelect, action }: { project: Project; versions: AudioVersion[]; scriptVersions: ScriptVersion[]; selectedId: string; onSelect: (id: string) => void; action: AppAction }) {
  const scriptLabel = (id: string) => scriptVersions.find((version) => version.id === id)?.label || "未关联文案";
  const deleteVersion = (version: AudioVersion) => {
    if (!window.confirm(`删除口播音频版本「${version.label}」？`)) return;
    action("删除口播音频版本", () => request(`/api/projects/${project.id}/audio-versions/${version.id}`, { method: "DELETE" }));
  };
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
              <button className="text-button danger-text" onClick={() => deleteVersion(version)}>删除</button>
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
      {visibleStageOrder.map((stage) => {
        const state = project.stageState?.[stage];
        const meta = stage === "publish"
          ? statusText(state?.status || "pending")
          : `${statusText(state?.status || "pending")} · ${formatDurationMs(stageDurationMs(state))}`;
        return (
          <div key={stage} className={cx("stage-node", state?.status, currentStage === stage && "current")}>
            <span>{state?.label || stage}</span>
            <small>{meta}</small>
            {state?.message && <em>{state.message}</em>}
          </div>
        );
      })}
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
  return <div className="stage-dots">{visibleStageOrder.map((stage) => <span key={stage} className={cx(project.stageState?.[stage]?.status)} />)}</div>;
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
  const [clipAssetId, setClipAssetId] = useState("");
  const [clipName, setClipName] = useState("");
  const [clipStart, setClipStart] = useState("0");
  const [clipEnd, setClipEnd] = useState("5");
  const [uploading, setUploading] = useState(false);
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
    setUploading(true);
    await action(uploadLabel, () => request(uploadUrl, { method: "POST", body })).finally(() => setUploading(false));
    setName("");
    setFile(null);
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

  function startClip(item: Asset) {
    setClipAssetId(item.id);
    setClipName(`${item.name}-片段`);
    setClipStart("0");
    setClipEnd("5");
  }

  function cancelClip() {
    setClipAssetId("");
    setClipName("");
    setClipStart("0");
    setClipEnd("5");
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

  async function createClip(item: Asset) {
    const start = Number(clipStart);
    const end = Number(clipEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    await action("生成素材片段", () => request(`/api/assets/avatar-videos/${item.id}/clip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clipName || `${item.name}-片段`, start, end })
    }));
    cancelClip();
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
        <button className="primary-button" disabled={uploading || !file}>{uploading ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}{uploading ? "上传中" : uploadLabel}</button>
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
        template={kind === "avatar" ? "42px minmax(300px, 1.35fr) minmax(170px, .75fr) 120px 210px" : "42px minmax(220px, 1.2fr) minmax(180px, .9fr) 120px 150px"}
        rows={filtered.map((item) => [
          <input className="table-check" type="checkbox" aria-label={`选择${entityLabel} ${item.name}`} checked={checkedIds.includes(item.id)} onChange={(event) => toggleOne(item.id, event.target.checked)} />,
          editingId === item.id ? (
            <div className="asset-edit-stack">
              <span className="inline-edit">
                <input value={editingName} onChange={(event) => setEditingName(event.target.value)} aria-label={`${entityLabel}名称`} />
                <button className="icon-mini" onClick={() => saveEdit(item)} aria-label="保存" disabled={!editingName.trim()}><Save size={14} /></button>
                <button className="icon-mini" onClick={cancelEdit} aria-label="取消"><X size={14} /></button>
              </span>
            </div>
          ) : clipAssetId === item.id ? (
            <ClipEditor
              item={item}
              clipName={clipName}
              setClipName={setClipName}
              clipStart={clipStart}
              setClipStart={setClipStart}
              clipEnd={clipEnd}
              setClipEnd={setClipEnd}
              onCreate={() => createClip(item)}
              onCancel={cancelClip}
            />
          ) : (
            <span className="asset-title"><strong>{item.name}</strong><small>{item.mimeType || item.provider || "local"}</small></span>
          ),
          <MediaPreview item={item} kind={kind} />,
          formatDate(item.createdAt),
          <span className="table-actions">
            <button className="text-button" onClick={() => startEdit(item)}><Pencil size={14} />编辑</button>
            {kind === "avatar" && <button className="text-button" onClick={() => startClip(item)}><Scissors size={14} />剪辑</button>}
            <button className="text-button danger-text" onClick={() => deleteItem(item)}><Trash2 size={14} />删除</button>
          </span>
        ])}
      />
    </section>
  );
}

function formatClipTime(value: number) {
  if (!Number.isFinite(value)) return "00:00.0";
  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function ClipEditor({
  item,
  clipName,
  setClipName,
  clipStart,
  setClipStart,
  clipEnd,
  setClipEnd,
  onCreate,
  onCancel
}: {
  item: Asset;
  clipName: string;
  setClipName: (value: string) => void;
  clipStart: string;
  setClipStart: (value: string) => void;
  clipEnd: string;
  setClipEnd: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const start = Math.max(0, Number(clipStart) || 0);
  const end = Math.max(start + 0.1, Number(clipEnd) || start + 0.1);
  const maxDuration = Math.max(duration, end, 0.1);
  const selectedDuration = Math.max(0, end - start);
  const startPercent = Math.min(100, Math.max(0, (start / maxDuration) * 100));
  const endPercent = Math.min(100, Math.max(startPercent, (end / maxDuration) * 100));
  const canCreate = Boolean(clipName.trim() && end > start);

  function syncVideo(time: number) {
    if (videoRef.current && Number.isFinite(time)) videoRef.current.currentTime = Math.max(0, Math.min(time, maxDuration));
  }

  function setRange(nextStart: number, nextEnd: number, focus: "start" | "end") {
    const safeStart = Math.max(0, Math.min(nextStart, maxDuration - 0.1));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(nextEnd, maxDuration));
    setClipStart(safeStart.toFixed(1));
    setClipEnd(safeEnd.toFixed(1));
    syncVideo(focus === "start" ? safeStart : safeEnd);
  }

  function timeFromPointer(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * maxDuration;
  }

  function beginDrag(handle: "start" | "end", event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(handle);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const time = timeFromPointer(event.clientX);
    if (dragging === "start") setRange(Math.min(time, end - 0.1), end, "start");
    if (dragging === "end") setRange(start, Math.max(time, start + 0.1), "end");
  }

  function jumpToNearestHandle(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== trackRef.current) return;
    const time = timeFromPointer(event.clientX);
    const nearest = Math.abs(time - start) <= Math.abs(time - end) ? "start" : "end";
    if (nearest === "start") setRange(Math.min(time, end - 0.1), end, "start");
    if (nearest === "end") setRange(start, Math.max(time, start + 0.1), "end");
  }

  function handleMetadata(event: React.SyntheticEvent<HTMLVideoElement>) {
    const nextDuration = event.currentTarget.duration;
    if (!Number.isFinite(nextDuration) || nextDuration <= 0) return;
    setDuration(nextDuration);
    if (Number(clipEnd) > nextDuration || clipEnd === "5") setClipEnd(Math.min(5, nextDuration).toFixed(1));
  }

  return (
    <div className="clip-editor-panel">
      <div className="clip-preview">
        <video ref={videoRef} src={item.uri} controls muted preload="metadata" onLoadedMetadata={handleMetadata} />
      </div>
      <div className="clip-controls">
        <div className="clip-title-row">
          <label>
            <span>新素材名称</span>
            <input value={clipName} onChange={(event) => setClipName(event.target.value)} aria-label="片段名称" placeholder="片段名称" />
          </label>
          <button className="icon-mini" onClick={onCancel} aria-label="取消"><X size={14} /></button>
        </div>
        <div className="clip-time-meta">
          <span>开始 {formatClipTime(start)}</span>
          <span>结束 {formatClipTime(end)}</span>
          <span>片段 {formatClipTime(selectedDuration)}</span>
          <span>总长 {duration ? formatClipTime(duration) : "读取中"}</span>
        </div>
        <div
          ref={trackRef}
          className="clip-timeline"
          onPointerDown={jumpToNearestHandle}
          onPointerMove={moveDrag}
          onPointerUp={() => setDragging(null)}
          onPointerCancel={() => setDragging(null)}
        >
          <div className="clip-track-bg" />
          <div className="clip-selection" style={{ left: `${startPercent}%`, width: `${Math.max(1, endPercent - startPercent)}%` }} />
          <button
            type="button"
            className={cx("clip-handle", "start", dragging === "start" && "dragging")}
            style={{ left: `${startPercent}%` }}
            onPointerDown={(event) => beginDrag("start", event)}
            aria-label="拖动开始时间"
          />
          <button
            type="button"
            className={cx("clip-handle", "end", dragging === "end" && "dragging")}
            style={{ left: `${endPercent}%` }}
            onPointerDown={(event) => beginDrag("end", event)}
            aria-label="拖动结束时间"
          />
        </div>
        <div className="clip-time-inputs">
          <label><span>开始秒</span><input type="number" min="0" step="0.1" value={clipStart} onChange={(event) => setRange(Number(event.target.value), end, "start")} /></label>
          <label><span>结束秒</span><input type="number" min="0.1" step="0.1" value={clipEnd} onChange={(event) => setRange(start, Number(event.target.value), "end")} /></label>
          <button className="ghost-button" onClick={onCreate} disabled={!canCreate}><Scissors size={14} />生成片段</button>
        </div>
      </div>
    </div>
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
        <label><span>裁剪模式</span><select value={settings.cropMode} onChange={(event) => updateSetting("cropMode", event.target.value as VideoSettings["cropMode"])}><option value="mediapipe">MediaPipe</option><option value="default">默认框</option></select></label>
        <label><span>解析模式</span><select value={settings.parsingMode} onChange={(event) => updateSetting("parsingMode", event.target.value as VideoSettings["parsingMode"])}><option value="jaw">jaw</option><option value="raw">raw</option></select></label>
        <label><span>上边界</span><input type="number" min="0.35" max="0.65" step="0.01" value={settings.upperBoundaryRatio} onChange={(event) => updateSetting("upperBoundaryRatio", Number(event.target.value))} /></label>
        <label><span>脸部扩展</span><input type="number" min="0.04" max="0.24" step="0.01" value={settings.facePad} onChange={(event) => updateSetting("facePad", Number(event.target.value))} /></label>
        <label><span>下巴扩展</span><input type="number" min="0" max="40" step="1" value={settings.extraMargin} onChange={(event) => updateSetting("extraMargin", Number(event.target.value))} /></label>
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
          statusText(record.status),
          record.publishedAt ? formatDate(record.publishedAt) : formatDate(record.createdAt),
          <span className="table-actions"><a className="table-link" href={record.workUrl || record.publishUrl} target="_blank" rel="noreferrer">打开</a><button className="text-button" onClick={() => markPublished(record)}>记录地址</button><button className="text-button danger-text" onClick={() => deleteRecord(record)}>删除</button></span>
        ])}
      />
      {records.length === 0 && <EmptyState text="还没有发布记录。只有确认已发布并记录作品地址后才会出现在这里。" />}
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
