# Real Listening Cards

一个可部署的英语真实听力闪卡网站。

## 已实现功能

- 搜索单词、词组或句子
- 返回类 YouGlish 的视频片段结果
- 字幕中高亮搜索词和口语变体
- 显示中文意思
- 显示词性
- 显示词形变化
- 显示口语变体，例如 `want to → wanna`
- 一键加入单词本
- 单词本本地保存
- 听写复习
- 标注音源类型：真实生活音源 / 标准发音替代 / 待搜索

## 重要说明

当前版本是可部署产品壳 + 本地模拟搜索数据。它可以直接部署到 Vercel。

真正接入真实搜索时，需要把 `lib/search.ts` 里的 `searchClips()` 换成你的后端搜索服务。正式搜索服务应该按这个顺序找音源：

1. 用户上传真实音频
2. 授权真人语料库
3. YouTube/公开视频字幕索引
4. 标准发音音频兜底

标准发音只能作为兜底，必须显示“标准发音替代”。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```bash
http://localhost:3000
```

## 部署到 Vercel

1. 把这个文件夹上传到 GitHub
2. 登录 Vercel
3. New Project
4. 选择这个仓库
5. Framework 选择 Next.js
6. 点击 Deploy

## 后续要接真实搜索

建议新增后端表：

- `clips`
- `captions`
- `lexicon`
- `wordbook`
- `reviews`
- `pronunciation_rules`

然后把搜索流程改成：

```text
用户输入
↓
生成口语变体
↓
搜索真实字幕索引
↓
返回视频 ID、开始时间、结束时间、字幕、中文意思、词性、变形
↓
用户添加到单词本
↓
进入听写复习
```
