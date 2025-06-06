# 运行和部署您的 AI Studio 音乐应用

![Music Console](music-console.jpg)

这包含了在本地运行应用所需的一切。

## 本地运行

**前提条件：** Node.js

1. 安装依赖：
   `npm install`
2. 在 [.env.local](.env.local) 中设置您的 Gemini API 密钥到 `GEMINI_API_KEY`
3. 运行应用：
   `npm run dev`

## 应用说明

这是一个 MIDI 音乐控制器应用，可以：
- 通过MIDI控制器实时控制音乐生成
- 调节各种音乐风格的权重
- 支持多种音乐风格如波萨诺瓦、电波音乐、鼓打贝斯等
- 实时音频处理和播放
