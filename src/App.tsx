import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ClipboardList,
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
  Sparkles,
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

type RuntimeModelStatus = {
  kind: "asr" | "tts" | "avatar";
  label: string;
  status: "stopped" | "starting" | "running" | "failed";
  startedAt?: string;
  readyAt?: string;
  loadMs?: number;
  error?: string;
  pid?: number | null;
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
  ttsModelId?: string;
  ttsModelName?: string;
  audioPlaybackSpeed?: number;
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
  generateSubtitles?: boolean;
  platforms: Platform[];
  avatarAssetId: string;
  backgroundMusicAssetId?: string;
  backgroundMusicVolume?: number;
  voiceId: string;
  scriptModelId?: string;
  ttsModelId?: string;
  audioPlaybackSpeed?: number;
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
    links: Array<{ id: string; url: string; platform: string; status: string; title?: string; message?: string; videoUri?: string; audioUri?: string; videoPath?: string; audioPath?: string; duration?: number }>;
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
  audioUri?: string;
  audioPath?: string;
  subtitlesUri?: string;
  subtitlesPath?: string;
  packageText?: string;
  videoVersionLabel?: string;
  title: string;
  body: string;
  automationStatus?: string;
  automationMessage?: string;
  automationSteps?: string[];
  automationStepDetails?: Array<{ id: string; label: string; status: string; message?: string; updatedAt?: string }>;
  createdAt: string;
  publishedAt?: string;
  workUrl?: string;
};

type RequirementTemplate = {
  id: string;
  label: string;
  value: string;
  createdAt?: string;
  updatedAt?: string;
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
  musicAssets: Asset[];
  voices: Asset[];
  models: ModelRecord[];
  modelCatalog: ModelCatalogItem[];
  apiProviderCatalog: ApiProviderCatalogItem[];
  apiProviders: ApiProviderRecord[];
  jobs: JobRecord[];
  queueItems: QueueItem[];
  resource?: ResourceSnapshot;
  publishRecords: PublishRecord[];
  requirementTemplates: RequirementTemplate[];
  runtimeModels?: {
    asr?: RuntimeModelStatus;
    tts?: RuntimeModelStatus;
    avatar?: RuntimeModelStatus;
  };
  modelHome: string;
  settings?: {
    defaultTextModelId?: string;
    defaultModelIds?: Partial<Record<ModelTypeKey, string>>;
    keepAsrModelWarm?: boolean;
    keepTtsModelWarm?: boolean;
    keepAvatarModelWarm?: boolean;
    videoConcurrency?: number;
    avatarSegmentSeconds?: number;
  };
};

const emptyState: State = {
  projects: [],
  avatarAssets: [],
  musicAssets: [],
  voices: [],
  models: [],
  modelCatalog: [],
  apiProviderCatalog: [],
  apiProviders: [],
  jobs: [],
  queueItems: [],
  resource: undefined,
  publishRecords: [],
  requirementTemplates: [],
  modelHome: "",
  settings: {}
};

const navItems = [
  { id: "tasks", label: "创建任务", icon: LayoutDashboard },
  { id: "taskList", label: "任务列表", icon: ClipboardList },
  { id: "assets", label: "素材库", icon: Video },
  { id: "voices", label: "音色库", icon: Mic2 },
  { id: "models", label: "体验中心", icon: MonitorCog },
  { id: "publish", label: "发布历史", icon: Send }
] as const;

const stageOrder: StageKey[] = ["input", "script", "voice", "video", "publish"];
const visibleStageOrder: StageKey[] = ["voice", "video", "publish"];
const platformLabels: Record<Platform, string> = { douyin: "抖音", xiaohongshu: "小红书", wechat: "公众号" };
const stageCopy: Record<StageKey, { title: string; description: string }> = {
  input: { title: "输入", description: "确认原始文本和生成要求。" },
  script: { title: "生成口播文案", description: "基于输入生成或保存口播文案版本。" },
  voice: { title: "生成口播音频", description: "基于输入内容和音色，生成可试听音频版本。" },
  video: { title: "视频合成", description: "选择音频版本和数字人素材，生成可用的视频版本。" },
  publish: { title: "发布", description: "选择视频版本和渠道，打开平台发布入口并复制素材。" }
};
const stageActionMap: Partial<Record<StageKey, FlowAction>> = {
  script: { label: "生成口播文案", path: "generate-script" },
  voice: { label: "生成口播音频", path: "synthesize-speech" },
  video: { label: "生成视频", path: "render-video" }
};
const modelTypeTabs: Array<{ id: ModelTypeKey; label: string }> = [
  { id: "llm", label: "AI润色" },
  { id: "tts", label: "音色试听" },
  { id: "avatar", label: "视频合成" }
];
const modelTypeLabels: Record<ModelTypeKey, string> = {
  llm: "AI润色",
  asr: "ASR",
  tts: "音色试听",
  avatar: "视频合成"
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
const audioSpeedOptions = [0.5, 1, 1.5, 2];
const defaultRequirementTemplates: RequirementTemplate[] = [
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
];

function getRequirementTemplates(state: State) {
  return state.requirementTemplates?.length ? state.requirementTemplates : defaultRequirementTemplates;
}
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

function publishPackageText(payload: PublishRecord) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return [
    `平台：${payload.platformLabel}`,
    `标题：${payload.title}`,
    "",
    "正文：",
    payload.body,
    "",
    `视频地址：${origin}${payload.videoUri}`,
    payload.videoPath ? `视频文件：${payload.videoPath}` : "",
    payload.audioUri ? `音频地址：${origin}${payload.audioUri}` : "",
    payload.audioPath ? `音频文件：${payload.audioPath}` : "",
    payload.subtitlesUri ? `字幕地址：${origin}${payload.subtitlesUri}` : "",
    payload.subtitlesPath ? `字幕文件：${payload.subtitlesPath}` : ""
  ].filter(Boolean).join("\n");
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

function metricDisplayEntries(metrics?: Record<string, unknown>) {
  if (!metrics) return [];
  const entries: Array<{ key: string; label: string; value: string }> = [];
  const loadMs = Number(metrics.load_ms);
  const inferMs = Number(metrics.infer_ms);
  const totalMs = (Number.isFinite(loadMs) ? loadMs : 0) + (Number.isFinite(inferMs) ? inferMs : 0);
  if (totalMs > 0) {
    entries.push({ key: "duration_ms", label: "耗时", value: formatDurationMs(totalMs) });
  }
  for (const [key, value] of Object.entries(metrics)) {
    if (value === "" || value === null || value === undefined) continue;
    if (key === "load_ms" || key === "infer_ms") continue;
    if (/_ms$/i.test(key) && Number.isFinite(Number(value))) {
      entries.push({ key, label: "耗时", value: formatDurationMs(Number(value)) });
      continue;
    }
    entries.push({ key, label: key, value: String(value) });
  }
  return entries;
}

function stageDurationMs(stage?: StageState[StageKey]) {
  if (!stage) return undefined;
  if (typeof stage.durationMs === "number") return stage.durationMs;
  if (stageRunning(stage.status) && stage.startedAt) return Date.now() - new Date(stage.startedAt).getTime();
  if (stage.startedAt && stage.finishedAt) return new Date(stage.finishedAt).getTime() - new Date(stage.startedAt).getTime();
  return undefined;
}

function taskDurationMs(project: Project) {
  const stageTotal = (["voice", "video"] as StageKey[]).reduce((sum, stage) => sum + (stageDurationMs(project.stageState?.[stage]) || 0), 0);
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
  return current === "input" || current === "script" ? "voice" : current;
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
    metadata_filled: "待确认发布",
    metadata_fill_partial: "部分回填",
    login_required: "需要登录",
    automation_failed: "回填失败",
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
          <TaskCreatePage
            state={state}
            busy={busy}
            action={action}
            onCreated={setSelectedProjectId}
          />
        )}
        {view === "taskList" && (
          <TaskListPage
            state={state}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            setSelectedProjectId={setSelectedProjectId}
            busy={busy}
            action={action}
          />
        )}
        {view === "assets" && <AssetLibrary state={state} refresh={refresh} action={action} />}
        {view === "voices" && <AssetManager title="音色库" kind="voice" items={state.voices} refresh={refresh} action={action} />}
        {view === "models" && <ModelCenter state={state} action={action} />}
        {view === "publish" && <PublishHistory records={state.publishRecords} projects={state.projects} action={action} />}
      </main>
    </div>
  );
}

function RuntimeSettingsDialog({ state, action, onClose }: { state: State; action: AppAction; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label="运行配置">
        <div className="modal-head">
          <div><p className="eyebrow">配置页</p><h2>运行配置</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </div>
        <RuntimeSettingsPanel state={state} action={action} />
      </section>
    </div>
  );
}

