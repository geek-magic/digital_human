# 数字人视频工厂

本项目是任务式数字人视频生成工具。用户输入一段需求、参考口播内容或包含链接的混合文本后，系统按阶段完成来源处理、口播内容、TTS、视频生成和平台发布准备。

## 启动

```bash
npm install
npm run build
npm run start
```

默认地址：

- Web 页面：http://127.0.0.1:8083
- API 健康检查：http://127.0.0.1:8083/api/health

## 验证

```bash
npm run typecheck
npm run build
npm run test:e2e
npm run test:ui
```

`test:e2e` 会验证统一输入、阶段执行、视频产物、发布记录、素材/音色和环境检测；`test:ui` 会在 1440、1280、1024 三种宽度下检查主要页面是否横向溢出、按钮文字是否溢出和是否有浏览器错误。`test:video` 会下载公开测试素材并生成一条完整视频产物。

## 核心能力

- 任务中心：统一输入，可先从抖音等链接提取文本或视频 ASR。
- 阶段执行：输入解析、来源处理、口播内容、音色/TTS、视频生成、发布。
- 审核开关：开启后关键阶段暂停等待确认；关闭后自动生成到视频阶段。
- 阶段重跑：修改口播内容、音色或素材后，只重跑受影响的后续阶段。
- 产物展示：主界面只展示最终视频。
- 素材库/音色库：表格式管理，支持搜索和上传。
- 环境检测：固定模型包检测，不向用户暴露模型选择和云端 Provider 配置。
- 发布历史：每个平台独立记录发布准备状态和跳转入口。

## 模型与协议

当前版本使用固定模型包，不向终端用户开放模型选择。模型目录默认使用 `MODEL_HOME`，未设置时为项目内 `models` 目录；商业化分发时建议把模型权重、Adapter、协议清单、许可证和校验文件一起放进安装包或独立资源包。

固定组合：

- LLM：`mlx-community/Qwen2.5-7B-Instruct-4bit`，安装到 `MODEL_HOME/llm/qwen2.5-7b-instruct-4bit-mlx`
- ASR：`Qwen/Qwen3-ASR-1.7B`，安装到 `MODEL_HOME/asr/qwen3-asr-1.7b`
- TTS：`Qwen/Qwen3-TTS-12Hz-1.7B-Base`，安装到 `MODEL_HOME/tts/qwen3-tts-12hz-1.7b-base`
- Avatar：`TMElyralab/MuseTalk v1.5`，安装到 `MODEL_HOME/avatar/MuseTalk`
- Media：`FFmpeg`

开发机可以复用已有 Model Plaza 模型目录；其他用户首次安装时应直接拿到同一套模型包。软链接只负责定位模型权重，不能改变运行协议。系统固定使用 Adapter 协议约束输入输出：

- LLM：`digital-human.llm.script@1.0`
- ASR：`digital-human.asr.transcript@1.0`
- TTS：`digital-human.tts.voice@1.0`
- Avatar：`digital-human.avatar.render@1.0`
- Media：`digital-human.media.tool@1.0`

分享给其他用户时，模型目录应放置 `digital-human-adapter.json`，声明 `protocolId` 和 `protocolVersion`。如果只检测到目录但没有协议清单，页面会标记为协议未验证；如果协议版本不一致，页面会标记为协议不匹配。

首次部署或拉取代码后，一条命令完成 Node 依赖、系统工具检查、浏览器依赖、`yt-dlp`、固定模型包和 MuseTalk 权重安装：

```bash
npm run setup
```

如果已经安装过 Node 依赖，只想重新补齐系统工具和模型，可以执行 `npm run setup -- --skip-npm`。高级场景仍可分开执行 `npm run install:system` 和 `npm run install:models`。

`install:system` 会先检查并尽量自动安装运行所需的系统工具：

- macOS：优先使用 Homebrew 安装 `git`、`python`、`ffmpeg/ffprobe`、`curl`、`zip`。
- Windows：优先使用 winget 安装 Git、Python、FFmpeg、curl、zip。
- Linux：会检查缺失项并给出 `apt-get` 安装命令；不同发行版需要按提示处理。

