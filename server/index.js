import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import { cpus, freemem, loadavg, totalmem } from "node:os";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const storageDir = join(rootDir, "storage");
const uploadDir = join(storageDir, "uploads");
const artifactDir = join(storageDir, "artifacts");
const packageDir = join(storageDir, "publish-packages");
const dbPath = join(storageDir, "db.json");
const PORT = Number(process.env.PORT || 8083);
const MODEL_HOME = process.env.MODEL_HOME || join(rootDir, "models");
const LLM_TOOL_PATH = process.env.DH_LLM_TOOL_PATH || join(rootDir, "scripts", "llm-tool.mjs");
const ASR_TOOL_PATH = process.env.DH_ASR_TOOL_PATH || join(rootDir, "scripts", "asr-tool.mjs");
const TTS_TOOL_PATH = process.env.DH_TTS_TOOL_PATH || join(rootDir, "scripts", "tts-tool.mjs");
const ASR_WORKER_PATH = join(rootDir, "scripts", "qwen-asr-worker.py");
const TTS_WORKER_PATH = join(rootDir, "scripts", "qwen-tts-worker.py");
const MUSETALK_ADAPTER_PATH = join(rootDir, "scripts", "musetalk-adapter.mjs");
const MUSETALK_WORKER_PATH = join(rootDir, "scripts", "musetalk-worker.mjs");
const MODEL_INSTALLER_PATH = join(rootDir, "scripts", "install-models.mjs");
const YT_DLP_BIN = process.env.YT_DLP_BIN || (process.platform === "win32"
  ? join(rootDir, "runtime", "tools", "Scripts", "yt-dlp.exe")
  : join(rootDir, "runtime", "tools", "bin", "yt-dlp"));

const defaultVideoSettings = {
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

const adapterProtocols = {
  llmScriptV1: {
    id: "digital-human.llm.script",
    version: "1.0",
    label: "LLM 口播文案生成协议 v1",
    transport: "JSON over Adapter",
    input: "sourceText、requirements、sourceType、platforms",
    output: "title、outline、script、tags、platformCopies"
  },
  asrTranscriptV1: {
    id: "digital-human.asr.transcript",
    version: "1.0",
    label: "ASR 转写协议 v1",
    transport: "audio file -> JSON",
    input: "audioPath、language",
    output: "text、segments、duration"
  },
  ttsVoiceV1: {
    id: "digital-human.tts.voice",
    version: "1.0",
    label: "TTS 口播协议 v1",
    transport: "JSON + reference audio",
    input: "text、voiceProfile、referenceAudio",
    output: "audioPath、duration、sampleRate"
  },
  avatarRenderV1: {
    id: "digital-human.avatar.render",
    version: "1.0",
    label: "数字人口型同步协议 v1",
    transport: "JSON payload + file paths",
    input: "avatarPath、audioPath、subtitlesPath、duration",
    output: "videoPath、qualityReport"
  },
  mediaToolV1: {
    id: "digital-human.media.tool",
    version: "1.0",
    label: "媒体处理协议 v1",
    transport: "CLI",
    input: "inputPath、outputPath、codecProfile",
    output: "mediaPath、duration、metadata"
  }
};

const modelCatalog = [
  {
    id: "qwen2-5-7b-instruct-4bit-mlx",
    name: "Qwen2.5-7B-Instruct 4bit MLX",
    type: "llm",
    runtime: "内置 LLM CLI",
    defaultPath: "llm/qwen2.5-7b-instruct-4bit-mlx",
    protocolId: "llmScriptV1",
    recommended: true,
    bundleRole: "默认口播文案模型",
    license: "Apache 2.0",
    description: "非 thinking 指令模型，用于链接整理、选题提炼、口播正文、标题和发布文案生成。",
    installGuide: "执行 npm run install:models 会下载该模型。独立部署时放到 MODEL_HOME/llm/qwen2.5-7b-instruct-4bit-mlx，或通过 DH_LLM_MODEL_PATH 指定权重目录。"
  },
  {
    id: "qwen3-asr-1-7b",
    name: "Qwen3-ASR 1.7B",
    type: "asr",
    runtime: "内置 ASR Adapter",
    defaultPath: "asr/qwen3-asr-1.7b",
    protocolId: "asrTranscriptV1",
    recommended: true,
    bundleRole: "来源转写模型",
    license: "Apache 2.0",
    description: "用于短视频链接音频转写和字幕基线。",
    installGuide: "执行 npm run install:models 会下载该模型。独立部署时放到 MODEL_HOME/asr/qwen3-asr-1.7b，或通过 DH_ASR_MODEL_PATH 指定权重目录。"
  },
  {
    id: "qwen3-tts-1-7b-base",
    name: "Qwen3-TTS 1.7B Base",
    type: "tts",
    runtime: "内置 TTS Adapter",
    defaultPath: "tts/qwen3-tts-12hz-1.7b-base",
    protocolId: "ttsVoiceV1",
    recommended: true,
    bundleRole: "口播与克隆音色模型",
    license: "Apache 2.0",
    description: "用于中文口播 TTS 和音色克隆。",
    installGuide: "执行 npm run install:models 会下载该模型。独立部署时放到 MODEL_HOME/tts/qwen3-tts-12hz-1.7b-base，或通过 DH_TTS_MODEL_PATH 指定权重目录。"
  },
  {
    id: "musetalk-v15",
    name: "MuseTalk v1.5",
    type: "avatar",
    runtime: "内置 MuseTalk Adapter",
    defaultPath: "avatar/MuseTalk",
    protocolId: "avatarRenderV1",
    recommended: true,
    bundleRole: "数字人口型同步模型",
    license: "Apache 2.0",
    description: "用于本地数字人口型同步，支持当前任务里的 MuseTalk 调参链路。",
    installGuide: "执行 npm run install:models 会下载 MuseTalk 代码、权重和运行环境。独立部署时放到 MODEL_HOME/avatar/MuseTalk。"
  },
  {
    id: "ffmpeg",
    name: "FFmpeg",
    type: "media",
    runtime: "System Binary",
    defaultPath: "",
    protocolId: "mediaToolV1",
    recommended: true,
    bundleRole: "媒体处理工具",
    license: "LGPL/GPL 取决于构建参数",
    description: "用于转码、字幕、预览视频和发布素材处理。",
    installGuide: "macOS 可用 Homebrew 安装 FFmpeg；Windows 建议使用官方构建并加入 PATH。"
  }
];

const apiProviderCatalog = [
  {
    id: "openai-compatible",
    name: "OpenAI Compatible",
    capabilities: ["llm"],
    envKey: "OPENAI_API_KEY",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    description: "兼容 OpenAI Chat Completions 的云端文本模型。",
    setupGuide: "填写 API Key；如使用第三方兼容服务，可改 endpoint 和模型名。"
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    capabilities: ["llm"],
    envKey: "DEEPSEEK_API_KEY",
    endpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    description: "DeepSeek 云端文本模型，走 OpenAI-compatible 协议。",
    setupGuide: "填写 DeepSeek API Key。"
  },
  {
    id: "dashscope-qwen",
    name: "通义千问 DashScope",
    capabilities: ["llm"],
    envKey: "DASHSCOPE_API_KEY",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-plus",
    models: ["qwen-plus", "qwen-turbo", "qwen-max"],
    description: "阿里云百炼/通义千问 OpenAI-compatible 接口。",
    setupGuide: "填写 DASHSCOPE_API_KEY，可按需修改模型名。"
  },
  {
    id: "custom",
    name: "自定义 OpenAI-compatible",
    capabilities: ["llm"],
    envKey: "CUSTOM_LLM_API_KEY",
    endpoint: "",
    defaultModel: "",
    models: [],
    description: "自定义兼容 Chat Completions 的文本模型服务。",
    setupGuide: "填写 endpoint、模型 ID 和 API Key。"
  },
  {
    id: "openai-asr",
    name: "OpenAI ASR",
    capabilities: ["asr"],
    envKey: "OPENAI_API_KEY",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    defaultModel: "gpt-4o-mini-transcribe",
    models: ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"],
    description: "兼容 OpenAI audio/transcriptions 的云端 ASR。",
    setupGuide: "填写 API Key；如使用兼容服务，可改 endpoint 和模型 ID。"
  },
  {
    id: "custom-asr",
    name: "自定义 ASR Provider",
    capabilities: ["asr"],
    envKey: "CUSTOM_ASR_API_KEY",
    endpoint: "",
    defaultModel: "",
    models: [],
    description: "自定义兼容 OpenAI audio/transcriptions 的 ASR 服务。",
    setupGuide: "填写 endpoint、模型 ID 和 API Key。"
  },
  {
    id: "openai-tts",
    name: "OpenAI TTS",
    capabilities: ["tts"],
    envKey: "OPENAI_API_KEY",
    endpoint: "https://api.openai.com/v1/audio/speech",
    defaultModel: "gpt-4o-mini-tts",
    models: ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"],
    description: "兼容 OpenAI audio/speech 的云端 TTS。",
    setupGuide: "填写 API Key；如使用兼容服务，可改 endpoint 和模型 ID。"
  },
  {
    id: "custom-tts",
    name: "自定义 TTS Provider",
    capabilities: ["tts"],
    envKey: "CUSTOM_TTS_API_KEY",
    endpoint: "",
    defaultModel: "",
    models: [],
    description: "自定义兼容 OpenAI audio/speech 的 TTS 服务。",
    setupGuide: "填写 endpoint、模型 ID 和 API Key。"
  }
];

const stageOrder = ["input", "script", "voice", "video", "publish"];
const stageLabels = {
  input: "输入",
  script: "生成口播文案",
  voice: "生成口播音频",
  video: "视频合成",
  publish: "发布"
};

const queueTypeLabels = {
  process_source: "解析来源",
  generate_script: "生成口播文案",
  synthesize_speech: "生成口播音频",
  render_video: "生成视频",
  run_all: "自动生成到视频",
  ab_render: "生成 A/B 小样"
};

const queueStageMap = {
  process_source: "input",
  generate_script: "script",
  synthesize_speech: "voice",
  render_video: "video",
  run_all: "input",
  ab_render: "video"
};

const platformLinks = {
  douyin: "https://creator.douyin.com/creator-micro/content/upload",
  xiaohongshu: "https://creator.xiaohongshu.com/publish/publish",
  wechat: "https://mp.weixin.qq.com/"
};

const platformLabels = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  wechat: "公众号"
};

const defaultRequirementTemplates = [
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

for (const dir of [storageDir, uploadDir, artifactDir, packageDir]) {
  mkdirSync(dir, { recursive: true });
}

const defaultDb = {
  projects: [],
  avatarAssets: [],
  musicAssets: [],
  voices: [],
  models: modelCatalog.map(modelFromCatalog),
  apiProviders: [],
  jobs: [],
  queueItems: [],
  sourceExtractions: [],
  publishPackages: [],
  publishRecords: [],
  requirementTemplates: defaultRequirementTemplates,
  settings: {
    defaultTextModelId: "model-qwen2-5-7b-instruct-4bit-mlx",
    keepAsrModelWarm: false,
    keepTtsModelWarm: false,
    keepAvatarModelWarm: false,
    videoConcurrency: 1,
    avatarSegmentSeconds: 30,
    defaultModelIds: {
      llm: "model-qwen2-5-7b-instruct-4bit-mlx",
      asr: "model-qwen3-asr-1-7b",
      tts: "model-qwen3-tts-1-7b-base",
      avatar: "model-musetalk-v15"
    }
  }
};

function modelFromCatalog(item) {
  const adapterProtocol = adapterProtocols[item.protocolId];
  return {
    id: `model-${item.id}`,
    catalogId: item.id,
    name: item.name,
    type: item.type,
    runtime: item.runtime,
    pathRef: item.defaultPath ? `MODEL_HOME/${item.defaultPath}` : "PATH:ffmpeg",
    modelPlazaPath: item.modelPlazaPath || "",
    bundleRole: item.bundleRole || "",
    license: item.license || "",
    status: "not_installed",
    selected: item.type === "llm" && item.recommended,
    protocolId: item.protocolId,
    adapterProtocol,
    protocolStatus: "已锁定",
    note: item.description,
    installGuide: item.installGuide,
    recommended: item.recommended
  };
}

function normalizeDb(db) {
  db.projects ||= [];
  db.avatarAssets ||= [];
  db.musicAssets ||= [];
  db.voices ||= [];
  db.models ||= [];
  db.apiProviders ||= [];
  db.jobs ||= [];
  db.queueItems ||= [];
  db.sourceExtractions ||= [];
  db.publishPackages ||= [];
  db.publishRecords ||= [];
  if (!Array.isArray(db.requirementTemplates)) {
    db.requirementTemplates = defaultRequirementTemplates.map((template) => ({ ...template }));
  }
  db.requirementTemplates = db.requirementTemplates
    .filter((item) => item && !item.deletedAt)
    .map((item) => ({
      id: item.id || `requirement-template-${randomUUID()}`,
      label: String(item.label || item.name || "未命名模板").trim() || "未命名模板",
      value: String(item.value || item.content || "").trim(),
      createdAt: item.createdAt || now(),
      updatedAt: item.updatedAt || item.createdAt || now()
    }));
  db.settings ||= {};
  db.settings.keepAsrModelWarm = Boolean(db.settings.keepAsrModelWarm);
  db.settings.keepTtsModelWarm = Boolean(db.settings.keepTtsModelWarm);
  db.settings.keepAvatarModelWarm = Boolean(db.settings.keepAvatarModelWarm);
  db.settings.videoConcurrency = clampNumber(db.settings.videoConcurrency, 1, 4, 1, true);
  db.settings.avatarSegmentSeconds = clampNumber(db.settings.avatarSegmentSeconds, 10, 120, 30, true);
  db.settings.defaultTextModelId ||= "model-qwen2-5-7b-instruct-4bit-mlx";
  if (db.settings.defaultTextModelId === "model-qwen3-5-27b-4bit-mlx") {
    db.settings.defaultTextModelId = "model-qwen2-5-7b-instruct-4bit-mlx";
  }
  db.settings.defaultModelIds ||= {};
  if (db.settings.defaultModelIds.llm === "model-qwen3-5-27b-4bit-mlx") {
    db.settings.defaultModelIds.llm = "model-qwen2-5-7b-instruct-4bit-mlx";
  }
  db.projects = db.projects.map(normalizeProject);
  db.queueItems = db.queueItems.map(normalizeQueueItem);
  for (const item of apiProviderCatalog) {
    const existing = db.apiProviders.find((provider) => provider.providerId === item.id);
    if (existing) {
      existing.name = item.name;
      existing.capabilities = item.capabilities;
      existing.authType = item.authType;
      existing.envKey = item.envKey;
      existing.endpoint ||= item.endpoint;
      existing.model ||= item.defaultModel || "";
      existing.models = item.models || [];
      existing.description = item.description;
      existing.setupGuide = item.setupGuide;
    } else if (process.env[item.envKey]) {
      db.apiProviders.push(providerFromCatalog(item));
    }
  }
  const fixedCatalogIds = new Set(modelCatalog.map((item) => item.id));
  for (const item of modelCatalog) {
    const id = `model-${item.id}`;
    const existing = db.models.find((model) => model.id === id || model.catalogId === item.id);
    if (existing) {
      existing.catalogId ||= item.id;
      existing.name = item.name;
      existing.type = item.type;
      existing.runtime = item.runtime;
      existing.pathRef = item.defaultPath ? `MODEL_HOME/${item.defaultPath}` : "PATH:ffmpeg";
      existing.modelPlazaPath = item.modelPlazaPath || "";
      existing.bundleRole = item.bundleRole || "";
      existing.license = item.license || "";
      existing.note = item.description;
      existing.installGuide = item.installGuide;
      existing.recommended = item.recommended;
      existing.protocolId = item.protocolId;
      existing.adapterProtocol = adapterProtocols[item.protocolId];
      existing.protocolStatus ||= "locked";
      if (existing.protocolStatus === "locked") existing.protocolStatus = "已锁定";
    }
    if (!db.models.some((model) => model.id === id || model.catalogId === item.id)) {
      db.models.push(modelFromCatalog(item));
    }
  }
  db.models = db.models.map((model) => ({
    ...model,
    hidden: model.catalogId ? !fixedCatalogIds.has(model.catalogId) : true
  }));
  for (const type of ["llm", "asr", "tts", "avatar"]) {
    const visible = db.models.filter((model) => !model.hidden && model.type === type);
    const configured = db.settings.defaultModelIds[type];
    const configuredProvider = String(configured || "").startsWith("provider:")
      ? db.apiProviders.find((provider) => (
          (provider.id === String(configured).replace("provider:", "") || provider.providerId === String(configured).replace("provider:", "")) &&
          provider.capabilities?.includes(type)
        ))
      : null;
    if (!configuredProvider && !visible.some((model) => model.id === configured)) {
      const recommended = visible.find((model) => model.recommended) || visible[0];
      if (recommended) db.settings.defaultModelIds[type] = recommended.id;
    }
  }
  if (!db.settings.defaultTextModelId) db.settings.defaultTextModelId = db.settings.defaultModelIds.llm || "model-qwen2-5-7b-instruct-4bit-mlx";
  if (!db.settings.defaultTextModelId.startsWith("provider:")) {
    db.settings.defaultModelIds.llm = db.settings.defaultTextModelId;
  } else {
    db.settings.defaultModelIds.llm = db.settings.defaultTextModelId;
  }
  return db;
}

function versionNoFromLabel(label = "", fallback = 1) {
  const match = String(label).match(/v\s*(\d+)/i);
  return match ? Number(match[1]) : fallback;
}

function nextVersionNo(items = []) {
  const maxNo = items.reduce((max, item, index) => Math.max(max, Number(item.versionNo || 0), versionNoFromLabel(item.label, index + 1)), 0);
  return maxNo + 1;
}

function versionLabel(versionNo) {
  return `V${versionNo}`;
}

function successfulVersions(items = []) {
  return items.filter((item) => !item.deletedAt && !["failed", "deleted"].includes(item.status));
}

function newestVersion(items = []) {
  return successfulVersions(items)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
}

function scriptArtifactFromVersion(project, version) {
  if (!version) return null;
  const fallback = buildScript(project);
  return {
    title: version.title || fallback.title,
    outline: Array.isArray(version.outline) ? version.outline : fallback.outline,
    script: version.scriptText || version.script || fallback.script,
    tags: Array.isArray(version.tags) ? version.tags : fallback.tags,
    visualSummary: version.visualSummary || fallback.visualSummary,
    platformCopies: version.platformCopies || fallback.platformCopies,
    modelInfo: version.modelInfo || null,
    modelParseWarning: version.modelParseWarning || ""
  };
}

function audioArtifactFromVersion(version) {
  if (!version) return null;
  return {
    uri: version.audioUri || version.uri || "",
    path: version.audioPath || version.path || "",
    duration: Number(version.duration || 0),
    adapter: version.adapter || version.modelInfo?.modelName || "tts",
    note: version.note || "",
    voiceId: version.voiceId || "",
    voiceName: version.voiceName || "",
    metrics: version.metrics || {}
  };
}

function videoArtifactFromVersion(version) {
  if (!version) return null;
  return version.artifact?.video || {
    uri: version.videoUri || "",
    path: version.videoPath || "",
    duration: Number(version.duration || 0),
    adapter: version.adapter || "video-render",
    subtitlesEmbedded: Boolean(version.subtitlesEmbedded),
    visibleCaptions: Boolean(version.visibleCaptions),
    qualityReport: version.qualityReport || null
  };
}

function normalizeScriptVersion(project, version, index) {
  const versionNo = Number(version.versionNo || 0) || versionNoFromLabel(version.label, index + 1);
  return {
    id: version.id || `${project.id}-script-${versionNo}`,
    projectId: project.id,
    versionNo,
    label: versionLabel(versionNo),
    sourceInputSnapshot: version.sourceInputSnapshot || project.inputText || "",
    requirementsSnapshot: version.requirementsSnapshot || project.requirements || "",
    scriptText: version.scriptText || version.script || version.artifact?.script || "",
    title: version.title || version.artifact?.title || project.title || versionLabel(versionNo),
    outline: Array.isArray(version.outline) ? version.outline : version.artifact?.outline || [],
    tags: Array.isArray(version.tags) ? version.tags : version.artifact?.tags || [],
    visualSummary: version.visualSummary || version.artifact?.visualSummary || null,
    platformCopies: version.platformCopies || version.artifact?.platformCopies || buildScript(project).platformCopies,
    modelInfo: version.modelInfo || version.artifact?.modelInfo || null,
    modelParseWarning: version.modelParseWarning || version.artifact?.modelParseWarning || "",
    createdAt: version.createdAt || project.updatedAt || project.createdAt || now(),
    status: version.status || "done",
    isCurrent: Boolean(version.isCurrent)
  };
}

function normalizeAudioVersion(project, version, index) {
  const versionNo = Number(version.versionNo || 0) || versionNoFromLabel(version.label, index + 1);
  return {
    id: version.id || `${project.id}-audio-${versionNo}`,
    projectId: project.id,
    versionNo,
    label: versionLabel(versionNo),
    sourceScriptVersionId: version.sourceScriptVersionId || project.selectedScriptVersionId || project.scriptVersions?.[0]?.id || "",
    voiceId: version.voiceId || "",
    voiceName: version.voiceName || "",
    audioUri: version.audioUri || version.uri || "",
    audioPath: version.audioPath || version.path || "",
    duration: Number(version.duration || 0),
    transcriptText: version.transcriptText || "",
    modelInfo: version.modelInfo || null,
    adapter: version.adapter || "tts",
    note: version.note || "",
    metrics: version.metrics || {},
    createdAt: version.createdAt || project.updatedAt || project.createdAt || now(),
    status: version.status || "done",
    isCurrent: Boolean(version.isCurrent)
  };
}

function normalizeVideoVersion(project, version, index) {
  const versionNo = Number(version.versionNo || 0) || versionNoFromLabel(version.label, index + 1);
  const artifactVideo = version.artifact?.video || {};
  return {
    ...version,
    id: version.id || `${project.id}-video-${versionNo}`,
    projectId: project.id,
    versionNo,
    label: versionLabel(versionNo),
    sourceAudioVersionId: version.sourceAudioVersionId || project.selectedAudioVersionId || "",
    sourceScriptVersionId: version.sourceScriptVersionId || project.selectedScriptVersionId || "",
    avatarAssetId: version.avatarAssetId || project.avatarAssetId || "",
    videoUri: version.videoUri || artifactVideo.uri || "",
    videoPath: version.videoPath || artifactVideo.path || "",
    duration: Number(version.duration || artifactVideo.duration || 0),
    resolution: version.resolution || "",
    createdAt: version.createdAt || project.updatedAt || project.createdAt || now(),
    status: version.status || "done",
    videoSettings: normalizeVideoSettings(version.videoSettings || project.videoSettings),
    artifact: {
      video: {
        ...artifactVideo,
        uri: version.videoUri || artifactVideo.uri || "",
        path: version.videoPath || artifactVideo.path || "",
        duration: Number(version.duration || artifactVideo.duration || 0),
        adapter: artifactVideo.adapter || version.adapter || "video-render"
      },
      subtitles: version.artifact?.subtitles || null
    },
    qualityReport: version.qualityReport || artifactVideo.qualityReport || null,
    isCurrent: Boolean(version.isCurrent)
  };
}

function normalizeProject(project) {
  project.requirements ||= "";
  project.inputText ||= project.sourceText || "";
  project.sourceText ||= project.inputText || "";
  project.manualScript = Boolean(project.manualScript);
  project.reviewEnabled = project.reviewEnabled ?? ["review", "manual"].includes(project.mode);
  project.mode = project.reviewEnabled ? "manual" : "auto";
  project.generateSubtitles = Boolean(project.generateSubtitles);
  project.platforms = project.platforms?.length ? project.platforms : ["douyin", "xiaohongshu", "wechat"];
  project.scriptModelId ||= "";
  project.backgroundMusicAssetId ||= "";
  project.videoSettings = normalizeVideoSettings(project.videoSettings);
  project.artifacts ||= {};
  project.scriptVersions = (project.scriptVersions || []).map((version, index) => normalizeScriptVersion(project, version, index));
  if (!project.scriptVersions.length && project.artifacts.script) {
    project.scriptVersions.push(normalizeScriptVersion(project, {
      id: `${project.id}-script-1`,
      versionNo: 1,
      label: "V1",
      sourceInputSnapshot: project.inputText || "",
      requirementsSnapshot: project.requirements || "",
      scriptText: project.artifacts.script.script || "",
      title: project.artifacts.script.title || project.title,
      outline: project.artifacts.script.outline || [],
      tags: project.artifacts.script.tags || [],
      visualSummary: project.artifacts.script.visualSummary || null,
      platformCopies: project.artifacts.script.platformCopies || null,
      modelInfo: project.artifacts.script.modelInfo || null,
      createdAt: project.updatedAt || project.createdAt || now(),
      status: "done",
      isCurrent: true
    }, 0));
  }
  project.selectedScriptVersionId ||= newestVersion(project.scriptVersions)?.id || "";
  project.scriptVersions = project.scriptVersions.map((version) => ({
    ...version,
    isCurrent: version.id === project.selectedScriptVersionId
  }));

  project.audioVersions = (project.audioVersions || []).map((version, index) => normalizeAudioVersion(project, version, index));
  if (!project.audioVersions.length && project.artifacts.audio) {
    project.audioVersions.push(normalizeAudioVersion(project, {
      id: `${project.id}-audio-1`,
      versionNo: 1,
      label: "V1",
      sourceScriptVersionId: project.selectedScriptVersionId || "",
      voiceId: project.artifacts.audio.voiceId || project.voiceId || "",
      voiceName: project.artifacts.audio.voiceName || "",
      audioUri: project.artifacts.audio.uri || "",
      audioPath: project.artifacts.audio.path || "",
      duration: project.artifacts.audio.duration || 0,
      adapter: project.artifacts.audio.adapter || "tts",
      note: project.artifacts.audio.note || "",
      metrics: project.artifacts.audio.metrics || {},
      createdAt: project.updatedAt || project.createdAt || now(),
      status: "done",
      isCurrent: true
    }, 0));
  }
  project.selectedAudioVersionId ||= newestVersion(project.audioVersions)?.id || "";
  project.audioVersions = project.audioVersions.map((version) => ({
    ...version,
    isCurrent: version.id === project.selectedAudioVersionId
  }));

  project.videoVersions = (project.videoVersions || project.versions || []).map((version, index) => normalizeVideoVersion(project, version, index));
  if (!project.videoVersions.length && project.artifacts.video) {
    project.videoVersions.push(normalizeVideoVersion(project, {
      id: `${project.id}-video-1`,
      versionNo: 1,
      label: "V1",
      sourceAudioVersionId: project.selectedAudioVersionId || "",
      sourceScriptVersionId: project.selectedScriptVersionId || "",
      avatarAssetId: project.avatarAssetId || "",
      videoUri: project.artifacts.video.uri || "",
      videoPath: project.artifacts.video.path || "",
      duration: project.artifacts.video.duration || 0,
      videoSettings: project.videoSettings,
      artifact: {
        video: project.artifacts.video,
        subtitles: project.artifacts.subtitles || null
      },
      qualityReport: project.artifacts.video.qualityReport || null,
      createdAt: project.updatedAt || project.createdAt || now(),
      status: "done",
      isCurrent: true
    }, 0));
  }
  project.selectedVideoVersionId ||= (project.videoVersions.find((version) => version.isCurrent) || newestVersion(project.videoVersions))?.id || "";
  project.videoVersions = project.videoVersions.map((version) => ({
    ...version,
    isCurrent: version.id === project.selectedVideoVersionId
  }));
  project.versions = project.videoVersions;

  const selectedScript = project.scriptVersions.find((version) => version.id === project.selectedScriptVersionId);
  const selectedAudio = project.audioVersions.find((version) => version.id === project.selectedAudioVersionId);
  const selectedVideo = project.videoVersions.find((version) => version.id === project.selectedVideoVersionId);
  if (selectedScript) project.artifacts.script = scriptArtifactFromVersion(project, selectedScript);
  if (selectedAudio) project.artifacts.audio = audioArtifactFromVersion(selectedAudio);
  if (selectedVideo) {
    project.artifacts.video = videoArtifactFromVersion(selectedVideo);
    if (selectedVideo.artifact?.subtitles) project.artifacts.subtitles = selectedVideo.artifact.subtitles;
    else delete project.artifacts.subtitles;
  }
  project.progress ||= {
    percent: project.status === "video_ready" || project.status === "ready_to_publish" ? 100 : 0,
    label: project.status === "video_ready" || project.status === "ready_to_publish" ? "已生成视频" : "等待执行",
    status: project.status || "created",
    updatedAt: project.updatedAt || project.createdAt || now()
  };
  project.sourceAnalysis ||= { links: [], transcripts: [], notes: [] };
  project.reviewSteps ||= [];
  project.stageState ||= {};
  for (const stage of stageOrder) {
    project.stageState[stage] ||= {
      status: stage === "input" ? "done" : "pending",
      label: stageLabels[stage],
      updatedAt: project.updatedAt || project.createdAt || now()
    };
    project.stageState[stage].label = stageLabels[stage];
  }
  if (project.stageState.source && project.currentStage === "source") {
    project.currentStage = project.scriptVersions.length ? "script" : "input";
    project.currentStep = project.currentStage;
  }
  if (!stageOrder.includes(project.currentStep)) project.currentStep = stageOrder.includes(project.currentStage) ? project.currentStage : "input";
  if (!stageOrder.includes(project.currentStage)) project.currentStage = project.currentStep || "input";
  project.currentStep ||= project.currentStage || "input";
  project.currentStage = project.currentStep;
  project.status ||= "created";
  if (project.status !== "failed" && project.stageState?.video?.status === "done") {
    project.lastError = "";
  }
  project.createdAt ||= now();
  project.updatedAt ||= project.createdAt;
  return project;
}

function normalizeQueueItem(item) {
  item.id ||= `queue-${randomUUID()}`;
  item.type ||= "run_all";
  item.label ||= queueTypeLabels[item.type] || item.type;
  if (item.type === "generate_script" && ["生成文案", "生成口播内容"].includes(item.label)) item.label = queueTypeLabels.generate_script;
  if (item.type === "synthesize_speech" && item.label === "生成口播") item.label = queueTypeLabels.synthesize_speech;
  item.status ||= "queued";
  item.payload ||= {};
  item.progress ||= {
    percent: item.status === "completed" ? 100 : 0,
    label: item.status === "queued" ? "等待执行" : statusTextForQueue(item.status),
    updatedAt: item.updatedAt || item.createdAt || now()
  };
  item.attempts ||= 0;
  item.createdAt ||= now();
  item.updatedAt ||= item.createdAt;
  return item;
}

function clampNumber(value, min, max, fallback, integer = false) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(max, Math.max(min, parsed));
  return integer ? Math.round(clamped) : clamped;
}

function normalizeVideoSettings(settings = {}) {
  const engine = ["musetalk"].includes(settings.engine)
    ? settings.engine
    : defaultVideoSettings.engine;
  return {
    engine,
    cropMode: "mediapipe",
    parsingMode: ["jaw", "raw"].includes(settings.parsingMode) ? settings.parsingMode : defaultVideoSettings.parsingMode,
    upperBoundaryRatio: clampNumber(settings.upperBoundaryRatio, 0.35, 0.65, defaultVideoSettings.upperBoundaryRatio),
    extraMargin: clampNumber(settings.extraMargin, 0, 40, defaultVideoSettings.extraMargin, true),
    facePad: clampNumber(settings.facePad, 0.04, 0.24, defaultVideoSettings.facePad),
    lowerPad: clampNumber(settings.lowerPad, 0, 0.12, defaultVideoSettings.lowerPad),
    batchSize: clampNumber(settings.batchSize, 1, 4, defaultVideoSettings.batchSize, true),
    leftCheekWidth: clampNumber(settings.leftCheekWidth, 40, 140, defaultVideoSettings.leftCheekWidth, true),
    rightCheekWidth: clampNumber(settings.rightCheekWidth, 40, 140, defaultVideoSettings.rightCheekWidth, true)
  };
}

function applyRuntimeVideoSettings(db, settings = {}) {
  const normalized = normalizeVideoSettings(settings);
  return {
    ...normalized,
    batchSize: clampNumber(db.settings?.videoConcurrency, 1, 4, normalized.batchSize, true)
  };
}

function readDb() {
  if (!existsSync(dbPath)) {
    writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
  }
  const db = normalizeDb(JSON.parse(readFileSync(dbPath, "utf-8")));
  return db;
}

