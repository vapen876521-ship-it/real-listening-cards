# Real Listening Cards - Live YouTube Version

这一版已经改成：

- 真实调用 YouTube Data API 搜索视频
- 自动嵌入 YouTube 视频
- 每条结果都有字幕区、中文意思、词性、词形变化、口语变体
- 一键添加到单词本
- 听写复习

## 必须配置

在 Vercel 的 Project Settings → Environment Variables 添加：

```txt
YOUTUBE_API_KEY=你的 YouTube Data API key
```

没有这个 key，搜索不会工作。

## 运行

```bash
npm install
npm run dev
```

## 部署

上传到 GitHub 后，在 Vercel 里设置：

- Framework Preset: Next.js
- Root Directory: 这个项目文件夹
- Environment Variables: 添加 YOUTUBE_API_KEY

## 说明

YouTube Data API 可以搜索视频，但不能稳定公开下载任意视频的完整字幕。本项目会先尝试抓取公开 timedtext 字幕；如果取不到，就用视频标题和简介生成字幕候选，并明确标注。
