# Real Listening Cards v4.6 - Free First

这一版是免费优先版。

## 目标

尽量不用付费服务，不强制 Forvo，不强制 RapidAPI。

## 默认可用

### 1. Free Dictionary API

不需要 Key。用于：

- 英文词性
- 音标
- 英文释义
- 英文例句
- 部分标准真人/词典发音音频

### 2. MyMemory 免费翻译

不需要 Key。用于：

- 英文短语或句子的中文解释兜底
- 中文到英文的翻译候选兜底

可选添加邮箱提高免费额度：

```txt
MYMEMORY_EMAIL=你的邮箱
```

### 3. YouTube Data API

Google 提供默认免费配额，但仍然需要 API Key。

```txt
YOUTUBE_API_KEY=你的 YouTube Data API Key
```

## 可选免费档

### RapidAPI Chinese-English Dictionary API

如果你能开通它的免费档，就填：

```txt
RAPIDAPI_KEY=你的 RapidAPI Key
```

如果只想完全不用 RapidAPI，也可以不填。

## 可选付费/非默认

### Forvo API

v4.6 保留 Forvo 接口，但默认不要求。只有你以后愿意用 Forvo 时再填：

```txt
FORVO_API_KEY=你的 Forvo API Key
```

## Vercel Root Directory

```txt
real-listening-cards-v4-6-free-first
```

## 最少只需要填

```txt
YOUTUBE_API_KEY=你的 YouTube Data API Key
```

其他都可以先不填。