function writeDb(db) {
  writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function now() {
  return new Date().toISOString();
}

function statusTextForQueue(status = "") {
  const dictionary = {
    queued: "等待执行",
    running: "正在执行",
    completed: "已完成",
    failed: "执行失败",
    cancelled: "已取消"
  };
  return dictionary[status] || status || "等待执行";
}

function publicPath(path) {
  return `/storage/${relative(storageDir, path).split("/").join("/")}`;
}

function commandExists(command) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function resolvePathRef(pathRef) {
  if (!pathRef) return "";
  if (pathRef === "PATH:ffmpeg") return "ffmpeg";
  if (pathRef.startsWith("MODEL_HOME/")) {
    return join(MODEL_HOME, pathRef.replace("MODEL_HOME/", ""));
  }
  return pathRef;
}

function modelCandidatePaths(model) {
  const candidates = [];
  const resolvedPath = resolvePathRef(model.pathRef);
  if (resolvedPath && resolvedPath !== "ffmpeg") {
    candidates.push({ path: resolvedPath, source: "bundle" });
  }
  return candidates.filter((item, index, arr) => item.path && arr.findIndex((other) => other.path === item.path) === index);
}

function detectModel(model) {
  const adapterProtocol = model.adapterProtocol || adapterProtocols[model.protocolId] || {
    id: "digital-human.custom",
    version: "1.0",
    label: "自定义 Adapter 协议"
  };
  if (model.pathRef === "PATH:ffmpeg") {
    const installed = commandExists("ffmpeg") && commandExists("ffprobe");
    return {
      status: installed ? "installed" : "missing",
      resolvedPath: installed ? "ffmpeg" : "",
      protocolStatus: installed ? "已验证" : "待检测",
      protocolMessage: installed ? `${adapterProtocol?.label || "媒体处理协议"} 已由内置 FFmpeg Adapter 锁定。` : "等待 FFmpeg 安装后启用媒体处理协议。",
      message: installed ? "已检测到 FFmpeg。" : "未检测到 FFmpeg，请按安装指引处理。"
    };
  }
  const candidates = modelCandidatePaths(model);
  const installedCandidate = candidates.find((item) => existsSync(item.path));
  if (!installedCandidate) {
    const missingMessage = `未检测到固定模型。标准安装包应内置到 ${model.pathRef}，也可通过对应 DH_*_MODEL_PATH 指定权重目录。`;
    return {
      status: "missing",
      resolvedPath: candidates[0]?.path || "",
      protocolStatus: "待检测",
      protocolMessage: `等待模型安装后校验 ${adapterProtocol?.label || "Adapter 协议"}。`,
      message: missingMessage
    };
  }
  const resolvedPath = installedCandidate.path;
  const museTalkCheck = model.catalogId === "musetalk-v15" ? validateMuseTalkInstall(resolvedPath) : null;
  if (museTalkCheck && !museTalkCheck.ok) {
    return {
      status: "incomplete",
      resolvedPath,
      protocolStatus: "待补齐",
      protocolMessage: `MuseTalk 模型包不完整，缺少 ${museTalkCheck.missing.join("、")}。`,
      message: "已检测到 MuseTalk 目录，但代码、权重或推理依赖不完整。"
    };
  }
  const manifest = readAdapterManifest(resolvedPath);
  if (!manifest) {
    if (model.catalogId) {
      return {
        status: "installed",
        resolvedPath,
        protocolStatus: "已验证",
        protocolMessage: `${adapterProtocol.label} 已由项目内固定 CLI Adapter 锁定。`,
        message: "已检测到本地模型文件，运行时会按需临时启动对应 CLI。"
      };
    }
    return {
      status: "protocol_unverified",
      resolvedPath,
      protocolStatus: "缺少清单",
      protocolMessage: `已检测到模型目录，但未发现协议清单。请在模型目录放置 digital-human-adapter.json，声明 ${adapterProtocol.id}@${adapterProtocol.version}。`,
      message: "已检测到模型目录，但协议未验证。打包分发时必须随模型保留协议清单和许可证文件。"
    };
  }
  const manifestProtocolId = manifest.protocolId || manifest.adapterProtocolId;
  const manifestProtocolVersion = manifest.protocolVersion || manifest.adapterProtocolVersion || manifest.version;
  if (manifestProtocolId !== adapterProtocol.id || manifestProtocolVersion !== adapterProtocol.version) {
    return {
      status: "protocol_mismatch",
      resolvedPath,
      protocolStatus: "协议不匹配",
      protocolMessage: `协议不一致：当前模型声明 ${manifestProtocolId || "unknown"}@${manifestProtocolVersion || "unknown"}，系统要求 ${adapterProtocol.id}@${adapterProtocol.version}。`,
      message: "已检测到模型目录，但 Adapter 协议不一致，请更换适配器或模型清单。"
    };
  }
  return {
    status: "installed",
    resolvedPath,
    protocolStatus: "已验证",
    protocolMessage: `${adapterProtocol.label} 已验证。`,
    message: "已检测到模型目录，且 Adapter 协议一致。"
  };
}

function readAdapterManifest(resolvedPath) {
  for (const name of ["digital-human-adapter.json", "adapter.protocol.json"]) {
    const manifestPath = join(resolvedPath, name);
    if (!existsSync(manifestPath)) continue;
    try {
      return JSON.parse(readFileSync(manifestPath, "utf-8"));
    } catch {
      return {
        protocolId: "invalid",
        protocolVersion: "invalid"
      };
    }
  }
  return null;
}

function validateMuseTalkInstall(resolvedPath) {
  const requiredFiles = [
    "scripts/inference.py",
    "models/musetalkV15/unet.pth",
    "models/musetalkV15/musetalk.json",
    "models/sd-vae",
    "models/whisper",
    "models/face-parse-bisent/79999_iter.pth"
  ];
  const missing = requiredFiles.filter((file) => !existsSync(join(resolvedPath, file)));
  return {
    ok: missing.length === 0,
    missing
  };
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function providerFromCatalog(item, existing = {}) {
  const envValue = process.env[item.envKey] || "";
  const hasKey = Boolean(envValue || existing.apiKey);
  return {
    id: `provider-${item.id}`,
    providerId: item.id,
    name: item.name,
    capabilities: item.capabilities,
    authType: item.authType,
    envKey: item.envKey,
    endpoint: existing.endpoint || item.endpoint,
    model: existing.model || item.defaultModel || "",
    models: item.models || [],
    description: item.description,
    setupGuide: item.setupGuide,
    status: hasKey ? existing.status || "configured" : "not_configured",
    apiKey: existing.apiKey || "",
    maskedKey: envValue ? `${item.envKey} 环境变量` : maskSecret(existing.apiKey || ""),
    lastCheckedAt: existing.lastCheckedAt || "",
    healthMessage: existing.healthMessage || (hasKey ? "API Key 已配置，真实调用由对应 Provider Adapter 执行。" : "未配置 API Key。")
  };
}

function publicProvider(provider) {
  const { apiKey, ...safe } = provider;
  return {
    ...safe,
    hasKey: Boolean(apiKey || process.env[provider.envKey])
  };
}

function detectProvider(provider) {
  const hasKey = Boolean(provider.apiKey || process.env[provider.envKey]);
  const missingConfig = [];
  if (!provider.endpoint) missingConfig.push("Endpoint");
  if (!provider.model) missingConfig.push("模型 ID");
  if (!hasKey) missingConfig.push("API Key");
  return {
    status: missingConfig.length ? "missing" : "configured",
    maskedKey: process.env[provider.envKey] ? `${provider.envKey} 环境变量` : maskSecret(provider.apiKey || ""),
    message: missingConfig.length
      ? `请补齐 ${missingConfig.join("、")}。`
      : "Provider 已配置。后续生成任务可选择该云端模型。"
  };
}

function ensureProject(db, id) {
  const project = db.projects.find((item) => item.id === id);
  if (!project) {
    const err = new Error("Project not found");
    err.status = 404;
    throw err;
  }
  return project;
}

function pushJob(db, projectId, step, status, message, artifact = null) {
  const job = {
    id: `job-${randomUUID()}`,
    projectId,
    step,
    status,
    message,
    artifact,
    createdAt: now(),
    updatedAt: now()
  };
  db.jobs.unshift(job);
  return job;
}

function markProjectDeleted(db, projectId) {
  const project = ensureProject(db, projectId);
  project.deletedAt = now();
  project.status = "deleted";
  project.updatedAt = now();
  for (const item of db.queueItems || []) {
    if (item.projectId !== project.id || !["queued", "running"].includes(item.status)) continue;
    item.status = "cancelled";
    item.updatedAt = now();
    item.progress = {
      ...(item.progress || {}),
      label: "任务已删除，队列已取消。",
      updatedAt: now()
    };
  }
  pushJob(db, project.id, "delete_project", "completed", "任务已删除。");
  return project;
}

function setStage(project, stage, status, message = "") {
  project.stageState ||= {};
  const timestamp = now();
  const previous = project.stageState[stage] || {};
  const next = {
    ...previous,
    label: stageLabels[stage],
    status,
    message,
    updatedAt: timestamp
  };
  if (status === "queued") {
    next.queuedAt ||= timestamp;
  } else if (status === "running") {
    if (previous.status !== "running" || !previous.startedAt) next.startedAt = timestamp;
    delete next.finishedAt;
    delete next.durationMs;
  } else if (["done", "ready", "failed", "cancelled", "completed"].includes(status)) {
    const startedAt = next.startedAt || previous.updatedAt || timestamp;
    next.startedAt = startedAt;
    next.finishedAt = timestamp;
    next.durationMs = Math.max(0, new Date(timestamp).getTime() - new Date(startedAt).getTime());
  } else if (status === "pending") {
    delete next.queuedAt;
    delete next.startedAt;
    delete next.finishedAt;
    delete next.durationMs;
  }
  project.stageState[stage] = {
    ...next
  };
  project.currentStep = stage;
  project.currentStage = stage;
  project.updatedAt = timestamp;
}

function resetStagesAfter(project, stage) {
  const index = stageOrder.indexOf(stage);
  if (index < 0) return;
  for (const next of stageOrder.slice(index + 1)) {
    project.stageState[next] = {
      label: stageLabels[next],
      status: "pending",
      message: "",
      updatedAt: now()
    };
  }
  if (stage === "input") {
    delete project.artifacts.script;
    delete project.artifacts.audio;
    delete project.artifacts.video;
    delete project.artifacts.subtitles;
  }
  if (stage === "script") {
    delete project.artifacts.audio;
    delete project.artifacts.video;
    delete project.artifacts.subtitles;
  }
  if (stage === "voice") {
    delete project.artifacts.audio;
    delete project.artifacts.video;
    delete project.artifacts.subtitles;
  }
  if (stage === "video") {
    delete project.artifacts.video;
    delete project.artifacts.subtitles;
  }
}

function setProjectProgress(project, progress) {
  const next = {
    percent: clampNumber(progress.percent, 0, 100, 0, true),
    label: progress.label || "等待执行",
    stage: progress.stage || project.currentStage || project.currentStep || "input",
    status: progress.status || project.status || "created",
    queueId: progress.queueId || project.progress?.queueId || "",
    updatedAt: now()
  };
  project.progress = next;
  project.updatedAt = now();
  return next;
}

function updateQueueProgress(queueId, progress) {
  if (!queueId) return;
  const db = readDb();
  const item = db.queueItems.find((entry) => entry.id === queueId);
  if (!item) return;
  const extraProgress = {};
  for (const key of ["resultVersionId", "resultVersionLabel", "artifactUri", "artifactType"]) {
    if (progress[key] !== undefined) extraProgress[key] = progress[key];
  }
  item.progress = {
    ...(item.progress || {}),
    percent: clampNumber(progress.percent, 0, 100, item.progress?.percent || 0, true),
    label: progress.label || item.progress?.label || statusTextForQueue(item.status),
    stage: progress.stage || item.progress?.stage || queueStageMap[item.type] || "input",
    ...extraProgress,
    updatedAt: now()
  };
  item.updatedAt = now();
  const project = db.projects.find((entry) => entry.id === item.projectId);
  if (project) {
    setProjectProgress(project, {
      ...item.progress,
      queueId: item.id,
      status: item.status
    });
    if (progress.stage && progress.stageStatus) {
      setStage(project, progress.stage, progress.stageStatus, progress.label || "");
    }
  }
  writeDb(db);
}

function activeQueueItems(db) {
  return (db.queueItems || []).filter((item) => ["queued", "running"].includes(item.status));
}

function resourceSnapshot(db = null) {
  const freeBytes = freemem();
  const totalBytes = totalmem();
  const freeGb = freeBytes / 1024 / 1024 / 1024;
  const totalGb = totalBytes / 1024 / 1024 / 1024;
  const memoryUsage = process.memoryUsage();
  const runningCount = db ? (db.queueItems || []).filter((item) => item.status === "running").length : 0;
  const queuedCount = db ? (db.queueItems || []).filter((item) => item.status === "queued").length : 0;
  const freeRatio = totalBytes ? freeBytes / totalBytes : 0;
  const load1 = loadavg()[0] || 0;
  const cpuCount = Math.max(1, cpus().length || 1);
  const minFreeGb = Number(process.env.DIGITAL_HUMAN_MIN_FREE_GB || 1.5);
  const minFreeRatio = Number(process.env.DIGITAL_HUMAN_MIN_FREE_RATIO || 0.03);
  const blocked = freeGb < minFreeGb && freeRatio < minFreeRatio;
  const warning = !blocked && (freeGb < 6 || load1 > cpuCount * 1.8);
  return {
    status: blocked ? "blocked" : warning ? "warning" : "ok",
    freeGb: Number(freeGb.toFixed(2)),
    totalGb: Number(totalGb.toFixed(2)),
    freeRatio: Number(freeRatio.toFixed(3)),
    load1: Number(load1.toFixed(2)),
    cpuCount,
    queuedCount,
    runningCount,
    rssGb: Number((memoryUsage.rss / 1024 / 1024 / 1024).toFixed(2)),
    heapUsedGb: Number((memoryUsage.heapUsed / 1024 / 1024 / 1024).toFixed(2)),
    updatedAt: now()
  };
}

function assertResourcesAvailable(queueItem) {
  const db = readDb();
  const snapshot = resourceSnapshot(db);
  queueItem.resourceSnapshot = snapshot;
  return snapshot;
}

function publicQueueItem(item, db) {
  const activeBefore = (db.queueItems || [])
    .filter((entry) => entry.status === "queued" && new Date(entry.createdAt) < new Date(item.createdAt))
    .length;
  return {
    ...item,
    position: item.status === "queued" ? activeBefore + 1 : 0
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function queueSignature(project, type, payload = {}) {
  if (type === "generate_script") {
    const modelId = payload.scriptModelId || project.scriptModelId || "";
    return stableStringify({ type, inputText: payload.inputText ?? project.inputText ?? "", requirements: payload.requirements ?? project.requirements ?? "", modelId });
  }
  if (type === "synthesize_speech") {
    return stableStringify({ type, scriptVersionId: payload.scriptVersionId || project.selectedScriptVersionId || "", voiceId: payload.voiceId || project.voiceId || "" });
  }
  if (type === "render_video") {
    return stableStringify({
      type,
      audioVersionId: payload.audioVersionId || project.selectedAudioVersionId || "",
      avatarAssetId: payload.avatarAssetId || project.avatarAssetId || "",
      backgroundMusicAssetId: payload.backgroundMusicAssetId || project.backgroundMusicAssetId || "",
      previewDuration: Number(payload.previewDuration || 0),
      variantLabel: payload.variantLabel || "",
      videoSettings: normalizeVideoSettings(payload.videoSettings || project.videoSettings)
    });
  }
  return stableStringify({ type, payload });
}

function visibleProjects(db) {
  return db.projects.filter((project) => !project.deletedAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

const activeQueueItemIds = new Set();
let queueLoopScheduled = false;
const queueConcurrency = Math.max(1, Number(process.env.DIGITAL_HUMAN_QUEUE_CONCURRENCY || 3));

function scheduleQueue() {
  if (queueLoopScheduled) return;
  queueLoopScheduled = true;
  setImmediate(() => {
    queueLoopScheduled = false;
    processQueue().catch((error) => {
      console.error("Queue worker crashed:", error);
      activeQueueItemIds.clear();
    });
  });
}

function enqueueProjectJob(projectId, type, payload = {}) {
  const db = readDb();
  const project = ensureProject(db, projectId);
  const signature = queueSignature(project, type, payload);
  const duplicate = activeQueueItems(db).find((item) => item.projectId === projectId && item.type === type && item.signature === signature);
  if (duplicate) return publicQueueItem(duplicate, db);
  if (type === "generate_script") {
    const modelId = payload.scriptModelId || project.scriptModelId || db.settings.defaultTextModelId || "";
    const inputSnapshot = payload.inputText ?? project.inputText ?? "";
    const requirementsSnapshot = payload.requirements ?? project.requirements ?? "";
    const existingVersion = (project.scriptVersions || []).find((version) => !version.deletedAt
      && String(version.sourceInputSnapshot || "") === String(inputSnapshot)
      && String(version.requirementsSnapshot || "") === String(requirementsSnapshot)
      && [version.modelInfo?.modelId, version.modelInfo?.providerId, version.modelInfo?.providerId ? `provider:${version.modelInfo.providerId}` : "", version.modelInfo?.model].filter(Boolean).includes(modelId));
    if (existingVersion) {
      const err = new Error(`相同输入、生成要求和模型已生成过 ${existingVersion.label}，请修改内容后再生成。`);
      err.status = 409;
      throw err;
    }
  }
  const stage = queueStageMap[type] || "input";
  const item = normalizeQueueItem({
    id: `queue-${randomUUID()}`,
    projectId,
    type,
    label: queueTypeLabels[type] || type,
    status: "queued",
    payload,
    signature,
    progress: {
      percent: 0,
      label: "已进入队列，等待本地 Worker 执行。",
      stage,
      updatedAt: now()
    },
    attempts: 0,
    createdAt: now(),
    updatedAt: now()
  });
  db.queueItems.unshift(item);
  project.status = "queued";
  project.activeQueueId = item.id;
  setProjectProgress(project, {
    ...item.progress,
    status: item.status,
    queueId: item.id
  });
  if (stage && stage !== "input") setStage(project, stage, "queued", "已进入队列。");
  pushJob(db, project.id, type, "queued", `${item.label}已进入队列。`);
  writeDb(db);
  scheduleQueue();
  return publicQueueItem(item, db);
}

function startImmediateProjectJob(projectId, type, payload = {}) {
  const db = readDb();
  const project = ensureProject(db, projectId);
  const signature = queueSignature(project, type, payload);
  const duplicate = activeQueueItems(db).find((item) => item.projectId === projectId && item.type === type && item.signature === signature);
  if (duplicate) {
    const err = new Error("相同参数的任务正在执行，请不要重复提交。");
    err.status = 409;
    throw err;
  }
  const stage = queueStageMap[type] || project.currentStage || "input";
  const item = normalizeQueueItem({
    id: `task-${randomUUID()}`,
    projectId,
    type,
    label: queueTypeLabels[type] || type,
    status: "running",
    payload,
    signature,
    progress: {
      percent: type === "generate_script" ? 10 : 12,
      label: type === "generate_script" ? "已提交，正在生成口播文案。" : "已提交，正在生成口播音频。",
      stage,
      updatedAt: now()
    },
    attempts: 1,
    createdAt: now(),
    startedAt: now(),
    updatedAt: now()
  });
  db.queueItems.unshift(item);
  project.status = "running";
  project.activeQueueId = item.id;
  setProjectProgress(project, {
    ...item.progress,
    status: item.status,
    queueId: item.id
  });
  if (stage && stage !== "input") setStage(project, stage, "running", item.progress.label);
  pushJob(db, project.id, type, "running", `${item.label}已开始执行。`);
  writeDb(db);
  runImmediateItem(item).catch((error) => console.error("Immediate task crashed:", error));
  return publicQueueItem(item, db);
}

async function runImmediateItem(item) {
  try {
    if (item.type === "generate_script") await generateScriptProject(item.projectId, { queueId: item.id, payload: item.payload });
    else if (item.type === "synthesize_speech") await synthesizeProject(item.projectId, { queueId: item.id, payload: item.payload });
    else throw new Error(`Unsupported immediate task type: ${item.type}`);
    const doneDb = readDb();
    const doneItem = doneDb.queueItems.find((entry) => entry.id === item.id);
    const doneProject = doneDb.projects.find((entry) => entry.id === item.projectId);
    if (doneItem) {
      doneItem.status = "completed";
      doneItem.finishedAt = now();
      doneItem.updatedAt = now();
      doneItem.progress = {
        ...(doneItem.progress || {}),
        percent: 100,
        label: doneItem.progress?.label || "任务已完成。",
        updatedAt: now()
      };
    }
    if (doneProject) {
      const nextActive = activeQueueItems(doneDb).find((entry) => entry.projectId === doneProject.id && entry.id !== doneItem?.id);
      doneProject.activeQueueId = nextActive?.id || "";
      if (nextActive) doneProject.status = "running";
      setProjectProgress(doneProject, {
        percent: 100,
        label: doneItem?.progress?.label || "任务已完成。",
        stage: doneItem?.progress?.stage || doneProject.currentStage,
        status: doneProject.status,
        queueId: doneItem?.id || ""
      });
    }
    writeDb(doneDb);
  } catch (error) {
    const failDb = readDb();
    const failedItem = failDb.queueItems.find((entry) => entry.id === item.id);
    const failedProject = failDb.projects.find((entry) => entry.id === item.projectId);
    const message = error?.message || "任务执行失败";
    if (failedItem) {
      failedItem.status = "failed";
      failedItem.lastError = message;
      failedItem.finishedAt = now();
      failedItem.updatedAt = now();
      failedItem.progress = {
        ...(failedItem.progress || {}),
        label: message,
        updatedAt: now()
      };
    }
    if (failedProject) {
      const stage = failedItem?.progress?.stage || queueStageMap[failedItem?.type] || failedProject.currentStage;
      const nextActive = activeQueueItems(failDb).find((entry) => entry.projectId === failedProject.id && entry.id !== failedItem?.id);
      failedProject.status = nextActive ? "running" : "failed";
      failedProject.activeQueueId = nextActive?.id || "";
      failedProject.lastError = message;
      setProjectProgress(failedProject, {
        percent: failedItem?.progress?.percent || 0,
        label: message,
        stage,
        status: failedProject.status,
        queueId: failedItem?.id || ""
      });
      if (stage && failedProject.stageState?.[stage] && !nextActive) setStage(failedProject, stage, "failed", message);
      pushJob(failDb, failedProject.id, failedItem?.type || "task", "failed", message);
    }
    writeDb(failDb);
  }
}

async function processQueue() {
  const db = readDb();
  const available = Math.max(0, queueConcurrency - activeQueueItemIds.size);
  if (!available) return;
  const nextItems = [...(db.queueItems || [])]
    .filter((item) => item.status === "queued")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, available);
  if (!nextItems.length) return;
  for (const next of nextItems) {
    activeQueueItemIds.add(next.id);
  next.status = "running";
  next.attempts = (next.attempts || 0) + 1;
  next.startedAt = now();
  next.updatedAt = now();
  next.progress = {
    ...(next.progress || {}),
    percent: Math.max(1, Number(next.progress?.percent || 0)),
    label: "Worker 已接手，正在准备执行。",
    stage: queueStageMap[next.type] || "input",
    updatedAt: now()
  };
  const project = db.projects.find((item) => item.id === next.projectId);
  if (project) {
    project.status = "running";
    project.activeQueueId = next.id;
    setProjectProgress(project, {
      ...next.progress,
      status: next.status,
      queueId: next.id
    });
    if (next.progress.stage && next.progress.stage !== "input") {
      setStage(project, next.progress.stage, "running", next.progress.label);
    }
  }
  }
  writeDb(db);

  for (const next of nextItems) {
    runQueueItem(next).catch((error) => console.error("Queue item crashed:", error));
  }
}

async function runQueueItem(next) {
  try {
    await executeQueueItem(next);
    const doneDb = readDb();
    const doneItem = doneDb.queueItems.find((item) => item.id === next.id);
    const doneProject = doneDb.projects.find((item) => item.id === next.projectId);
    if (doneItem) {
      doneItem.status = "completed";
      doneItem.finishedAt = now();
      doneItem.updatedAt = now();
      doneItem.progress = {
        ...(doneItem.progress || {}),
        percent: 100,
        label: "任务已完成。",
        updatedAt: now()
      };
    }
    if (doneProject) {
      const nextActive = activeQueueItems(doneDb).find((item) => item.projectId === doneProject.id && item.id !== doneItem?.id);
      doneProject.activeQueueId = nextActive?.id || "";
      setProjectProgress(doneProject, {
        percent: 100,
        label: doneItem?.progress?.label || "任务已完成。",
        stage: doneItem?.progress?.stage || doneProject.currentStage,
        status: doneProject.status,
        queueId: doneItem?.id || ""
      });
    }
    writeDb(doneDb);
  } catch (error) {
    const failDb = readDb();
    const failedItem = failDb.queueItems.find((item) => item.id === next.id);
    const failedProject = failDb.projects.find((item) => item.id === next.projectId);
    const message = error?.message || "任务执行失败";
    if (failedItem) {
      failedItem.status = "failed";
      failedItem.lastError = message;
      failedItem.finishedAt = now();
      failedItem.updatedAt = now();
      failedItem.progress = {
        ...(failedItem.progress || {}),
        label: message,
        updatedAt: now()
      };
    }
    if (failedProject) {
      const stage = failedItem?.progress?.stage || queueStageMap[failedItem?.type] || failedProject.currentStage;
      const nextActive = activeQueueItems(failDb).find((item) => item.projectId === failedProject.id && item.id !== failedItem?.id);
      failedProject.status = nextActive ? "running" : "failed";
      failedProject.activeQueueId = nextActive?.id || "";
      failedProject.lastError = message;
      setProjectProgress(failedProject, {
        percent: failedItem?.progress?.percent || 0,
        label: message,
        stage,
        status: failedProject.status,
        queueId: failedItem?.id || ""
      });
      if (stage && failedProject.stageState?.[stage]) setStage(failedProject, stage, "failed", message);
      pushJob(failDb, failedProject.id, failedItem?.type || "queue", "failed", message);
    }
    writeDb(failDb);
  } finally {
    activeQueueItemIds.delete(next.id);
    scheduleQueue();
  }
}

async function executeQueueItem(item) {
  if (["synthesize_speech", "render_video", "run_all", "ab_render"].includes(item.type)) {
    assertResourcesAvailable(item);
  }
  if (item.type === "process_source") return processSourceProject(item.projectId, { queueId: item.id });
  if (item.type === "generate_script") return await generateScriptProject(item.projectId, { queueId: item.id, payload: item.payload });
  if (item.type === "synthesize_speech") return synthesizeProject(item.projectId, { queueId: item.id, payload: item.payload });
  if (item.type === "render_video") return renderProject(item.projectId, {
    queueId: item.id,
    videoSettings: item.payload?.videoSettings,
    audioVersionId: item.payload?.audioVersionId,
    avatarAssetId: item.payload?.avatarAssetId,
    backgroundMusicAssetId: item.payload?.backgroundMusicAssetId,
    generateSubtitles: item.payload?.generateSubtitles,
    previewDuration: item.payload?.previewDuration,
    variantLabel: item.payload?.variantLabel
  });
  if (item.type === "run_all") return runAllProject(item.projectId, { queueId: item.id });
  if (item.type === "ab_render") return renderAbProject(item.projectId, { queueId: item.id, payload: item.payload });
  throw new Error(`Unknown queue type: ${item.type}`);
}

function recoverQueueOnBoot() {
  const db = readDb();
  let changed = false;
  for (const item of db.queueItems || []) {
    if (item.status !== "running") continue;
    item.status = "failed";
    item.lastError = "服务重启后，上一次运行中的任务已标记为失败，可点击重试。";
    item.finishedAt = now();
    item.updatedAt = now();
    changed = true;
    const project = db.projects.find((entry) => entry.id === item.projectId);
    if (project) {
      project.status = "failed";
      project.activeQueueId = "";
      project.lastError = item.lastError;
      setProjectProgress(project, {
        percent: item.progress?.percent || 0,
        label: item.lastError,
        stage: item.progress?.stage || queueStageMap[item.type] || project.currentStage,
        status: "failed",
        queueId: item.id
      });
    }
  }
  if (changed) writeDb(db);
  scheduleQueue();
}

function extractLinks(text = "") {
  const candidates = new Set();
  const normalized = text
    .replace(/[“”‘’]/g, "")
    .replace(/[，。！？；、]/g, " ")
    .replace(/\s+/g, " ");
  const knownUrlPattern = /((?:https?:\/\/)?(?:www\.)?(?:v\.douyin\.com|www\.douyin\.com|douyin\.com|iesdouyin\.com|tiktok\.com|www\.tiktok\.com|b23\.tv|bilibili\.com|youtube\.com|youtu\.be|xhslink\.com|xiaohongshu\.com|www\.xiaohongshu\.com)(?:\/[^\s<>"'，。！？；]*)?)/gi;
  const explicitUrlPattern = /((?:https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"'，。！？；]*)?)/gi;
  for (const pattern of [knownUrlPattern, explicitUrlPattern]) {
    for (const match of normalized.matchAll(pattern)) {
      let url = match[1].trim().replace(/[)\]}]+$/, "");
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      candidates.add(url);
    }
  }
  return Array.from(candidates).map((url) => ({
    id: `link-${randomUUID()}`,
    url,
    platform: classifyLink(url),
    status: "detected"
  }));
}

function extractExplicitUrls(text = "") {
  const candidates = new Set();
  const pattern = /((?:https?:\/\/|www\.)[^\s<>"'，。！？；、]+)/gi;
  for (const match of text.matchAll(pattern)) {
    let url = match[1].trim().replace(/[)\]}]+$/, "");
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    candidates.add(url);
  }
  return Array.from(candidates);
}

function classifyLink(url) {
  if (/douyin|iesdouyin/i.test(url)) return "douyin";
  if (/tiktok/i.test(url)) return "tiktok";
  if (/bilibili|b23\.tv/i.test(url)) return "bilibili";
  if (/youtube|youtu\.be/i.test(url)) return "youtube";
  if (/xhslink|xiaohongshu/i.test(url)) return "xiaohongshu";
  if (isDirectMediaUrl(url)) return "direct_media";
  return "web";
}

function isDirectMediaUrl(url) {
  try {
    return /\.(mp4|mov|m4v|webm|mp3|m4a|wav|aac|ogg)(?:$|[?#])/i.test(new URL(url).pathname);
  } catch {
    return /\.(mp4|mov|m4v|webm|mp3|m4a|wav|aac|ogg)(?:$|[?#])/i.test(url);
  }
}

function mediaTitleFromUrl(url) {
  try {
    return decodeURIComponent(basename(new URL(url).pathname)) || url;
  } catch {
    return basename(url) || url;
  }
}

const browserUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const mobileBrowserUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function extractDouyinVideoId(...values) {
  for (const value of values) {
    const match = String(value || "").match(/(?<!\d)(\d{16,22})(?!\d)/);
    if (match) return match[1];
  }
  return "";
}

function douyinTitle(aweme = {}, fallback = "抖音视频") {
  const desc = String(aweme.desc || aweme.preview_title || "").trim();
  const line = desc.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  return (line || String(aweme.aweme_id || fallback)).replace(/\s+/g, " ").slice(0, 120);
}

function decodeHtmlText(text = "") {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function decodeJsEscapedText(text = "") {
  return String(text || "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003D/gi, "=")
    .replace(/\\u003F/gi, "?")
    .replace(/\\u003A/gi, ":");
}

function shareNoiseToken(token = "") {
  const value = token.trim();
  if (!value) return true;
  if (/[\u4e00-\u9fff]/.test(value)) return false;
  return /^[#@:/.\-\w]+$/.test(value) && (
    /\d/.test(value) ||
    value.includes(":/") ||
    value.includes("@") ||
    /^[A-Za-z]{1,4}$/.test(value) ||
    /^[A-Za-z0-9_.-]{4,}$/.test(value)
  );
}

function inferDouyinCaptionFromShareText(shareText = "") {
  const urls = extractExplicitUrls(shareText);
  let text = String(shareText || "");
  for (const url of urls) text = text.replace(url, " ");
  text = text
    .replace(/复制打开抖音，?看看【.+?的作品】/g, " ")
    .replace(/看看【.+?的作品】/g, " ")
    .replace(/复制此链接，?打开Dou音搜索，?直接观看视频！?/gi, " ")
    .replace(/复制此链接，?打开抖音搜索，?直接观看视频！?/g, " ")
    .replace(/打开抖音搜索，?直接观看视频！?/g, " ")
    .replace(/打开Dou音搜索，?直接观看视频！?/gi, " ")
    .replace(/来抖音，?记录美好生活！?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = text.split(/\s+/);
  while (tokens.length && shareNoiseToken(tokens[0])) {
    if (/^[A-Za-z]{1,4}$/.test(tokens[0]) && /[\u4e00-\u9fff]/.test(tokens[1] || "")) break;
    tokens.shift();
  }
  while (tokens.length && shareNoiseToken(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ")
    .replace(/^[：:，,。.\s-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDouyinDescription(text = "") {
  const decoded = decodeHtmlText(text);
  return decoded
    .replace(/\s+-\s+.+?于\d{8}发布在抖音.*$/s, "")
    .replace(/\s+-\s*抖音\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function douyinAuthorFromDescription(text = "") {
  return decodeHtmlText(text).match(/\s+-\s+(.+?)于\d{8}发布在抖音/)?.[1]?.trim() || "";
}

function parseHtmlAttributes(tag = "") {
  const attrs = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlText(match[2] || match[3] || match[4] || "");
  }
  return attrs;
}

function parseMetaContent(html = "", key, value) {
  const expectedKey = key.toLowerCase();
  const expectedValue = value.toLowerCase();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseHtmlAttributes(match[0]);
    if (String(attrs[expectedKey] || "").toLowerCase() === expectedValue) return attrs.content || "";
  }
  return "";
}

function parseHtmlTitle(html = "") {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return cleanDouyinPageTitle(decodeHtmlText(match?.[1] || ""));
}

function extractDouyinPlayableUrlsFromHtml(html = "") {
  const decoded = decodeJsEscapedText(decodeHtmlText(html));
  const urls = new Set();
  for (const match of decoded.matchAll(/https?:\/\/[^"'<>\\\s]+/gi)) {
    const url = match[0].replace(/[),.;]+$/g, "");
    if (/\/aweme\/v1\/play|douyinvod|mime_type=video_mp4|video_id=/i.test(url)) urls.add(url);
  }
  for (const match of decoded.matchAll(/"play_addr"\s*:\s*\{[\s\S]{0,1400}?"url_list"\s*:\s*\[([\s\S]*?)\]/gi)) {
    for (const urlMatch of match[1].matchAll(/"([^"]+)"/g)) {
      const url = decodeJsEscapedText(urlMatch[1]);
      if (/^https?:\/\//i.test(url)) urls.add(url);
    }
  }
  return Array.from(urls).map((url, index) => ({
    url,
    label: "mobile_share_play_addr",
    score: 8_500_000_000 - index,
    size: 0
  }));
}

async function resolveDouyinShareMetadata(url, shareText = "", options = {}) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": mobileBrowserUserAgent,
      "Accept-Language": "zh-CN,zh;q=0.9",
      Accept: "text/html,application/xhtml+xml,*/*"
    },
    signal: AbortSignal.timeout(options.probeTimeout || 45000)
  });
  if (!response.ok) throw new Error(`抖音分享页提取失败：HTTP ${response.status}`);
  const html = await response.text();
  const title = parseHtmlTitle(html);
  const description = parseMetaContent(html, "name", "description") || parseMetaContent(html, "property", "og:description");
  const canonical = parseHtmlAttributes(html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || "").href || response.url;
  const caption = cleanDouyinDescription(description) || cleanDouyinPageTitle(title) || inferDouyinCaptionFromShareText(shareText);
  return {
    finalUrl: canonical || response.url,
    videoId: extractDouyinVideoId(canonical, response.url, html, shareText),
    title,
    description: decodeHtmlText(description),
    caption,
    author: douyinAuthorFromDescription(description),
    videoCandidates: extractDouyinPlayableUrlsFromHtml(html)
  };
}

function fallbackDouyinMetadata(videoId, shareText = "", hints = {}) {
  const author = shareText.match(/看看【(.+?)的作品】/)?.[1] || "";
  const desc = cleanDouyinDescription(hints.description || "")
    || hints.caption
    || inferDouyinCaptionFromShareText(shareText)
    || cleanDouyinPageTitle(hints.title || "")
    || videoId
    || "抖音视频";
  return {
    aweme_detail: {
      aweme_id: videoId,
      desc,
      duration: 0,
      author: { nickname: hints.author || author },
      video: {}
    }
  };
}

function cleanDouyinPageTitle(text = "") {
  return String(text || "")
    .replace(/\s*-\s*抖音\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function douyinVideoCandidates(metadata = {}) {
  const video = metadata.aweme_detail?.video || {};
  const candidates = [];
  const addAddr = (addr, label, score) => {
    if (!addr || typeof addr !== "object") return;
    for (const url of addr.url_list || []) {
      if (typeof url === "string" && /^https?:\/\//i.test(url)) {
        candidates.push({ url, label, score, size: addr.data_size || 0 });
      }
    }
  };
  for (const bitrate of video.bit_rate || []) {
    const codecBonus = bitrate.is_bytevc1 || bitrate.is_h265 ? 0 : 10_000_000_000;
    addAddr(bitrate.play_addr, bitrate.gear_name || "bit_rate", codecBonus + Number(bitrate.bit_rate || 0));
  }
  addAddr(video.play_addr_h264, "play_addr_h264", 9_000_000_000);
  addAddr(video.play_addr, "play_addr", 1_000_000_000);
  addAddr(video.download_addr, "download_addr", 500_000_000);
  const seen = new Set();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
}

function douyinSubtitleCandidates(metadata = {}) {
  const video = metadata.aweme_detail?.video || {};
  const found = [];
  const add = (url, label, format = "", language = "") => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) found.push({ url, label, format, language });
  };
  for (const item of video.subtitleInfos || []) add(item.Url || item.url, "subtitleInfos", item.Format, item.LanguageCodeName);
  for (const item of video.cla_info?.caption_infos || []) add(item.url || item.Url || item.caption_url, "cla_info.caption_infos", item.Format, item.lang);
  const walk = (obj, path = "") => {
    if (Array.isArray(obj)) {
      obj.forEach((value, index) => walk(value, `${path}[${index}]`));
      return;
    }
    if (!obj || typeof obj !== "object") return;
    const context = path.toLowerCase();
    if (["subtitle", "caption", "cla_info"].some((token) => context.includes(token))) {
      add(obj.url || obj.Url || obj.caption_url || obj.subtitle_url, path, obj.Format, obj.lang || obj.language);
    }
    for (const [key, value] of Object.entries(obj)) walk(value, path ? `${path}.${key}` : key);
  };
  walk(video);
  const seen = new Set();
  return found.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function collectJsonText(obj, out = []) {
  const textKeys = new Set(["text", "content", "caption", "sentence", "utterance", "line"]);
  if (Array.isArray(obj)) {
    obj.forEach((item) => collectJsonText(item, out));
  } else if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      if (textKeys.has(key.toLowerCase()) && typeof value === "string" && value.trim()) out.push(value.trim());
      else collectJsonText(value, out);
    }
  }
  return out;
}

function subtitleTextFromBuffer(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const stripped = text.trimStart();
  const lines = [];
  if (stripped.startsWith("{") || stripped.startsWith("[")) {
    try {
      collectJsonText(JSON.parse(text), lines);
    } catch {
      // Fall through to line parsing.
    }
  }
  if (!lines.length && text.split(/\r?\n/).filter((line) => line.trim()).every((line) => line.trim().startsWith("{"))) {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        collectJsonText(JSON.parse(line), lines);
      } catch {
        // Ignore malformed jsonl lines.
      }
    }
  }
  if (!lines.length) {
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine
        .trim()
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ");
      if (!line || /^\d+$/.test(line) || line.includes("-->") || /^(WEBVTT|NOTE)$/i.test(line)) continue;
      lines.push(line);
    }
  }
  const compact = [];
  for (const line of lines.map((item) => item.trim()).filter(Boolean)) {
    if (compact[compact.length - 1] !== line) compact.push(line);
  }
  return compact.join("\n");
}

function cookieHeader(cookies = []) {
  return cookies.filter((item) => item.name).map((item) => `${item.name}=${item.value}`).join("; ");
}

async function downloadBuffer(url, { referer = "", cookie = "", timeout = 90000, userAgent = browserUserAgent } = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "*/*",
      ...(referer ? { Referer: referer } : {}),
      ...(cookie ? { Cookie: cookie } : {})
    },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function parseJsonFromStdout(stdout = "") {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("本地 ASR 未返回结果。");
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/).reverse();
    for (const line of lines) {
      const candidate = line.trim();
      if (!candidate.startsWith("{")) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        // Keep looking for the final JSON payload.
      }
    }
    throw new Error("本地 ASR 返回内容不是合法 JSON。");
  }
}

const runtimeWorkers = {
  asr: createRuntimeWorker("asr"),
  tts: createRuntimeWorker("tts"),
  avatar: createRuntimeWorker("avatar")
};

function appendTail(current = "", chunk = "", max = 6000) {
  const next = `${current}${chunk}`;
  return next.length > max ? next.slice(-max) : next;
}

async function inspectLocalRuntime(kind) {
  const toolPath = kind === "asr" ? ASR_TOOL_PATH : TTS_TOOL_PATH;
  if (!existsSync(toolPath)) throw new Error(kind === "asr" ? "缺少本地 ASR CLI 工具。" : "缺少本地 TTS CLI 工具。");
  const { stdout } = await execFileAsync(process.execPath, [toolPath, "doctor"], {
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 4,
    env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
  });
  const runtime = parseJsonFromStdout(stdout);
  if (!runtime.ready) throw new Error(`${kind === "asr" ? "ASR" : "TTS"} 运行环境未就绪：${(runtime.missing || []).join(", ")}`);
  return runtime;
}

function createRuntimeWorker(kind) {
  const label = kind === "asr" ? "语音识别模型" : kind === "tts" ? "音频合成模型" : "视频合成模型";
  const workerPath = kind === "asr" ? ASR_WORKER_PATH : kind === "tts" ? TTS_WORKER_PATH : MUSETALK_WORKER_PATH;
  const defaults = kind === "asr"
    ? {
        language: process.env.DH_ASR_LANGUAGE || "Chinese",
        deviceMap: process.env.DH_ASR_DEVICE_MAP || "mps",
        dtype: process.env.DH_ASR_DTYPE || "float16",
        maxNewTokens: process.env.DH_ASR_MAX_NEW_TOKENS || "1024"
      }
    : kind === "tts" ? {
        language: process.env.DH_TTS_LANGUAGE || "Chinese",
        deviceMap: process.env.DH_TTS_DEVICE_MAP || "mps",
        dtype: process.env.DH_TTS_DTYPE || "float16"
      } : {};
  return {
    kind,
    label,
    process: null,
    status: "stopped",
    startedAt: "",
    readyAt: "",
    loadMs: 0,
    error: "",
    stderr: "",
    stdoutBuffer: "",
    pending: new Map(),
    startPromise: null,
    async start() {
      if (this.status === "running") return this.publicStatus();
      if (this.status === "starting" && this.startPromise) return this.startPromise;
      if (!existsSync(workerPath)) throw new Error(`缺少 ${label} worker：${workerPath}`);
      if (kind === "avatar") {
        const check = validateMuseTalkInstall(join(MODEL_HOME, "avatar", "MuseTalk"));
        if (!check.ok) throw new Error(`MuseTalk 运行环境未就绪：${check.missing.join(", ")}`);
      }
      const runtime = kind === "avatar" ? { python: process.execPath } : await inspectLocalRuntime(kind);
      const args = kind === "avatar"
        ? [workerPath]
        : [
            workerPath,
            "--model",
            runtime.model,
            "--language",
            defaults.language,
            "--device-map",
            defaults.deviceMap,
            "--dtype",
            defaults.dtype
          ];
      if (kind === "asr") args.push("--max-new-tokens", String(defaults.maxNewTokens));
      this.stop(false);
      this.status = "starting";
      this.error = "";
      this.stderr = "";
      this.stdoutBuffer = "";
      this.startedAt = now();
      this.readyAt = "";
      this.loadMs = 0;
      const child = spawn(runtime.python, args, {
        cwd: rootDir,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
      });
      this.process = child;
      child.stderr.on("data", (chunk) => {
        this.stderr = appendTail(this.stderr, chunk.toString());
      });
      child.stdout.on("data", (chunk) => {
        this.stdoutBuffer += chunk.toString();
        let index = this.stdoutBuffer.indexOf("\n");
        while (index !== -1) {
          const line = this.stdoutBuffer.slice(0, index).trim();
          this.stdoutBuffer = this.stdoutBuffer.slice(index + 1);
          if (line) this.handleLine(line);
          index = this.stdoutBuffer.indexOf("\n");
        }
      });
      child.on("exit", (code, signal) => {
        for (const pending of this.pending.values()) pending.reject(new Error(`${label} worker 已退出。code=${code ?? ""} signal=${signal ?? ""}`));
        this.pending.clear();
        if (this.process === child) {
          this.process = null;
          this.status = "stopped";
        }
      });
      this.startPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`${label} 启动超时。${this.stderr ? `stderr: ${this.stderr}` : ""}`));
        }, Number(process.env.DH_MODEL_WARM_TIMEOUT_MS || 1200000));
        this.pending.set("__ready__", {
          resolve: (payload) => {
            clearTimeout(timer);
            this.startPromise = null;
            resolve(payload);
          },
          reject: (error) => {
            clearTimeout(timer);
            this.startPromise = null;
            reject(error);
          }
        });
      });
      return this.startPromise;
    },
    handleLine(line) {
      let payload;
      try {
        payload = JSON.parse(line);
      } catch {
        this.stderr = appendTail(this.stderr, `${line}\n`);
        return;
      }
      if (payload.event === "ready") {
        const pending = this.pending.get("__ready__");
        this.pending.delete("__ready__");
        if (payload.ok) {
          this.status = "running";
          this.readyAt = now();
          this.loadMs = Number(payload.load_ms || 0);
          pending?.resolve(this.publicStatus());
        } else {
          this.status = "failed";
          this.error = payload.error || `${label} 启动失败。`;
          pending?.reject(new Error(this.error));
        }
        return;
      }
      const pending = this.pending.get(payload.id);
      if (!pending) return;
      this.pending.delete(payload.id);
      if (payload.ok) pending.resolve(payload);
      else pending.reject(new Error(payload.error || `${label} 执行失败。`));
    },
    async request(payload, timeout = 1200000) {
      await this.start();
      if (!this.process?.stdin?.writable) throw new Error(`${label} worker 未运行。`);
      const id = `runtime-${randomUUID()}`;
      const command = { ...payload, id };
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`${label} 执行超时。`));
        }, timeout);
        this.pending.set(id, {
          resolve: (result) => {
            clearTimeout(timer);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          }
        });
      });
      this.process.stdin.write(`${JSON.stringify(command)}\n`);
      return response;
    },
    stop(markStopped = true) {
      if (this.process) {
        try {
          if (this.process.stdin?.writable) this.process.stdin.write(`${JSON.stringify({ id: `shutdown-${randomUUID()}`, command: "shutdown" })}\n`);
        } catch {
          // Ignore shutdown pipe errors.
        }
        this.process.kill("SIGTERM");
      }
      this.process = null;
      this.startPromise = null;
      for (const pending of this.pending.values()) pending.reject(new Error(`${label} worker 已停止。`));
      this.pending.clear();
      if (markStopped) {
        this.status = "stopped";
        this.readyAt = "";
        this.error = "";
      }
      return this.publicStatus();
    },
    publicStatus() {
      return {
        kind,
        label,
        status: this.status,
        startedAt: this.startedAt,
        readyAt: this.readyAt,
        loadMs: this.loadMs,
        error: this.error,
        pid: this.process?.pid || null
      };
    }
  };
}