function TaskCreatePage(props: {
  state: State;
  busy: string;
  action: <T>(label: string, runner: () => Promise<T>) => Promise<T | undefined>;
  onCreated: (id: string) => void;
}) {
  const [draftInputText, setDraftInputText] = useState("");
  const [extractOpen, setExtractOpen] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState("");
  const createdProject = props.state.projects.find((project) => project.id === createdProjectId);

  useEffect(() => {
    if (createdProjectId && !props.state.projects.some((project) => project.id === createdProjectId)) {
      setCreatedProjectId("");
    }
  }, [createdProjectId, props.state.projects]);

  const handleCreated = (id: string) => {
    setCreatedProjectId(id);
    props.onCreated(id);
  };

  return (
    <div className="task-layout">
      <section className="task-main create-only">
        <div className="task-create-panel">
          <TaskComposer
            state={props.state}
            action={props.action}
            onCreated={handleCreated}
            inputText={draftInputText}
            setInputText={setDraftInputText}
            busy={props.busy}
            onOpenExtraction={() => setExtractOpen(true)}
          />
        </div>
      </section>
      {extractOpen && <SourceExtractionDialog action={props.action} onClose={() => setExtractOpen(false)} />}
      {createdProject ? (
        <TaskDetail project={createdProject} state={props.state} busy={props.busy} action={props.action} />
      ) : (
        <aside className="task-detail">
          <EmptyState text="创建任务后，右侧会显示当前创建任务的详情。" />
        </aside>
      )}
    </div>
  );
}

function TaskListPage(props: {
  state: State;
  selectedProject?: Project;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  busy: string;
  action: <T>(label: string, runner: () => Promise<T>) => Promise<T | undefined>;
}) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const allChecked = props.state.projects.length > 0 && props.state.projects.every((project) => checkedSet.has(project.id));
  const deletingChecked = props.busy === "批量删除任务";

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
    if (!checkedIds.length || deletingChecked) return;
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
      <section className="task-main list-only">
        <div className="bulk-toolbar">
          <span className="count-pill">{props.state.projects.length}</span>
          <label className="checkbox-pill">
            <input type="checkbox" checked={allChecked} onChange={(event) => toggleAll(event.target.checked)} />
            全选
          </label>
          <button className="ghost-button danger" disabled={!checkedIds.length || deletingChecked} onClick={deleteChecked}>
            {deletingChecked ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
            {deletingChecked ? "删除中" : "删除所选"}
          </button>
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
    ["asr", "文案识别"],
    ["result", "解析结果"]
  ] as const;
  if (status === "idle") return labels.map(([id, label]) => ({ id, label, status: "pending" as const }));
  if (status === "done") return labels.map(([id, label]) => ({ id, label, status: "done" as const }));
  if (status === "failed") return labels.map(([id, label], index) => ({ id, label, status: index < 2 ? "done" as const : index === 2 ? "failed" as const : "pending" as const }));
  return labels.map(([id, label], index) => ({ id, label, status: index < 2 ? "done" as const : index === 2 ? "running" as const : "pending" as const }));
}

function SourceExtractionDialog({ action, onClose }: { action: AppAction; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="source-modal" role="dialog" aria-modal="true" aria-label="链接解析">
        <div className="modal-head">
          <h2>链接解析</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </div>
        <SourceExtractionTool action={action} />
      </section>
    </div>
  );
}