FFmpeg 不是 Mac 专用工具，Windows、Linux、macOS 都支持。项目的视频下载、抽音频、预览视频和字幕处理都依赖 `ffmpeg/ffprobe`。

安装脚本还会执行 Playwright Chromium 安装，用于抖音等网页解析；如果机器已安装 Chrome，系统会优先使用 Chrome，否则使用 Playwright Chromium。`yt-dlp` 会安装到项目内 `runtime/tools` 虚拟环境，后端会优先调用该本地版本；缺失时抖音专用解析仍可用，但 B站、YouTube 等通用视频探测会降级。

MuseTalk 官方 `requirements.txt` 包含 Web Demo 和部分可选依赖，其中 `tensorflow==2.12.0` 在不少新 macOS/Python 环境不可安装。项目安装脚本会安装经过裁剪的推理依赖集，覆盖当前数字人合成链路需要的 PyTorch、diffusers、transformers、opencv、mediapipe、moviepy 等包，不再盲装官方完整 requirements。

统一安装脚本会下载并补齐：

- `MODEL_HOME/llm/qwen2.5-7b-instruct-4bit-mlx`
- `MODEL_HOME/asr/qwen3-asr-1.7b`
- `MODEL_HOME/tts/qwen3-tts-12hz-1.7b-base`
- `MODEL_HOME/avatar/MuseTalk`

脚本通过关键文件判断模型是否已经下载完成；关键文件都存在时，再执行 `npm run install:models` 会跳过对应模型下载，只刷新协议清单。

判定清单：

```text
MODEL_HOME/llm/qwen2.5-7b-instruct-4bit-mlx/
├── config.json
└── tokenizer.json

MODEL_HOME/asr/qwen3-asr-1.7b/
├── config.json
├── preprocessor_config.json
└── model.safetensors.index.json

MODEL_HOME/tts/qwen3-tts-12hz-1.7b-base/
├── config.json
├── model.safetensors
└── speech_tokenizer/model.safetensors
```

MuseTalk 模型包目录：

```text
MODEL_HOME/avatar/MuseTalk/
├── scripts/inference.py
├── models/musetalkV15/unet.pth
├── models/musetalkV15/musetalk.json
├── models/sd-vae/config.json
├── models/sd-vae/diffusion_pytorch_model.bin
├── models/whisper/config.json
├── models/whisper/pytorch_model.bin
├── models/whisper/preprocessor_config.json
├── models/face-parse-bisent/79999_iter.pth
├── models/face-parse-bisent/resnet18-5c106cde.pth
└── digital-human-adapter.json
```

脚本也会写入 `digital-human-adapter.json` 协议清单；商业化打包时要随模型包保留来源链接、许可证和校验文件。

## 链接来源处理

系统会从整段输入中识别普通 URL、短链和常见视频平台分享链接。识别后优先用 `yt-dlp` 做探测；如果平台需要登录态、cookies 或规则变化，任务会标记为需要处理，用户仍可继续用输入文本生成内容。

## 可选环境变量

- `MODEL_HOME=/path/to/models`：指定模型根目录。
- `MODEL_PLAZA_ASR_ENABLED=1`：开发机优先调用本机 Model Plaza ASR。
- `MODEL_PLAZA_TTS_ENABLED=1`：优先调用本机 Model Plaza TTS。
- `MODEL_PLAZA_TTS_MODEL=qwen3-tts-1.7b-base`：指定 TTS 模型 ID。
- `MODEL_PLAZA_API=http://127.0.0.1:8765`：指定 Model Plaza API 地址。
- `MUSETALK_HOME=/path/to/MuseTalk`：指定 MuseTalk 模型包或官方仓库目录，默认读取 `MODEL_HOME/avatar/MuseTalk`。
- `MUSETALK_PYTHON=/path/to/python`：指定 MuseTalk Python 环境。
- `AVATAR_RENDER_COMMAND=/path/to/render-adapter`：覆盖默认 MuseTalk Adapter。命令会接收两个参数：输入 JSON 路径、输出 MP4 路径。
