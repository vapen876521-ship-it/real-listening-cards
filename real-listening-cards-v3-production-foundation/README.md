# Real Listening Cards v3

这一版是“生产级基础版”，目标是解决前面版本的主要缺点。

## 已解决的问题

### 1. 可靠词典数据

词典信息只来自：

- `lib/data/curated-dictionary.ts` 人工整理词典
- 可选外部词典接口 `DICTIONARY_API_URL`

查不到时不会猜：

- 中文意思：待补充中文释义
- 词性：未确认
- 词形变化：无可确认词形变化
- 不能进入“已确认词典信息”展示

### 2. 读音样本质量排序

读音样本按以下条件评分：

- 字幕可用
- 字幕精确匹配
- 片段长度合适
- 来源频道不同
- 口语变体匹配
- 标题弱匹配降权
- 无字幕结果降权

默认只展示高质量样本。低质量样本折叠在“备选样本”里。

### 3. 没有字幕精确匹配的样本不进入复习

保存到单词本时，只保存高质量可复习样本：

- 必须有字幕
- 必须精确匹配
- 片段不能太长

### 4. 复习训练升级

包含两种题型：

- 听真实发音，写出听到的英文
- 听口语变体，还原成标准英文

同时加入基础答案判定：

- 忽略大小写
- 忽略部分标点
- 支持轻微拼写差异

### 5. 云端保存

支持 Supabase 登录和云端保存。没有配置 Supabase 时自动退回浏览器本地保存。

## Vercel 环境变量

必填：

```txt
YOUTUBE_API_KEY=你的 YouTube Data API Key
```

推荐配置：

```txt
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon key
```

可选：

```txt
DICTIONARY_API_URL=你的词典接口地址
```

## Vercel Root Directory

```txt
real-listening-cards-v3-production-foundation
```

## Supabase 数据库

在 Supabase SQL Editor 运行：

```sql
-- 文件见 supabase/schema.sql
```

## 重要边界

YouTube 来源不能合法地抽取并重新分发纯音频。本版本只嵌入来源片段。  
如果以后要做真正的纯音频混合播放，需要：

- 用户上传音频
- 授权音频库
- 公共许可语音数据
- 自建真人语音库