function runtimeWorkerStatus() {
  return {
    asr: runtimeWorkers.asr.publicStatus(),
    tts: runtimeWorkers.tts.publicStatus(),
    avatar: runtimeWorkers.avatar.publicStatus()
  };
}

async function transcribeWithLocalAsr(audioPath, options = {}) {
  if (runtimeWorkers.asr.status === "running" || runtimeWorkers.asr.status === "starting") {
    const result = await runtimeWorkers.asr.request({
      command: "transcribe",
      audio: audioPath,
      language: options.language || "Chinese"
    }, options.asrTimeout || 1200000);
    if (!result.ok) throw new Error(result.error || "本地 ASR 转写失败。");
    return result;
  }
  const args = [
    ASR_TOOL_PATH,
    "transcribe",
    "--audio",
    audioPath,
    "--language",
    options.language || "Chinese",
    "--timeout",
    String(options.asrTimeout || 1200000)
  ];
  if (options.deviceMap) args.push("--device-map", options.deviceMap);
  if (options.dtype) args.push("--dtype", options.dtype);
  if (options.maxNewTokens) args.push("--max-new-tokens", String(options.maxNewTokens));
  const { stdout } = await execFileAsync(process.execPath, args, {
    timeout: options.asrTimeout || 1200000,
    maxBuffer: 1024 * 1024 * 16,
    env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
  });
  const result = parseJsonFromStdout(stdout);
  if (!result.ok) throw new Error(result.error || "本地 ASR 转写失败。");
  return result;
}

async function resolveDouyinDetail(link, shareText, options = {}) {
  let shareMetadata = null;
  try {
    shareMetadata = await resolveDouyinShareMetadata(link.url, shareText, options);
  } catch {
    shareMetadata = null;
  }
  const { chromium } = await import("playwright");
  const launchOptions = [
    { channel: "chrome", headless: true },
    { headless: true }
  ];
  let browser = null;
  const errors = [];
  for (const option of launchOptions) {
    try {
      browser = await chromium.launch(option);
      break;
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (!browser) throw new Error(`无法启动浏览器解析抖音链接：${errors.join(" | ")}`);
  try {
    const context = await browser.newContext({ userAgent: browserUserAgent, locale: "zh-CN" });
    const page = await context.newPage();
    await page.goto(shareMetadata?.finalUrl || link.url, { waitUntil: "domcontentloaded", timeout: options.probeTimeout || 60000 });
    await page.waitForTimeout(options.browserWaitMs || 4500);
    const finalUrl = shareMetadata?.finalUrl || page.url();
    const pageTitle = cleanDouyinPageTitle(await page.title().catch(() => "")) || shareMetadata?.caption || shareMetadata?.title || "";
    let videoId = extractDouyinVideoId(finalUrl, shareMetadata?.videoId);
    if (!videoId) {
      const content = await page.content().catch(() => "");
      videoId = extractDouyinVideoId(content, shareText);
    }
    if (!videoId) throw new Error(`未能从抖音跳转页提取视频 ID：${finalUrl}`);
    const api = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${videoId}`;
    const result = await page.evaluate(async ({ apiUrl, timeoutMs }) => {
      return Promise.race([
        fetch(apiUrl, {
          credentials: "include",
          headers: { accept: "application/json, text/plain, */*" }
        })
          .then(async (response) => ({ status: response.status, url: response.url, text: await response.text(), timeout: false }))
          .catch((error) => ({ status: 0, url: apiUrl, text: "", timeout: false, error: error?.message || "fetch failed" })),
        new Promise((resolve) => setTimeout(() => resolve({ status: 0, url: apiUrl, text: "", timeout: true }), timeoutMs))
      ]);
    }, { apiUrl: api, timeoutMs: options.apiTimeout || 20000 });
    const cookies = await context.cookies();
    if (result.timeout || result.status !== 200 || !result.text) {
      return {
        metadata: fallbackDouyinMetadata(videoId, shareText, shareMetadata || { title: pageTitle }),
        videoId,
        finalUrl,
        pageTitle,
        shareMetadata,
        apiUrl: api,
        cookies,
        detailFallback: result.timeout ? "timeout" : `HTTP ${result.status || "empty"}`
      };
    }
    const metadata = JSON.parse(result.text || "{}");
    if (!metadata.aweme_detail) {
      return {
        metadata: fallbackDouyinMetadata(videoId, shareText, shareMetadata || { title: pageTitle }),
        videoId,
        finalUrl,
        pageTitle,
        shareMetadata,
        apiUrl: api,
        cookies,
        detailFallback: "no_aweme_detail"
      };
    }
    return { metadata, videoId, finalUrl, pageTitle, shareMetadata, apiUrl: api, cookies };
  } finally {
    const browserProcess = typeof browser.process === "function" ? browser.process() : null;
    await Promise.race([
      browser.close().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1200))
    ]);
    if (browserProcess && !browserProcess.killed) browserProcess.kill("SIGKILL");
  }
}

async function extractDouyinLink(link, projectId, shareText, options = {}) {
  const outDir = join(artifactDir, projectId, "sources", link.id);
  mkdirSync(outDir, { recursive: true });
  try {
    const detail = await resolveDouyinDetail(link, shareText, options);
    const aweme = detail.metadata.aweme_detail || {};
    const title = cleanDouyinPageTitle(douyinTitle(aweme, detail.shareMetadata?.caption || detail.pageTitle || detail.videoId) || detail.shareMetadata?.caption || detail.pageTitle);
    const author = aweme.author?.nickname || detail.shareMetadata?.author || "";
    writeFileSync(join(outDir, "metadata.json"), JSON.stringify(detail.metadata, null, 2));

    let transcriptText = "";
    for (const candidate of douyinSubtitleCandidates(detail.metadata)) {
      try {
        const buffer = await downloadBuffer(candidate.url, {
          referer: detail.finalUrl,
          cookie: cookieHeader(detail.cookies),
          timeout: options.probeTimeout || 60000
        });
        transcriptText = subtitleTextFromBuffer(buffer);
        if (transcriptText) {
          writeFileSync(join(outDir, "transcript.txt"), transcriptText);
          break;
        }
      } catch {
        // Subtitle download is best effort; audio ASR will be attempted next.
      }
    }

    const videoCandidates = [
      ...(detail.shareMetadata?.videoCandidates || []),
      ...douyinVideoCandidates(detail.metadata)
    ];
    let videoPath = "";
    let audioPath = "";
    let mediaDuration = aweme.duration ? Math.round(Number(aweme.duration) / 1000) : 0;
    let downloadMessage = "";
    for (const candidate of videoCandidates) {
      try {
        const buffer = await downloadBuffer(candidate.url, {
          referer: detail.finalUrl,
          cookie: cookieHeader(detail.cookies),
          userAgent: candidate.label === "mobile_share_play_addr" ? mobileBrowserUserAgent : browserUserAgent,
          timeout: options.downloadTimeout || 180000
        });
        if (buffer.length < 50 * 1024) continue;
        videoPath = join(outDir, "video.mp4");
        writeFileSync(videoPath, buffer);
        audioPath = join(outDir, "audio.wav");
        await execFileAsync("ffmpeg", [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          videoPath,
          "-vn",
          "-acodec",
          "pcm_s16le",
          "-ar",
          "16000",
          "-ac",
          "1",
          audioPath
        ], { timeout: options.downloadTimeout || 180000, maxBuffer: 1024 * 1024 * 8 });
        mediaDuration = await probeMediaDuration(videoPath) || await probeMediaDuration(audioPath) || mediaDuration;
        break;
      } catch (error) {
        downloadMessage = error instanceof Error ? error.message : "视频候选地址下载失败。";
      }
    }

    return {
      ...link,
      status: audioPath ? "downloaded" : transcriptText ? "ready" : "needs_attention",
      title,
      author,
      duration: mediaDuration,
      webpageUrl: detail.finalUrl,
      videoPath,
      videoUri: videoPath ? publicPath(videoPath) : "",
      audioPath,
      audioUri: audioPath ? publicPath(audioPath) : "",
      transcriptText,
      transcriptStatus: transcriptText ? "subtitle" : "",
      message: transcriptText
        ? "已从抖音字幕提取文本。"
        : audioPath
          ? "已下载抖音视频并提取音频，正在启动文案识别。"
          : videoCandidates.length
            ? `已找到 ${videoCandidates.length} 个视频候选地址，但下载或抽音频失败：${downloadMessage || "未知错误"}。`
          : detail.detailFallback
            ? `抖音详情接口${detail.detailFallback === "timeout" ? "超时" : "未返回可用数据"}，已使用分享页标题/描述作为文本。`
          : "已解析抖音详情，但没有找到可下载的视频地址。"
    };
  } catch (error) {
    return {
      ...link,
      status: "download_failed",
      message: error instanceof Error ? error.message : "抖音链接解析失败。"
    };
  }
}

async function probeLinkWithYtdlp(link, options = {}) {
  try {
    const command = existsSync(YT_DLP_BIN) ? YT_DLP_BIN : "yt-dlp";
    const { stdout } = await execFileAsync(command, ["--dump-single-json", "--skip-download", "--no-playlist", link.url], {
      timeout: options.probeTimeout || 120000,
      maxBuffer: 1024 * 1024 * 8
    });
    const data = JSON.parse(stdout || "{}");
    return {
      ...link,
      status: "ready",
      title: data.title || "",
      duration: data.duration || 0,
      webpageUrl: data.webpage_url || link.url
    };
  } catch (error) {
    if (isDirectMediaUrl(link.url)) {
      return {
        ...link,
        status: "ready",
        title: mediaTitleFromUrl(link.url),
        duration: 0,
        webpageUrl: link.url,
        message: "已识别为直链媒体，跳过 yt-dlp 探测。"
      };
    }
    return {
      ...link,
      status: "needs_attention",
      message: "已识别链接，但下载探测未完成，可能需要登录态、cookies 或平台规则已变化。"
    };
  }
}

async function downloadLinkAudio(link, projectId, options = {}) {
  if (link.status !== "ready") return link;
  const outDir = join(artifactDir, projectId, "sources");
  mkdirSync(outDir, { recursive: true });
  const audioPath = join(outDir, `${link.id}.wav`);
  try {
    if (isDirectMediaUrl(link.url)) {
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        link.url,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        audioPath
      ], { timeout: options.downloadTimeout || 300000, maxBuffer: 1024 * 1024 * 8 });
    } else {
      const command = existsSync(YT_DLP_BIN) ? YT_DLP_BIN : "yt-dlp";
      await execFileAsync(command, [
        "--no-playlist",
        "--extract-audio",
        "--audio-format",
        "wav",
        "-o",
        join(outDir, `${link.id}.%(ext)s`),
        link.url
      ], {
        timeout: options.downloadTimeout || 300000,
        maxBuffer: 1024 * 1024 * 8
      });
    }
    return {
      ...link,
      status: existsSync(audioPath) ? "downloaded" : "ready",
      audioPath: existsSync(audioPath) ? audioPath : "",
      audioUri: existsSync(audioPath) ? publicPath(audioPath) : ""
    };
  } catch {
    return {
      ...link,
      status: "download_failed",
      message: "链接已识别，但下载失败，可能需要登录态、cookies 或平台规则已变化。"
    };
  }
}

async function transcribeSourceAudio(link, options = {}) {
  if (link.transcriptText) {
    return {
      linkId: link.id,
      text: link.transcriptText,
      status: link.transcriptStatus || "subtitle"
    };
  }
  if (!link.audioPath) return null;
  try {
    const result = await transcribeWithLocalAsr(link.audioPath, options);
    return {
      linkId: link.id,
      text: result.text || "",
      status: result.text ? "transcribed" : "empty",
      metrics: result.metrics || {}
    };
  } catch (error) {
    return {
      linkId: link.id,
      text: link.title || "",
      status: "local_asr_failed",
      message: error instanceof Error ? error.message : "本地文案识别失败。"
    };
  }
}

async function analyzeSource(project, options = {}) {
  const sourceText = project.inputText || project.sourceText || "";
  const links = extractLinks(sourceText);
  const probedLinks = [];
  const transcripts = [];
  for (const link of links.slice(0, 5)) {
    const downloaded = link.platform === "douyin"
      ? await extractDouyinLink(link, project.id, sourceText, options)
      : await downloadLinkAudio(await probeLinkWithYtdlp(link, options), project.id, options);
    probedLinks.push(downloaded);
    const transcript = await transcribeSourceAudio(downloaded, options);
    if (transcript?.text) transcripts.push(transcript);
  }
  project.sourceAnalysis = {
    links: probedLinks,
    transcripts: transcripts.length ? transcripts : probedLinks
      .filter((link) => link.title)
      .map((link) => ({
        linkId: link.id,
        text: link.title,
        status: "metadata"
      })),
    notes: links.length
      ? ["已从输入中识别链接；可用链接会进入下载/ASR 节点。"]
      : ["未识别到视频链接，直接使用输入内容生成。"]
  };
  return project.sourceAnalysis;
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?；;])\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripLinks(text = "") {
  return text
    .replace(/https?:\/\/[^\s，。！？；、]+/gi, "")
    .replace(/\b(?:v\.douyin\.com|xhslink\.com|b23\.tv|youtu\.be|youtube\.com|bilibili\.com|upload\.wikimedia\.org)[^\s，。！？；、]*/gi, "")
    .replace(/参考素材[:：]?/g, "")
    .replace(/固定模型包端到端验证-\d+/g, "数字人视频自动化")
    .replace(/\s+/g, " ")
    .trim();
}

function buildExtractedSourceText(source = "", sourceAnalysis = {}) {
  const directText = stripLinks(source);
  const hasLinks = Boolean((sourceAnalysis.links || []).length);
  const transcriptText = (sourceAnalysis.transcripts || [])
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n\n");
  const titleText = (sourceAnalysis.links || [])
    .filter((link) => link.title)
    .map((link) => link.title)
    .join("\n");
  if (hasLinks) return (transcriptText || titleText).trim();
  return directText || source.trim();
}

function sourceExtractionKind(sourceAnalysis = {}) {
  const links = sourceAnalysis.links || [];
  if (!links.length) return "text";
  if ((sourceAnalysis.transcripts || []).some((item) => ["transcribed", "subtitle"].includes(item.status))) return "video_asr";
  if ((sourceAnalysis.transcripts || []).some((item) => item.status === "metadata") || links.some((link) => link.title)) return "link_metadata";
  return "link";
}

function sourceExtractionNotes(source = "", sourceAnalysis = {}) {
  const notes = [...(sourceAnalysis.notes || [])];
  const links = sourceAnalysis.links || [];
  const hasTranscribed = (sourceAnalysis.transcripts || []).some((item) => ["transcribed", "subtitle"].includes(item.status));
  for (const link of links) {
    if (link.message) notes.push(`${link.platform}：${link.message}`);
  }
  for (const transcript of sourceAnalysis.transcripts || []) {
    if (transcript.message) notes.push(`文案识别：${transcript.message}`);
  }
  if (!links.length) {
    notes.push("已识别为文本内容，直接填入输入内容。");
  } else if (!hasTranscribed) {
    notes.push("本次没有拿到可用 ASR 文本，已先使用可提取的视频标题/描述。");
  }
  return Array.from(new Set(notes));
}

function compactChinese(text = "", max = 90) {
  const cleaned = stripLinks(text).replace(/[「」"']/g, "").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

function deriveTopic(input) {
  const sourceText = input.sourceAnalysis?.transcripts?.map((item) => item.text).join("。") || "";
  const directText = stripLinks(input.inputText || input.sourceText || "");
  const combined = [directText, sourceText].filter(Boolean).join("。");
  if (/数字人|口播|ASR|TTS/i.test(combined)) {
    return "数字人视频自动化生成";
  }
  return compactChinese(combined || "短视频内容生产", 22);
}

function deriveProjectTitle(inputText = "", requirements = "") {
  const cleaned = stripLinks(inputText)
    .replace(/^(你好|大家好|哈喽|hello)[，,。！!\s]*/i, "")
    .replace(/我想要|帮我|请你|生成|制作/g, "")
    .trim();
  const firstSentence = cleaned.split(/[。！？!?；;\n]/).map((item) => item.trim()).find(Boolean);
  const base = firstSentence || stripLinks(requirements) || "新建数字人任务";
  return compactChinese(base, 24) || "新建数字人任务";
}

function scriptGenerationMessages(input) {
  const sourceText = buildExtractedSourceText(input.inputText || input.sourceText || "", input.sourceAnalysis || {});
  const payload = {
    sourceText: sourceText || input.inputText || input.sourceText || "",
    requirements: input.requirements || "",
    title: input.title || ""
  };
  return [
    {
      role: "system",
      content: [
        "你是短视频数字人口播策划。",
        "只输出最终口播正文纯文本，不要输出 JSON，不要输出 Markdown，不要输出标题、标签、大纲、发布建议、解释说明或 Thinking Process。",
        "不要展示推理过程，不要先列草稿，直接给最终可朗读正文。",
        "不要保留输入里的话题标签、井号标签或平台标签。",
        "口播文案要自然、可直接朗读，中文为主，避免空话。"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify(payload, null, 2)
    }
  ];
}

function titleGenerationMessages(input) {
  const sourceText = buildExtractedSourceText(input.inputText || input.sourceText || "", input.sourceAnalysis || {});
  return [
    {
      role: "system",
      content: [
        "你是短视频任务命名助手。",
        "只输出一个中文任务标题，不要解释，不要 Markdown，不要引号。",
        "标题要能概括内容主题，避免直接截取原文，避免出现“生成”“帮我”“输入内容”等过程词。",
        "控制在8到18个中文字符，适合显示在任务列表。"
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        sourceText: sourceText || input.inputText || input.sourceText || "",
        requirements: input.requirements || ""
      }, null, 2)
    }
  ];
}

function cleanGeneratedTitle(text = "", fallback = "") {
  const cleaned = stripModelJsonFence(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !/thinking|标题|解释|建议|以下|任务命名/i.test(line)) || "";
  return compactChinese(
    (cleaned || fallback)
      .replace(/^["“”'「标题：:：\s]+|["“”'」\s]+$/g, "")
      .replace(/^(任务标题|标题)\s*[:：]\s*/i, "")
      .replace(/[。！？!?；;，,]+$/g, "")
      .trim(),
    18
  ) || fallback || "新建数字人任务";
}

async function generateProjectTitleWithTextModel(db, input = {}) {
  const fallback = deriveProjectTitle(input.inputText || input.sourceText || "", input.requirements || "");
  const modelId = input.scriptModelId || db.settings.defaultTextModelId || "model-qwen2-5-7b-instruct-4bit-mlx";
  const messages = titleGenerationMessages(input);
  try {
    let result;
    if (String(modelId).startsWith("provider:")) {
      const providerId = String(modelId).replace("provider:", "");
      const provider = db.apiProviders.find((item) => item.id === providerId || item.providerId === providerId);
      if (!provider) return fallback;
      result = await callCloudLlm(provider, messages, { temperature: 0.35, timeout: 60000 });
    } else {
      const model = db.models.find((item) => item.id === modelId && item.type === "llm");
      if (!model) return fallback;
      const detection = detectModel(model);
      model.status = detection.status;
      model.resolvedPath = detection.resolvedPath;
      model.protocolStatus = detection.protocolStatus;
      model.protocolMessage = detection.protocolMessage;
      model.healthMessage = detection.message;
      model.lastCheckedAt = now();
      if (detection.status === "missing") return fallback;
      result = await callLocalLlm(messages, { temperature: 0.35, llmTimeout: 120000 });
    }
    return cleanGeneratedTitle(result.text || "", fallback);
  } catch (error) {
    console.warn(`[title-generation] fallback: ${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

function stripModelJsonFence(text = "") {
  return text
    .trim()
    .replace(/^```(?:json|JSON)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function findBalancedJsonObjects(text = "") {
  const candidates = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return candidates.sort((a, b) => b.length - a.length);
}

function loosenJsonText(text = "") {
  return text
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

function parseJsonCandidate(candidate = "") {
  const attempts = [
    candidate,
    loosenJsonText(candidate)
  ];
  for (const item of attempts) {
    try {
      return JSON.parse(item);
    } catch {
      // Try the next normalized candidate.
    }
  }
  return null;
}

function scriptTextFromModelText(text = "") {
  const badMetaPattern = /thinking process|final review|character count|critique|constraints|analyze the request|^\s*(?:draft|final output)\s*[:：]/im;
  const cleaned = stripModelJsonFence(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^口播文案\s*[:：]\s*/i, "")
    .replace(/^正文\s*[:：]\s*/i, "")
    .trim();
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const spokenLines = lines.filter((line) => {
    if (/^(?:\d+\.|[-*#>`]|[（(]?\d+\s*[字秒]|\(?\d+\)?$)/.test(line)) return false;
    if (/thinking process|final output|final review|character count|draft|critique|constraints|analyze the request|let's|wait,/i.test(line)) return false;
    const cjkCount = (line.match(/[\u4e00-\u9fff]/g) || []).length;
    return cjkCount >= 20 && cjkCount / Math.max(line.length, 1) > 0.45;
  });
  const completeLines = spokenLines.filter((line) => line.length >= 40 && /[。！？!?]$/.test(line));
  const selected = completeLines.at(-1) || spokenLines.sort((a, b) => b.length - a.length)[0] || "";
  const script = selected
    .replace(/^[“”"']+|[“”"']+$/g, "")
    .replace(/\s*#[^\s#，。！？；、]+/g, "")
    .trim();
  if (!script || badMetaPattern.test(script)) return "";
  return script;
}

function stripTopicTags(text = "") {
  return String(text)
    .replace(/\s*#[^\s#，。！？；、]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function publishCopiesFromScript(script = "", fallbackInput = {}, baseTitle = "") {
  const topic = compactChinese(baseTitle || deriveTopic(fallbackInput), 24) || "短视频口播";
  const cleanScript = stripTopicTags(script);
  const tags = ["AI工具", "短视频", "口播文案"];
  return {
    douyin: {
      title: compactChinese(topic, 28),
      body: `${cleanScript}\n\n#${tags.join(" #")}`,
      checklist: ["上传视频", "粘贴标题", "粘贴正文和话题", "检查封面后人工发布"]
    },
    xiaohongshu: {
      title: compactChinese(`${topic}｜实用教程`, 28),
      body: `${cleanScript}\n\n#${tags.join(" #")}`,
      checklist: ["上传视频", "粘贴标题和正文", "选择话题", "检查封面后人工发布"]
    },
    wechat: {
      title: compactChinese(`${topic}：视频口播稿`, 32),
      body: cleanScript,
      checklist: ["上传视频素材", "写入标题和正文", "检查摘要和封面", "人工确认发布"]
    }
  };
}

function publishCopyForProject(project, platform = "douyin") {
  const script = project.artifacts?.script?.script || "";
  const scriptTitle = project.artifacts?.script?.title || "";
  const baseTitle = /数字人视频自动化生成|短视频内容生产/.test(scriptTitle) ? project.title : scriptTitle || project.title;
  const generated = publishCopiesFromScript(script, project, baseTitle);
  const custom = project.artifacts?.script?.platformCopies?.[platform] || project.artifacts?.script?.platformCopies?.douyin;
  const firstLine = stripTopicTags(script).slice(0, 24);
  if (custom?.title && custom?.body && (!firstLine || custom.body.includes(firstLine))) return custom;
  return generated[platform] || generated.douyin;
}

function scriptArtifactFromModelText(text = "", fallbackInput = {}) {
  const cleaned = stripModelJsonFence(text);
  const direct = parseJsonCandidate(cleaned);
  if (direct) return direct;
  for (const candidate of findBalancedJsonObjects(cleaned)) {
    const parsed = parseJsonCandidate(candidate);
    if (parsed?.script) return parsed;
  }
  const fallback = buildScript(fallbackInput);
  return {
    ...fallback,
    script: scriptTextFromModelText(cleaned) || fallback.script
  };
}

function normalizeScriptArtifact(value, fallbackInput) {
  const fallback = buildScript(fallbackInput);
  const rawScript = String(value.script || "").trim();
  const script = scriptTextFromModelText(rawScript) || (rawScript && !/thinking process|<think>|final review|character count|critique|analyze the request/i.test(rawScript) ? rawScript : "") || fallback.script;
  const title = String(value.title || fallback.title);
  const platformCopies = value.platformCopies && Object.keys(value.platformCopies).length
    ? value.platformCopies
    : publishCopiesFromScript(script, fallbackInput, title);
  return {
    title,
    outline: Array.isArray(value.outline) && value.outline.length ? value.outline.map(String) : fallback.outline,
    script,
    tags: Array.isArray(value.tags) ? value.tags.map(String).filter(Boolean) : fallback.tags,
    visualSummary: {
      hook: String(value.visualSummary?.hook || fallback.visualSummary.hook),
      bullets: Array.isArray(value.visualSummary?.bullets) && value.visualSummary.bullets.length
        ? value.visualSummary.bullets.map(String)
        : fallback.visualSummary.bullets,
      cta: String(value.visualSummary?.cta || fallback.visualSummary.cta)
    },
    platformCopies,
    modelInfo: value.modelInfo || null,
    modelParseWarning: value.modelParseWarning || ""
  };
}

async function callLocalLlm(messages, options = {}) {
  if (!existsSync(LLM_TOOL_PATH)) throw new Error("缺少本地 LLM CLI 工具。");
  const timeoutMs = Number(options.llmTimeout || 240000);
  const args = [
    LLM_TOOL_PATH,
    "chat",
    "--messages",
    JSON.stringify(messages),
    "--temperature",
    String(options.temperature ?? 0.55),
    "--timeout",
    String(timeoutMs)
  ];
  if (options.maxTokens !== undefined && options.maxTokens !== null) {
    args.push("--max-tokens", String(options.maxTokens));
  }
  const { stdout } = await execFileAsync(process.execPath, args, {
    timeout: timeoutMs + 5000,
    maxBuffer: 1024 * 1024 * 16,
    env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
  });
  const result = parseJsonFromStdout(stdout);
  if (!result.ok) throw new Error(result.error || "本地文本模型生成失败。");
  return result;
}

async function callCloudLlm(provider, messages, options = {}) {
  const apiKey = provider.apiKey || process.env[provider.envKey];
  if (!apiKey) throw new Error(`${provider.name} 未配置 API Key。`);
  if (!provider.endpoint) throw new Error(`${provider.name} 未配置 endpoint。`);
  if (!provider.model) throw new Error(`${provider.name} 未配置模型名。`);
  const body = {
    model: provider.model,
    messages,
    temperature: options.temperature ?? 0.55
  };
  if (options.maxTokens !== undefined && options.maxTokens !== null) {
    body.max_tokens = options.maxTokens;
  }
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeout || 120000)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${provider.name} 调用失败：HTTP ${response.status} ${raw.slice(0, 240)}`);
  const data = JSON.parse(raw || "{}");
  const text = data.choices?.[0]?.message?.content || data.output_text || data.text || "";
  if (!text) throw new Error(`${provider.name} 未返回文本内容。`);
  return { ok: true, text, metrics: { provider: provider.providerId || provider.id, model: provider.model } };
}

async function callCloudAsr(provider, audioPath, options = {}) {
  const apiKey = provider.apiKey || process.env[provider.envKey];
  if (!apiKey) throw new Error(`${provider.name} 未配置 API Key。`);
  if (!provider.endpoint) throw new Error(`${provider.name} 未配置 endpoint。`);
  if (!provider.model) throw new Error(`${provider.name} 未配置模型名。`);
  const body = new FormData();
  body.append("model", provider.model);
  if (options.language) body.append("language", String(options.language).toLowerCase().startsWith("chinese") ? "zh" : String(options.language));
  body.append("file", new Blob([readFileSync(audioPath)]), basename(audioPath));
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(options.timeout || 120000)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${provider.name} ASR 调用失败：HTTP ${response.status} ${raw.slice(0, 240)}`);
  let data = {};
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    data = { text: raw };
  }
  const text = data.text || data.transcript || data.output_text || data.result?.text || "";
  if (!text) throw new Error(`${provider.name} ASR 未返回转写文本。`);
  return { ok: true, text, segments: data.segments || [], metrics: { provider: provider.id, model: provider.model } };
}

async function callCloudTts(provider, text, outPath, options = {}) {
  const apiKey = provider.apiKey || process.env[provider.envKey];
  if (!apiKey) throw new Error(`${provider.name} 未配置 API Key。`);
  if (!provider.endpoint) throw new Error(`${provider.name} 未配置 endpoint。`);
  if (!provider.model) throw new Error(`${provider.name} 未配置模型名。`);
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      input: text,
      voice: options.voice || "alloy",
      response_format: options.responseFormat || "wav"
    }),
    signal: AbortSignal.timeout(options.timeout || 120000)
  });
  const contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) throw new Error(`${provider.name} TTS 调用失败：HTTP ${response.status} ${buffer.toString("utf-8").slice(0, 240)}`);
  if (contentType.includes("application/json")) {
    const data = JSON.parse(buffer.toString("utf-8") || "{}");
    const audioBase64 = data.audio || data.audio_base64 || data.data?.audio;
    if (!audioBase64) throw new Error(`${provider.name} TTS 未返回音频。`);
    writeFileSync(outPath, Buffer.from(audioBase64, "base64"));
  } else {
    writeFileSync(outPath, buffer);
  }
  if (!existsSync(outPath)) throw new Error(`${provider.name} TTS 未生成音频。`);
  return { ok: true, metrics: { provider: provider.id, model: provider.model, voice: options.voice || "alloy" } };
}

