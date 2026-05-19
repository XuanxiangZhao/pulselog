# PulseLog Vercel 部署指南

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