function SourceExtractionTool({
  action
}: {
  action: AppAction;
}) {
  const [sourceText, setSourceText] = useState("");
  const [result, setResult] = useState<SourceExtractResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "failed">("idle");
  const extractedText = result?.extractedText || result?.inputText || "";
  const extractionId = result?.extractionId || result?.id || "";
  const mediaLinks = result?.sourceAnalysis?.links?.filter((link) => link.videoUri || link.audioUri) || [];
  const steps = result?.steps?.length
    ? result.steps.map((step) => ({ id: step.key, label: step.key === "asr" ? "文案识别" : displaySourceStepText(step.label), status: step.status }))
    : extractionStepsFor(status);

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

  async function saveExtractionMedia(kind: "avatar" | "voice", linkId = "", options: { name: string; start?: number; end?: number }) {
    if (!extractionId) return;
    const name = options.name.trim();
    await action(kind === "avatar" ? "保存为素材" : "保存为音色", () => request(kind === "avatar"
      ? `/api/source-extractions/${extractionId}/save-avatar`
      : `/api/source-extractions/${extractionId}/save-voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, linkId, start: options.start, end: options.end })
    }));
  }

  return (
    <section className="source-tool">
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
      {mediaLinks.length > 0 && (
        <SourceMediaSavePanel links={mediaLinks} onSave={saveExtractionMedia} fallbackTitle={result?.title || "链接解析媒体"} />
      )}
      <SourceExtractionTimeline
        result={result}
        fallbackSteps={extractionStepsFor(status)}
        extractedText={extractedText}
        canApply={Boolean(extractedText && result?.status === "done")}
        onApply={copyExtractedText}
      />
    </section>
  );
}

function SourceMediaSavePanel({
  links,
  fallbackTitle,
  onSave
}: {
  links: Project["sourceAnalysis"]["links"];
  fallbackTitle: string;
  onSave: (kind: "avatar" | "voice", linkId: string, options: { name: string; start?: number; end?: number }) => void;
}) {
  return (
    <div className="source-save-panel">
      <div>
        <strong>保存解析媒体</strong>
        <small>可先拖动选择片段，再保存到素材库或音色库。</small>
      </div>
      <div className="source-save-actions">
        {links.map((link) => (
          <div key={link.id} className="source-save-card">
            <div className="source-save-title">
              <strong>{compactDisplay(link.title || fallbackTitle || link.url, 32)}</strong>
              <small>{link.url}</small>
            </div>
            {link.videoUri && (
              <SourceMediaImportCard
                kind="avatar"
                link={link}
                src={link.videoUri}
                fallbackName={compactDisplay(link.title || fallbackTitle || "链接解析素材", 18)}
                onSave={onSave}
              />
            )}
            {link.audioUri && (
              <SourceMediaImportCard
                kind="voice"
                link={link}
                src={link.audioUri}
                fallbackName={compactDisplay(link.title || fallbackTitle || "链接解析音色", 18)}
                onSave={onSave}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceMediaImportCard({
  kind,
  link,
  src,
  fallbackName,
  onSave
}: {
  kind: "avatar" | "voice";
  link: Project["sourceAnalysis"]["links"][number];
  src: string;
  fallbackName: string;
  onSave: (kind: "avatar" | "voice", linkId: string, options: { name: string; start?: number; end?: number }) => void;
}) {
  const [name, setName] = useState(fallbackName);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState(link.duration ? Number(link.duration).toFixed(1) : "");
  const numericStart = Number(start);
  const numericEnd = Number(end);
  const isVoice = kind === "voice";
  return (
    <div className="source-import-card">
      <MediaRangeEditor
        src={src}
        mediaKind={isVoice ? "audio" : "video"}
        name={name}
        setName={setName}
        nameLabel={isVoice ? "音色名称" : "素材名称"}
        start={start}
        setStart={setStart}
        end={end}
        setEnd={setEnd}
        actionLabel={isVoice ? "添加到音色" : "添加到素材"}
        actionIcon={isVoice ? "voice" : "avatar"}
        onSubmit={() => onSave(kind, link.id, {
          name,
          start: Number.isFinite(numericStart) ? numericStart : undefined,
          end: Number.isFinite(numericEnd) ? numericEnd : undefined
        })}
      />
    </div>
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

function displaySourceStepText(value = "") {
  return String(value)
    .replace(/ASR 转写/g, "文案识别")
    .replace(/ASR转写/g, "文案识别");
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
  const text = ["type", "asr"].includes(step.key || "") || (step.key === "extract" && Boolean(step.mediaUri))
    ? ""
    : isFinal ? (finalText || step.outputText || "") : (step.outputText || "");
  const displayLabel = step.key === "asr" ? "文案识别" : displaySourceStepText(step.label);
  const displayMessage = displaySourceStepText(step.message || statusText(step.status));
  const displayText = displaySourceStepText(text);
  const outputMetrics = metricDisplayEntries(step.outputJson as Record<string, unknown> | undefined);
  const showOutputJson = !["type", "extract"].includes(step.key || "") && outputMetrics.length > 0;
  const hasMedia = Boolean(step.mediaUri) && !["extract", "asr"].includes(step.key || "");
  return (
    <article className={cx("source-step-card", step.status)}>
      <div className="source-step-head">
        <span className="source-step-index">{step.status === "running" ? <Loader2 className="spin" size={14} /> : step.status === "failed" ? <XCircle size={14} /> : step.status === "done" ? <CheckCircle2 size={14} /> : "•"}</span>
        <div>
          <strong>{displayLabel}</strong>
          <small>{displayMessage}</small>
        </div>
      </div>
      {step.url && step.key !== "extract" && <a className="source-url" href={step.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />{step.url}</a>}
      {hasMedia && (
        step.mediaType === "video"
          ? <video className="source-media" controls src={step.mediaUri} />
          : <audio className="source-audio" controls src={step.mediaUri} />
      )}
      {displayText && <pre className="source-output">{displayText}</pre>}
      {showOutputJson && (
        <div className="source-kv">
          {outputMetrics.map((item) => (
            <span key={item.key}><b>{item.label}</b>{item.value}</span>
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
  busy,
  onOpenExtraction
}: {
  state: State;
  action: AppAction;
  onCreated: (id: string) => void;
  inputText: string;
  setInputText: (value: string) => void;
  busy: string;
  onOpenExtraction: () => void;
}) {
  const [title, setTitle] = useState("");
  const [requirements, setRequirements] = useState("");
  const [mode, setMode] = useState<WorkMode>("manual");
  const [scriptModelId, setScriptModelId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [ttsModelId, setTtsModelId] = useState("");
  const [audioPlaybackSpeed, setAudioPlaybackSpeed] = useState(1);
  const [avatarAssetId, setAvatarAssetId] = useState("");
  const [backgroundMusicAssetId, setBackgroundMusicAssetId] = useState("");
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.2);
  const [generateSubtitles, setGenerateSubtitles] = useState(false);
  const [polishOpen, setPolishOpen] = useState(false);
  useEffect(() => {
    setScriptModelId((current) => current || localTextModelId(state));
  }, [state.settings?.defaultTextModelId, state.settings?.defaultModelIds?.llm, state.models]);
  useEffect(() => {
    setTtsModelId((current) => current || defaultModelIdForType(state, "tts"));
  }, [state.settings?.defaultModelIds?.tts, state.models]);

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
          manualScript: true,
          mode,
          reviewEnabled: mode === "manual",
          generateSubtitles: mode === "auto" ? generateSubtitles : false,
          voiceId: mode === "auto" ? voiceId : "",
          ttsModelId: ttsModelId || defaultModelIdForType(state, "tts"),
          audioPlaybackSpeed,
          avatarAssetId: mode === "auto" ? avatarAssetId : "",
          backgroundMusicAssetId,
          backgroundMusicVolume,
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
    setScriptModelId(localTextModelId(state));
    setVoiceId("");
    setTtsModelId(defaultModelIdForType(state, "tts"));
    setAudioPlaybackSpeed(1);
    setAvatarAssetId("");
    setBackgroundMusicAssetId("");
    setBackgroundMusicVolume(0.2);
    setGenerateSubtitles(false);
  }
  const submitLabel = mode === "auto" ? "创建并自动生成" : "创建手动任务";
  const submitting = busy === "创建任务" || busy === "创建任务并提交自动流程";
  const selectedBackgroundMusic = state.musicAssets.find((asset) => asset.id === backgroundMusicAssetId);
  const selectedVoice = state.voices.find((voice) => voice.id === voiceId);
  const selectedAvatarAsset = state.avatarAssets.find((asset) => asset.id === avatarAssetId);
  const selectedTtsModel = state.models.find((model) => model.id === (ttsModelId || defaultModelIdForType(state, "tts")));

  return (
    <section className="composer">
      <form onSubmit={submit}>
        <div className="mode-switch" role="group" aria-label="任务模式">
          <button type="button" className={cx(mode === "manual" && "active")} onClick={() => setMode("manual")}>手动模式</button>
          <button type="button" className={cx(mode === "auto" && "active")} onClick={() => setMode("auto")}>全自动模式</button>
        </div>
        <div className="task-create-toolbar">
          <button type="button" className="ghost-button extraction-entry-button" onClick={onOpenExtraction}><Download size={15} />链接解析</button>
        </div>
        <FieldCard title="任务标题" meta={title ? compactDisplay(title, 18) : "可选"}>
          <label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="可选；不填会自动生成短标题" />
          </label>
        </FieldCard>
        <FieldCard title="输入内容" meta={inputText ? `${inputText.trim().length} 字` : "必填"}>
          <label>
            <div className="label-head">
              <span>原始输入</span>
              <button type="button" className="text-button" disabled={busy === "AI润色"} onClick={() => setPolishOpen(true)}>
              {busy === "AI润色" ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />}
              AI润色
              </button>
            </div>
            <textarea required value={inputText} onChange={(event) => setInputText(event.target.value)} placeholder="输入主题、需求、参考信息" />
          </label>
        </FieldCard>
        {mode === "manual" ? (
          <div className="composer-grid compact">
            <BackgroundMusicField state={state} selectedBackgroundMusic={selectedBackgroundMusic} backgroundMusicAssetId={backgroundMusicAssetId} setBackgroundMusicAssetId={setBackgroundMusicAssetId} backgroundMusicVolume={backgroundMusicVolume} setBackgroundMusicVolume={setBackgroundMusicVolume} />
            <FieldCard title="语音模型" meta={selectedTtsModel?.name || "默认"}>
              <TtsModelSelect state={state} value={ttsModelId} onChange={setTtsModelId} hideLabel />
            </FieldCard>
          </div>
        ) : (
          <div className="composer-grid auto-layout">
            <div className="composer-audio-column">
              <BackgroundMusicField state={state} selectedBackgroundMusic={selectedBackgroundMusic} backgroundMusicAssetId={backgroundMusicAssetId} setBackgroundMusicAssetId={setBackgroundMusicAssetId} backgroundMusicVolume={backgroundMusicVolume} setBackgroundMusicVolume={setBackgroundMusicVolume} />
              <FieldCard title="语音模型" meta={selectedTtsModel?.name || "默认"}>
                <TtsModelSelect state={state} value={ttsModelId} onChange={setTtsModelId} hideLabel />
              </FieldCard>
              <FieldCard title="口播速度" meta={`${audioPlaybackSpeed}x`}>
                <SpeedSelect value={audioPlaybackSpeed} onChange={setAudioPlaybackSpeed} hideLabel />
              </FieldCard>
              <FieldCard title="音色" meta={selectedVoice?.name || "默认音色"}>
                <label><select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">默认音色</option>{state.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
                <VoiceSample asset={selectedVoice} />
              </FieldCard>
              <FieldCard title="字幕" meta={generateSubtitles ? "生成" : "不生成"}>
                <Toggle checked={generateSubtitles} onChange={setGenerateSubtitles} label="生成字幕" />
              </FieldCard>
            </div>
            <div className="composer-avatar-column">
              <FieldCard title="数字人素材" meta={selectedAvatarAsset?.name || "未选择"}>
                <label><select value={avatarAssetId} onChange={(event) => setAvatarAssetId(event.target.value)}><option value="">请选择数字人素材</option>{state.avatarAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                <AvatarSample asset={selectedAvatarAsset} />
              </FieldCard>
            </div>
          </div>
        )}
        <div className="toolbar-row">
          <button className="primary-button" disabled={submitting || !inputText.trim()}>
            {submitting ? <Loader2 className="spin" size={17} /> : <Play size={17} />}
            {submitting ? "创建中" : submitLabel}
          </button>
        </div>
      </form>
      {polishOpen && (
        <PolishDialog
          state={state}
          action={action}
          inputText={inputText}
          requirements={requirements}
          scriptModelId={scriptModelId}
          busy={busy}
          onClose={() => setPolishOpen(false)}
          onApply={({ text, requirements: nextRequirements, scriptModelId: nextModelId }) => {
            setInputText(text);
            setRequirements(nextRequirements);
            setScriptModelId(nextModelId);
            setPolishOpen(false);
          }}
        />
      )}
    </section>
  );
}

function FieldCard({
  title,
  meta,
  children,
  defaultOpen = true
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="field-card" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {meta && <small>{meta}</small>}
        <ChevronDown size={15} />
      </summary>
      <div className="field-card-body">{children}</div>
    </details>
  );
}

function BackgroundMusicField({
  state,
  selectedBackgroundMusic,
  backgroundMusicAssetId,
  setBackgroundMusicAssetId,
  backgroundMusicVolume,
  setBackgroundMusicVolume
}: {
  state: State;
  selectedBackgroundMusic?: Asset;
  backgroundMusicAssetId: string;
  setBackgroundMusicAssetId: (value: string) => void;
  backgroundMusicVolume: number;
  setBackgroundMusicVolume: (value: number) => void;
}) {
  return (
    <FieldCard title="背景音乐" meta={selectedBackgroundMusic?.name || "不使用"}>
      <label>
        <select value={backgroundMusicAssetId} onChange={(event) => setBackgroundMusicAssetId(event.target.value)}>
          <option value="">不使用背景音乐</option>
          {state.musicAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
        </select>
      </label>
      {selectedBackgroundMusic && (
        <div className="media-control-block">
          <VolumeAudioPreview src={selectedBackgroundMusic.uri} volume={backgroundMusicVolume} onVolumeChange={setBackgroundMusicVolume} />
        </div>
      )}
    </FieldCard>
  );
}

function PolishDialog({
  state,
  action,
  inputText,
  requirements,
  scriptModelId,
  busy,
  onApply,
  onClose
}: {
  state: State;
  action: AppAction;
  inputText: string;
  requirements: string;
  scriptModelId: string;
  busy: string;
  onApply: (result: { text: string; requirements: string; scriptModelId: string }) => void;
  onClose: () => void;
}) {
  const [draftInputText, setDraftInputText] = useState(inputText);
  const [draftRequirements, setDraftRequirements] = useState(requirements);
  const [draftTemplateId, setDraftTemplateId] = useState("");
  const draftModelId = scriptModelId || localTextModelId(state);
  const [versions, setVersions] = useState<Array<{ id: string; label: string; text: string; requirements: string; scriptModelId: string; createdAt: string }>>([]);
  const [activeVersionId, setActiveVersionId] = useState("");
  const polishing = busy === "AI润色";
  const activeVersion = versions.find((version) => version.id === activeVersionId) || versions[0];
  const templates = getRequirementTemplates(state);
  const applyRequirementTemplate = (templateId: string) => {
    setDraftTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    setDraftRequirements(template?.value || "");
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function confirm() {
    const response = await action("AI润色", () => request<{ text: string }>("/api/text/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputText: draftInputText, requirements: draftRequirements, scriptModelId: draftModelId })
    }));
    if (response?.text) {
      setVersions((current) => {
        const nextVersion = {
          id: `polish-${Date.now()}`,
          label: `V${current.length + 1}`,
          text: response.text,
          requirements: draftRequirements,
          scriptModelId: draftModelId,
          createdAt: new Date().toISOString()
        };
        setActiveVersionId(nextVersion.id);
        return [...current, nextVersion];
      });
    }
  }

  function useVersion(version: { text: string; requirements: string; scriptModelId: string }) {
    onApply({ text: version.text, requirements: version.requirements, scriptModelId: version.scriptModelId });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="polish-modal" role="dialog" aria-modal="true" aria-label="AI润色">
        <div className="modal-head">
          <h2>AI润色</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </div>
        <div className="polish-body">
          <label><span>输入内容</span><textarea value={draftInputText} onChange={(event) => setDraftInputText(event.target.value)} placeholder="输入或粘贴需要润色的口播内容" /></label>
          <label><span>生成要求模板</span><select value={draftTemplateId} onChange={(event) => applyRequirementTemplate(event.target.value)}><option value="">不使用</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
          <label><span>生成要求</span><textarea value={draftRequirements} onChange={(event) => setDraftRequirements(event.target.value)} placeholder="语气、时长、平台风格、受众" /></label>
          <section className="polish-result-panel">
            <div className="section-head">
              <div><p className="eyebrow">润色结果</p><h3>版本输出</h3></div>
              <span className="count-pill">{versions.length}</span>
            </div>
            {versions.length ? (
              <>
                <div className="version-tabs" role="tablist" aria-label="润色结果版本">
                  {versions.map((version) => (
                    <button
                      type="button"
                      key={version.id}
                      role="tab"
                      aria-selected={activeVersion?.id === version.id}
                      className={cx("version-tab", activeVersion?.id === version.id && "active")}
                      onClick={() => setActiveVersionId(version.id)}
                    >
                      {version.label}
                    </button>
                  ))}
                </div>
                {activeVersion && (
                  <article className="polish-version-output">
                    <div className="section-head compact">
                      <button type="button" className="primary-button" onClick={() => useVersion(activeVersion)}><CheckCircle2 size={16} />使用</button>
                    </div>
                    <textarea readOnly value={activeVersion.text} aria-label={`${activeVersion.label} 润色结果`} />
                    <small>{formatDate(activeVersion.createdAt)} · {activeVersion.text.length} 字</small>
                  </article>
                )}
              </>
            ) : <EmptyState text="点击开始润色后，会在这里生成 V1、V2 等多个结果版本。" />}
          </section>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>取消</button>
          <button type="button" className="primary-button" disabled={polishing || !draftInputText.trim()} onClick={confirm}>
            {polishing ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            {polishing ? "润色中" : "开始润色"}
          </button>
        </div>
      </section>
    </div>
  );
}

function providerTextModelValue(provider: ApiProviderRecord) {
  return `provider:${provider.id}`;
}

function localTextModelId(state: State) {
  return state.models.find((model) => model.type === "llm" && !String(model.id).startsWith("provider:"))?.id || "";
}

function normalizeTextModelValue(state: State, value = "") {
  const fallback = localTextModelId(state);
  const selected = value || fallback;
  if (!selected.startsWith("provider:")) return selected;
  const providerKey = selected.replace("provider:", "");
  const provider = state.apiProviders.find((item) => item.id === providerKey || item.providerId === providerKey);
  return provider ? providerTextModelValue(provider) : selected;
}

function defaultModelIdForType(state: State, type: ModelTypeKey) {
  if (type === "llm") return localTextModelId(state);
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

function TtsModelSelect({ state, value, onChange, hideLabel = false }: { state: State; value: string; onChange: (value: string) => void; hideLabel?: boolean }) {
  const models = state.models.filter((model) => model.type === "tts");
  return (
    <label>
      {!hideLabel && <span>语音模型</span>}
      <select value={value || defaultModelIdForType(state, "tts")} onChange={(event) => onChange(event.target.value)}>
        {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
      </select>
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  format,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const display = format ? format(value) : `${Number(value).toFixed(step < 0.1 ? 2 : 1)}${unit}`;
  return (
    <label className="range-field">
      <span>{label}<strong>{display}</strong></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SpeedSelect({ value, onChange, hideLabel = false }: { value: number; onChange: (value: number) => void; hideLabel?: boolean }) {
  return (
    <div className="speed-field">
      {!hideLabel && <span>口播速度</span>}
      <div className="speed-options" role="group" aria-label="口播速度">
        {audioSpeedOptions.map((option) => (
          <button
            type="button"
            key={option}
            className={cx(Math.abs(value - option) < 0.01 && "active")}
            onClick={() => onChange(option)}
          >
            {option}x
          </button>
        ))}
      </div>
    </div>
  );
}

function VolumeAudioPreview({ src, volume, onVolumeChange }: { src: string; volume: number; onVolumeChange?: (value: number) => void }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.volume = Math.max(0, Math.min(1, Number(volume) || 0));
  }, [volume, src]);
  return <audio ref={ref} className="inline-audio" controls src={src} onVolumeChange={(event) => onVolumeChange?.(event.currentTarget.volume)} />;
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
  const [ttsModelId, setTtsModelId] = useState("");
  const [audioPlaybackSpeed, setAudioPlaybackSpeed] = useState(1);
  const [avatarAssetId, setAvatarAssetId] = useState("");
  const [backgroundMusicAssetId, setBackgroundMusicAssetId] = useState("");
  const [backgroundMusicVolume, setBackgroundMusicVolume] = useState(0.2);
  const [generateSubtitles, setGenerateSubtitles] = useState(false);
  const [videoSettings, setVideoSettings] = useState<VideoSettings>(defaultVideoSettings);
  const currentStage = project ? getVisibleStage(project) : "script";
  const [activeStage, setActiveStage] = useState<StageKey>(currentStage);
  const [selectedScriptVersionId, setSelectedScriptVersionId] = useState("");
  const [selectedAudioVersionId, setSelectedAudioVersionId] = useState("");
  const [selectedVideoVersionId, setSelectedVideoVersionId] = useState("");
  const [publishDraft, setPublishDraft] = useState<PublishRecord | null>(null);
  const [publishingPlatform, setPublishingPlatform] = useState<Platform | "">("");
  const lastAutoStageRef = useRef<StageKey>(currentStage);
  const voiceDirtyRef = useRef(false);
  const currentVersionId = (project?.videoVersions || project?.versions || []).find((version) => version.isCurrent)?.id || "";

  useEffect(() => {
    setInputText(project?.inputText || "");
    setRequirements(project?.requirements || "");
    const projectScriptModelId = project?.scriptModelId || "";
    setScriptModelId(projectScriptModelId && !projectScriptModelId.startsWith("provider:") ? projectScriptModelId : localTextModelId(state));
    setVoiceId(project?.voiceId || "");
    setTtsModelId(project?.ttsModelId || defaultModelIdForType(state, "tts"));
    setAudioPlaybackSpeed(project?.audioPlaybackSpeed || 1);
    voiceDirtyRef.current = false;
    setAvatarAssetId(project?.avatarAssetId || "");
    setBackgroundMusicAssetId(project?.backgroundMusicAssetId || "");
    setBackgroundMusicVolume(project?.backgroundMusicVolume ?? 0.2);
    setGenerateSubtitles(Boolean(project?.generateSubtitles));
  }, [project?.id]);

  useEffect(() => {
    if (!project || voiceDirtyRef.current) return;
    setVoiceId(project.voiceId || "");
  }, [project?.voiceId]);

  useEffect(() => {
    if (!project) return;
    setTtsModelId((current) => current || project.ttsModelId || defaultModelIdForType(state, "tts"));
  }, [project?.ttsModelId, state.settings?.defaultModelIds?.tts, state.models]);

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
      body: JSON.stringify({ script: inputText, inputText, requirements, voiceId, ttsModelId, audioPlaybackSpeed, scriptModelId, changedStage: "script" })
    }));

  const saveVideoSetup = () =>
    action("保存视频设置", () => request<Project>(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarAssetId, backgroundMusicAssetId, backgroundMusicVolume, generateSubtitles, videoSettings, changedStage: "video" })
      }));

  const generateVoice = () =>
    action("生成口播音频", async () => {
      const updated = await request<Project>(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: inputText, inputText, requirements, voiceId, ttsModelId, audioPlaybackSpeed, scriptModelId, changedStage: "script" })
      });
      const scriptVersionId = updated.selectedScriptVersionId || updated.scriptVersions?.[0]?.id || "";
      await request<Project>(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, ttsModelId, audioPlaybackSpeed, selectedScriptVersionId: scriptVersionId, changedStage: "voice" })
      });
      voiceDirtyRef.current = false;
      return request(`/api/projects/${project.id}/synthesize-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptVersionId, voiceId, ttsModelId, audioPlaybackSpeed })
      });
    });

  const importAudioVersion = (file?: File, voiceName?: string) =>
    action(file ? "录制口播音频" : "使用原始音频", async () => {
      const body = new FormData();
      if (file) body.append("audio", file);
      if (voiceName) body.append("voiceName", voiceName);
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
        body: JSON.stringify({ avatarAssetId, backgroundMusicAssetId, backgroundMusicVolume, generateSubtitles, selectedAudioVersionId, videoSettings, changedStage: "video" })
      });
      return request(`/api/projects/${project.id}/render-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoSettings, generateSubtitles, audioVersionId: selectedAudioVersionId, avatarAssetId, backgroundMusicAssetId, backgroundMusicVolume })
      });
    });

  const generateVideoPreview = () =>
    action("生成3秒预览", async () => {
      await request<Project>(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarAssetId, backgroundMusicAssetId, backgroundMusicVolume, generateSubtitles, selectedAudioVersionId, videoSettings, changedStage: "video" })
      });
      return request(`/api/projects/${project.id}/render-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoSettings, generateSubtitles, audioVersionId: selectedAudioVersionId, avatarAssetId, backgroundMusicAssetId, backgroundMusicVolume })
      });
    });

  async function preparePublish(platform: Platform) {
    setPublishingPlatform(platform);
    try {
      const payload = await action("打开发布入口", () => request<PublishRecord>(`/api/projects/${currentProject.id}/publish/${platform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoVersionId: selectedVideoVersionId })
      }));
      if (payload) {
        setPublishDraft(payload);
      }
    } finally {
      setPublishingPlatform("");
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
  const musicAssets = state.musicAssets || [];
  const selectedMusic = musicAssets.find((asset) => asset.id === backgroundMusicAssetId);
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
        setVoiceId={(value) => {
          voiceDirtyRef.current = true;
          setVoiceId(value);
        }}
        ttsModelId={ttsModelId}
        setTtsModelId={setTtsModelId}
        audioPlaybackSpeed={audioPlaybackSpeed}
        setAudioPlaybackSpeed={setAudioPlaybackSpeed}
        selectedVoice={selectedVoice}
        generateVoice={generateVoice}
        importAudioVersion={importAudioVersion}
        selectedAudioVersionId={selectedAudioVersionId}
        setSelectedAudioVersionId={setSelectedAudioVersionId}
        avatarAssetId={avatarAssetId}
        setAvatarAssetId={setAvatarAssetId}
        selectedAsset={selectedAsset}
        backgroundMusicAssetId={backgroundMusicAssetId}
        setBackgroundMusicAssetId={setBackgroundMusicAssetId}
        backgroundMusicVolume={backgroundMusicVolume}
        setBackgroundMusicVolume={setBackgroundMusicVolume}
        selectedMusic={selectedMusic}
        generateSubtitles={generateSubtitles}
        setGenerateSubtitles={setGenerateSubtitles}
        videoSettings={videoSettings}
        setVideoSettings={setVideoSettings}
        saveVideoSetup={saveVideoSetup}
        generateVideo={generateVideo}
        generateVideoPreview={generateVideoPreview}
        selectedVideoVersionId={selectedVideoVersionId}
        setSelectedVideoVersionId={setSelectedVideoVersionId}
        publishDraft={publishDraft}
        publishingPlatform={publishingPlatform}
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
  ttsModelId,
  setTtsModelId,
  audioPlaybackSpeed,
  setAudioPlaybackSpeed,
  selectedVoice,
  generateVoice,
  importAudioVersion,
  selectedAudioVersionId,
  setSelectedAudioVersionId,
  avatarAssetId,
  setAvatarAssetId,
  selectedAsset,
  backgroundMusicAssetId,
  setBackgroundMusicAssetId,
  backgroundMusicVolume,
  setBackgroundMusicVolume,
  selectedMusic,
  generateSubtitles,
  setGenerateSubtitles,
  videoSettings,
  setVideoSettings,
  saveVideoSetup,
  generateVideo,
  generateVideoPreview,
  selectedVideoVersionId,
  setSelectedVideoVersionId,
  publishDraft,
  publishingPlatform,
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
  ttsModelId: string;
  setTtsModelId: (value: string) => void;
  audioPlaybackSpeed: number;
  setAudioPlaybackSpeed: (value: number) => void;
  selectedVoice?: Asset;
  generateVoice: () => Promise<unknown>;
  importAudioVersion: (file?: File, voiceName?: string) => Promise<unknown>;
  selectedAudioVersionId: string;
  setSelectedAudioVersionId: (value: string) => void;
  avatarAssetId: string;
  setAvatarAssetId: (value: string) => void;
  selectedAsset?: Asset;
  backgroundMusicAssetId: string;
  setBackgroundMusicAssetId: (value: string) => void;
  backgroundMusicVolume: number;
  setBackgroundMusicVolume: (value: number) => void;
  selectedMusic?: Asset;
  generateSubtitles: boolean;
  setGenerateSubtitles: (value: boolean) => void;
  videoSettings: VideoSettings;
  setVideoSettings: React.Dispatch<React.SetStateAction<VideoSettings>>;
  saveVideoSetup: () => Promise<Project | undefined>;
  generateVideo: () => Promise<unknown>;
  generateVideoPreview: () => Promise<unknown>;
  selectedVideoVersionId: string;
  setSelectedVideoVersionId: (value: string) => void;
  publishDraft: PublishRecord | null;
  publishingPlatform: Platform | "";
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
  const musicAssets = state.musicAssets || [];
  const selectedAudioVersion = audioVersions.find((version) => version.id === selectedAudioVersionId) || audioVersions[0];
  const selectedVideoVersion = videoVersions.find((version) => version.id === selectedVideoVersionId) || videoVersions[0];
  const nextStage = visibleStageOrder[visibleStageOrder.indexOf(activeStage) + 1];
  const canGoNext = project.mode === "manual" && Boolean(nextStage && canEnterStage(project, nextStage));
  const copyPublishField = (value: string) => copyTextToClipboard(value).catch(() => undefined);
  const savingScript = busy === "保存口播文案";
  const savingVideoSetup = busy === "保存视频设置";
  const savingSourceAudio = busy === "使用原始音频";
  const recordingPublish = busy === "记录发布结果";
  const templates = getRequirementTemplates(state);
  const applyRequirementTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
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
      {["voice", "video"].includes(activeStage) && <StageTaskPanel queueItems={stageQueues} action={action} />}

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
          <label><span>生成要求模板</span><select value="" onChange={(event) => applyRequirementTemplate(event.target.value)}><option value="">选择模板</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
          <label><span>生成要求</span><input value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="语气、时长、平台风格、受众" /></label>
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
          <label>
            <span>口播内容</span>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="输入或粘贴需要合成语音的口播内容"
            />
          </label>
          <div className="field-row">
            <label><span>音色</span><select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">默认音色</option>{state.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
            <TtsModelSelect state={state} value={ttsModelId} onChange={setTtsModelId} />
          </div>
          <SpeedSelect value={audioPlaybackSpeed} onChange={setAudioPlaybackSpeed} />
          <VoiceSample asset={selectedVoice} />
          <div className="step-actions">
            <ActionButton label="生成口播音频" busy={busy} disabled={!inputText.trim()} onClick={generateVoice} />
            <button className="ghost-button" disabled={savingSourceAudio || !project.sourceAnalysis?.links?.some((link) => link.audioUri)} onClick={() => importAudioVersion()}>
              {savingSourceAudio ? <Loader2 className="spin" size={15} /> : <Save size={15} />}
              {savingSourceAudio ? "保存中" : "使用原始音频"}
            </button>
            <AudioRecorder label="录制口播音频" onRecorded={(file) => importAudioVersion(file, "录制音频")} />
          </div>
          <AudioVersionList project={project} versions={audioVersions} selectedId={selectedAudioVersionId} onSelect={setSelectedAudioVersionId} action={action} />
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
          <label>
            <span>背景音乐</span>
            <select value={backgroundMusicAssetId} onChange={(event) => setBackgroundMusicAssetId(event.target.value)}>
              <option value="">不使用背景音乐</option>
              {musicAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </label>
          {selectedMusic && (
            <div className="media-control-block">
              <VolumeAudioPreview src={selectedMusic.uri} volume={backgroundMusicVolume} onVolumeChange={setBackgroundMusicVolume} />
            </div>
          )}
          <Toggle checked={generateSubtitles} onChange={setGenerateSubtitles} label="生成字幕" />
          <div className="preset-row">
            <code>最佳参数模式：MediaPipe 智能裁剪 / 稳定融合 / 上边界 0.50</code>
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
              <button key={platform} className="primary-link" disabled={Boolean(publishingPlatform) || !selectedVideoVersion} onClick={() => preparePublish(platform)}>
                {publishingPlatform === platform ? <Loader2 className="spin" size={16} /> : <ExternalLink size={16} />}
                {publishingPlatform === platform ? "打开中" : platformLabels[platform]}
              </button>
            ))}
            {selectedVideoVersion && <a className="secondary-button" href={selectedVideoVersion.artifact.video.uri} download><Download size={16} />下载视频</a>}
          </div>
          <small>点击平台会打开创作者后台，并使用 Playwright 尝试上传视频、填写标题和正文；最终发布仍需用户在平台页面确认。</small>
          {publishDraft && (
            <OutputItem title={`${publishDraft.platformLabel}自动发布结果`} status={publishDraft.automationStatus || publishDraft.status} meta={publishDraft.automationMessage || publishDraft.videoVersionLabel || "当前视频版本"}>
              <div className="publish-draft-grid">
                {publishDraft.automationStepDetails?.length ? (
                  <div className="publish-step-list">
                    {publishDraft.automationStepDetails.map((step) => (
                      <div key={step.id} className={cx("publish-step-item", step.status)}>
                        <strong>{step.label}</strong>
                        <span>{statusText(step.status)}</span>
                        {step.message && <small>{step.message}</small>}
                      </div>
                    ))}
                  </div>
                ) : publishDraft.automationSteps?.length ? (
                  <label className="publish-package-field"><span>自动化步骤</span><textarea readOnly value={publishDraft.automationSteps.join("\n")} /></label>
                ) : null}
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
              <small>{formatDate(version.createdAt)}</small>
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

function AudioVersionList({ project, versions, selectedId, onSelect, action }: { project: Project; versions: AudioVersion[]; selectedId: string; onSelect: (id: string) => void; action: AppAction }) {
  const activeVersion = versions.find((version) => version.id === selectedId) || versions[0];
  const deleteVersion = (version: AudioVersion) => {
    if (!window.confirm(`删除口播音频版本「${version.label}」？`)) return;
    action("删除口播音频版本", () => request(`/api/projects/${project.id}/audio-versions/${version.id}`, { method: "DELETE" }));
  };
  useEffect(() => {
    if (!selectedId && versions[0]) onSelect(versions[0].id);
  }, [selectedId, versions, onSelect]);
  return (
    <section className="version-panel">
      <div className="section-head">
        <div><p className="eyebrow">输出版本</p><h3>口播音频版本</h3></div>
        <span className="count-pill">{versions.length}</span>
      </div>
      {versions.length ? (
        <div className="audio-version-tabs">
          <div className="version-tabs" role="tablist" aria-label="口播音频版本">
            {versions.map((version) => (
              <button
                key={version.id}
                type="button"
                role="tab"
                aria-selected={version.id === activeVersion?.id}
                className={cx("version-tab", version.id === activeVersion?.id && "active")}
                onClick={() => onSelect(version.id)}
              >
                {version.label}
              </button>
            ))}
          </div>
          {activeVersion && (
            <article className="audio-version-detail" role="tabpanel">
              <div>
                <strong>{activeVersion.voiceName || "默认音色"}</strong>
                <small>{formatDate(activeVersion.createdAt)} · {formatDurationMs(Number(activeVersion.duration || 0) * 1000)}</small>
              </div>
              <audio controls src={activeVersion.audioUri} />
              {activeVersion.transcriptText && <p>{activeVersion.transcriptText}</p>}
              <div className="version-actions">
                <button className="text-button danger-text" onClick={() => deleteVersion(activeVersion)}>删除当前版本</button>
              </div>
            </article>
          )}
        </div>
      ) : <EmptyState text="还没有口播音频版本。" />}
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

function AssetLibrary({ state, refresh, action }: { state: State; refresh: () => Promise<void>; action: AppAction }) {
  const [activeTab, setActiveTab] = useState<"avatar" | "music" | "requirements">("avatar");
  const avatarAssets = state.avatarAssets || [];
  const musicAssets = state.musicAssets || [];
  const templates = getRequirementTemplates(state);
  return (
    <section className="manager-page asset-library">
      <div className="library-tabs" role="tablist" aria-label="素材类型">
        <button type="button" role="tab" className={cx(activeTab === "avatar" && "active")} onClick={() => setActiveTab("avatar")}>视频素材<span>{avatarAssets.length}</span></button>
        <button type="button" role="tab" className={cx(activeTab === "music" && "active")} onClick={() => setActiveTab("music")}>背景音素材<span>{musicAssets.length}</span></button>
        <button type="button" role="tab" className={cx(activeTab === "requirements" && "active")} onClick={() => setActiveTab("requirements")}>生成要求模板<span>{templates.length}</span></button>
      </div>
      {activeTab === "avatar" && <AssetManager title="数字人素材" kind="avatar" items={avatarAssets} refresh={refresh} action={action} />}
      {activeTab === "music" && <AssetManager title="背景音素材" kind="music" items={musicAssets} refresh={refresh} action={action} />}
      {activeTab === "requirements" && <RequirementTemplateManager items={templates} action={action} />}
    </section>
  );
}

function RequirementTemplateManager({ items, action }: { items: RequirementTemplate[]; action: AppAction }) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingLabel, setEditingLabel] = useState("");
  const [editingValue, setEditingValue] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await action("新增生成要求模板", () => request("/api/requirement-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, value })
    }));
    setLabel("");
    setValue("");
  }

  function startEdit(item: RequirementTemplate) {
    setEditingId(item.id);
    setEditingLabel(item.label);
    setEditingValue(item.value);
  }

  async function saveEdit() {
    if (!editingId) return;
    await action("编辑生成要求模板", () => request(`/api/requirement-templates/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editingLabel, value: editingValue })
    }));
    setEditingId("");
    setEditingLabel("");
    setEditingValue("");
  }

  function deleteTemplate(item: RequirementTemplate) {
    if (!window.confirm(`删除生成要求模板「${item.label}」？`)) return;
    action("删除生成要求模板", () => request(`/api/requirement-templates/${item.id}`, { method: "DELETE" }));
  }

  return (
    <section className="manager-page">
      <div className="manager-toolbar">
        <div><p className="eyebrow">提示词资产</p><h2>生成要求模板</h2><small>创建任务、任务步骤和体验中心 AI 润色会共用这里的模板。</small></div>
      </div>
      <form className="template-editor" onSubmit={submit}>
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="模板名称" />
        <textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="生成要求内容" />
        <button className="primary-button" disabled={!label.trim() || !value.trim()}><Plus size={16} />新增模板</button>
      </form>
      <DataTable
        columns={["模板名称", "生成要求", "更新时间", "操作"]}
        template="minmax(160px, .55fr) minmax(320px, 1.4fr) 130px 160px"
        rows={items.map((item) => [
          editingId === item.id ? <input value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} /> : <strong>{item.label}</strong>,
          editingId === item.id ? <textarea className="table-textarea" value={editingValue} onChange={(event) => setEditingValue(event.target.value)} /> : <span className="table-long-text">{item.value}</span>,
          formatDate(item.updatedAt || item.createdAt || new Date().toISOString()),
          <span className="table-actions">
            {editingId === item.id ? (
              <>
                <button className="text-button" onClick={saveEdit} disabled={!editingLabel.trim() || !editingValue.trim()}><Save size={14} />保存</button>
                <button className="text-button" onClick={() => setEditingId("")}><X size={14} />取消</button>
              </>
            ) : (
              <>
                <button className="text-button" onClick={() => startEdit(item)}><Pencil size={14} />编辑</button>
                <button className="text-button danger-text" onClick={() => deleteTemplate(item)}><Trash2 size={14} />删除</button>
              </>
            )}
          </span>
        ])}
      />
    </section>
  );
}