async function generateScriptWithTextModel(db, project, payload = {}) {
  const modelId = payload.scriptModelId || project.scriptModelId || db.settings.defaultTextModelId || "model-qwen2-5-7b-instruct-4bit-mlx";
  const input = { ...project, ...payload, scriptModelId: modelId };
  const messages = scriptGenerationMessages(input);
  let result;
  let modelInfo;
  if (modelId.startsWith("provider:")) {
    const providerId = modelId.replace("provider:", "");
    const provider = db.apiProviders.find((item) => item.id === providerId || item.providerId === providerId);
    if (!provider) throw new Error("未找到已配置的云端 Provider。");
    result = await callCloudLlm(provider, messages, payload);
    modelInfo = { type: "cloud", providerId: provider.providerId, providerName: provider.name, model: provider.model };
  } else {
    const model = db.models.find((item) => item.id === modelId && item.type === "llm");
    if (!model) throw new Error("未找到本地文本模型。");
    const detection = detectModel(model);
    model.status = detection.status;
    model.resolvedPath = detection.resolvedPath;
    model.protocolStatus = detection.protocolStatus;
    model.protocolMessage = detection.protocolMessage;
    model.healthMessage = detection.message;
    model.lastCheckedAt = now();
    if (detection.status === "missing") throw new Error(detection.message);
    result = await callLocalLlm(messages, payload);
    modelInfo = { type: "local", modelId: model.id, modelName: model.name, runtime: model.runtime };
  }
  const parsed = scriptArtifactFromModelText(result.text || "", input);
  return normalizeScriptArtifact({ ...parsed, modelInfo: { ...modelInfo, metrics: result.metrics || {} } }, input);
}

async function polishTextWithTextModel(db, input = {}) {
  const modelId = input.scriptModelId || db.settings.defaultTextModelId || "model-qwen2-5-7b-instruct-4bit-mlx";
  const messages = scriptGenerationMessages({
    inputText: input.inputText || "",
    sourceText: input.inputText || "",
    requirements: input.requirements || ""
  });
  let result;
  let modelInfo;
  if (String(modelId).startsWith("provider:")) {
    const providerId = String(modelId).replace("provider:", "");
    const provider = db.apiProviders.find((item) => item.id === providerId || item.providerId === providerId);
    if (!provider) throw new Error("未找到已配置的云端 Provider。");
    result = await callCloudLlm(provider, messages, input);
    modelInfo = { type: "cloud", providerId: provider.providerId, providerName: provider.name, model: provider.model };
  } else {
    const model = db.models.find((item) => item.id === modelId && item.type === "llm");
    if (!model) throw new Error("未找到本地文本模型。");
    const detection = detectModel(model);
    model.status = detection.status;
    model.resolvedPath = detection.resolvedPath;
    model.protocolStatus = detection.protocolStatus;
    model.protocolMessage = detection.protocolMessage;
    model.healthMessage = detection.message;
    model.lastCheckedAt = now();
    if (detection.status === "missing") throw new Error(detection.message);
    result = await callLocalLlm(messages, input);
    modelInfo = { type: "local", modelId: model.id, modelName: model.name, runtime: model.runtime };
  }
  const artifact = normalizeScriptArtifact(scriptArtifactFromModelText(result.text || "", input), input);
  return {
    text: artifact.script,
    title: artifact.title,
    modelInfo: { ...modelInfo, metrics: result.metrics || {} }
  };
}

function srtTime(seconds) {
  const ms = Math.floor((seconds % 1) * 1000);
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function buildScript(input) {
  const topic = deriveTopic(input);
  const requirements = compactChinese(input.requirements || "", 36);
  const title = `${topic}｜数字人口播`;
  const requirementLine = requirements ? `这次生成会按「${requirements}」来控制节奏。` : "这次生成会控制在短视频可看完的节奏。";
  const script = [
    `如果你想稳定批量生产口播视频，关键不是把模型堆起来，而是把流程做成可确认、可重跑的任务。`,
    `第一步，系统先识别输入里的主题、口播文案和链接，把视频来源转成可用文本。`,
    `第二步，口播文案、音色和数字人素材都进入同一个任务阶段，任何一步改动后，只重跑后续产物。`,
    `第三步，ASR、TTS、字幕和视频封装都由固定模型包完成，用户不需要理解模型目录。`,
    requirementLine,
    `最终拿到的是一条可下载、可发布、可追溯的数字人口播视频，而不是一堆零散的音频和字幕文件。`
  ].join("");

  return {
    title,
    outline: ["任务化流程", "阶段可重跑", "固定模型包", "最终视频产物"],
    script,
    tags: ["数字人", "AI视频", "口播自动化", "内容生产"],
    visualSummary: {
      hook: "一条任务，自动生成数字人口播视频",
      bullets: ["识别链接并转写来源", "口播文案、音色、素材可确认可重跑", "最终只交付可下载视频"],
      cta: "适合短视频矩阵和内容团队试用"
    },
    platformCopies: {
      douyin: {
        title,
        body: `${script}\n\n#数字人 #AI视频 #口播自动化`,
        checklist: ["上传 MP4", "选择封面", "粘贴标题和话题", "人工确认发布"]
      },
      xiaohongshu: {
        title: `${topic}｜实用口播`,
        body: `这条视频讲的是：${topic}\n\n重点：任务化流程、阶段重跑、固定模型包。\n\n#AI工具 #数字人口播 #内容创作`,
        checklist: ["上传视频", "粘贴正文", "选择话题", "人工确认发布"]
      },
      wechat: {
        title: `${topic}：口播视频稿`,
        body: `正文摘要：${script}`,
        checklist: ["上传视频素材", "写入图文草稿", "检查封面和摘要", "人工确认群发或发布"]
      }
    }
  };
}

function buildCaptionSegments(script, duration) {
  const lines = splitSentences(script);
  const step = Math.max(2.5, duration / Math.max(lines.length, 1));
  return lines.map((line, index) => {
    const start = index * step;
    const end = Math.min(duration, start + step - 0.2);
    return { index: index + 1, start, end, text: line };
  });
}

function buildSrt(script, duration) {
  return buildCaptionSegments(script, duration)
    .map((segment) => `${segment.index}\n${srtTime(segment.start)} --> ${srtTime(segment.end)}\n${segment.text}`)
    .join("\n\n");
}

async function createSilentAudio(outPath, duration) {
  if (!commandExists("ffmpeg")) {
    writeFileSync(outPath, "Audio placeholder: configure TTS adapter to generate real speech.\n");
    return false;
  }
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t",
    String(duration),
    "-c:a",
    "aac",
    outPath
  ]);
  return true;
}

async function probeMediaDuration(filePath) {
  if (!filePath || !existsSync(filePath)) return 0;
  if (!existsSync("/opt/homebrew/bin/ffprobe") && !existsSync("/usr/bin/ffprobe")) return 0;
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);
    return Number.parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

function resolveTtsVoice(db, project, requestedVoiceId = "") {
  const activeVoices = (db.voices || []).filter((item) => !item.deletedAt && item.path && existsSync(item.path));
  const selected = activeVoices.find((item) => item.id === (requestedVoiceId || project.voiceId));
  return selected || activeVoices[0] || null;
}

async function createLocalTtsAudio(script, voice, outPath, options = {}) {
  if (!existsSync(TTS_TOOL_PATH)) throw new Error("缺少本地 TTS CLI 工具。");
  if (!voice?.path || !existsSync(voice.path)) {
    throw new Error("缺少可用参考音色。请先在音色库上传一个参考音频，或在任务中选择音色。");
  }
  if (runtimeWorkers.tts.status === "running" || runtimeWorkers.tts.status === "starting") {
    const result = await runtimeWorkers.tts.request({
      command: "synthesize",
      text: script,
      ref_audio: voice.path,
      output: outPath,
      ref_text: voice.referenceText || "",
      language: options.language || "Chinese"
    }, options.ttsTimeout || 1200000);
    if (!result.ok || !existsSync(outPath)) throw new Error(result.error || "本地 TTS 未生成音频。");
    return result;
  }
  const args = [
    TTS_TOOL_PATH,
    "synthesize",
    "--text",
    script,
    "--ref-audio",
    voice.path,
    "--output",
    outPath,
    "--ref-text",
    voice.referenceText || "",
    "--timeout",
    String(options.ttsTimeout || 1200000)
  ];
  if (options.deviceMap) args.push("--device-map", options.deviceMap);
  if (options.dtype) args.push("--dtype", options.dtype);
  const { stdout } = await execFileAsync(process.execPath, args, {
    timeout: options.ttsTimeout || 1200000,
    maxBuffer: 1024 * 1024 * 16,
    env: { ...process.env, TOKENIZERS_PARALLELISM: "false" }
  });
  const result = parseJsonFromStdout(stdout);
  if (!result.ok || !existsSync(outPath)) throw new Error(result.error || "本地 TTS 未生成音频。");
  return result;
}

async function createExternalAvatarVideo(input, outPath) {
  const payloadPath = join(dirname(outPath), "avatar-render-input.json");
  writeFileSync(payloadPath, JSON.stringify(input, null, 2));
  const engine = input.videoSettings?.engine || defaultVideoSettings.engine;
  if (engine === "musetalk" && (runtimeWorkers.avatar.status === "running" || runtimeWorkers.avatar.status === "starting")) {
    const result = await runtimeWorkers.avatar.request({
      command: "render",
      payloadPath,
      outPath
    }, 1200000);
    if (result.ok && existsSync(outPath)) return { ok: true, engine: result.engine || "musetalk-v15-worker" };
    return { ok: false, engine: "musetalk-v15-worker", error: result.error || "MuseTalk 常驻 Adapter 未输出视频。" };
  }
  const attempts = [];
  if (process.env.AVATAR_RENDER_COMMAND) {
    attempts.push({ command: process.env.AVATAR_RENDER_COMMAND, args: [payloadPath, outPath], engine: "configured-avatar-adapter" });
  } else if (engine === "musetalk" && existsSync(MUSETALK_ADAPTER_PATH)) {
    attempts.push({ command: process.execPath, args: [MUSETALK_ADAPTER_PATH, payloadPath, outPath], engine: "musetalk-v15" });
  }
  if (!attempts.length) {
    return { ok: false, engine, error: `未找到 ${engine} 本地 Adapter。` };
  }
  let lastError = "";
  for (const attempt of attempts) {
    try {
      await execFileAsync(attempt.command, attempt.args, {
        timeout: 1200000,
        maxBuffer: 1024 * 1024 * 16
      });
      if (existsSync(outPath)) return { ok: true, engine: attempt.engine };
      lastError = `${attempt.engine} 未输出视频文件。`;
    } catch (error) {
      lastError = error?.message || "avatar render failed";
      writeFileSync(join(dirname(outPath), "avatar-render-error.json"), JSON.stringify({
        engine: attempt.engine,
        settings: input.videoSettings || {},
        message: error?.message || "avatar render failed",
        stdout: error?.stdout || "",
        stderr: error?.stderr || "",
        updatedAt: now()
      }, null, 2));
    }
  }
  return { ok: false, engine, error: lastError || "口型 Adapter 未生成视频。" };
}

function avatarSegmentSeconds() {
  return clampNumber(process.env.AVATAR_SEGMENT_SECONDS || 30, 10, 120, 30, true);
}

function shellQuoteForConcat(filePath) {
  return String(filePath).replace(/'/g, "'\\''");
}

async function concatVideoSegments(segmentPaths, outPath) {
  if (!segmentPaths.length) throw new Error("没有可拼接的视频片段。");
  if (segmentPaths.length === 1) {
    copyFileSync(segmentPaths[0], outPath);
    return;
  }
  const listPath = join(dirname(outPath), "avatar-segments.txt");
  writeFileSync(listPath, segmentPaths.map((item) => `file '${shellQuoteForConcat(item)}'`).join("\n"));
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outPath
    ], { timeout: 1200000, maxBuffer: 1024 * 1024 * 16 });
  } catch {
    const inputs = segmentPaths.flatMap((item) => ["-i", item]);
    const concatFilter = segmentPaths.map((_, index) => `[${index}:v:0][${index}:a:0]`).join("") + `concat=n=${segmentPaths.length}:v=1:a=1[v][a]`;
    await execFileAsync("ffmpeg", [
      "-y",
      ...inputs,
      "-filter_complex",
      concatFilter,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outPath
    ], { timeout: 1200000, maxBuffer: 1024 * 1024 * 16 });
  }
}

async function createSegmentedAvatarVideo(input, outPath, options = {}) {
  const duration = Math.max(1, Number(input.duration || 1));
  const segmentSeconds = clampNumber(options.segmentSeconds, 10, 120, avatarSegmentSeconds(), true);
  if (duration <= segmentSeconds) {
    return createExternalAvatarVideo(input, outPath);
  }
  const avatarDuration = await probeMediaDuration(input.avatarPath).catch(() => 0);
  const segmentCount = Math.ceil(duration / segmentSeconds);
  const segments = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const start = index * segmentSeconds;
    const segmentDuration = Math.min(segmentSeconds, duration - start);
    segments.push({
      duration: segmentDuration,
      audioStart: start,
      videoStart: avatarDuration > 0 ? start % avatarDuration : 0,
      segmentIndex: index,
      segmentCount
    });
  }
  updateQueueProgress(options.queueId, { percent: 78, label: `正在单进程生成 ${segmentCount} 个数字人口型片段。`, stage: "video" });
  const result = await createExternalAvatarVideo({ ...input, segments }, outPath);
  return {
    ...result,
    ok: result.ok && existsSync(outPath),
    engine: result.engine ? `${result.engine}-segmented` : `${input.videoSettings?.engine || defaultVideoSettings.engine}-segmented`,
    segmentCount,
    segmentSeconds
  };
}

