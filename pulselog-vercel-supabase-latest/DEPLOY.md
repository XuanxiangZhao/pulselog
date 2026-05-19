# PulseLog Vercel + Supabase 部署指南

## 0. 创建 Supabase 项目

1. 打开 https://supabase.com
2. 登录并创建 New Project
3. 进入项目后打开 SQL Editor
4. 复制 `supabase-schema.sql` 的全部内容并运行
5. 打开 Project Settings > API
6. 复制：
   - Project URL
   - anon public key

## 0.1 填写前端配置

打开 `supabase-config.js`，替换成你的 Supabase 配置：

```js
window.PULSELOG_SUPABASE = {
  url: "https://你的项目.supabase.co",
  anonKey: "你的 anon public key",
};
```

这个 anon key 是前端可公开使用的 key，安全边界由 `supabase-schema.sql` 里的 RLS 策略控制。

## 1. 推送到 GitHub

在当前项目目录创建 Git 仓库并推送到 GitHub。

## 2. 导入 Vercel

1. 打开 https://vercel.com/new
2. 选择这个 GitHub 仓库
3. Framework Preset 选择 `Other`
4. Build Command 留空
5. Output Directory 留空
6. 点击 Deploy

## 3. 手机访问

部署完成后，Vercel 会给一个公网地址，例如：

```text
https://pulselog.vercel.app
```

手机浏览器打开这个网址即可实时查看。

## 4. 数据接口

部署后前端会优先使用这些接口：

- `/api/nba-scores`
- `/api/cs-matches`
- `/api/headlines`

接口失败时，前端会自动退回浏览器直连公开源。

## 5. 手机实时同步

部署完成后：

1. 手机打开 Vercel 网址
2. 在侧边栏输入邮箱
3. 点击邮件里的登录链接
4. 电脑和手机使用同一个邮箱登录

之后目标、体重、成就、来源、收藏会通过 Supabase 同步。