function AssetManager({ title, kind, items, refresh, action }: { title: string; kind: "avatar" | "voice" | "music"; items: Asset[]; refresh: () => Promise<void>; action: AppAction }) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [clipAssetId, setClipAssetId] = useState("");
  const [clipName, setClipName] = useState("");
  const [clipStart, setClipStart] = useState("0");
  const [clipEnd, setClipEnd] = useState("");
  const [uploading, setUploading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const filtered = items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  const uploadUrl = kind === "avatar" ? "/api/assets/avatar-videos" : kind === "music" ? "/api/assets/music" : "/api/voices/reference-samples";
  const endpointFor = (id: string) => kind === "avatar" ? `/api/assets/avatar-videos/${id}` : kind === "music" ? `/api/assets/music/${id}` : `/api/voices/reference-samples/${id}`;
  const entityLabel = kind === "avatar" ? "数字人素材" : kind === "music" ? "背景音素材" : "参考音色";
  const managerEyebrow = kind === "avatar" ? "视频素材管理" : kind === "music" ? "背景音管理" : "克隆参考音色";
  const nameLabel = kind === "avatar" ? "素材名称" : kind === "music" ? "背景音名称" : "音色名称";
  const fileLabel = kind === "avatar" ? "选择视频" : kind === "music" ? "选择背景音" : "选择参考音频";
  const uploadLabel = kind === "avatar" ? "上传素材" : kind === "music" ? "上传背景音" : "上传参考音色";
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
    if (!checkedIds.length || bulkDeleting) return;
    if (!window.confirm(`删除选中的 ${checkedIds.length} 个${entityLabel}？`)) return;
    const ids = [...checkedIds];
    setBulkDeleting(true);
    try {
      await action(`批量删除${entityLabel}`, async () => {
        await Promise.all(ids.map((id) => request(endpointFor(id), { method: "DELETE" })));
        return { ok: true };
      });
      setCheckedIds([]);
    } finally {
      setBulkDeleting(false);
    }
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
    setClipEnd("");
  }

  function cancelClip() {
    setClipAssetId("");
    setClipName("");
    setClipStart("0");
    setClipEnd("");
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
    await action(kind === "avatar" ? "生成素材片段" : kind === "music" ? "生成背景音片段" : "生成音色片段", () => request(kind === "avatar"
      ? `/api/assets/avatar-videos/${item.id}/clip`
      : kind === "music"
        ? `/api/assets/music/${item.id}/clip`
        : `/api/voices/reference-samples/${item.id}/clip`, {
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
        {kind === "music" && <AudioRecorder label="录制背景音" onRecorded={setFile} />}
        <button className="primary-button" disabled={uploading || !file}>{uploading ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}{uploading ? "上传中" : uploadLabel}</button>
      </form>
      <div className="bulk-toolbar manager-bulk-toolbar">
        <label className="checkbox-pill">
          <input type="checkbox" checked={allChecked} onChange={(event) => toggleAll(event.target.checked)} />
          全选
        </label>
        <button className="ghost-button danger" disabled={!checkedIds.length || bulkDeleting} onClick={deleteChecked}>
          {bulkDeleting ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
          {bulkDeleting ? "删除中" : "删除所选"}
        </button>
        {checkedIds.length > 0 && <small>已选 {checkedIds.length} 个</small>}
      </div>
      <DataTable
        columns={["", nameLabel, kind === "avatar" ? "预览" : "试听", "创建时间", "操作"]}
        template={kind === "avatar" ? "42px minmax(300px, 1.35fr) minmax(170px, .75fr) 120px 210px" : "42px minmax(220px, 1.2fr) minmax(180px, .9fr) 120px 190px"}
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
              kind={kind === "music" ? "voice" : kind}
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
          <MediaPreview item={item} kind={kind === "music" ? "voice" : kind} />,
          formatDate(item.createdAt),
          <span className="table-actions">
            <button className="text-button" onClick={() => startEdit(item)}><Pencil size={14} />编辑</button>
            <button className="text-button" onClick={() => startClip(item)}><Scissors size={14} />剪辑</button>
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
  kind,
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
  kind: "avatar" | "voice";
  clipName: string;
  setClipName: (value: string) => void;
  clipStart: string;
  setClipStart: (value: string) => void;
  clipEnd: string;
  setClipEnd: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  return (
    <MediaRangeEditor
      src={item.uri}
      mediaKind={kind === "avatar" ? "video" : "audio"}
      name={clipName}
      setName={setClipName}
      nameLabel={kind === "avatar" ? "新素材名称" : "新音色名称"}
      start={clipStart}
      setStart={setClipStart}
      end={clipEnd}
      setEnd={setClipEnd}
      actionLabel={kind === "avatar" ? "生成片段" : "生成音色片段"}
      actionIcon={kind === "avatar" ? "avatar" : "voice"}
      onSubmit={onCreate}
      onCancel={onCancel}
    />
  );
}

function MediaRangeEditor({
  src,
  mediaKind,
  name,
  setName,
  nameLabel,
  start,
  setStart,
  end,
  setEnd,
  actionLabel,
  actionIcon,
  onSubmit,
  onCancel
}: {
  src: string;
  mediaKind: "video" | "audio";
  name: string;
  setName: (value: string) => void;
  nameLabel: string;
  start: string;
  setStart: (value: string) => void;
  end: string;
  setEnd: (value: string) => void;
  actionLabel: string;
  actionIcon: "avatar" | "voice";
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const startValue = Math.max(0, Number(start) || 0);
  const endValue = Math.max(startValue + 0.1, Number(end) || startValue + 0.1);
  const maxDuration = Math.max(duration, endValue, 0.1);
  const selectedDuration = Math.max(0, endValue - startValue);
  const startPercent = Math.min(100, Math.max(0, (startValue / maxDuration) * 100));
  const endPercent = Math.min(100, Math.max(startPercent, (endValue / maxDuration) * 100));
  const canSubmit = Boolean(name.trim() && endValue > startValue);
  const Icon = actionIcon === "voice" ? Mic2 : Scissors;

  function syncVideo(time: number) {
    if (mediaRef.current && Number.isFinite(time)) mediaRef.current.currentTime = Math.max(0, Math.min(time, maxDuration));
  }

  function setRange(nextStart: number, nextEnd: number, focus: "start" | "end") {
    const safeStart = Math.max(0, Math.min(nextStart, maxDuration - 0.1));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(nextEnd, maxDuration));
    setStart(safeStart.toFixed(1));
    setEnd(safeEnd.toFixed(1));
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
    if (dragging === "start") setRange(Math.min(time, endValue - 0.1), endValue, "start");
    if (dragging === "end") setRange(startValue, Math.max(time, startValue + 0.1), "end");
  }

  function jumpToNearestHandle(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== trackRef.current) return;
    const time = timeFromPointer(event.clientX);
    const nearest = Math.abs(time - startValue) <= Math.abs(time - endValue) ? "start" : "end";
    if (nearest === "start") setRange(Math.min(time, endValue - 0.1), endValue, "start");
    if (nearest === "end") setRange(startValue, Math.max(time, startValue + 0.1), "end");
  }

  function handleMetadata(event: React.SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) {
    const nextDuration = event.currentTarget.duration;
    if (!Number.isFinite(nextDuration) || nextDuration <= 0) return;
    setDuration(nextDuration);
    if (!end) setEnd(nextDuration.toFixed(1));
    else if (Number(end) > nextDuration) setEnd(nextDuration.toFixed(1));
  }

  return (
    <div className={cx("clip-editor-panel", mediaKind === "audio" && "audio-editor")}>
      {mediaKind === "video" && (
        <div className="clip-preview">
          <video ref={(node) => { mediaRef.current = node; }} src={src} controls muted preload="metadata" onLoadedMetadata={handleMetadata} />
        </div>
      )}
      <div className="clip-controls">
        {mediaKind === "audio" && (
          <audio className="clip-audio-bar" ref={(node) => { mediaRef.current = node; }} src={src} controls preload="metadata" onLoadedMetadata={handleMetadata} />
        )}
        <div className="clip-title-row">
          <label>
            <span>{nameLabel}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} aria-label={nameLabel} placeholder={nameLabel} />
          </label>
          {onCancel && <button className="icon-mini" onClick={onCancel} aria-label="取消"><X size={14} /></button>}
        </div>
        <div className="clip-time-meta">
          <span>开始 {formatClipTime(startValue)}</span>
          <span>结束 {formatClipTime(endValue)}</span>
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
          <label><span>开始秒</span><input type="number" min="0" step="0.1" value={start} onChange={(event) => setRange(Number(event.target.value), endValue, "start")} /></label>
          <label><span>结束秒</span><input type="number" min="0.1" step="0.1" value={end} onChange={(event) => setRange(startValue, Number(event.target.value), "end")} /></label>
          <button className="ghost-button" onClick={onSubmit} disabled={!canSubmit}><Icon size={14} />{actionLabel}</button>
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
  return (
    <section className="manager-page">
      <div className="manager-toolbar">
        <div><p className="eyebrow">体验中心</p><h2>内容能力体验</h2></div>
      </div>
      <div className="model-type-tabs" role="tablist" aria-label="体验分类">
        {modelTypeTabs.map((tab) => (
          <button key={tab.id} role="tab" className={cx(activeType === tab.id && "active")} onClick={() => setActiveType(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeType === "llm" && <LlmTypeTestPanel state={state} action={action} />}
      {activeType === "tts" && <TtsTypeTestPanel state={state} voices={state.voices} action={action} />}
      {activeType === "avatar" && <AvatarTypeTestPanel state={state} action={action} />}
    </section>
  );
}

function RuntimeSettingsPanel({ state, action }: { state: State; action: AppAction }) {
  const settings = state.settings || {};
  const [pendingKey, setPendingKey] = useState("");
  const [pendingLabel, setPendingLabel] = useState("");
  const [draft, setDraft] = useState({
    videoConcurrency: settings.videoConcurrency || 1,
    avatarSegmentSeconds: settings.avatarSegmentSeconds || 30
  });
  useEffect(() => {
    setDraft({
      videoConcurrency: settings.videoConcurrency || 1,
      avatarSegmentSeconds: settings.avatarSegmentSeconds || 30
    });
  }, [settings.videoConcurrency, settings.avatarSegmentSeconds]);

  async function update(next: Partial<typeof draft>, key = "runtime", label = "保存中") {
    const payload = { ...draft, ...next };
    setDraft(payload);
    setPendingKey(key);
    setPendingLabel(label);
    try {
      await action("保存运行配置", () => request("/api/settings/runtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }));
    } finally {
      setPendingKey("");
      setPendingLabel("");
    }
  }

  return (
    <section className="runtime-settings">
      <div>
        <strong>运行配置</strong>
        <small>模型按需运行，完成后释放；这里仅配置视频合成参数。</small>
      </div>
      <label><span>视频合成并行度</span><input type="number" min="1" max="4" step="1" value={draft.videoConcurrency} onChange={(event) => update({ videoConcurrency: Number(event.target.value) }, "videoConcurrency")} /></label>
      <label><span>分段时间长度</span><input type="number" min="10" max="120" step="5" value={draft.avatarSegmentSeconds} onChange={(event) => update({ avatarSegmentSeconds: Number(event.target.value) }, "avatarSegmentSeconds")} /></label>
      {pendingKey && <small>{pendingLabel}</small>}
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
  const [prompt, setPrompt] = useState("把这段内容润色成适合短视频口播的自然中文：今天店里来了很多老顾客，大家都说环境越来越舒服。");
  const [requirements, setRequirements] = useState("");
  const [templateId, setTemplateId] = useState("");
  const scriptModelId = localTextModelId(state);
  const [result, setResult] = useState("");
  const [testing, setTesting] = useState(false);
  const templates = getRequirementTemplates(state);
  const applyTemplate = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    setRequirements(template?.value || "");
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    setTesting(true);
    try {
      const response = await action("AI润色", () => request<{ text: string }>("/api/text/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputText: prompt, requirements, scriptModelId })
      }));
      if (response?.text) setResult(response.text);
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="model-test-panel" onSubmit={submit}>
      <div><p className="eyebrow">体验</p><h3>AI润色</h3></div>
      <label><span>输入内容</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
      <label><span>生成要求模板</span><select value={templateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">不使用</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
      <label><span>生成要求</span><textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="语气、时长、平台风格、受众" /></label>
      <button className="primary-button" disabled={testing || !prompt.trim()}>{testing ? <Loader2 className="spin" size={16} /> : <Play size={16} />}{testing ? "润色中" : "开始润色"}</button>
      {result && <OutputItem title="润色结果" status="done"><p>{result}</p></OutputItem>}
    </form>
  );
}

function ModelTypeTestPanel({ type, models, state, action }: { type: Exclude<ModelTypeKey, "llm">; models: ModelRecord[]; state: State; action: AppAction }) {
  const defaultModelId = defaultModelIdForType(state, type);
  if (type === "asr") return <AsrTypeTestPanel state={state} models={models} defaultModelId={defaultModelId} action={action} />;
  if (type === "tts") return <TtsTypeTestPanel state={state} voices={state.voices} action={action} />;
  return <AvatarTypeTestPanel state={state} action={action} />;
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

function TtsTypeTestPanel({ state, voices, action }: { state: State; voices: Asset[]; action: AppAction }) {
  const [modelId, setModelId] = useState(defaultModelIdForType(state, "tts"));
  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState("这是一次音色克隆测试，请生成自然清晰的中文口播。");
  const [audioUri, setAudioUri] = useState("");
  const [testing, setTesting] = useState(false);
  const selectedVoice = voices.find((voice) => voice.id === voiceId);
  useEffect(() => {
    setVoiceId((current) => current || voices[0]?.id || "");
  }, [voices]);
  useEffect(() => {
    setModelId((current) => current || defaultModelIdForType(state, "tts"));
  }, [state.settings?.defaultModelIds?.tts, state.models]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTesting(true);
    try {
      const body = new FormData();
      body.append("text", text);
      body.append("modelId", modelId || defaultModelIdForType(state, "tts"));
      if (voiceId) body.append("voiceId", voiceId);
      const response = await action("生成试听", () => request<{ audio?: { uri: string } }>("/api/model-tests/tts", { method: "POST", body }));
      if (response?.audio?.uri) setAudioUri(response.audio.uri);
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="model-test-panel" onSubmit={submit}>
      <div><p className="eyebrow">体验</p><h3>音色试听</h3></div>
      <TtsModelSelect state={state} value={modelId} onChange={setModelId} />
      <label><span>音色</span><select value={voiceId} onChange={(event) => setVoiceId(event.target.value)}><option value="">请选择音色</option>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>
      <VoiceSample asset={selectedVoice} />
      <label><span>合成文本</span><textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
      <button className="primary-button" disabled={testing || !text.trim() || !voiceId || !modelId}>{testing ? <Loader2 className="spin" size={16} /> : <Play size={16} />}{testing ? "生成中" : "生成试听"}</button>
      {audioUri && <OutputItem title="试听音频" status="done"><audio controls src={audioUri} /></OutputItem>}
    </form>
  );
}

function AvatarTypeTestPanel({ state, action }: { state: State; action: AppAction }) {
  const [avatarAssetId, setAvatarAssetId] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [backgroundMusicAssetId, setBackgroundMusicAssetId] = useState("");
  const [videoUri, setVideoUri] = useState("");
  const [testing, setTesting] = useState(false);
  const selectedAvatarAsset = state.avatarAssets.find((asset) => asset.id === avatarAssetId);
  useEffect(() => {
    setAvatarAssetId((current) => current || state.avatarAssets[0]?.id || "");
  }, [state.avatarAssets]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTesting(true);
    try {
      const body = new FormData();
      body.append("avatarAssetId", avatarFile ? "" : avatarAssetId);
      body.append("backgroundMusicAssetId", backgroundMusicAssetId);
      if (avatarFile) body.append("avatar", avatarFile);
      if (audio) body.append("audio", audio);
      const response = await action("生成体验视频", () => request<{ video?: { uri: string } }>("/api/model-tests/avatar", { method: "POST", body }));
      if (response?.video?.uri) setVideoUri(response.video.uri);
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="model-test-panel" onSubmit={submit}>
      <div><p className="eyebrow">体验</p><h3>视频合成</h3></div>
      <label><span>数字人素材</span><select value={avatarAssetId} onChange={(event) => setAvatarAssetId(event.target.value)}><option value="">使用上传素材</option>{state.avatarAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
      {!avatarFile && <AvatarSample asset={selectedAvatarAsset} />}
      <label><span>背景音</span><select value={backgroundMusicAssetId} onChange={(event) => setBackgroundMusicAssetId(event.target.value)}><option value="">不使用背景音</option>{(state.musicAssets || []).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
      <div className="test-file-row">
        <label className="file-chip"><Upload size={16} />{avatarFile ? avatarFile.name : "上传人物视频"}<input type="file" accept="video/*" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} /></label>
        <label className="file-chip"><Upload size={16} />{audio ? audio.name : "上传口播音频"}<input type="file" accept="audio/*" onChange={(event) => setAudio(event.target.files?.[0] || null)} /></label>
        <AudioRecorder label="录制口播音频" onRecorded={setAudio} />
      </div>
      <button className="primary-button" disabled={testing || (!avatarAssetId && !avatarFile) || !audio}>{testing ? <Loader2 className="spin" size={16} /> : <Play size={16} />}{testing ? "生成中" : "生成体验视频"}</button>
      {videoUri && <OutputItem title="体验视频" status="done"><video className="test-video" controls src={videoUri} /></OutputItem>}
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