function escapeFilterPath(filePath) {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function previewVideoFilter(subtitlesPath) {
  const base = "scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,format=yuv420p";
  if (!subtitlesPath || !existsSync(subtitlesPath)) return base;
  return `${base},subtitles='${escapeFilterPath(subtitlesPath)}':force_style='Fontsize=18,MarginV=150,PrimaryColour=&H00FFFFFF&,OutlineColour=&HAA000000&,BorderStyle=1,Outline=2'`;
}

async function createSimpleSubtitleOverlays(segments, outDir, baseVideoPath) {
  const selectedSegments = segments.filter((segment) => segment.text).slice(0, 120);
  if (!selectedSegments.length) return [];
  const media = await probeMediaInfo(baseVideoPath).catch(() => ({}));
  const width = Math.max(320, Math.ceil(Number(media.width || 1080) / 2) * 2);
  const height = Math.max(240, Math.ceil(Number(media.height || 1920) / 2) * 2);
  const overlayDir = join(outDir, "subtitle-overlays");
  mkdirSync(overlayDir, { recursive: true });
  const payload = {
    width,
    height,
    segments: selectedSegments.map((segment) => ({
      ...segment,
      text: compactChinese(segment.text, 68),
      path: join(overlayDir, `subtitle-${String(segment.index).padStart(3, "0")}.png`)
    }))
  };
  const script = `
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

payload = json.loads(sys.argv[1])
width = int(payload["width"])
height = int(payload["height"])
font_paths = [
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
]
font_path = next((p for p in font_paths if os.path.exists(p)), None)
def font(size):
  if font_path:
    return ImageFont.truetype(font_path, size)
  return ImageFont.load_default()

def wrap_text(draw, text, fnt, max_width):
  lines, current = [], ""
  for ch in text:
    trial = current + ch
    bbox = draw.textbbox((0, 0), trial, font=fnt, stroke_width=2)
    if bbox[2] - bbox[0] <= max_width or not current:
      current = trial
    else:
      lines.append(current)
      current = ch
  if current:
    lines.append(current)
  return lines[:2]

font_size = max(22, min(52, int(height * 0.045)))
caption_font = font(font_size)
line_gap = int(font_size * 1.35)
max_width = int(width * 0.84)
pad_x = int(width * 0.045)
pad_y = int(font_size * 0.42)
bottom_margin = max(28, int(height * 0.07))

for segment in payload["segments"]:
  img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
  draw = ImageDraw.Draw(img)
  lines = wrap_text(draw, segment["text"], caption_font, max_width)
  if not lines:
    img.save(segment["path"])
    continue
  text_width = max(draw.textbbox((0, 0), line, font=caption_font, stroke_width=2)[2] for line in lines)
  box_width = min(width - pad_x * 2, text_width + pad_x * 2)
  box_height = len(lines) * line_gap + pad_y * 2
  x0 = int((width - box_width) / 2)
  y0 = int(height - bottom_margin - box_height)
  x1 = x0 + box_width
  y1 = y0 + box_height
  draw.rounded_rectangle((x0, y0, x1, y1), radius=max(10, int(font_size * 0.45)), fill=(0, 0, 0, 132))
  y = y0 + pad_y
  for line in lines:
    bbox = draw.textbbox((0, 0), line, font=caption_font, stroke_width=2)
    x = int((width - (bbox[2] - bbox[0])) / 2)
    draw.text((x, y), line, font=caption_font, fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 220))
    y += line_gap
  img.save(segment["path"])
`;
  await execFileAsync("python3", ["-c", script, JSON.stringify(payload)], { timeout: 120000, maxBuffer: 1024 * 1024 * 4 });
  return payload.segments.filter((segment) => existsSync(segment.path));
}

async function runFfmpegWithSubtitleFallback(args, subtitlesPath) {
  try {
    await execFileAsync("ffmpeg", args);
    return true;
  } catch (error) {
    if (!subtitlesPath) throw error;
    const fallbackArgs = args.map((arg) => (
      typeof arg === "string" && arg.includes("subtitles=") ? previewVideoFilter("") : arg
    ));
    await execFileAsync("ffmpeg", fallbackArgs);
    return true;
  }
}

async function createCaptionOverlays(project, segments, outDir) {
  const selectedSegments = segments.slice(0, 10);
  if (!selectedSegments.length) return [];
  const overlayDir = join(outDir, "caption-overlays");
  mkdirSync(overlayDir, { recursive: true });
  const visual = project.artifacts.script?.visualSummary || {};
  const payload = {
    title: compactChinese(project.artifacts.script?.title || project.title, 24),
    hook: compactChinese(visual.hook || "数字人口播视频", 28),
    bullets: (visual.bullets || project.artifacts.script?.outline || []).slice(0, 3).map((item) => compactChinese(item, 22)),
    cta: compactChinese(visual.cta || "视频已生成，确认后发布", 26),
    segments: selectedSegments.map((segment) => ({
      ...segment,
      text: compactChinese(segment.text, 58),
      path: join(overlayDir, `caption-${String(segment.index).padStart(2, "0")}.png`)
    }))
  };
  const script = `
import json, os, sys, textwrap
from PIL import Image, ImageDraw, ImageFont

payload = json.loads(sys.argv[1])
font_paths = [
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
]
font_path = next((p for p in font_paths if os.path.exists(p)), None)
def font(size, bold=False):
  if font_path:
    return ImageFont.truetype(font_path, size)
  return ImageFont.load_default()

def wrap_text(draw, text, fnt, max_width):
  lines, current = [], ""
  for ch in text:
    trial = current + ch
    bbox = draw.textbbox((0, 0), trial, font=fnt)
    if bbox[2] - bbox[0] <= max_width or not current:
      current = trial
    else:
      lines.append(current)
      current = ch
  if current:
    lines.append(current)
  return lines[:3]

for segment in payload["segments"]:
  img = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
  draw = ImageDraw.Draw(img)
  title_font = font(42)
  hook_font = font(52)
  meta_font = font(30)
  caption_font = font(48)
  small_font = font(28)

  draw.rounded_rectangle((56, 78, 1024, 285), radius=26, fill=(6, 19, 31, 210))
  draw.text((92, 112), payload["hook"], fill=(255, 255, 255, 255), font=hook_font)
  draw.text((92, 184), payload["title"], fill=(201, 231, 255, 255), font=title_font)
  draw.rounded_rectangle((92, 232, 330, 268), radius=18, fill=(23, 107, 135, 235))
  draw.text((118, 235), "数字人口播", fill=(255, 255, 255, 255), font=small_font)

  draw.rounded_rectangle((56, 1328, 1024, 1754), radius=30, fill=(6, 19, 31, 224))
  y = 1376
  for line in wrap_text(draw, segment["text"], caption_font, 880):
    draw.text((96, y), line, fill=(255, 255, 255, 255), font=caption_font)
    y += 66

  y = 1586
  for item in payload.get("bullets", [])[:3]:
    draw.ellipse((96, y + 10, 110, y + 24), fill=(86, 190, 150, 255))
    draw.text((126, y), item, fill=(218, 234, 248, 255), font=meta_font)
    y += 44

  draw.rounded_rectangle((56, 1782, 1024, 1852), radius=24, fill=(255, 255, 255, 222))
  draw.text((96, 1801), payload.get("cta", ""), fill=(15, 79, 99, 255), font=meta_font)
  img.save(segment["path"])
`;
  await execFileAsync("python3", ["-c", script, JSON.stringify(payload)], { timeout: 120000, maxBuffer: 1024 * 1024 * 4 });
  return payload.segments.filter((segment) => existsSync(segment.path));
}

function baseComplexVideoFilter() {
  return [
    "[0:v]split=2[bgsrc][fgsrc]",
    "[bgsrc]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:2,eq=brightness=-0.10:saturation=0.90[bg]",
    "[fgsrc]crop=w='min(iw,ih*9/16)':h=ih:x='(iw-min(iw,ih*9/16))/2':y=0,scale=940:1500:force_original_aspect_ratio=decrease,setsar=1[fg]",
    "[bg][fg]overlay=(W-w)/2:(H-h)/2,eq=contrast=1.04:saturation=1.05,format=yuv420p[v0]"
  ].join(";");
}

function overlayFilterGraph(captionOverlays) {
  let graph = baseComplexVideoFilter();
  let previous = "v0";
  captionOverlays.forEach((item, index) => {
    const inputIndex = index + 2;
    const output = index === captionOverlays.length - 1 ? "vout" : `v${index + 1}`;
    const start = Number(item.start || 0).toFixed(2);
    const end = Number(item.end || 0).toFixed(2);
    graph += `;[${inputIndex}:v]format=rgba[ov${index}];[${previous}][ov${index}]overlay=0:0:enable='between(t,${start},${end})'[${output}]`;
    previous = output;
  });
  return graph;
}

function simpleSubtitleOverlayFilterGraph(captionOverlays, firstOverlayInputIndex) {
  let graph = "[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,format=yuv420p[v0]";
  let previous = "v0";
  captionOverlays.forEach((item, index) => {
    const inputIndex = firstOverlayInputIndex + index;
    const output = index === captionOverlays.length - 1 ? "v" : `vsub${index + 1}`;
    const start = Number(item.start || 0).toFixed(2);
    const end = Number(item.end || 0).toFixed(2);
    graph += `;[${inputIndex}:v]format=rgba[ovsub${index}];[${previous}][ovsub${index}]overlay=0:0:enable='between(t,${start},${end})'[${output}]`;
    previous = output;
  });
  return graph;
}

async function createPreviewVideo(outPath, avatarPath, audioPath, duration, subtitlesPath = "", captionOverlays = []) {
  const hasFfmpeg = commandExists("ffmpeg");
  if (!hasFfmpeg) {
    writeFileSync(outPath, "Video placeholder: install FFmpeg and configure avatar adapter.\n");
    return false;
  }
  const audioInput = audioPath && existsSync(audioPath) ? ["-i", audioPath] : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"];
  const overlayInputs = captionOverlays.flatMap((item) => ["-loop", "1", "-i", item.path]);
  if (captionOverlays.length) {
    const videoInput = avatarPath && existsSync(avatarPath)
      ? ["-stream_loop", "-1", "-i", avatarPath]
      : ["-f", "lavfi", "-i", `color=c=0xf4f7fa:s=1080x1920:d=${duration}`];
    try {
      await execFileAsync("ffmpeg", [
        "-y",
        ...videoInput,
        ...audioInput,
        ...overlayInputs,
        "-filter_complex",
        overlayFilterGraph(captionOverlays),
        "-map",
        "[vout]",
        "-map",
        "1:a:0",
        "-t",
        String(duration),
        "-shortest",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        outPath
      ], { timeout: 1200000, maxBuffer: 1024 * 1024 * 8 });
      return true;
    } catch {
      // Fall through to the plain renderer if image overlays are unavailable.
    }
  }
  const vf = previewVideoFilter(subtitlesPath);
  if (avatarPath && existsSync(avatarPath)) {
    await runFfmpegWithSubtitleFallback([
      "-y",
      "-stream_loop",
      "-1",
      "-i",
      avatarPath,
      ...audioInput,
      "-t",
      String(duration),
      "-vf",
      vf,
      "-shortest",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      outPath
    ], subtitlesPath);
    return true;
  }
  await runFfmpegWithSubtitleFallback([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=0xf4f7fa:s=1080x1920:d=${duration}`,
    ...audioInput,
    "-shortest",
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    outPath
  ], subtitlesPath);
  return true;
}

async function mixBackgroundMusic(videoPath, musicPath, duration) {
  if (!commandExists("ffmpeg") || !videoPath || !musicPath || !existsSync(videoPath) || !existsSync(musicPath)) return false;
  const tmpPath = videoPath.replace(/\.mp4$/i, `-bgm-${randomUUID().slice(0, 8)}.mp4`);
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-stream_loop",
    "-1",
    "-i",
    musicPath,
    "-filter_complex",
    `[1:a]volume=0.16,atrim=0:${Math.max(1, Number(duration) || 1)},asetpts=PTS-STARTPTS[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=0[a]`,
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    tmpPath
  ], { timeout: 1200000, maxBuffer: 1024 * 1024 * 8 });
  copyFileSync(tmpPath, videoPath);
  return true;
}

async function packageAvatarRenderVideo({
  outPath,
  avatarRenderPath,
  audioPath,
  backgroundMusicPath = "",
  subtitlesPath = "",
  duration,
  burnSubtitles = false,
  captionOverlays = []
}) {
  if (!commandExists("ffmpeg") || !avatarRenderPath || !existsSync(avatarRenderPath)) return { ok: false, backgroundMusicMixed: false, subtitlesEmbedded: false, visibleCaptions: false };
  const hasAudio = audioPath && existsSync(audioPath);
  const hasMusic = backgroundMusicPath && existsSync(backgroundMusicPath);
  const hasSubtitles = subtitlesPath && existsSync(subtitlesPath);
  const shouldBurnSubtitles = Boolean(burnSubtitles && hasSubtitles);
  const usableOverlays = shouldBurnSubtitles ? captionOverlays.filter((item) => item.path && existsSync(item.path)) : [];
  const inputs = ["-i", avatarRenderPath];
  if (hasAudio) inputs.push("-i", audioPath);
  if (hasMusic) inputs.push("-stream_loop", "-1", "-i", backgroundMusicPath);
  if (hasSubtitles && !shouldBurnSubtitles) inputs.push("-i", subtitlesPath);
  for (const overlay of usableOverlays) inputs.push("-loop", "1", "-i", overlay.path);

  const args = ["-y", ...inputs];
  const audioInputIndex = hasAudio ? 1 : -1;
  const musicInputIndex = hasMusic ? (hasAudio ? 2 : 1) : -1;
  const subtitleInputIndex = hasSubtitles && !shouldBurnSubtitles ? 1 + (hasAudio ? 1 : 0) + (hasMusic ? 1 : 0) : -1;
  const firstOverlayInputIndex = 1 + (hasAudio ? 1 : 0) + (hasMusic ? 1 : 0) + (hasSubtitles && !shouldBurnSubtitles ? 1 : 0);
  const filters = [];
  if (usableOverlays.length) {
    filters.push(simpleSubtitleOverlayFilterGraph(usableOverlays, firstOverlayInputIndex));
  } else if (shouldBurnSubtitles) {
    filters.push(`[0:v]${previewVideoFilter(subtitlesPath)}[v]`);
  }

  if (hasMusic && hasAudio) {
    filters.push(`[${musicInputIndex}:a]volume=0.16,atrim=0:${Math.max(1, Number(duration) || 1)},asetpts=PTS-STARTPTS[bgm]`);
    filters.push(`[${audioInputIndex}:a][bgm]amix=inputs=2:duration=first:dropout_transition=0[a]`);
    args.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      shouldBurnSubtitles ? "[v]" : "0:v:0",
      "-map",
      "[a]"
    );
  } else {
    if (filters.length) args.push("-filter_complex", filters.join(";"));
    args.push("-map", shouldBurnSubtitles ? "[v]" : "0:v:0");
    if (hasAudio) {
      args.push("-map", `${audioInputIndex}:a:0`);
    } else {
      args.push("-map", "0:a?");
    }
  }

  if (hasSubtitles && !shouldBurnSubtitles) args.push("-map", `${subtitleInputIndex}:0`);
  args.push(
    "-t",
    String(duration),
    "-shortest"
  );
  if (shouldBurnSubtitles) {
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p"
    );
  } else {
    args.push("-c:v", "copy");
  }
  args.push(
    "-c:a",
    "aac"
  );
  if (hasSubtitles && !shouldBurnSubtitles) args.push("-c:s", "mov_text");
  args.push("-movflags", "+faststart", outPath);
  try {
    await execFileAsync("ffmpeg", args, { timeout: 1200000, maxBuffer: 1024 * 1024 * 16 });
    const ok = existsSync(outPath);
    return {
      ok,
      backgroundMusicMixed: Boolean(ok && hasMusic && hasAudio),
      subtitlesEmbedded: Boolean(ok && hasSubtitles && !shouldBurnSubtitles),
      visibleCaptions: Boolean(ok && shouldBurnSubtitles)
    };
  } catch {
    return { ok: false, backgroundMusicMixed: false, subtitlesEmbedded: false, visibleCaptions: false };
  }
}

async function embedSubtitlesInMp4(videoPath, subtitlesPath) {
  if (!videoPath || !subtitlesPath || !existsSync(videoPath) || !existsSync(subtitlesPath)) return false;
  const outPath = videoPath.replace(/\.mp4$/i, ".with-subtitles.mp4");
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-i",
      subtitlesPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-map",
      "1:0",
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-c:s",
      "mov_text",
      outPath
    ], { maxBuffer: 1024 * 1024 * 8 });
    copyFileSync(outPath, videoPath);
    return true;
  } catch {
    return false;
  }
}

async function zipDirectory(sourceDir, zipPath) {
  await execFileAsync("zip", ["-qr", zipPath, "."], { cwd: sourceDir });
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeBase = basename(file.originalname, extname(file.originalname)).replace(/[^\w\u4e00-\u9fa5.-]+/g, "-");
    cb(null, `${Date.now()}-${safeBase}${extname(file.originalname)}`);
  }
});
const upload = multer({ storage: diskStorage });
const app = express();

app.use(express.json({ limit: "5mb" }));
app.use("/storage", express.static(storageDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, port: PORT, storageDir });
});

app.get("/api/state", (_req, res) => {
  const db = readDb();
  res.json({
    ...db,
    models: db.models.filter((model) => !model.hidden && model.type !== "media"),
    projects: visibleProjects(db),
    avatarAssets: (db.avatarAssets || []).filter((asset) => !asset.deletedAt),
    musicAssets: (db.musicAssets || []).filter((asset) => !asset.deletedAt),
    voices: (db.voices || []).filter((voice) => !voice.deletedAt),
    queueItems: (db.queueItems || []).map((item) => publicQueueItem(item, db)),
    resource: resourceSnapshot(db),
    publishRecords: (db.publishRecords || [])
      .filter((record) => !record.deletedAt && record.status === "published")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    apiProviders: (db.apiProviders || []).map(publicProvider),
    modelCatalog: modelCatalog.filter((item) => item.type !== "media").map((item) => ({
      ...item,
      adapterProtocol: adapterProtocols[item.protocolId]
    })),
    apiProviderCatalog,
    requirementTemplates: db.requirementTemplates || [],
    runtimeModels: runtimeWorkerStatus(),
    settings: db.settings,
    modelHome: MODEL_HOME
  });
});

app.post("/api/requirement-templates", (req, res) => {
  const db = readDb();
  const label = String(req.body?.label || "").trim();
  const value = String(req.body?.value || "").trim();
  if (!label) return res.status(400).json({ error: "请输入模板名称。" });
  if (!value) return res.status(400).json({ error: "请输入生成要求。" });
  const template = {
    id: `requirement-template-${randomUUID()}`,
    label,
    value,
    createdAt: now(),
    updatedAt: now()
  };
  db.requirementTemplates.unshift(template);
  writeDb(db);
  res.json(template);
});

app.patch("/api/requirement-templates/:id", (req, res) => {
  const db = readDb();
  const template = db.requirementTemplates.find((item) => item.id === req.params.id);
  if (!template) return res.status(404).json({ error: "模板不存在。" });
  const label = String(req.body?.label ?? template.label).trim();
  const value = String(req.body?.value ?? template.value).trim();
  if (!label) return res.status(400).json({ error: "请输入模板名称。" });
  if (!value) return res.status(400).json({ error: "请输入生成要求。" });
  template.label = label;
  template.value = value;
  template.updatedAt = now();
  writeDb(db);
  res.json(template);
});

app.delete("/api/requirement-templates/:id", (req, res) => {
  const db = readDb();
  const before = db.requirementTemplates.length;
  db.requirementTemplates = db.requirementTemplates.filter((item) => item.id !== req.params.id);
  if (db.requirementTemplates.length === before) return res.status(404).json({ error: "模板不存在。" });
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/runtime-models/:kind/start", async (req, res, next) => {
  try {
    const kind = req.params.kind;
    if (!["asr", "tts", "avatar"].includes(kind)) return res.status(404).json({ error: "未知运行模型。" });
    const status = await runtimeWorkers[kind].start();
    const db = readDb();
    if (kind === "asr") db.settings.keepAsrModelWarm = true;
    if (kind === "tts") db.settings.keepTtsModelWarm = true;
    if (kind === "avatar") db.settings.keepAvatarModelWarm = true;
    writeDb(db);
    res.json({ ok: true, status, settings: db.settings, runtimeModels: runtimeWorkerStatus() });
  } catch (err) {
    next(err);
  }
});

app.post("/api/runtime-models/:kind/stop", (req, res) => {
  const kind = req.params.kind;
  if (!["asr", "tts", "avatar"].includes(kind)) return res.status(404).json({ error: "未知运行模型。" });
  const status = runtimeWorkers[kind].stop();
  const db = readDb();
  if (kind === "asr") db.settings.keepAsrModelWarm = false;
  if (kind === "tts") db.settings.keepTtsModelWarm = false;
  if (kind === "avatar") db.settings.keepAvatarModelWarm = false;
  writeDb(db);
  res.json({ ok: true, status, settings: db.settings, runtimeModels: runtimeWorkerStatus() });
});

app.get("/api/runtime-models", (_req, res) => {
  res.json({ ok: true, runtimeModels: runtimeWorkerStatus() });
});

app.patch("/api/settings/runtime", async (req, res, next) => {
  try {
  const db = readDb();
  const body = req.body || {};
  if (body.keepAsrModelWarm !== undefined) db.settings.keepAsrModelWarm = Boolean(body.keepAsrModelWarm);
  if (body.keepTtsModelWarm !== undefined) db.settings.keepTtsModelWarm = Boolean(body.keepTtsModelWarm);
  if (body.keepAvatarModelWarm !== undefined) db.settings.keepAvatarModelWarm = Boolean(body.keepAvatarModelWarm);
  if (body.videoConcurrency !== undefined) db.settings.videoConcurrency = clampNumber(body.videoConcurrency, 1, 4, db.settings.videoConcurrency || 1, true);
  if (body.avatarSegmentSeconds !== undefined) db.settings.avatarSegmentSeconds = clampNumber(body.avatarSegmentSeconds, 10, 120, db.settings.avatarSegmentSeconds || 30, true);
  writeDb(db);
  if (body.keepAsrModelWarm === true) await runtimeWorkers.asr.start();
  if (body.keepAsrModelWarm === false) runtimeWorkers.asr.stop();
  if (body.keepTtsModelWarm === true) await runtimeWorkers.tts.start();
  if (body.keepTtsModelWarm === false) runtimeWorkers.tts.stop();
  if (body.keepAvatarModelWarm === true) await runtimeWorkers.avatar.start();
  if (body.keepAvatarModelWarm === false) runtimeWorkers.avatar.stop();
  res.json({ ok: true, settings: db.settings, runtimeModels: runtimeWorkerStatus() });
  } catch (err) {
    next(err);
  }
});

function parseFps(value = "") {
  const [left, right] = String(value).split("/").map(Number);
  if (!Number.isFinite(left) || !left) return 0;
  if (!Number.isFinite(right) || !right) return left;
  return left / right;
}

async function probeMediaInfo(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return { ok: false, error: "文件不存在。" };
  }
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      filePath
    ], { timeout: 30000, maxBuffer: 1024 * 1024 * 4 });
    const data = JSON.parse(stdout || "{}");
    const video = (data.streams || []).find((stream) => stream.codec_type === "video");
    const audio = (data.streams || []).find((stream) => stream.codec_type === "audio");
    return {
      ok: Boolean(video || audio),
      width: Number(video?.width || 0),
      height: Number(video?.height || 0),
      fps: Number(parseFps(video?.avg_frame_rate || video?.r_frame_rate || "").toFixed(2)),
      duration: Number.parseFloat(video?.duration || audio?.duration || data.format?.duration || "0") || 0,
      codec: video?.codec_name || "",
      hasAudio: Boolean(audio),
      audioCodec: audio?.codec_name || "",
      bitRate: Number(data.format?.bit_rate || 0)
    };
  } catch (error) {
    return { ok: false, error: error?.message || "媒体信息读取失败。" };
  }
}

async function detectFaceSignal(filePath) {
  const museTalkPython = join(MODEL_HOME, "avatar", "MuseTalk", ".venv", "bin", "python");
  const python = process.env.MUSETALK_PYTHON || (existsSync(museTalkPython) ? museTalkPython : "python3");
  const script = `
import json, sys
try:
    import cv2
    import mediapipe as mp
except Exception as exc:
    print(json.dumps({"status": "skipped", "message": "人脸检测依赖未就绪。"}))
    sys.exit(0)

path = sys.argv[1]
cap = cv2.VideoCapture(path)
frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
indices = [0]
if frames > 4:
    indices = [max(0, int(frames * 0.2)), max(0, int(frames * 0.5)), max(0, int(frames * 0.8))]
detector = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.45)
hits = 0
for index in indices:
    cap.set(cv2.CAP_PROP_POS_FRAMES, index)
    ok, frame = cap.read()
    if not ok:
        continue
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = detector.process(rgb)
    if result.detections:
        hits += 1
cap.release()
print(json.dumps({"status": "done", "sampled": len(indices), "faces": hits}))
`;
  try {
    const { stdout } = await execFileAsync(python, ["-c", script, filePath], { timeout: 30000, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout || "{}");
  } catch {
    return { status: "skipped", message: "人脸检测未完成。" };
  }
}

async function analyzeAvatarQuality(filePath, mimeType = "") {
  const metrics = await probeMediaInfo(filePath);
  const notes = [];
  let status = "passed";
  if (!mimeType.startsWith("video/")) {
    status = "failed";
    notes.push("上传文件不是视频类型。");
  }
  if (!metrics.ok) {
    status = "failed";
    notes.push(metrics.error || "未检测到视频流。");
    return { status, notes, metrics };
  }
  if (metrics.width < 720 || metrics.height < 720) {
    status = status === "failed" ? status : "warning";
    notes.push(`分辨率 ${metrics.width}x${metrics.height} 偏低，口型区域容易糊或贴片感明显。`);
  } else {
    notes.push(`分辨率 ${metrics.width}x${metrics.height} 可用于首轮生成。`);
  }
  if (metrics.duration < 3) {
    status = status === "failed" ? status : "warning";
    notes.push("视频时长低于 3 秒，循环或截取时可能不自然。");
  }
  if (metrics.fps && metrics.fps < 20) {
    status = status === "failed" ? status : "warning";
    notes.push(`帧率 ${metrics.fps}fps 偏低，嘴部运动可能不顺。`);
  }
  if (!metrics.hasAudio) {
    notes.push("未检测到原始音频；数字人口播可正常用新音频驱动。");
  }
  const face = await detectFaceSignal(filePath);
  if (face.status === "done") {
    metrics.faceSamples = face.sampled;
    metrics.faceHits = face.faces;
    if (!face.faces) {
      status = status === "failed" ? status : "warning";
      notes.push("抽样帧未检测到人脸，建议换正脸、光线稳定、嘴部无遮挡素材。");
    } else {
      notes.push(`抽样 ${face.sampled} 帧，检测到 ${face.faces} 帧有人脸。`);
    }
  } else {
    notes.push(face.message || "人脸检测跳过，仅使用媒体参数评估。");
  }
  return { status, notes, metrics };
}

app.post("/api/assets/avatar-videos", upload.single("file"), async (req, res, next) => {
  try {
  const db = readDb();
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Missing file" });
  const qualityReport = await analyzeAvatarQuality(file.path, file.mimetype);
  const asset = {
    id: `avatar-${randomUUID()}`,
    name: req.body.name || basename(file.originalname),
    tags: String(req.body.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
    path: file.path,
    uri: publicPath(file.path),
    mimeType: file.mimetype,
    authStatus: req.body.authStatus || "self_authorized",
    qualityReport,
    createdAt: now()
  };
  db.avatarAssets.unshift(asset);
  writeDb(db);
  res.json(asset);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/assets/avatar-videos/:id", (req, res) => {
  const db = readDb();
  const asset = (db.avatarAssets || []).find((item) => item.id === req.params.id);
  if (!asset) return res.status(404).json({ error: "Avatar asset not found" });
  asset.deletedAt = now();
  asset.updatedAt = now();
  asset.status = "deleted";
  writeDb(db);
  res.json({ ok: true });
});

app.patch("/api/assets/avatar-videos/:id", (req, res) => {
  const db = readDb();
  const asset = (db.avatarAssets || []).find((item) => item.id === req.params.id && !item.deletedAt);
  if (!asset) return res.status(404).json({ error: "Avatar asset not found" });
  if (req.body.name !== undefined) asset.name = String(req.body.name || "").trim() || asset.name;
  if (req.body.tags !== undefined) {
    asset.tags = Array.isArray(req.body.tags)
      ? req.body.tags.map((item) => String(item).trim()).filter(Boolean)
      : String(req.body.tags || "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  asset.updatedAt = now();
  writeDb(db);
  res.json(asset);
});

app.post("/api/assets/avatar-videos/:id/clip", async (req, res, next) => {
  try {
    const db = readDb();
    const asset = (db.avatarAssets || []).find((item) => item.id === req.params.id && !item.deletedAt);
    if (!asset?.path || !existsSync(asset.path)) return res.status(404).json({ error: "Avatar asset not found" });
    const media = await probeMediaInfo(asset.path);
    if (!media.ok) return res.status(400).json({ error: media.error || "素材视频不可用。" });
    const start = clampNumber(req.body.start, 0, Math.max(0, media.duration - 0.5), 0);
    const end = clampNumber(req.body.end, start + 0.5, media.duration || start + 1, Math.min(media.duration || start + 5, start + 5));
    if (end <= start) return res.status(400).json({ error: "结束时间必须大于开始时间。" });
    const name = String(req.body.name || `${asset.name}-片段`).trim();
    const targetPath = join(uploadDir, `${Date.now()}-${randomUUID().slice(0, 8)}-${name.replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")}.mp4`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      String(start),
      "-i",
      asset.path,
      "-t",
      String(end - start),
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      targetPath
    ], { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    const qualityReport = await analyzeAvatarQuality(targetPath, "video/mp4");
    const clipped = {
      id: `avatar-${randomUUID()}`,
      name,
      tags: Array.from(new Set([...(asset.tags || []), "片段"])),
      path: targetPath,
      uri: publicPath(targetPath),
      mimeType: "video/mp4",
      authStatus: asset.authStatus || "self_authorized",
      qualityReport,
      sourceAssetId: asset.id,
      clipRange: { start, end, duration: end - start },
      createdAt: now()
    };
    db.avatarAssets.unshift(clipped);
    writeDb(db);
    res.json(clipped);
  } catch (err) {
    next(err);
  }
});

app.post("/api/assets/music", upload.single("file"), async (req, res, next) => {
  try {
    const db = readDb();
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing file" });
    const asset = await createMusicFromPath(db, file.path, {
      name: req.body.name || basename(file.originalname),
      mimeType: file.mimetype
    });
    writeDb(db);
    res.json(asset);
  } catch (err) {
    next(err);
  }
});

app.patch("/api/assets/music/:id", (req, res) => {
  const db = readDb();
  const asset = (db.musicAssets || []).find((item) => item.id === req.params.id && !item.deletedAt);
  if (!asset) return res.status(404).json({ error: "Music asset not found" });
  if (req.body.name !== undefined) asset.name = String(req.body.name || "").trim() || asset.name;
  asset.updatedAt = now();
  writeDb(db);
  res.json(asset);
});

app.post("/api/assets/music/:id/clip", async (req, res, next) => {
  try {
    const db = readDb();
    const asset = (db.musicAssets || []).find((item) => item.id === req.params.id && !item.deletedAt);
    if (!asset?.path || !existsSync(asset.path)) return res.status(404).json({ error: "Music asset not found" });
    const clipped = await createMusicFromPath(db, asset.path, {
      name: String(req.body.name || `${asset.name}-片段`).trim(),
      start: req.body.start,
      end: req.body.end,
      sourceMusicAssetId: asset.id
    });
    writeDb(db);
    res.json(clipped);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/assets/music/:id", (req, res) => {
  const db = readDb();
  const asset = (db.musicAssets || []).find((item) => item.id === req.params.id);
  if (!asset) return res.status(404).json({ error: "Music asset not found" });
  asset.deletedAt = now();
  asset.updatedAt = now();
  asset.status = "deleted";
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/voices/reference-samples", upload.single("file"), (req, res) => {
  const db = readDb();
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Missing file" });
  const voice = {
    id: `voice-${randomUUID()}`,
    name: req.body.name || basename(file.originalname),
    provider: req.body.provider || "local",
    path: file.path,
    uri: publicPath(file.path),
    mimeType: file.mimetype,
    authScope: req.body.authScope || "self_authorized",
    cloneStatus: "ready_for_adapter",
    createdAt: now()
  };
  db.voices.unshift(voice);
  writeDb(db);
  res.json(voice);
});

app.patch("/api/voices/reference-samples/:id", (req, res) => {
  const db = readDb();
  const voice = (db.voices || []).find((item) => item.id === req.params.id && !item.deletedAt);
  if (!voice) return res.status(404).json({ error: "Voice not found" });
  if (req.body.name !== undefined) voice.name = String(req.body.name || "").trim() || voice.name;
  if (req.body.provider !== undefined) voice.provider = String(req.body.provider || "").trim() || voice.provider || "local";
  voice.updatedAt = now();
  writeDb(db);
  res.json(voice);
});

app.post("/api/voices/reference-samples/:id/clip", async (req, res, next) => {
  try {
    const db = readDb();
    const voice = (db.voices || []).find((item) => item.id === req.params.id && !item.deletedAt);
    if (!voice?.path || !existsSync(voice.path)) return res.status(404).json({ error: "Voice not found" });
    const name = String(req.body.name || `${voice.name}-片段`).trim();
    const clipped = await createVoiceFromPath(db, voice.path, {
      name,
      provider: voice.provider || "local",
      authScope: voice.authScope || "self_authorized",
      start: req.body.start,
      end: req.body.end
    });
    clipped.sourceVoiceId = voice.id;
    writeDb(db);
    res.json(clipped);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/voices/reference-samples/:id", (req, res) => {
  const db = readDb();
  const voice = (db.voices || []).find((item) => item.id === req.params.id);
  if (!voice) return res.status(404).json({ error: "Voice not found" });
  voice.deletedAt = now();
  voice.updatedAt = now();
  voice.cloneStatus = "deleted";
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/models/register", (req, res) => {
  return res.status(410).json({ error: "当前版本使用固定模型包，不支持用户新增或选择模型。" });
  /*
  const db = readDb();
  const protocolKey = req.body.protocolId || `${req.body.type || "llm"}ScriptV1`;
  const adapterProtocol = adapterProtocols[protocolKey] || adapterProtocols[`${req.body.type}VoiceV1`] || {
    id: req.body.adapterProtocolId || "digital-human.custom",
    version: req.body.protocolVersion || "1.0",
    label: req.body.protocolLabel || "自定义 Adapter 协议",
    transport: "custom",
    input: "custom",
    output: "custom"
  };
  const model = {
    id: `model-${randomUUID()}`,
    name: req.body.name,
    type: req.body.type,
    runtime: req.body.runtime || (req.body.source === "cloud" ? "cloud adapter" : "custom adapter"),
    pathRef: req.body.pathRef || "",
    source: req.body.source || "local",
    endpoint: req.body.endpoint || "",
    protocolId: protocolKey,
    adapterProtocol,
    protocolStatus: "待检测",
    status: req.body.pathRef || req.body.endpoint ? "registered" : "not_configured",
    note: req.body.note || "",
    createdAt: now()
  };
  db.models.unshift(model);
  writeDb(db);
  res.json(model);
  */
});

app.post("/api/models/health-check-all", (req, res) => {
  res.status(410).json({ error: "当前版本不提供模型检测；模型会在实际任务或类型测试时临时启动。" });
});

app.post("/api/models/:id/test", async (req, res) => {
  res.status(410).json({ error: "单模型测试已移除；请使用 /api/model-tests/{llm,asr,tts,avatar} 按模型类型测试。" });
});

app.post("/api/models/:id/install", (req, res, next) => {
  try {
    const db = readDb();
    const model = db.models.find((item) => item.id === req.params.id);
    if (!model) return res.status(404).json({ error: "Model not found" });
    if (!model.catalogId || model.catalogId === "ffmpeg") {
      return res.status(400).json({ error: "当前模型不支持自动安装。" });
    }
    model.status = "installing";
    model.healthMessage = "正在安装固定模型包，完成后请重新检测环境。";
    model.lastCheckedAt = now();
    writeDb(db);
    execFile(process.execPath, [MODEL_INSTALLER_PATH], {
      cwd: rootDir,
      timeout: 1000 * 60 * 120,
      maxBuffer: 1024 * 1024 * 16
    }, (error) => {
      const nextDb = readDb();
      const nextModel = nextDb.models.find((item) => item.id === req.params.id);
      if (!nextModel) return;
      const detection = detectModel(nextModel);
      nextModel.status = error ? "install_failed" : detection.status;
      nextModel.resolvedPath = detection.resolvedPath;
      nextModel.protocolStatus = error ? "安装失败" : detection.protocolStatus;
      nextModel.protocolMessage = error ? "模型下载或安装失败，请检查网络后重试。" : detection.protocolMessage;
      nextModel.healthMessage = error ? "模型下载或安装失败，请检查网络后重试。" : detection.message;
      nextModel.lastCheckedAt = now();
      writeDb(nextDb);
    });
    res.json({
      ok: true,
      status: model.status,
      message: model.healthMessage
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/models/select", (req, res) => {
  const db = readDb();
  const model = db.models.find((item) => item.id === req.body.modelId && !item.hidden && ["llm", "asr", "tts", "avatar"].includes(item.type));
  if (!model) return res.status(404).json({ error: "Model not found" });
  db.settings.defaultModelIds ||= {};
  db.settings.defaultModelIds[model.type] = model.id;
  if (model.type === "llm") {
    db.settings.defaultTextModelId = model.id;
    for (const item of db.models) {
      if (item.type === "llm") item.selected = item.id === model.id;
    }
  }
  writeDb(db);
  res.json(model);
});

app.post("/api/models/:id/health-check", (req, res) => {
  res.status(410).json({ error: "当前版本不提供模型检测；模型会在实际任务或类型测试时临时启动。" });
});

app.post("/api/providers/configure", (req, res) => {
  const db = readDb();
  const catalogItem = apiProviderCatalog.find((item) => item.id === req.body.providerId);
  if (!catalogItem) return res.status(404).json({ error: "Provider option not found" });
  const existing = db.apiProviders.find((item) => item.providerId === catalogItem.id);
  const provider = providerFromCatalog(catalogItem, existing || {});
  const apiKey = String(req.body.apiKey || "").trim();
  if (apiKey) provider.apiKey = apiKey;
  if (req.body.endpoint !== undefined) provider.endpoint = String(req.body.endpoint || "").trim() || catalogItem.endpoint || "";
  if (req.body.model !== undefined) provider.model = String(req.body.model || "").trim() || catalogItem.defaultModel || "";
  const detection = detectProvider(provider);
  if (detection.status !== "configured") return res.status(400).json({ error: detection.message });
  Object.assign(provider, {
    status: detection.status,
    maskedKey: detection.maskedKey,
    healthMessage: detection.message,
    lastCheckedAt: now()
  });
  if (existing) {
    Object.assign(existing, provider);
  } else {
    db.apiProviders.unshift(provider);
  }
  writeDb(db);
  res.json(publicProvider(existing || provider));
});

app.post("/api/providers/:id/health-check", (req, res) => {
  const db = readDb();
  const provider = db.apiProviders.find((item) => item.id === req.params.id || item.providerId === req.params.id);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const detection = detectProvider(provider);
  provider.status = detection.status;
  provider.maskedKey = detection.maskedKey;
  provider.healthMessage = detection.message;
  provider.lastCheckedAt = now();
  writeDb(db);
  res.json(publicProvider(provider));
});

app.post("/api/providers/:id/select", (req, res) => {
  const db = readDb();
  const provider = db.apiProviders.find((item) => item.id === req.params.id || item.providerId === req.params.id);
  if (!provider) return res.status(404).json({ error: "Provider not found" });
  const capability = provider.capabilities?.find((item) => ["llm", "asr", "tts"].includes(item));
  if (!capability) return res.status(400).json({ error: "Provider 不支持可选择的模型类型。" });
  const detection = detectProvider(provider);
  provider.status = detection.status;
  provider.maskedKey = detection.maskedKey;
  provider.healthMessage = detection.message;
  provider.lastCheckedAt = now();
  if (detection.status !== "configured") return res.status(400).json({ error: detection.message });
  db.settings.defaultModelIds ||= {};
  db.settings.defaultModelIds[capability] = `provider:${provider.id}`;
  if (capability === "llm") {
    db.settings.defaultTextModelId = `provider:${provider.id}`;
    for (const item of db.models) {
      if (item.type === "llm") item.selected = false;
    }
  }
  writeDb(db);
  res.json({ ok: true, type: capability, defaultModelId: db.settings.defaultModelIds[capability], defaultTextModelId: db.settings.defaultTextModelId, provider: publicProvider(provider) });
});

app.delete("/api/providers/:id", (req, res) => {
  const db = readDb();
  const index = db.apiProviders.findIndex((item) => item.id === req.params.id || item.providerId === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Provider not found" });
  const [provider] = db.apiProviders.splice(index, 1);
  const selectedValue = `provider:${provider.id}`;
  const capability = provider.capabilities?.find((item) => ["llm", "asr", "tts"].includes(item)) || "llm";
  const fallback = db.models.find((item) => item.type === capability && !item.hidden)?.id || (capability === "llm" ? "model-qwen2-5-7b-instruct-4bit-mlx" : "");
  db.settings.defaultModelIds ||= {};
  if (capability === "llm" && (db.settings.defaultTextModelId === selectedValue || db.settings.defaultTextModelId === `provider:${provider.providerId}`)) {
    db.settings.defaultTextModelId = fallback;
  }
  if (db.settings.defaultModelIds[capability] === selectedValue || db.settings.defaultModelIds[capability] === `provider:${provider.providerId}`) {
    db.settings.defaultModelIds[capability] = capability === "llm" ? db.settings.defaultTextModelId : fallback;
  }
  for (const item of db.models) {
    if (item.type === "llm") item.selected = item.id === db.settings.defaultTextModelId;
  }
  writeDb(db);
  res.json({ ok: true, deletedProviderId: provider.id, defaultTextModelId: db.settings.defaultTextModelId });
});

app.post("/api/providers/:id/test", async (req, res, next) => {
  try {
    const db = readDb();
    const provider = db.apiProviders.find((item) => item.id === req.params.id || item.providerId === req.params.id);
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    const detection = detectProvider(provider);
    provider.status = detection.status;
    provider.maskedKey = detection.maskedKey;
    provider.healthMessage = detection.message;
    if (detection.status === "configured") {
      await callCloudLlm(provider, [
        { role: "system", content: "你是一个简洁的中文助手。" },
        { role: "user", content: "用一句话回复：云端文本模型连接正常。" }
      ], { maxTokens: 80, temperature: 0.2 });
    }
    provider.testResult = {
      status: detection.status === "configured" ? "passed" : "blocked",
      message: detection.status === "configured" ? "Provider 测试通过，已完成一次 chat/completions 调用。" : "请先配置 API Key。",
      testedAt: now()
    };
    writeDb(db);
    res.json(provider.testResult);
  } catch (err) {
    next(err);
  }
});

function findTextModelTarget(db, modelId = "") {
  const selected = String(modelId || db.settings.defaultTextModelId || "model-qwen2-5-7b-instruct-4bit-mlx");
  if (selected.startsWith("provider:")) {
    const providerKey = selected.replace("provider:", "");
    const provider = db.apiProviders.find((item) => item.id === providerKey || item.providerId === providerKey);
    if (!provider) {
      const err = new Error("未找到已配置的云端文本模型。");
      err.status = 404;
      throw err;
    }
    return { type: "cloud", provider };
  }
  const model = db.models.find((item) => item.id === selected && item.type === "llm" && !item.hidden);
  if (!model) {
    const err = new Error("未找到本地文本模型。");
    err.status = 404;
    throw err;
  }
  return { type: "local", model };
}

function findTypedModelTarget(db, type, modelId = "") {
  const selected = String(modelId || db.settings.defaultModelIds?.[type] || "");
  if (selected.startsWith("provider:")) {
    const providerKey = selected.replace("provider:", "");
    const provider = db.apiProviders.find((item) => (item.id === providerKey || item.providerId === providerKey) && item.capabilities?.includes(type));
    if (!provider) {
      const err = new Error(`未找到已配置的云端${modelTypeLabel(type)}。`);
      err.status = 404;
      throw err;
    }
    return { type: "cloud", provider };
  }
  const model = db.models.find((item) => item.id === selected && item.type === type && !item.hidden);
  if (!model) {
    const err = new Error(`未找到本地${modelTypeLabel(type)}。`);
    err.status = 404;
    throw err;
  }
  return { type: "local", model };
}

function modelTypeLabel(type) {
  return ({ llm: "文本模型", asr: "ASR 模型", tts: "TTS 模型", avatar: "数字人模型" })[type] || "模型";
}

app.post("/api/model-tests/llm", async (req, res, next) => {
  try {
    const db = readDb();
    const body = req.body || {};
    const prompt = String(body.prompt || body.text || "").trim();
    if (!prompt) return res.status(400).json({ error: "请输入要测试的文本。" });
    const target = findTextModelTarget(db, body.modelId);
    const messages = [
      { role: "system", content: "你是一个简洁、准确的中文助手。" },
      { role: "user", content: prompt }
    ];
    const result = target.type === "cloud"
      ? await callCloudLlm(target.provider, messages, { maxTokens: 600, temperature: 0.3 })
      : await callLocalLlm(messages, { maxTokens: 600, temperature: 0.3 });
    res.json({
      ok: true,
      text: result.text,
      modelInfo: target.type === "cloud"
        ? { type: "cloud", providerId: target.provider.id, providerName: target.provider.name, model: target.provider.model }
        : { type: "local", modelId: target.model.id, modelName: target.model.name },
      metrics: result.metrics || {}
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/model-tests/asr", upload.single("audio"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "请上传或录制一段音频。" });
    const db = readDb();
    const body = req.body || {};
    const target = findTypedModelTarget(db, "asr", body.modelId);
    const result = target.type === "cloud"
      ? await callCloudAsr(target.provider, req.file.path, { language: body.language || "Chinese", timeout: Number(body.timeout || 120000) })
      : await transcribeWithLocalAsr(req.file.path, {
          language: body.language || "Chinese",
          asrTimeout: Number(body.timeout || 1200000)
        });
    res.json({
      ok: true,
      text: result.text || "",
      segments: result.segments || [],
      metrics: result.metrics || {},
      modelInfo: target.type === "cloud"
        ? { type: "cloud", providerId: target.provider.id, providerName: target.provider.name, model: target.provider.model }
        : { type: "local", modelId: target.model.id, modelName: target.model.name },
      audio: { uri: publicPath(req.file.path), path: req.file.path }
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/model-tests/tts", upload.single("referenceAudio"), async (req, res, next) => {
  try {
    const db = readDb();
    const body = req.body || {};
    const text = String(body.text || "").trim();
    if (!text) return res.status(400).json({ error: "请输入要合成的文本。" });
    const target = findTypedModelTarget(db, "tts", body.modelId);
    const savedVoice = (db.voices || []).find((item) => item.id === body.voiceId && !item.deletedAt);
    const voice = req.file
      ? {
          id: "uploaded-reference",
          name: req.file.originalname || "录制参考音色",
          path: req.file.path,
          uri: publicPath(req.file.path),
          referenceText: body.referenceText || ""
        }
      : savedVoice;
    if (target.type === "local" && !voice?.path) return res.status(400).json({ error: "请选择参考音色，或上传/录制一段参考音频。" });
    const outDir = join(artifactDir, "model-tests", `tts-${randomUUID()}`);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "tts-test.wav");
    const result = target.type === "cloud"
      ? await callCloudTts(target.provider, text, outPath, { voice: body.cloudVoice || body.voice || "alloy", timeout: Number(body.timeout || 120000) })
      : await createLocalTtsAudio(text, voice, outPath, {
          ttsTimeout: Number(body.timeout || 1200000)
        });
    const duration = await probeMediaDuration(outPath);
    res.json({
      ok: true,
      audio: {
        uri: publicPath(outPath),
        path: outPath,
        duration
      },
      voice: target.type === "cloud" ? { id: body.cloudVoice || "alloy", name: body.cloudVoice || "alloy" } : { id: voice.id, name: voice.name },
      modelInfo: target.type === "cloud"
        ? { type: "cloud", providerId: target.provider.id, providerName: target.provider.name, model: target.provider.model }
        : { type: "local", modelId: target.model.id, modelName: target.model.name },
      metrics: result.metrics || {}
    });
  } catch (err) {
    next(err);
  }
});

function avatarEngineFromModelId(modelId = "") {
  const normalized = String(modelId || "").toLowerCase();
  if (normalized.includes("musetalk")) return "musetalk";
  return defaultVideoSettings.engine;
}

app.post("/api/model-tests/avatar", upload.fields([
  { name: "avatar", maxCount: 1 },
  { name: "audio", maxCount: 1 }
]), async (req, res, next) => {
  try {
    const db = readDb();
    const body = req.body || {};
    const files = req.files || {};
    const uploadedAvatar = Array.isArray(files.avatar) ? files.avatar[0] : null;
    const uploadedAudio = Array.isArray(files.audio) ? files.audio[0] : null;
    const savedAvatar = (db.avatarAssets || []).find((item) => item.id === body.avatarAssetId && !item.deletedAt);
    const avatarPath = uploadedAvatar?.path || savedAvatar?.path || "";
    if (!avatarPath) return res.status(400).json({ error: "请上传或选择数字人素材。" });
    const audioPath = uploadedAudio?.path || "";
    if (!audioPath) return res.status(400).json({ error: "请上传或录制一段口播音频。" });
    const modelId = String(body.modelId || "");
    const model = db.models.find((item) => item.id === modelId && item.type === "avatar" && !item.hidden);
    if (modelId && !model) return res.status(404).json({ error: "数字人模型不存在。" });
    if (model) {
      const detection = detectModel(model);
      model.status = detection.status;
      model.resolvedPath = detection.resolvedPath;
      model.protocolStatus = detection.protocolStatus;
      model.protocolMessage = detection.protocolMessage;
      model.healthMessage = detection.message;
      model.lastCheckedAt = now();
      writeDb(db);
      if (detection.status !== "installed") {
        return res.status(400).json({ error: detection.message || "数字人模型未安装完整。" });
      }
    }
    const requestedSettings = (() => {
      try {
        return body.videoSettings ? JSON.parse(body.videoSettings) : {};
      } catch {
        return {};
      }
    })();
    const videoSettings = applyRuntimeVideoSettings(db, {
      ...requestedSettings,
      engine: requestedSettings.engine || avatarEngineFromModelId(model?.catalogId || model?.id || modelId)
    });
    const outDir = join(artifactDir, "model-tests", `avatar-${randomUUID()}`);
    mkdirSync(outDir, { recursive: true });
    const rawPath = join(outDir, "avatar-render.mp4");
    const finalPath = join(outDir, "avatar-test.mp4");
    const duration = Math.min(20, Math.max(3, Math.ceil(await probeMediaDuration(audioPath) || 8)));
    const render = await createExternalAvatarVideo({
      projectId: "model-test",
      script: "",
      audioPath,
      avatarPath,
      subtitlesPath: "",
      duration,
      videoSettings
    }, rawPath);
    if (!render.ok || !existsSync(rawPath)) {
      return res.status(500).json({ error: render.error || "数字人模型未输出视频。" });
    }
    const packaged = await createPreviewVideo(finalPath, rawPath, audioPath, duration, "", []).catch(() => false);
    if (!packaged && existsSync(rawPath)) copyFileSync(rawPath, finalPath);
    const backgroundMusic = (db.musicAssets || []).find((item) => item.id === body.backgroundMusicAssetId && !item.deletedAt && item.path && existsSync(item.path));
    if (backgroundMusic?.path) await mixBackgroundMusic(finalPath, backgroundMusic.path, duration).catch(() => false);
    res.json({
      ok: true,
      video: {
        uri: publicPath(finalPath),
        path: finalPath,
        duration
      },
      modelInfo: {
        modelId: model?.id || "",
        modelName: model?.name || "",
        engine: render.engine || videoSettings.engine
      },
      videoSettings
    });
  } catch (err) {
    next(err);
  }
});

const extractionStepDefinitions = [
  ["link", "提取链接"],
  ["type", "识别类型"],
  ["extract", "提取/下载"],
  ["asr", "文案识别"],
  ["result", "解析结果"]
];

function sourceExtractionSteps() {
  return extractionStepDefinitions.map(([key, label]) => ({
    key,
    label,
    status: "pending",
    outputText: "",
    outputJson: null,
    url: "",
    mediaUri: "",
    mediaType: "",
    message: "",
    updatedAt: ""
  }));
}

function sourceTypeLabel(type = "") {
  return ({
    douyin: "抖音",
    tiktok: "TikTok",
    xiaohongshu: "小红书",
    bilibili: "B站",
    youtube: "YouTube",
    direct_media: "媒体直链",
    web: "普通网页",
    text: "纯文本"
  })[type] || type || "未知";
}

function createSourceExtraction(source) {
  const createdAt = now();
  return {
    id: `extraction-${randomUUID()}`,
    sourceText: source,
    detectedType: "",
    sourceUrl: "",
    title: "",
    extractedText: "",
    transcriptText: "",
    mediaUri: "",
    status: "running",
    steps: sourceExtractionSteps(),
    sourceAnalysis: { links: [], transcripts: [], notes: [] },
    notes: [],
    createdAt,
    updatedAt: createdAt
  };
}

function updateSourceExtraction(id, updater) {
  const db = readDb();
  db.sourceExtractions ||= [];
  const extraction = db.sourceExtractions.find((item) => item.id === id || item.extractionId === id);
  if (!extraction) return null;
  updater(extraction, db);
  extraction.updatedAt = now();
  writeDb(db);
  return extraction;
}

function setExtractionStep(id, key, patch) {
  return updateSourceExtraction(id, (extraction) => {
    const step = (extraction.steps || []).find((item) => item.key === key);
    if (!step) return;
    Object.assign(step, patch, { updatedAt: now() });
  });
}

function setExtractionFailed(id, key, error, patch = {}) {
  const message = error instanceof Error ? error.message : String(error || "解析失败");
  updateSourceExtraction(id, (extraction) => {
    extraction.status = "failed";
    extraction.error = message;
    const step = (extraction.steps || []).find((item) => item.key === key);
    if (step) Object.assign(step, { status: "failed", message, outputText: message, updatedAt: now() }, patch);
    extraction.notes = Array.from(new Set([...(extraction.notes || []), message]));
  });
}

function uploadCopyPath(sourcePath, fallbackName, extension = "") {
  if (!sourcePath || !existsSync(sourcePath)) {
    const err = new Error("解析产物文件不存在。");
    err.status = 404;
    throw err;
  }
  const sourceExt = extname(sourcePath) || extension;
  const safeBase = basename(fallbackName || basename(sourcePath), extname(fallbackName || basename(sourcePath)))
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
    .slice(0, 80) || "media";
  const targetPath = join(uploadDir, `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}${sourceExt}`);
  copyFileSync(sourcePath, targetPath);
  return targetPath;
}

function shouldClipMedia(options = {}) {
  return Number.isFinite(Number(options.start)) && Number.isFinite(Number(options.end)) && Number(options.end) > Number(options.start);
}

async function clipMediaToUpload(sourcePath, fallbackName, options = {}) {
  if (!shouldClipMedia(options)) return uploadCopyPath(sourcePath, fallbackName, options.extension || "");
  if (!sourcePath || !existsSync(sourcePath)) {
    const err = new Error("解析产物文件不存在。");
    err.status = 404;
    throw err;
  }
  const media = await probeMediaInfo(sourcePath);
  if (!media.ok) {
    const err = new Error(media.error || "媒体文件不可用。");
    err.status = 400;
    throw err;
  }
  const minLength = options.mediaType === "audio" ? 0.2 : 0.5;
  const start = clampNumber(options.start, 0, Math.max(0, media.duration - minLength), 0);
  const end = clampNumber(options.end, start + minLength, media.duration || start + minLength, Math.min(media.duration || start + 5, start + 5));
  if (end <= start) {
    const err = new Error("结束时间必须大于开始时间。");
    err.status = 400;
    throw err;
  }
  const extension = options.extension || extname(sourcePath) || (options.mediaType === "audio" ? ".wav" : ".mp4");
  const safeBase = basename(fallbackName || basename(sourcePath), extname(fallbackName || basename(sourcePath)))
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "-")
    .slice(0, 80) || "media";
  const targetPath = join(uploadDir, `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}${extension}`);
  const args = ["-y", "-ss", String(start), "-i", sourcePath, "-t", String(end - start)];
  if (options.mediaType === "audio") {
    args.push("-vn", "-acodec", extension === ".mp3" ? "libmp3lame" : "pcm_s16le", targetPath);
  } else {
    args.push("-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-movflags", "+faststart", targetPath);
  }
  await execFileAsync("ffmpeg", args, { timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
  return { targetPath, clipRange: { start, end, duration: end - start } };
}

async function createAvatarAssetFromPath(db, sourcePath, options = {}) {
  const prepared = await clipMediaToUpload(sourcePath, options.name || "数字人素材", { ...options, mediaType: "video", extension: ".mp4" });
  const targetPath = typeof prepared === "string" ? prepared : prepared.targetPath;
  const qualityReport = await analyzeAvatarQuality(targetPath, "video/mp4");
  const asset = {
    id: `avatar-${randomUUID()}`,
    name: options.name || basename(sourcePath),
    tags: options.tags || ["链接解析导入"],
    path: targetPath,
    uri: publicPath(targetPath),
    mimeType: "video/mp4",
    authStatus: options.authStatus || "self_authorized",
    qualityReport,
    sourceExtractionId: options.extractionId || "",
    sourceLinkId: options.linkId || "",
    clipRange: typeof prepared === "string" ? undefined : prepared.clipRange,
    createdAt: now()
  };
  db.avatarAssets.unshift(asset);
  return asset;
}

async function createVoiceFromPath(db, sourcePath, options = {}) {
  const ext = extname(sourcePath).toLowerCase() || ".wav";
  const outputExt = shouldClipMedia(options) ? ".wav" : ext;
  const prepared = await clipMediaToUpload(sourcePath, options.name || "参考音色", { ...options, mediaType: "audio", extension: outputExt });
  const targetPath = typeof prepared === "string" ? prepared : prepared.targetPath;
  const voice = {
    id: `voice-${randomUUID()}`,
    name: options.name || basename(sourcePath),
    provider: options.provider || "local",
    path: targetPath,
    uri: publicPath(targetPath),
    mimeType: outputExt === ".mp3" ? "audio/mpeg" : "audio/wav",
    authScope: options.authScope || "self_authorized",
    cloneStatus: "ready_for_adapter",
    sourceExtractionId: options.extractionId || "",
    sourceLinkId: options.linkId || "",
    clipRange: typeof prepared === "string" ? undefined : prepared.clipRange,
    createdAt: now()
  };
  db.voices.unshift(voice);
  return voice;
}

async function createMusicFromPath(db, sourcePath, options = {}) {
  const ext = extname(sourcePath).toLowerCase() || ".mp3";
  const outputExt = shouldClipMedia(options) ? ".mp3" : ext;
  const prepared = await clipMediaToUpload(sourcePath, options.name || "背景音乐", { ...options, mediaType: "audio", extension: outputExt });
  const targetPath = typeof prepared === "string" ? prepared : prepared.targetPath;
  const duration = await probeMediaDuration(targetPath);
  const asset = {
    id: `music-${randomUUID()}`,
    name: options.name || basename(sourcePath),
    provider: "local",
    path: targetPath,
    uri: publicPath(targetPath),
    mimeType: options.mimeType || (outputExt === ".wav" ? "audio/wav" : "audio/mpeg"),
    duration,
    sourceMusicAssetId: options.sourceMusicAssetId || "",
    clipRange: typeof prepared === "string" ? undefined : prepared.clipRange,
    createdAt: now()
  };
  db.musicAssets ||= [];
  db.musicAssets.unshift(asset);
  return asset;
}

async function extractWebText(link, options = {}) {
  const response = await fetch(link.url, {
    headers: { "User-Agent": browserUserAgent, Accept: "text/html,application/xhtml+xml,text/plain,*/*" },
    signal: AbortSignal.timeout(options.probeTimeout || 45000)
  });
  if (!response.ok) throw new Error(`网页提取失败：HTTP ${response.status}`);
  const html = await response.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

async function runSourceExtraction(id) {
  const record = updateSourceExtraction(id, (extraction) => {
    extraction.status = "running";
  });
  if (!record) return;
  const source = record.sourceText || "";
  const sourceAnalysis = { links: [], transcripts: [], notes: [] };
  try {
    setExtractionStep(id, "link", { status: "running", message: "正在从分享文本中提取真实链接。" });
    const links = extractLinks(source);
    if (!links.length) {
      const text = stripLinks(source) || source.trim();
      setExtractionStep(id, "link", { status: "skipped", outputText: "未识别到 URL，按纯文本处理。", message: "未识别到 URL。" });
      setExtractionStep(id, "type", { status: "done", outputText: "纯文本", outputJson: { type: "text" }, message: "输入内容不是链接。" });
      setExtractionStep(id, "extract", { status: "done", outputText: text, message: "已直接提取文本内容。" });
      setExtractionStep(id, "asr", { status: "skipped", outputText: "当前来源不是视频，跳过文案识别。", message: "已跳过。" });
      setExtractionStep(id, "result", { status: "done", outputText: text, message: "最终文本已生成。" });
      updateSourceExtraction(id, (extraction) => {
        extraction.status = "done";
        extraction.detectedType = "text";
        extraction.extractedText = text;
        extraction.sourceAnalysis = { links: [], transcripts: [], notes: ["已识别为文本内容，直接作为最终文本。"] };
        extraction.notes = extraction.sourceAnalysis.notes;
      });
      return;
    }

    const link = links[0];
    setExtractionStep(id, "link", {
      status: "done",
      outputText: link.url,
      url: link.url,
      message: links.length > 1 ? `已提取首个链接，共识别 ${links.length} 个。` : "已提取链接。"
    });

    setExtractionStep(id, "type", { status: "running", message: "正在识别链接来源。" });
    setExtractionStep(id, "type", {
      status: "done",
      outputText: sourceTypeLabel(link.platform),
      outputJson: { platform: link.platform, url: link.url },
      message: `识别为${sourceTypeLabel(link.platform)}。`
    });

    setExtractionStep(id, "extract", { status: "running", message: "正在提取内容或下载媒体。" });
    let extractedLink = link;
    let extractedText = "";
    const options = { probeTimeout: 45000, downloadTimeout: 180000, apiTimeout: 12000, browserWaitMs: 4500, asrTimeout: 1200000 };
    if (link.platform === "douyin") {
      extractedLink = await extractDouyinLink(link, id, source, options);
      sourceAnalysis.links.push(extractedLink);
      const mediaUri = extractedLink.videoUri || extractedLink.audioUri || "";
      setExtractionStep(id, "extract", {
        status: ["download_failed"].includes(extractedLink.status) ? "failed" : "done",
        outputText: extractedLink.message || "媒体提取完成。",
        outputJson: null,
        url: "",
        mediaUri,
        mediaType: extractedLink.videoUri ? "video" : extractedLink.audioUri ? "audio" : "",
        message: extractedLink.message || "提取完成。"
      });
    } else if (isDirectMediaUrl(link.url)) {
      extractedLink = await downloadLinkAudio({ ...link, status: "ready", title: mediaTitleFromUrl(link.url), webpageUrl: link.url }, id, options);
      sourceAnalysis.links.push(extractedLink);
      setExtractionStep(id, "extract", {
        status: extractedLink.audioPath ? "done" : "failed",
        outputText: extractedLink.audioPath ? `已提取媒体音频：${extractedLink.title || mediaTitleFromUrl(link.url)}` : extractedLink.message || "媒体下载失败。",
        outputJson: null,
        url: "",
        mediaUri: extractedLink.audioUri || link.url,
        mediaType: "audio",
        message: extractedLink.audioPath ? "媒体音频已提取。" : extractedLink.message || "媒体下载失败。"
      });
    } else {
      try {
        extractedText = await extractWebText(link, options);
        extractedLink = { ...link, status: "ready", title: mediaTitleFromUrl(link.url), webpageUrl: link.url };
        sourceAnalysis.links.push(extractedLink);
        setExtractionStep(id, "extract", {
          status: "done",
          outputText: extractedText,
          outputJson: null,
          url: "",
          message: "已提取网页文本。"
        });
      } catch (error) {
        extractedLink = await downloadLinkAudio(await probeLinkWithYtdlp(link, options), id, options);
        sourceAnalysis.links.push(extractedLink);
        setExtractionStep(id, "extract", {
          status: extractedLink.audioPath ? "done" : "failed",
          outputText: extractedLink.message || (extractedLink.audioPath ? "音频已提取。" : "未提取到可用内容。"),
          outputJson: null,
          url: "",
          mediaUri: extractedLink.audioUri || "",
          mediaType: extractedLink.audioUri ? "audio" : "",
          message: extractedLink.message || (extractedLink.audioPath ? "音频已提取。" : "提取失败。")
        });
      }
    }

    const isVideoSource = ["douyin", "tiktok", "bilibili", "youtube", "direct_media"].includes(link.platform) || Boolean(extractedLink.audioPath || extractedLink.videoUri);
    if (isVideoSource) {
      setExtractionStep(id, "asr", {
        status: "running",
        outputText: extractedLink.audioPath
          ? `已获得音频文件，正在识别文案。${extractedLink.duration ? `视频时长约 ${Math.round(extractedLink.duration)} 秒，长视频会耗时较久。` : ""}`
          : "",
        mediaUri: extractedLink.audioUri || "",
        mediaType: extractedLink.audioUri ? "audio" : "",
        outputJson: extractedLink.duration ? { duration: Math.round(extractedLink.duration) } : null,
        message: extractedLink.transcriptText ? "已找到平台字幕，整理为文案结果。" : "正在临时启动 ASR 识别文案。"
      });
      if (extractedLink.transcriptText) {
        sourceAnalysis.transcripts.push({
          linkId: extractedLink.id,
          text: extractedLink.transcriptText,
          status: extractedLink.transcriptStatus || "subtitle"
        });
        setExtractionStep(id, "asr", {
          status: "done",
          outputText: "文案识别完成，完整内容见解析结果。",
          outputJson: { source: extractedLink.transcriptStatus || "subtitle" },
          message: "已使用平台字幕作为文案结果。"
        });
      } else if (extractedLink.audioPath) {
        try {
          const result = await transcribeWithLocalAsr(extractedLink.audioPath, options);
          const text = result.text || "";
          if (!text.trim()) throw new Error("ASR 未返回有效文本。");
          sourceAnalysis.transcripts.push({
            linkId: extractedLink.id,
            text,
            status: "transcribed",
            metrics: result.metrics || {}
          });
          setExtractionStep(id, "asr", {
            status: "done",
            outputText: "文案识别完成，完整内容见解析结果。",
            outputJson: result.metrics || {},
            message: "文案识别完成。"
          });
        } catch (error) {
          setExtractionStep(id, "asr", {
            status: "failed",
            outputText: error instanceof Error ? error.message : "文案识别失败。",
            message: error instanceof Error ? error.message : "文案识别失败。"
          });
          sourceAnalysis.notes.push(`文案识别：${error instanceof Error ? error.message : "识别失败。"}`);
        }
      } else {
        setExtractionStep(id, "asr", {
          status: "failed",
          outputText: "未获得可转写的音频文件。",
          message: "平台未返回可下载音频或视频。"
        });
        sourceAnalysis.notes.push("文案识别：未获得可识别的音频文件。");
      }
    } else {
      setExtractionStep(id, "asr", {
        status: "skipped",
        outputText: "当前来源不是视频，跳过文案识别。",
        message: "已跳过。"
      });
    }

    const notes = sourceExtractionNotes(source, sourceAnalysis);
    const transcriptText = (sourceAnalysis.transcripts || []).map((item) => item.text).filter(Boolean).join("\n\n");
    const finalText = (transcriptText || extractedText || buildExtractedSourceText(source, sourceAnalysis)).trim();
    if (!finalText) throw new Error(notes[notes.length - 1] || "没有提取到可用文本。");
    setExtractionStep(id, "result", {
      status: "done",
      outputText: finalText,
      outputJson: { source: transcriptText ? "asr_or_subtitle" : extractedText ? "text_extract" : "metadata" },
      message: "最终文本已生成。"
    });
    updateSourceExtraction(id, (extraction) => {
      const firstLink = sourceAnalysis.links?.[0] || {};
      extraction.status = "done";
      extraction.detectedType = sourceExtractionKind(sourceAnalysis);
      extraction.sourceUrl = firstLink.url || link.url;
      extraction.title = firstLink.title || "";
      extraction.extractedText = finalText;
      extraction.transcriptText = transcriptText;
      extraction.mediaUri = firstLink.videoUri || firstLink.audioUri || "";
      extraction.sourceAnalysis = { ...sourceAnalysis, notes };
      extraction.notes = notes;
    });
  } catch (error) {
    setExtractionFailed(id, "result", error);
  }
}

async function buildSourceExtraction(source) {
  const extraction = createSourceExtraction(source);
  const db = readDb();
  db.sourceExtractions ||= [];
  db.sourceExtractions.unshift(extraction);
  writeDb(db);
  await runSourceExtraction(extraction.id);
  const finalDb = readDb();
  const finalExtraction = finalDb.sourceExtractions.find((item) => item.id === extraction.id);
  if (!finalExtraction || finalExtraction.status === "failed") {
    const err = new Error(finalExtraction?.error || "来源解析失败。");
    err.status = 422;
    err.payload = finalExtraction || {};
    throw err;
  }
  return finalExtraction;
}

app.post("/api/source-extractions", (req, res) => {
  const source = String(req.body.sourceText || req.body.source || req.body.link || req.body.inputText || "").trim();
  if (!source) return res.status(400).json({ error: "请先输入要提取的链接或文本。" });
  const extraction = createSourceExtraction(source);
  const db = readDb();
  db.sourceExtractions ||= [];
  db.sourceExtractions.unshift(extraction);
  writeDb(db);
  setImmediate(() => {
    runSourceExtraction(extraction.id).catch((error) => setExtractionFailed(extraction.id, "result", error));
  });
  res.json({ extractionId: extraction.id, ...extraction });
});

app.get("/api/source-extractions/:id", (req, res) => {
  const db = readDb();
  const extraction = (db.sourceExtractions || []).find((item) => item.id === req.params.id || item.extractionId === req.params.id);
  if (!extraction) return res.status(404).json({ error: "Source extraction not found" });
  res.json({ extractionId: extraction.id, ...extraction });
});

function resolveExtractionMedia(req, mediaType) {
  const db = readDb();
  const extraction = (db.sourceExtractions || []).find((item) => item.id === req.params.id || item.extractionId === req.params.id);
  if (!extraction) {
    const err = new Error("Source extraction not found");
    err.status = 404;
    throw err;
  }
  const links = extraction.sourceAnalysis?.links || [];
  const requestedLinkId = String(req.body?.linkId || "");
  const link = links.find((item) => requestedLinkId && item.id === requestedLinkId)
    || links.find((item) => mediaType === "video" ? item.videoPath : item.audioPath);
  const sourcePath = mediaType === "video" ? link?.videoPath : link?.audioPath;
  if (!sourcePath || !existsSync(sourcePath)) {
    const err = new Error(mediaType === "video" ? "当前解析结果没有可保存的视频文件。" : "当前解析结果没有可保存的音频文件。");
    err.status = 400;
    throw err;
  }
  return { db, extraction, link, sourcePath };
}

app.post("/api/source-extractions/:id/save-avatar", async (req, res, next) => {
  try {
    const { db, extraction, link, sourcePath } = resolveExtractionMedia(req, "video");
    const name = String(req.body?.name || extraction.title || link?.title || "链接解析素材").trim();
    const asset = await createAvatarAssetFromPath(db, sourcePath, {
      name,
      tags: ["链接解析导入", sourceTypeLabel(link?.platform || "")].filter(Boolean),
      extractionId: extraction.id,
      linkId: link?.id || "",
      start: req.body?.start,
      end: req.body?.end
    });
    writeDb(db);
    res.json(asset);
  } catch (err) {
    next(err);
  }
});

app.post("/api/source-extractions/:id/save-voice", async (req, res, next) => {
  try {
    const { db, extraction, link, sourcePath } = resolveExtractionMedia(req, "audio");
    const name = String(req.body?.name || extraction.title || link?.title || "链接解析音色").trim();
    const voice = await createVoiceFromPath(db, sourcePath, {
      name,
      extractionId: extraction.id,
      linkId: link?.id || "",
      start: req.body?.start,
      end: req.body?.end
    });
    writeDb(db);
    res.json(voice);
  } catch (err) {
    next(err);
  }
});

app.post("/api/source/extract", async (req, res, next) => {
  try {
    const source = String(req.body.source || req.body.link || req.body.inputText || "").trim();
    if (!source) return res.status(400).json({ error: "请先输入要提取的链接或文本。" });
    const extraction = await buildSourceExtraction(source);
    res.json({
      inputText: extraction.extractedText,
      extractedText: extraction.extractedText,
      kind: extraction.detectedType,
      sourceAnalysis: extraction.sourceAnalysis,
      steps: extraction.steps,
      notes: extraction.notes
    });
  } catch (err) {
    if (err.payload) return res.status(err.status || 500).json({ error: err.message, ...err.payload });
    next(err);
  }
});

app.post("/api/text/polish", async (req, res, next) => {
  try {
    const db = readDb();
    const inputText = String(req.body.inputText || req.body.text || "").trim();
    if (!inputText) return res.status(400).json({ error: "请输入要润色的内容。" });
    const result = await polishTextWithTextModel(db, {
      inputText,
      requirements: req.body.requirements || "",
      scriptModelId: req.body.scriptModelId || db.settings.defaultTextModelId
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.post("/api/projects", async (req, res, next) => {
  try {
  const db = readDb();
  const inputText = req.body.inputText || req.body.sourceText || "";
  const manualScript = Boolean(req.body.manualScript);
  const mode = req.body.mode === "auto" ? "auto" : "manual";
  const scriptModelId = req.body.scriptModelId || db.settings.defaultTextModelId || "model-qwen2-5-7b-instruct-4bit-mlx";
  const title = String(req.body.title || "").trim() || await generateProjectTitleWithTextModel(db, {
    inputText,
    sourceText: inputText,
    requirements: req.body.requirements || "",
    scriptModelId
  });
  const initialScript = manualScript
    ? {
        title,
        outline: ["用户手动输入"],
        script: inputText,
        tags: [],
        platformCopies: buildScript({ inputText, requirements: req.body.requirements }).platformCopies
      }
    : null;
  const createdAt = now();
  const project = {
    id: `project-${randomUUID()}`,
    title,
    sourceType: "unified",
    inputText,
    sourceText: inputText,
    requirements: req.body.requirements || "",
    manualScript,
    reviewEnabled: mode === "manual",
    mode,
    generateSubtitles: Boolean(req.body.generateSubtitles),
    platforms: req.body.platforms?.length ? req.body.platforms : ["douyin", "xiaohongshu", "wechat"],
    scriptModelId,
    avatarAssetId: req.body.avatarAssetId || "",
    backgroundMusicAssetId: req.body.backgroundMusicAssetId || "",
    voiceId: req.body.voiceId || "",
    videoSettings: normalizeVideoSettings(req.body.videoSettings),
    status: "created",
    currentStep: "input",
    currentStage: "input",
    artifacts: initialScript ? { script: initialScript } : {},
    scriptVersions: initialScript ? [{
      id: `script-${randomUUID()}`,
      projectId: "",
      versionNo: 1,
      label: "V1",
      sourceInputSnapshot: inputText,
      requirementsSnapshot: req.body.requirements || "",
      scriptText: initialScript.script,
      title: initialScript.title,
      outline: initialScript.outline,
      tags: initialScript.tags,
      platformCopies: initialScript.platformCopies,
      modelInfo: null,
      createdAt: now(),
      status: "done",
      isCurrent: true
    }] : [],
    audioVersions: [],
    videoVersions: [],
    selectedScriptVersionId: "",
    selectedAudioVersionId: "",
    selectedVideoVersionId: "",
    sourceAnalysis: { links: [], transcripts: [], notes: [] },
    stageState: Object.fromEntries(
      stageOrder.map((stage) => [
        stage,
        {
          label: stageLabels[stage],
          status: stage === "input" || (manualScript && stage === "script") ? "done" : "pending",
          message: stage === "input" ? "输入已保存。" : manualScript && stage === "script" ? "已使用手动口播文案。" : "",
          updatedAt: createdAt,
          ...(stage === "input" || (manualScript && stage === "script")
            ? { startedAt: createdAt, finishedAt: createdAt, durationMs: 0 }
            : {})
        }
      ])
    ),
    reviewSteps: [],
    createdAt,
    updatedAt: createdAt
  };
  if (project.scriptVersions[0]) {
    project.scriptVersions[0].projectId = project.id;
    project.selectedScriptVersionId = project.scriptVersions[0].id;
  }
  db.projects.unshift(project);
  pushJob(db, project.id, "create_project", "completed", "任务已创建。");
  writeDb(db);
  res.json(project);
  } catch (err) {
    next(err);
  }
});

app.post("/api/projects/bulk-delete", (req, res) => {
  const ids = Array.isArray(req.body.ids)
    ? Array.from(new Set(req.body.ids.map((id) => String(id || "").trim()).filter(Boolean)))
    : [];
  if (!ids.length) return res.status(400).json({ error: "请选择要删除的任务。" });
  const db = readDb();
  const deleted = [];
  const missing = [];
  for (const id of ids) {
    try {
      const project = markProjectDeleted(db, id);
      deleted.push(project.id);
    } catch (error) {
      missing.push(id);
    }
  }
  writeDb(db);
  console.log(`[bulk-delete] requested=${ids.length} deleted=${deleted.length} missing=${missing.length}`);
  res.json({ ok: true, requested: ids.length, deleted, missing });
});

app.delete("/api/projects/:id", (req, res) => {
  const db = readDb();
  markProjectDeleted(db, req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

app.patch("/api/projects/:id", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const changedStage = req.body.changedStage || "input";
  for (const key of ["title", "inputText", "requirements", "manualScript", "reviewEnabled", "mode", "generateSubtitles", "voiceId", "avatarAssetId", "backgroundMusicAssetId", "scriptModelId", "platforms"]) {
    if (req.body[key] !== undefined) project[key] = req.body[key];
  }
  if (req.body.videoSettings !== undefined) {
    project.videoSettings = normalizeVideoSettings({ ...project.videoSettings, ...req.body.videoSettings });
  }
  if (req.body.selectedScriptVersionId !== undefined) project.selectedScriptVersionId = String(req.body.selectedScriptVersionId || "");
  if (req.body.selectedAudioVersionId !== undefined) project.selectedAudioVersionId = String(req.body.selectedAudioVersionId || "");
  if (req.body.selectedVideoVersionId !== undefined) project.selectedVideoVersionId = String(req.body.selectedVideoVersionId || "");
  project.sourceText = project.inputText || project.sourceText || "";
  project.mode = project.mode === "auto" ? "auto" : "manual";
  project.reviewEnabled = project.mode === "manual";
  if (req.body.script !== undefined) {
    const base = project.artifacts.script || buildScript(project);
    const scriptArtifact = {
      ...base,
      script: String(req.body.script || ""),
      title: req.body.title || base.title || project.title
    };
    createScriptVersion(project, scriptArtifact);
    project.manualScript = true;
    setStage(project, "script", "done", `${project.selectedScriptVersionId ? "新" : ""}口播文案版本已保存。`);
  }
  resetStagesAfter(project, changedStage);
  project.updatedAt = now();
  pushJob(db, project.id, "update_project", "completed", "任务配置已更新，后续阶段已等待重跑。");
  writeDb(db);
  res.json(project);
});

app.post("/api/projects/:id/input/apply-source", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const extraction = (db.sourceExtractions || []).find((item) => item.id === req.body.extractionId || item.extractionId === req.body.extractionId);
  if (!extraction) return res.status(404).json({ error: "Source extraction not found" });
  const mode = req.body.mode === "replace" ? "replace" : "append";
  const text = String(extraction.extractedText || extraction.transcriptText || "").trim();
  if (!text) return res.status(400).json({ error: "解析结果没有可推送文本。" });
  project.inputText = mode === "replace" || !project.inputText
    ? text
    : `${project.inputText.trim()}\n\n${text}`;
  project.sourceText = project.inputText;
  project.sourceAnalysis = extraction.sourceAnalysis || project.sourceAnalysis || { links: [], transcripts: [], notes: [] };
  setStage(project, "input", "done", mode === "replace" ? "解析结果已覆盖输入内容。" : "解析结果已追加到输入内容。");
  resetStagesAfter(project, "input");
  project.updatedAt = now();
  pushJob(db, project.id, "apply_source", "completed", mode === "replace" ? "解析结果已覆盖输入内容。" : "解析结果已追加到输入内容。", extraction);
  writeDb(db);
  res.json({ updatedInputText: project.inputText, project });
});

async function processSourceProject(projectId, options = {}) {
  const db = readDb();
  const project = ensureProject(db, projectId);
  project.status = "running";
  setStage(project, "input", "running", "正在解析输入来源。");
  setProjectProgress(project, {
    percent: options.queueId ? 8 : 0,
    label: "正在解析输入来源。",
    stage: "input",
    status: "running",
    queueId: options.queueId || ""
  });
  pushJob(db, project.id, "process_source", "running", "开始解析输入来源。");
  writeDb(db);
  updateQueueProgress(options.queueId, { percent: 12, label: "正在探测链接和下载可用音频。", stage: "input", stageStatus: "running" });
  await analyzeSource(project);
  project.status = "input_ready";
  setStage(project, "input", "done", "输入来源已处理。");
  setProjectProgress(project, {
    percent: options.queueId ? 20 : 100,
    label: "输入来源已处理。",
    stage: "input",
    status: project.status,
    queueId: options.queueId || ""
  });
  pushJob(db, project.id, "process_source", "completed", "输入来源已处理。", project.sourceAnalysis);
  writeDb(db);
  updateQueueProgress(options.queueId, { percent: 20, label: "输入来源已处理。", stage: "input" });
  return project;
}

function createScriptVersion(project, scriptArtifact, options = {}) {
  project.scriptVersions ||= [];
  const versionNo = nextVersionNo(project.scriptVersions);
  const version = normalizeScriptVersion(project, {
    id: `script-${randomUUID()}`,
    versionNo,
    label: versionLabel(versionNo),
    sourceInputSnapshot: options.sourceInputSnapshot ?? project.inputText ?? "",
    requirementsSnapshot: options.requirementsSnapshot ?? project.requirements ?? "",
    scriptText: scriptArtifact.script || "",
    title: scriptArtifact.title || project.title || versionLabel(versionNo),
    outline: scriptArtifact.outline || [],
    tags: scriptArtifact.tags || [],
    visualSummary: scriptArtifact.visualSummary || null,
    platformCopies: scriptArtifact.platformCopies || buildScript(project).platformCopies,
    modelInfo: scriptArtifact.modelInfo || null,
    modelParseWarning: scriptArtifact.modelParseWarning || "",
    createdAt: now(),
    status: options.status || "done",
    isCurrent: true
  }, versionNo - 1);
  project.scriptVersions = project.scriptVersions.map((item) => ({ ...item, isCurrent: false }));
  project.scriptVersions.unshift(version);
  project.selectedScriptVersionId = version.id;
  project.artifacts.script = scriptArtifactFromVersion(project, version);
  return version;
}

function createAudioVersion(project, audioArtifact, options = {}) {
  project.audioVersions ||= [];
  const versionNo = nextVersionNo(project.audioVersions);
  const version = normalizeAudioVersion(project, {
    id: `audio-${randomUUID()}`,
    versionNo,
    label: versionLabel(versionNo),
    sourceScriptVersionId: options.sourceScriptVersionId || project.selectedScriptVersionId || "",
    voiceId: audioArtifact.voiceId || project.voiceId || "",
    voiceName: audioArtifact.voiceName || "",
    audioUri: audioArtifact.uri || "",
    audioPath: audioArtifact.path || "",
    duration: audioArtifact.duration || 0,
    transcriptText: options.transcriptText || project.artifacts.script?.script || "",
    modelInfo: options.modelInfo || null,
    adapter: audioArtifact.adapter || "tts",
    note: audioArtifact.note || "",
    metrics: audioArtifact.metrics || {},
    createdAt: now(),
    status: options.status || "done",
    isCurrent: true
  }, versionNo - 1);
  project.audioVersions = project.audioVersions.map((item) => ({ ...item, isCurrent: false }));
  project.audioVersions.unshift(version);
  project.selectedAudioVersionId = version.id;
  project.artifacts.audio = audioArtifactFromVersion(version);
  return version;
}

function createVideoVersion(db, project, options = {}) {
    if (!project.artifacts?.video?.path || !existsSync(project.artifacts.video.path)) return null;
    project.videoVersions ||= project.versions || [];
    const versionNo = nextVersionNo(project.videoVersions);
    const versionId = `video-${randomUUID()}`;
    const versionDir = join(artifactDir, project.id, "versions");
    mkdirSync(versionDir, { recursive: true });
    const versionVideoPath = join(versionDir, `${versionId}.mp4`);
    copyFileSync(project.artifacts.video.path, versionVideoPath);
    const subtitles = project.artifacts.subtitles?.path && existsSync(project.artifacts.subtitles.path)
      ? {
          ...project.artifacts.subtitles,
          uri: project.artifacts.subtitles.uri,
          path: project.artifacts.subtitles.path
        }
      : null;
    project.videoVersions = project.videoVersions.map((item) => ({ ...item, isCurrent: false }));
    const version = normalizeVideoVersion(project, {
      id: versionId,
      versionNo,
      label: versionLabel(versionNo),
      variantLabel: options.variantLabel || "",
      abGroupId: options.abGroupId || "",
      sourceQueueId: options.queueId || "",
      sourceAudioVersionId: options.sourceAudioVersionId || project.selectedAudioVersionId || "",
      sourceScriptVersionId: options.sourceScriptVersionId || project.selectedScriptVersionId || "",
      avatarAssetId: project.avatarAssetId || "",
      isCurrent: true,
      createdAt: now(),
      videoSettings: normalizeVideoSettings(options.videoSettings || project.videoSettings),
      videoUri: publicPath(versionVideoPath),
      videoPath: versionVideoPath,
      duration: project.artifacts.video.duration || 0,
      artifact: {
        video: {
          ...project.artifacts.video,
          uri: publicPath(versionVideoPath),
          path: versionVideoPath
        },
        subtitles
      },
      qualityReport: project.artifacts.video.qualityReport || null,
      status: "done"
    }, versionNo - 1);
    project.videoVersions.unshift(version);
    project.versions = project.videoVersions;
    project.selectedVideoVersionId = version.id;
    pushJob(db, project.id, "create_version", "completed", `${version.label}${version.variantLabel ? ` · ${version.variantLabel}` : ""} 已保存。`, version);
    return version;
}

function resolveScriptVersion(project, requestedId = "") {
  const id = requestedId || project.selectedScriptVersionId || "";
  return project.scriptVersions?.find((version) => version.id === id && !version.deletedAt) || newestVersion(project.scriptVersions || []);
}

function resolveAudioVersion(project, requestedId = "") {
  const id = requestedId || project.selectedAudioVersionId || "";
  return project.audioVersions?.find((version) => version.id === id && !version.deletedAt) || newestVersion(project.audioVersions || []);
}

function resolveVideoVersion(project, requestedId = "") {
  const id = requestedId || project.selectedVideoVersionId || "";
  return project.videoVersions?.find((version) => version.id === id && !version.deletedAt) || newestVersion(project.videoVersions || project.versions || []);
}

async function generateScriptProject(projectId, options = {}) {
  const db = readDb();
  const project = ensureProject(db, projectId);
  setStage(project, "script", "running", "正在生成口播文案。");
  project.status = "running";
  setProjectProgress(project, {
    percent: options.queueId ? 30 : 0,
    label: "正在生成口播文案。",
    stage: "script",
    status: "running",
    queueId: options.queueId || ""
  });
  pushJob(db, project.id, "generate_script", "running", "开始生成口播文案。", { scriptModelId: options.payload?.scriptModelId || project.scriptModelId || db.settings.defaultTextModelId });
  writeDb(db);
  let script;
  try {
    script = await generateScriptWithTextModel(db, project, options.payload || {});
  } catch (error) {
    const failDb = readDb();
    const failedProject = ensureProject(failDb, projectId);
    const message = error instanceof Error ? error.message : "文本模型生成口播文案失败。";
    failedProject.status = "failed";
    failedProject.lastError = message;
    setStage(failedProject, "script", "failed", message);
    setProjectProgress(failedProject, {
      percent: options.queueId ? 30 : 0,
      label: message,
      stage: "script",
      status: "failed",
      queueId: options.queueId || ""
    });
    failedProject.updatedAt = now();
    pushJob(failDb, failedProject.id, "generate_script", "failed", message, { scriptModelId: options.payload?.scriptModelId || failedProject.scriptModelId || failDb.settings.defaultTextModelId });
    writeDb(failDb);
    updateQueueProgress(options.queueId, { percent: 30, label: message, stage: "script", stageStatus: "failed" });
    throw error;
  }
  const latestDb = readDb();
  const latestProject = ensureProject(latestDb, projectId);
  latestProject.scriptModelId = options.payload?.scriptModelId || latestProject.scriptModelId || latestDb.settings.defaultTextModelId;
  if (options.payload?.inputText !== undefined) latestProject.inputText = options.payload.inputText;
  if (options.payload?.requirements !== undefined) latestProject.requirements = options.payload.requirements;
  latestProject.sourceText = latestProject.inputText || latestProject.sourceText || "";
  const version = createScriptVersion(latestProject, script, {
    sourceInputSnapshot: options.payload?.inputText ?? latestProject.inputText ?? "",
    requirementsSnapshot: options.payload?.requirements ?? latestProject.requirements ?? ""
  });
  latestProject.status = "script_ready";
  setStage(latestProject, "script", "done", `${version.label} 口播文案已生成。`);
  latestProject.updatedAt = now();
  if (latestProject.mode === "auto") {
    latestProject.currentStep = "voice";
    latestProject.currentStage = "voice";
  }
  setProjectProgress(latestProject, {
    percent: options.queueId ? 40 : 100,
    label: `${version.label} 口播文案已生成。`,
    stage: "script",
    status: latestProject.status,
    queueId: options.queueId || ""
  });
  pushJob(latestDb, latestProject.id, "generate_script", "completed", `${version.label} 口播文案已生成。`, version);
  writeDb(latestDb);
  updateQueueProgress(options.queueId, {
    percent: 40,
    label: `${version.label} 口播文案已生成。`,
    stage: "script",
    resultVersionId: version.id,
    resultVersionLabel: version.label,
    artifactType: "script"
  });
  return latestProject;
}

function enqueueAndRespond(req, res, next, type, payload = {}) {
  try {
    const item = enqueueProjectJob(req.params.id, type, payload);
    res.status(202).json({ queued: true, queueItem: item });
  } catch (err) {
    next(err);
  }
}

function startImmediateAndRespond(req, res, next, type, payload = {}) {
  try {
    const item = startImmediateProjectJob(req.params.id, type, payload);
    res.status(202).json({ submitted: true, queueItem: item });
  } catch (err) {
    next(err);
  }
}

app.post("/api/projects/:id/process-source", (req, res, next) => {
  enqueueAndRespond(req, res, next, "process_source");
});

app.post("/api/projects/:id/generate-script", (req, res, next) => {
  startImmediateAndRespond(req, res, next, "generate_script", req.body || {});
});

app.post("/api/projects/:id/script-versions", (req, res, next) => {
  enqueueAndRespond(req, res, next, "generate_script", req.body || {});
});

app.patch("/api/projects/:id/script-versions/:versionId", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const baseVersion = resolveScriptVersion(project, req.params.versionId);
  if (!baseVersion) return res.status(404).json({ error: "Script version not found" });
  const baseArtifact = scriptArtifactFromVersion(project, baseVersion);
  const scriptArtifact = {
    ...baseArtifact,
    script: String(req.body.scriptText || req.body.script || baseArtifact.script || ""),
    title: String(req.body.title || baseArtifact.title || project.title)
  };
  const version = createScriptVersion(project, scriptArtifact);
  setStage(project, "script", "done", `${version.label} 口播文案已保存。`);
  resetStagesAfter(project, "script");
  project.status = "script_ready";
  project.updatedAt = now();
  pushJob(db, project.id, "update_script_version", "completed", `${version.label} 口播文案已保存。`, version);
  writeDb(db);
  res.json({ scriptVersion: version, project });
});

app.delete("/api/projects/:id/script-versions/:versionId", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const version = project.scriptVersions?.find((item) => item.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: "Script version not found" });
  version.deletedAt = now();
  version.status = "deleted";
  if (project.selectedScriptVersionId === version.id) {
    const next = newestVersion(project.scriptVersions || []);
    project.selectedScriptVersionId = next?.id || "";
    if (next) project.artifacts.script = scriptArtifactFromVersion(project, next);
    else delete project.artifacts.script;
  }
  resetStagesAfter(project, "script");
  project.updatedAt = now();
  pushJob(db, project.id, "delete_script_version", "completed", `${version.label} 已删除。`);
  writeDb(db);
  res.json({ ok: true, project });
});

app.post("/api/projects/:id/review/approve", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const step = req.body.step || project.currentStep;
  const pending = project.reviewSteps.find((item) => item.status === "pending" && step.includes(item.step));
  if (pending) {
    pending.status = "approved";
    pending.comment = req.body.comment || "";
    pending.approvedAt = now();
  }
  project.status = "approved";
  setStage(project, step === "script" || step === "script_review" ? "script" : "video", "done", "确认已通过。");
  project.currentStep = step === "script" || step === "script_review" ? "voice" : "video";
  project.currentStage = project.currentStep;
  project.updatedAt = now();
  pushJob(db, project.id, "review_approve", "completed", "确认已通过。");
  writeDb(db);
  res.json(project);
});

async function synthesizeProject(projectId, options = {}) {
  const db = readDb();
  const project = ensureProject(db, projectId);
    const scriptVersion = resolveScriptVersion(project, options.payload?.scriptVersionId || options.scriptVersionId || "");
    if (!scriptVersion) {
      const err = new Error("Generate script first");
      err.status = 400;
      throw err;
    }
    project.selectedScriptVersionId = scriptVersion.id;
    project.artifacts.script = scriptArtifactFromVersion(project, scriptVersion);
    const scriptText = project.artifacts.script.script || "";
    const estimatedDuration = Math.min(90, Math.max(18, Math.round(scriptText.length / 7)));
    const outDir = join(artifactDir, project.id, "audio-versions", `audio-${randomUUID()}`);
    mkdirSync(outDir, { recursive: true });
    const modelAudioPath = join(outDir, "voiceover.wav");
    const voice = resolveTtsVoice(db, project, options.payload?.voiceId || "");
    project.status = "running";
    setStage(project, "voice", "running", "正在生成口播音频。");
    setProjectProgress(project, {
      percent: options.queueId ? 48 : 0,
      label: "正在生成口播音频。",
      stage: "voice",
      status: "running",
      queueId: options.queueId || ""
    });
    pushJob(db, project.id, "synthesize_speech", "running", "开始生成口播音频。");
    writeDb(db);
    const usingWarmTts = runtimeWorkers.tts.status === "running" || runtimeWorkers.tts.status === "starting";
    const ttsProgressLabel = usingWarmTts ? "正在使用已启动的音频合成模型。" : "正在临时启动本地 TTS。";
    updateQueueProgress(options.queueId, { percent: 50, label: ttsProgressLabel, stage: "voice", stageStatus: "running" });
    setStage(project, "voice", "running", ttsProgressLabel);
    project.updatedAt = now();
    writeDb(db);
    let ttsResult;
    try {
      ttsResult = await createLocalTtsAudio(scriptText, voice, modelAudioPath, options);
    } catch (error) {
      const failDb = readDb();
      const failedProject = ensureProject(failDb, projectId);
      const message = error instanceof Error ? error.message : "本地 TTS 生成失败。";
      setStage(failedProject, "voice", "failed", message);
      setProjectProgress(failedProject, {
        percent: options.queueId ? 50 : 0,
        label: message,
        stage: "voice",
        status: "failed",
        queueId: options.queueId || ""
      });
      failedProject.status = "failed";
      failedProject.lastError = message;
      failedProject.updatedAt = now();
      pushJob(failDb, failedProject.id, "synthesize_speech", "failed", message, { voiceId: voice?.id || "", voiceName: voice?.name || "" });
      writeDb(failDb);
      updateQueueProgress(options.queueId, { percent: 50, label: message, stage: "voice", stageStatus: "failed" });
      throw error;
    }
    const audioPath = modelAudioPath;
    const actualDuration = await probeMediaDuration(audioPath);
    const duration = Math.min(120, Math.max(estimatedDuration, Math.ceil(actualDuration || estimatedDuration)));
    const usedWarmTts = Boolean(ttsResult?.metrics?.worker_warm);
    const audioArtifact = {
      uri: publicPath(audioPath),
      path: audioPath,
      duration,
      adapter: usedWarmTts ? "local-qwen3-tts-worker" : "local-qwen3-tts-cli",
      note: `${usedWarmTts ? "已使用提前启动的音频合成模型" : "已临时启动本地 TTS"}生成真实口播音频。${voice?.name ? `参考音色：${voice.name}。` : ""}`,
      voiceId: voice?.id || "",
      voiceName: voice?.name || "",
      metrics: ttsResult?.metrics || {}
    };
    const latestDb = readDb();
    const latestProject = ensureProject(latestDb, projectId);
    latestProject.selectedScriptVersionId = scriptVersion.id;
    latestProject.artifacts.script = scriptArtifactFromVersion(latestProject, scriptVersion);
    const version = createAudioVersion(latestProject, audioArtifact, { sourceScriptVersionId: scriptVersion.id });
    latestProject.status = "voice_ready";
    setStage(latestProject, "voice", "done", `${version.label} 口播音频已生成。`);
    if (latestProject.mode === "auto") {
      latestProject.currentStep = "video";
      latestProject.currentStage = "video";
    }
    setProjectProgress(latestProject, {
      percent: options.queueId ? 62 : 100,
      label: `${version.label} 口播音频已生成。`,
      stage: "voice",
      status: latestProject.status,
      queueId: options.queueId || ""
    });
    latestProject.updatedAt = now();
    pushJob(latestDb, latestProject.id, "synthesize_speech", "completed", `${version.label} 口播音频已生成。`, version);
    writeDb(latestDb);
    updateQueueProgress(options.queueId, {
      percent: 62,
      label: `${version.label} 口播音频已生成。`,
      stage: "voice",
      resultVersionId: version.id,
      resultVersionLabel: version.label,
      artifactUri: version.audioUri,
      artifactType: "audio"
    });
    return latestProject;
}

app.post("/api/projects/:id/synthesize-speech", async (req, res, next) => {
  startImmediateAndRespond(req, res, next, "synthesize_speech", req.body || {});
});

app.post("/api/projects/:id/audio-versions", async (req, res, next) => {
  startImmediateAndRespond(req, res, next, "synthesize_speech", req.body || {});
});

app.post("/api/projects/:id/audio-versions/import", upload.single("audio"), async (req, res, next) => {
  try {
    const db = readDb();
    const project = ensureProject(db, req.params.id);
    const sourcePath = req.file?.path
      || project.sourceAnalysis?.links?.find((link) => link.audioPath)?.audioPath
      || project.artifacts.audio?.path
      || "";
    if (!sourcePath || !existsSync(sourcePath)) return res.status(400).json({ error: "没有可使用的原始音频，请先通过链接解析提取音频，或录制口播音频。" });
    const outDir = join(artifactDir, project.id, "audio-versions", `audio-${randomUUID()}`);
    mkdirSync(outDir, { recursive: true });
    const ext = extname(sourcePath) || ".wav";
    const audioPath = join(outDir, `voiceover${ext}`);
    copyFileSync(sourcePath, audioPath);
    const duration = Math.ceil(await probeMediaDuration(audioPath) || 0);
    const audioArtifact = {
      uri: publicPath(audioPath),
      path: audioPath,
      duration,
      adapter: req.file ? "uploaded-audio" : "source-audio",
      note: req.file ? "用户录制的口播音频。" : "已将原始来源音频作为新的口播音频版本。",
      voiceId: project.voiceId || "",
      voiceName: req.body.voiceName || (req.file ? "录制音频" : "原始音频"),
      metrics: {}
    };
    const version = createAudioVersion(project, audioArtifact, { sourceScriptVersionId: req.body.scriptVersionId || project.selectedScriptVersionId || "" });
    project.status = "voice_ready";
    setStage(project, "voice", "done", `${version.label} 口播音频已生成。`);
    resetStagesAfter(project, "voice");
    project.updatedAt = now();
    pushJob(db, project.id, "import_audio_version", "completed", `${version.label} 口播音频已生成。`, version);
    writeDb(db);
    res.json({ audioVersion: version, project });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/projects/:id/audio-versions/:versionId", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const version = project.audioVersions?.find((item) => item.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: "Audio version not found" });
  version.deletedAt = now();
  version.status = "deleted";
  if (project.selectedAudioVersionId === version.id) {
    const next = newestVersion(project.audioVersions || []);
    project.selectedAudioVersionId = next?.id || "";
    if (next) project.artifacts.audio = audioArtifactFromVersion(next);
    else delete project.artifacts.audio;
  }
  resetStagesAfter(project, "voice");
  project.updatedAt = now();
  pushJob(db, project.id, "delete_audio_version", "completed", `${version.label} 已删除。`);
  writeDb(db);
  res.json({ ok: true, project });
});

async function renderProject(projectId, options = {}) {
    const db = readDb();
    const project = ensureProject(db, projectId);
    const audioVersion = resolveAudioVersion(project, options.audioVersionId || "");
    if (!audioVersion) {
      const err = new Error("Generate audio first");
      err.status = 400;
      throw err;
    }
    project.selectedAudioVersionId = audioVersion.id;
    project.artifacts.audio = audioArtifactFromVersion(audioVersion);
    const scriptVersion = resolveScriptVersion(project, audioVersion.sourceScriptVersionId || project.selectedScriptVersionId || "");
    if (!scriptVersion) {
      const err = new Error("Generate script first");
      err.status = 400;
      throw err;
    }
    project.selectedScriptVersionId = scriptVersion.id;
    project.artifacts.script = scriptArtifactFromVersion(project, scriptVersion);
    const outDir = join(artifactDir, project.id);
    mkdirSync(outDir, { recursive: true });
    const fullDuration = project.artifacts.audio?.duration || 45;
    const previewDuration = Number(options.previewDuration || 0);
    const duration = previewDuration > 0 ? Math.min(fullDuration, Math.max(1, previewDuration)) : fullDuration;
    const avatarAssetId = options.avatarAssetId || project.avatarAssetId;
    const avatar = db.avatarAssets.find((item) => item.id === avatarAssetId);
    if (!avatar?.path) {
      const err = new Error("请先选择可用的数字人素材。");
      err.status = 400;
      throw err;
    }
    project.avatarAssetId = avatarAssetId || project.avatarAssetId;
    const backgroundMusicAssetId = options.backgroundMusicAssetId || project.backgroundMusicAssetId || "";
    const backgroundMusic = (db.musicAssets || []).find((item) => item.id === backgroundMusicAssetId && !item.deletedAt && item.path && existsSync(item.path));
    project.backgroundMusicAssetId = backgroundMusic?.id || "";
    project.videoSettings = applyRuntimeVideoSettings(db, { ...project.videoSettings, ...(options.videoSettings || {}) });
    const generateSubtitles = Boolean(options.generateSubtitles ?? project.generateSubtitles);
    project.generateSubtitles = generateSubtitles;
    project.status = "running";
    setStage(project, "video", "running", "正在生成数字人视频。");
    setProjectProgress(project, {
      percent: options.queueId ? 68 : 0,
      label: options.variantLabel ? `正在生成 ${options.variantLabel}。` : "正在生成数字人视频。",
      stage: "video",
      status: "running",
      queueId: options.queueId || ""
    });
    pushJob(db, project.id, "render_video", "running", previewDuration > 0 ? "开始生成3秒预览。" : "开始生成数字人视频。", { videoSettings: project.videoSettings, duration });
    writeDb(db);
    updateQueueProgress(options.queueId, { percent: 70, label: generateSubtitles ? "正在生成字幕文件。" : "正在准备视频素材。", stage: "video", stageStatus: "running" });
    const videoPath = join(outDir, "digital-human.mp4");
    const avatarRenderPath = join(outDir, "digital-human-musetalk.mp4");
    const srtPath = generateSubtitles ? join(outDir, "captions.srt") : "";
    const captionSegments = generateSubtitles ? buildCaptionSegments(project.artifacts.script.script, duration) : [];
    if (generateSubtitles) writeFileSync(srtPath, buildSrt(project.artifacts.script.script, duration));
    updateQueueProgress(options.queueId, { percent: 76, label: "正在调用数字人口型 Adapter。", stage: "video" });
    const avatarRender = await createSegmentedAvatarVideo(
      {
        projectId: project.id,
        script: project.artifacts.script.script,
        audioPath: project.artifacts.audio?.path || "",
        avatarPath: avatar?.path || "",
        subtitlesPath: srtPath,
        duration,
        videoSettings: project.videoSettings
      },
      avatarRenderPath,
      { queueId: options.queueId, segmentSeconds: db.settings.avatarSegmentSeconds }
    ).catch((error) => ({
      ok: false,
      engine: project.videoSettings.engine,
      error: error instanceof Error ? error.message : "口型 Adapter 调用失败。"
    }));
    const externalRendered = Boolean(avatarRender.ok);
    if (!externalRendered) {
      const failDb = readDb();
      const failedProject = ensureProject(failDb, projectId);
      const message = `数字人口型生成失败：${avatarRender.error || "口型 Adapter 未生成视频。"}`;
      failedProject.status = "failed";
      failedProject.lastError = message;
      setStage(failedProject, "video", "failed", message);
      setProjectProgress(failedProject, {
        percent: options.queueId ? 82 : 0,
        label: message,
        stage: "video",
        status: "failed",
        queueId: options.queueId || ""
      });
      failedProject.updatedAt = now();
      pushJob(failDb, failedProject.id, "render_video", "failed", message, { videoSettings: project.videoSettings, error: avatarRender.error || "" });
      writeDb(failDb);
      updateQueueProgress(options.queueId, { percent: 82, label: message, stage: "video", stageStatus: "failed" });
      throw new Error(message);
    }
    const captionOverlays = generateSubtitles
      ? await createSimpleSubtitleOverlays(captionSegments, outDir, avatarRenderPath).catch(() => [])
      : [];
    updateQueueProgress(options.queueId, { percent: 86, label: generateSubtitles ? "正在一次性封装视频、音频、背景音和可见字幕。" : "正在一次性封装视频、音频和背景音。", stage: "video" });
    const packaged = await packageAvatarRenderVideo({
      outPath: videoPath,
      avatarRenderPath,
      audioPath: project.artifacts.audio?.path || "",
      backgroundMusicPath: backgroundMusic?.path || "",
      subtitlesPath: srtPath,
      duration,
      burnSubtitles: generateSubtitles,
      captionOverlays
    });
    let rendered = packaged.ok;
    if (!rendered) {
      rendered = await createPreviewVideo(videoPath, avatarRenderPath, project.artifacts.audio?.path || "", duration, srtPath, []).catch(() => false);
    }
    if (!rendered && existsSync(avatarRenderPath)) {
      copyFileSync(avatarRenderPath, videoPath);
      rendered = true;
    }
    const backgroundMusicMixed = packaged.backgroundMusicMixed;
    const subtitlesEmbedded = packaged.subtitlesEmbedded || (generateSubtitles && rendered && !packaged.ok && !packaged.visibleCaptions ? await embedSubtitlesInMp4(videoPath, srtPath) : false);
    const visibleCaptions = Boolean(generateSubtitles && (packaged.visibleCaptions || (rendered && !packaged.ok)));
    const videoArtifact = {
      uri: publicPath(videoPath),
      path: videoPath,
      duration,
      adapter: `${avatarRender.engine || project.videoSettings.engine}-avatar-adapter`,
      subtitlesEmbedded,
      visibleCaptions,
      qualityReport: {
        status: `rendered_by_${avatarRender.engine || project.videoSettings.engine}`,
        notes: [
          `已临时启动 ${avatarRender.engine || project.videoSettings.engine} Adapter 渲染口型。`,
          avatarRender.segmentCount ? `长视频已自动切成 ${avatarRender.segmentCount} 段渲染，每段约 ${avatarRender.segmentSeconds} 秒。` : "",
          `视频参数：${project.videoSettings.cropMode} / ${project.videoSettings.parsingMode} / upper=${project.videoSettings.upperBoundaryRatio} / margin=${project.videoSettings.extraMargin}`,
          backgroundMusicMixed ? `已混入背景音乐：${backgroundMusic.name}。` : "未使用背景音乐。",
          generateSubtitles ? (visibleCaptions ? "字幕已烧录到视频画面。" : subtitlesEmbedded ? "字幕已写入 MP4 字幕轨。" : "字幕文件已生成，当前环境未能写入视频画面。") : "未生成字幕。",
          "输出画幅已按数字人原视频保留，不再强制裁剪为 1080x1920。"
        ].filter(Boolean)
      }
    };
    const subtitlesArtifact = generateSubtitles ? {
      uri: publicPath(srtPath),
      path: srtPath,
      format: "srt"
    } : null;
    const latestDb = readDb();
    const latestProject = ensureProject(latestDb, projectId);
    latestProject.selectedAudioVersionId = audioVersion.id;
    latestProject.artifacts.audio = audioArtifactFromVersion(audioVersion);
    latestProject.selectedScriptVersionId = scriptVersion.id;
    latestProject.artifacts.script = scriptArtifactFromVersion(latestProject, scriptVersion);
    latestProject.avatarAssetId = avatarAssetId || latestProject.avatarAssetId;
    latestProject.backgroundMusicAssetId = backgroundMusic?.id || "";
    latestProject.generateSubtitles = generateSubtitles;
    latestProject.videoSettings = project.videoSettings;
    latestProject.artifacts.video = videoArtifact;
    if (subtitlesArtifact) latestProject.artifacts.subtitles = subtitlesArtifact;
    else delete latestProject.artifacts.subtitles;
    latestProject.status = "video_ready";
    latestProject.lastError = "";
    setStage(latestProject, "video", "done", previewDuration > 0 ? "3秒预览已生成。" : "视频已生成。");
    if (latestProject.mode === "auto") {
      latestProject.currentStep = "publish";
      latestProject.currentStage = "publish";
    }
    const version = options.createVersion === false ? null : createVideoVersion(latestDb, latestProject, {
      queueId: options.queueId || "",
      abGroupId: options.abGroupId || "",
      variantLabel: options.variantLabel || (previewDuration > 0 ? "3秒预览" : ""),
      videoSettings: latestProject.videoSettings,
      sourceAudioVersionId: audioVersion.id,
      sourceScriptVersionId: scriptVersion.id
    });
    setProjectProgress(latestProject, {
      percent: options.queueId ? 96 : 100,
      label: version ? `${version.label}${previewDuration > 0 ? " 3秒预览" : " 视频版本"}已生成。` : "视频已生成。",
      stage: "video",
      status: latestProject.status,
      queueId: options.queueId || ""
    });
    latestProject.updatedAt = now();
    pushJob(latestDb, latestProject.id, "render_video", "completed", previewDuration > 0 ? "3秒预览已生成。" : "视频已生成。", latestProject.artifacts.video);
    writeDb(latestDb);
    updateQueueProgress(options.queueId, { percent: 96, label: version ? `${version.label}${previewDuration > 0 ? " 3秒预览" : " 视频版本"}已生成。` : "视频已生成。", stage: "video" });
    return latestProject;
}

app.post("/api/projects/:id/render-video", async (req, res, next) => {
  enqueueAndRespond(req, res, next, "render_video", {
    videoSettings: req.body?.videoSettings || null,
    audioVersionId: req.body?.audioVersionId || "",
    avatarAssetId: req.body?.avatarAssetId || "",
    backgroundMusicAssetId: req.body?.backgroundMusicAssetId || "",
    generateSubtitles: Boolean(req.body?.generateSubtitles)
  });
});

app.post("/api/projects/:id/render-preview", async (req, res, next) => {
  enqueueAndRespond(req, res, next, "render_video", {
    videoSettings: req.body?.videoSettings || null,
    audioVersionId: req.body?.audioVersionId || "",
    avatarAssetId: req.body?.avatarAssetId || "",
    backgroundMusicAssetId: req.body?.backgroundMusicAssetId || "",
    generateSubtitles: Boolean(req.body?.generateSubtitles),
    previewDuration: 3,
    variantLabel: "3秒预览"
  });
});

app.post("/api/projects/:id/video-versions", async (req, res, next) => {
  enqueueAndRespond(req, res, next, "render_video", {
    videoSettings: req.body?.videoSettings || null,
    audioVersionId: req.body?.audioVersionId || "",
    avatarAssetId: req.body?.avatarAssetId || "",
    generateSubtitles: Boolean(req.body?.generateSubtitles)
  });
});

app.post("/api/projects/:id/publish-package", async (req, res, next) => {
  try {
    const db = readDb();
    const project = ensureProject(db, req.params.id);
    if (!project.artifacts.script) return res.status(400).json({ error: "Generate script first" });
    const packId = `package-${randomUUID()}`;
    const outDir = join(packageDir, packId);
    mkdirSync(outDir, { recursive: true });
    const manifest = {
      projectId: project.id,
      title: project.title,
      mode: "semi_auto_publish_only",
      platforms: project.platforms,
      createdAt: now(),
      files: []
    };

    if (project.artifacts.video?.path && existsSync(project.artifacts.video.path)) {
      copyFileSync(project.artifacts.video.path, join(outDir, "video.mp4"));
      manifest.files.push("video.mp4");
    }
    if (project.artifacts.subtitles?.path && existsSync(project.artifacts.subtitles.path)) {
      copyFileSync(project.artifacts.subtitles.path, join(outDir, "captions.srt"));
      manifest.files.push("captions.srt");
    }
    writeFileSync(join(outDir, "script.txt"), project.artifacts.script.script);
    writeFileSync(join(outDir, "metadata.json"), JSON.stringify(manifest, null, 2));
    for (const platform of project.platforms) {
      const payload = publishCopyForProject(project, platform);
      writeFileSync(
        join(outDir, `${platform}-publish-copy.txt`),
        [
          `标题：${payload.title}`,
          "",
          "正文：",
          payload.body,
          "",
          "半自动发布检查：",
          ...payload.checklist.map((item, index) => `${index + 1}. ${item}`)
        ].join("\n")
      );
    }
    const readme = [
      `# ${project.title}`,
      "",
      "这是平台发布素材，不会代替用户点击最终发布。",
      "",
      "发布步骤：",
      "1. 打开目标平台创作者后台。",
      "2. 上传 video.mp4。",
      "3. 按平台复制对应 publish-copy.txt 的标题和正文。",
      "4. 检查封面、字幕、话题和账号合规项。",
      "5. 人工点击发布。",
      "",
      "包含文件：",
      ...manifest.files.map((item) => `- ${item}`),
      "- script.txt",
      "- metadata.json"
    ].join("\n");
    writeFileSync(join(outDir, "README.md"), readme);
    const zipPath = join(packageDir, `${packId}.zip`);
    await zipDirectory(outDir, zipPath);
    const publishPackage = {
      id: packId,
      projectId: project.id,
      mode: "semi_auto",
      uri: publicPath(zipPath),
      path: zipPath,
      folderUri: publicPath(outDir),
      platforms: project.platforms,
      createdAt: now()
    };
    db.publishPackages.unshift(publishPackage);
    project.artifacts.publishPackage = publishPackage;
    project.status = "ready_to_publish";
    setStage(project, "publish", "ready", "视频已可发布。");
    project.currentStep = "publish";
    project.currentStage = "publish";
    project.updatedAt = now();
    pushJob(db, project.id, "publish_package", "completed", "发布素材已准备。", publishPackage);
    writeDb(db);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

async function runAllProject(projectId, options = {}) {
  updateQueueProgress(options.queueId, { percent: 5, label: "开始自动流程。", stage: "input", stageStatus: "running" });
  await processSourceProject(projectId, { queueId: options.queueId });
  const scriptDb = readDb();
  const scriptProject = ensureProject(scriptDb, projectId);
  if (!resolveScriptVersion(scriptProject)) {
    const scriptArtifact = {
      ...buildScript(scriptProject),
      script: scriptProject.inputText || scriptProject.sourceText || ""
    };
    createScriptVersion(scriptProject, scriptArtifact, {
      sourceInputSnapshot: scriptProject.inputText || scriptProject.sourceText || "",
      requirementsSnapshot: scriptProject.requirements || ""
    });
    setStage(scriptProject, "script", "done", "已使用输入内容作为口播文案。");
    scriptProject.updatedAt = now();
    writeDb(scriptDb);
  }
  updateQueueProgress(options.queueId, { percent: 44, label: "口播内容已就绪，准备生成口播音频。", stage: "voice", stageStatus: "running" });
  await synthesizeProject(projectId, { queueId: options.queueId });
  updateQueueProgress(options.queueId, { percent: 64, label: "口播已就绪，准备生成视频。", stage: "video", stageStatus: "running" });
  await renderProject(projectId, { queueId: options.queueId });
  const db = readDb();
  const project = ensureProject(db, projectId);
  project.status = "video_ready";
  setStage(project, "publish", "ready", "视频已可发布。");
  setProjectProgress(project, {
    percent: 100,
    label: "任务已自动生成到视频阶段。",
    stage: "publish",
    status: project.status,
    queueId: options.queueId || ""
  });
  pushJob(db, project.id, "run_all", "completed", "任务已自动生成到视频阶段。");
  writeDb(db);
  updateQueueProgress(options.queueId, { percent: 100, label: "任务已自动生成到视频阶段。", stage: "publish" });
  return project;
}

async function renderAbProject(projectId, options = {}) {
  const db = readDb();
  const project = ensureProject(db, projectId);
  const base = normalizeVideoSettings(options.payload?.videoSettings || project.videoSettings || defaultVideoSettings);
  if (!project.artifacts.script) {
      const err = new Error("请先生成口播文案，再生成 A/B 小样。");
    err.status = 400;
    throw err;
  }
  if (!project.artifacts.audio) {
    writeDb(db);
    updateQueueProgress(options.queueId, { percent: 18, label: "缺少口播音频，先补生成口播音频。", stage: "voice", stageStatus: "running" });
    await synthesizeProject(projectId, { queueId: options.queueId });
  }
  const abGroupId = `ab-${randomUUID()}`;
  const variants = [
    {
      label: "A 推荐参数",
      settings: base
    },
    {
      label: "B 下边界更稳",
      settings: normalizeVideoSettings({
        ...base,
        upperBoundaryRatio: base.upperBoundaryRatio + 0.04,
        lowerPad: base.lowerPad + 0.02,
        facePad: Math.min(0.18, base.facePad + 0.02)
      })
    },
    {
      label: "C 脸颊保护更强",
      settings: normalizeVideoSettings({
        ...base,
        facePad: Math.min(0.2, base.facePad + 0.04),
        lowerPad: Math.min(0.08, base.lowerPad + 0.03),
        extraMargin: Math.min(8, base.extraMargin + 4)
      })
    }
  ];
  for (const [index, variant] of variants.entries()) {
    const startPercent = 25 + index * 22;
    updateQueueProgress(options.queueId, {
      percent: startPercent,
      label: `正在生成 ${variant.label}。`,
      stage: "video",
      stageStatus: "running"
    });
    await renderProject(projectId, {
      queueId: options.queueId,
      videoSettings: variant.settings,
      abGroupId,
      variantLabel: variant.label
    });
  }
  const finalDb = readDb();
  const finalProject = ensureProject(finalDb, projectId);
  finalProject.status = "video_ready";
  setStage(finalProject, "video", "done", "A/B 小样已生成。");
  setProjectProgress(finalProject, {
    percent: 100,
    label: "A/B 小样已生成，可在版本列表对比。",
    stage: "video",
    status: finalProject.status,
    queueId: options.queueId || ""
  });
  pushJob(finalDb, finalProject.id, "ab_render", "completed", "A/B 小样已生成。");
  writeDb(finalDb);
  updateQueueProgress(options.queueId, { percent: 100, label: "A/B 小样已生成，可在版本列表对比。", stage: "video" });
  return finalProject;
}

app.post("/api/projects/:id/run-all", (req, res, next) => {
  enqueueAndRespond(req, res, next, "run_all");
});

app.post("/api/projects/:id/ab-render", (req, res, next) => {
  enqueueAndRespond(req, res, next, "ab_render", { videoSettings: req.body?.videoSettings || null });
});

const activePublishContexts = new Map();

async function fillFirstMatchingField(page, selectors, value, steps, label) {
  if (!value) {
    steps.push(`${label}为空，跳过填写。`);
    return false;
  }
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.count()) {
        await locator.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => undefined);
        await locator.click({ timeout: 1500 }).catch(() => undefined);
        await locator.fill(value, { timeout: 2500 }).catch(async () => {
          await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A", { timeout: 1000 }).catch(() => undefined);
          await locator.type(value, { delay: 1, timeout: 5000 });
        });
        steps.push(`已尝试填写${label}。`);
        return true;
      }
    } catch {
      continue;
    }
  }
  steps.push(`未找到${label}输入框，可能需要登录后手动补填。`);
  return false;
}

async function automatePublishPlatform(platform, payload) {
  const steps = [];
  const profileDir = join(storageDir, "playwright-profiles", platform);
  mkdirSync(profileDir, { recursive: true });
  const { chromium } = await import("playwright");
  const previous = activePublishContexts.get(platform);
  if (previous) {
    await previous.close().catch(() => undefined);
    activePublishContexts.delete(platform);
  }
  const launchOptions = {
    headless: process.env.DH_PUBLISH_HEADLESS === "1",
    viewport: null,
    args: ["--start-maximized"]
  };
  if (process.env.DH_PLAYWRIGHT_CHANNEL || process.platform === "darwin") {
    launchOptions.channel = process.env.DH_PLAYWRIGHT_CHANNEL || "chrome";
  }
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, launchOptions);
  } catch (error) {
    if (!launchOptions.channel) throw error;
    steps.push(`未能启动 ${launchOptions.channel}，改用 Playwright Chromium。`);
    const fallbackOptions = { ...launchOptions };
    delete fallbackOptions.channel;
    context = await chromium.launchPersistentContext(profileDir, fallbackOptions);
  }
  activePublishContexts.set(platform, context);
  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(payload.publishUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  steps.push(`已打开${payload.platformLabel}创作者后台。`);

  if (payload.videoPath && existsSync(payload.videoPath)) {
    const fileInputs = page.locator("input[type='file']");
    const count = await fileInputs.count().catch(() => 0);
    if (count > 0) {
      await fileInputs.first().setInputFiles(payload.videoPath, { timeout: 15000 });
      steps.push("已尝试上传视频文件。");
    } else {
      steps.push("未找到视频上传控件，可能需要登录或切换到发布页后再上传。");
    }
  } else {
    steps.push("未找到本地视频文件，跳过上传。");
  }

  const titleSelectors = platform === "douyin"
    ? [
        "input[placeholder*='标题']",
        "textarea[placeholder*='标题']",
        "[contenteditable='true'][data-placeholder*='标题']",
        "[contenteditable='true']:near(:text('标题'))"
      ]
    : [
        "input[placeholder*='标题']",
        "textarea[placeholder*='标题']",
        "[contenteditable='true'][data-placeholder*='标题']",
        "[contenteditable='true']"
      ];
  const bodySelectors = platform === "douyin"
    ? [
        "textarea[placeholder*='描述']",
        "textarea[placeholder*='简介']",
        "textarea[placeholder*='正文']",
        "[contenteditable='true'][data-placeholder*='描述']",
        "[contenteditable='true'][data-placeholder*='正文']",
        "[contenteditable='true']"
      ]
    : [
        "textarea[placeholder*='正文']",
        "textarea[placeholder*='描述']",
        "textarea[placeholder*='内容']",
        "[contenteditable='true'][data-placeholder*='正文']",
        "[contenteditable='true'][data-placeholder*='内容']",
        "[contenteditable='true']"
      ];
  await fillFirstMatchingField(page, titleSelectors, payload.title, steps, "标题");
  await fillFirstMatchingField(page, bodySelectors, payload.body, steps, "正文");
  steps.push("未点击最终发布，请在平台页面确认封面、合规项和账号状态后手动发布。");
  return {
    status: "automation_attempted",
    message: "已打开平台并尝试回填视频、标题和正文。",
    steps
  };
}

app.post("/api/projects/:id/publish/:platform", async (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const platform = req.params.platform;
  if (!platformLinks[platform]) return res.status(404).json({ error: "Platform not supported" });
  const videoVersion = resolveVideoVersion(project, req.body?.videoVersionId || "");
  if (!videoVersion) return res.status(400).json({ error: "请先选择要发布的视频版本。" });
  project.selectedVideoVersionId = videoVersion.id;
  project.artifacts.video = videoArtifactFromVersion(videoVersion);
  if (videoVersion.artifact?.subtitles) project.artifacts.subtitles = videoVersion.artifact.subtitles;
  const audioVersion = resolveAudioVersion(project, videoVersion.sourceAudioVersionId || project.selectedAudioVersionId || "");
  if (audioVersion) {
    project.selectedAudioVersionId = audioVersion.id;
    project.artifacts.audio = audioArtifactFromVersion(audioVersion);
  }
  const copy = publishCopyForProject(project, platform);
  const publishPayload = {
    id: `publish-draft-${randomUUID()}`,
    projectId: project.id,
    projectTitle: project.title,
    platform,
    platformLabel: platformLabels[platform],
    status: "publish_payload_ready",
    publishUrl: platformLinks[platform],
    videoVersionId: videoVersion.id,
    videoVersionLabel: videoVersion.label,
    videoUri: project.artifacts.video?.uri || "",
    videoPath: project.artifacts.video?.path || "",
    audioUri: project.artifacts.audio?.uri || "",
    audioPath: project.artifacts.audio?.path || "",
    subtitlesUri: project.artifacts.subtitles?.uri || "",
    subtitlesPath: project.artifacts.subtitles?.path || "",
    title: copy.title,
    body: copy.body,
    createdAt: now(),
    publishedAt: "",
    workUrl: "",
    automationStatus: "pending",
    automationMessage: "",
    automationSteps: []
  };
  try {
    const automation = await automatePublishPlatform(platform, publishPayload);
    publishPayload.automationStatus = automation.status;
    publishPayload.automationMessage = automation.message;
    publishPayload.automationSteps = automation.steps;
    setStage(project, "publish", "ready", `${platformLabels[platform]} 已打开并尝试自动回填发布信息。`);
    pushJob(db, project.id, "publish_automation", "completed", `${platformLabels[platform]} 已尝试自动回填。`, publishPayload);
  } catch (error) {
    publishPayload.automationStatus = "automation_failed";
    publishPayload.automationMessage = error instanceof Error ? error.message : "自动回填失败。";
    publishPayload.automationSteps = ["自动打开或回填失败，可检查平台登录状态后重试。"];
    setStage(project, "publish", "ready", `${platformLabels[platform]} 自动回填失败，可重试。`);
    pushJob(db, project.id, "publish_automation", "failed", publishPayload.automationMessage, publishPayload);
  }
  writeDb(db);
  res.json(publishPayload);
});

app.post("/api/projects/:id/publish-records", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const channels = Array.isArray(req.body.channels) && req.body.channels.length ? req.body.channels : ["douyin"];
  const platform = channels.find((item) => platformLinks[item]) || "douyin";
  const videoVersion = resolveVideoVersion(project, req.body.videoVersionId || "");
  if (!videoVersion) return res.status(400).json({ error: "请先选择要发布的视频版本。" });
  project.selectedVideoVersionId = videoVersion.id;
  project.artifacts.video = videoArtifactFromVersion(videoVersion);
  if (videoVersion.artifact?.subtitles) project.artifacts.subtitles = videoVersion.artifact.subtitles;
  const copy = publishCopyForProject(project, platform);
  const record = {
    id: `publish-${randomUUID()}`,
    projectId: project.id,
    projectTitle: project.title,
    platform,
    platformLabel: platformLabels[platform],
    channels,
    status: "ready_for_manual_publish",
    publishUrl: platformLinks[platform],
    videoVersionId: videoVersion.id,
    videoVersionLabel: videoVersion.label,
    videoUri: project.artifacts.video?.uri || "",
    videoPath: project.artifacts.video?.path || "",
    title: copy.title,
    body: copy.body,
    createdAt: now(),
    publishedAt: req.body.status === "published" ? now() : "",
    workUrl: String(req.body.workUrl || "")
  };
  if (req.body.status === "published") record.status = "published";
  db.publishRecords.unshift(record);
  setStage(project, "publish", "ready", "发布记录已准备。");
  pushJob(db, project.id, "prepare_publish", "completed", "发布记录已准备。", record);
  writeDb(db);
  res.json({ publishRecord: record });
});

app.patch("/api/publish-records/:id", (req, res) => {
  const db = readDb();
  const record = (db.publishRecords || []).find((item) => item.id === req.params.id);
  if (!record) return res.status(404).json({ error: "Publish record not found" });
  if (req.body.workUrl !== undefined) record.workUrl = req.body.workUrl;
  if (req.body.status !== undefined) record.status = req.body.status;
  if (record.status === "published" && !record.publishedAt) record.publishedAt = now();
  record.updatedAt = now();
  writeDb(db);
  res.json(record);
});

app.delete("/api/publish-records/:id", (req, res) => {
  const db = readDb();
  const record = (db.publishRecords || []).find((item) => item.id === req.params.id);
  if (!record) return res.status(404).json({ error: "Publish record not found" });
  record.deletedAt = now();
  record.updatedAt = now();
  record.status = "deleted";
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/queue/:id/retry", (req, res) => {
  const db = readDb();
  const item = (db.queueItems || []).find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Queue item not found" });
  if (!["failed", "cancelled"].includes(item.status)) {
    return res.status(400).json({ error: "只有失败或已取消的任务可以重试。" });
  }
  if (["generate_script", "synthesize_speech"].includes(item.type)) {
    try {
      const retryItem = startImmediateProjectJob(item.projectId, item.type, item.payload || {});
      return res.status(202).json({ submitted: true, queueItem: retryItem });
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message || "重试失败。" });
    }
  }
  const project = ensureProject(db, item.projectId);
  const duplicate = activeQueueItems(db).find((entry) => entry.projectId === item.projectId && entry.type === item.type && entry.signature === item.signature);
  if (duplicate) return res.status(409).json({ error: "相同参数的任务已在执行或等待。" });
  item.status = "queued";
  item.lastError = "";
  item.cancelRequested = false;
  item.startedAt = "";
  item.finishedAt = "";
  item.updatedAt = now();
  item.progress = {
    percent: 0,
    label: "已重新进入队列。",
    stage: queueStageMap[item.type] || "input",
    updatedAt: now()
  };
  project.status = "queued";
  project.activeQueueId = item.id;
  project.lastError = "";
  setProjectProgress(project, {
    ...item.progress,
    status: item.status,
    queueId: item.id
  });
  if (item.progress.stage && item.progress.stage !== "input") {
    setStage(project, item.progress.stage, "queued", "已重新进入队列。");
  }
  pushJob(db, project.id, item.type, "queued", `${item.label}已重试入队。`);
  writeDb(db);
  scheduleQueue();
  res.json({ queued: true, queueItem: publicQueueItem(item, db) });
});

app.post("/api/queue/:id/cancel", (req, res) => {
  const db = readDb();
  const item = (db.queueItems || []).find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Queue item not found" });
  if (item.status === "running") {
    return res.status(409).json({ error: "运行中的本地推理任务暂不强杀；失败后可重试，或等待当前阶段结束。" });
  }
  if (item.status !== "queued") return res.status(400).json({ error: "只有等待中的任务可以取消。" });
  item.status = "cancelled";
  item.finishedAt = now();
  item.updatedAt = now();
  item.progress = {
    ...(item.progress || {}),
    label: "任务已取消。",
    updatedAt: now()
  };
  const project = db.projects.find((entry) => entry.id === item.projectId);
  if (project) {
    project.status = "created";
    project.activeQueueId = "";
    setProjectProgress(project, {
      percent: item.progress?.percent || 0,
      label: "任务已取消。",
      stage: item.progress?.stage || project.currentStage,
      status: "cancelled",
      queueId: item.id
    });
    pushJob(db, project.id, item.type, "cancelled", "队列任务已取消。");
  }
  writeDb(db);
  res.json({ ok: true, queueItem: publicQueueItem(item, db) });
});

app.post("/api/queue/clear", (req, res) => {
  const ids = new Set(Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []);
  if (!ids.size) return res.status(400).json({ error: "请选择要清理的执行记录。" });
  const db = readDb();
  const before = db.queueItems.length;
  db.queueItems = db.queueItems.filter((item) => !ids.has(item.id) || !["completed", "cancelled"].includes(item.status));
  writeDb(db);
  res.json({ ok: true, deleted: before - db.queueItems.length });
});

app.post("/api/projects/:id/versions/:versionId/use", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const version = (project.videoVersions || project.versions || []).find((item) => item.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: "Version not found" });
  for (const item of project.videoVersions || project.versions || []) item.isCurrent = item.id === version.id;
  project.versions = project.videoVersions || project.versions || [];
  project.selectedVideoVersionId = version.id;
  project.artifacts.video = videoArtifactFromVersion(version);
  if (version.artifact?.subtitles) project.artifacts.subtitles = version.artifact.subtitles;
  project.videoSettings = normalizeVideoSettings(version.videoSettings || project.videoSettings);
  project.status = "video_ready";
  setStage(project, "video", "done", `${version.label}${version.variantLabel ? ` · ${version.variantLabel}` : ""} 已设为当前版本。`);
  setProjectProgress(project, {
    percent: 100,
    label: "已切换当前视频版本。",
    stage: "video",
    status: project.status
  });
  pushJob(db, project.id, "use_version", "completed", `${version.label} 已设为当前版本。`, version);
  writeDb(db);
  res.json(project);
});

app.delete("/api/projects/:id/versions/:versionId", (req, res) => {
  const db = readDb();
  const project = ensureProject(db, req.params.id);
  const versions = project.videoVersions || project.versions || [];
  const version = versions.find((item) => item.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: "Version not found" });
  const wasCurrent = Boolean(version.isCurrent);
  project.videoVersions = versions.filter((item) => item.id !== version.id);
  project.versions = project.videoVersions;
  if (wasCurrent) {
    const nextCurrent = project.videoVersions[0];
    if (nextCurrent) {
      nextCurrent.isCurrent = true;
      project.selectedVideoVersionId = nextCurrent.id;
      project.artifacts.video = videoArtifactFromVersion(nextCurrent);
      if (nextCurrent.artifact?.subtitles) project.artifacts.subtitles = nextCurrent.artifact.subtitles;
      project.videoSettings = normalizeVideoSettings(nextCurrent.videoSettings || project.videoSettings);
      setStage(project, "video", "done", `${nextCurrent.label} 已设为当前版本。`);
    } else {
      project.selectedVideoVersionId = "";
      delete project.artifacts.video;
      delete project.artifacts.subtitles;
      setStage(project, "video", "pending", "当前视频版本已删除。");
      project.status = "voice_ready";
      project.currentStep = "video";
      project.currentStage = "video";
    }
  }
  project.updatedAt = now();
  pushJob(db, project.id, "delete_version", "completed", `${version.label}${version.variantLabel ? ` · ${version.variantLabel}` : ""} 已删除。`);
  writeDb(db);
  res.json(project);
});

app.get("/api/resources", (_req, res) => {
  const db = readDb();
  res.json(resourceSnapshot(db));
});

app.get("/api/projects/:id", (req, res) => {
  const db = readDb();
  res.json(ensureProject(db, req.params.id));
});

const distDir = join(rootDir, "dist");
if (existsSync(join(distDir, "index.html"))) {
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => res.sendFile(join(distDir, "index.html")));
}

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

recoverQueueOnBoot();

app.listen(PORT, () => {
  console.log(`Digital human API listening on http://127.0.0.1:${PORT}`);
  const db = readDb();
  if (db.settings.keepAsrModelWarm) {
    runtimeWorkers.asr.start().catch((error) => console.error(`[runtime-models] ASR 启动失败：${error.message}`));
  }
  if (db.settings.keepTtsModelWarm) {
    runtimeWorkers.tts.start().catch((error) => console.error(`[runtime-models] TTS 启动失败：${error.message}`));
  }
  if (db.settings.keepAvatarModelWarm) {
    runtimeWorkers.avatar.start().catch((error) => console.error(`[runtime-models] MuseTalk 启动失败：${error.message}`));
  }
});
