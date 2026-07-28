---
name: 智慧文旅 · 全息导游
description: 由晨光、水脉和植物能量驱动的沉浸式旅行操作系统
colors:
  water-ink: '#043b34'
  river-night: '#021e24'
  living-emerald: '#0d8d70'
  mist-aqua: '#77f3e4'
  sunrise-gold: '#ffe7a0'
  journey-coral: '#ff9f7b'
  cloud-white: '#f7fff9'
typography:
  display:
    fontFamily: 'Noto Serif SC, Georgia, serif'
    fontSize: 'clamp(2.4rem, 5vw, 4.8rem)'
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: '0'
  body:
    fontFamily: 'system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: '0'
  label:
    fontFamily: 'system-ui, sans-serif'
    fontSize: '0.72rem'
    fontWeight: 850
    lineHeight: 1.4
    letterSpacing: '0'
rounded:
  control: '999px'
  surface: '8px'
  compact: '6px'
spacing:
  xs: '8px'
  sm: '14px'
  md: '24px'
  lg: '34px'
  xl: '48px'
components:
  button-voice:
    backgroundColor: '{colors.living-emerald}'
    textColor: '{colors.sunrise-gold}'
    rounded: '{rounded.control}'
    size: '132px'
  navigation:
    backgroundColor: '{colors.water-ink}'
    textColor: '{colors.cloud-white}'
    rounded: '{rounded.surface}'
    height: '72px'
---

# Design System: 智慧文旅 · 全息导游

## Overview

**Creative North Star: "Living Wuzhen Travel OS"**

界面像一座由水、晨光和植物能量驱动的旅行操作系统。信息不是摆在相同卡片里，而是根据任务变成观景台、问题星群、故事声波、运河节点、时间流和旅行护照。背景保留真实景区纵深，前景通过清透膜片和流体光线保证操作清晰。

**Key Characteristics:**

- 每个页面拥有独立的空间隐喻，同时共享水脉、晨光和植物能量语言。
- 主要信息始终可读，循环动画只承担状态和方向表达。
- 翠绿和天青负责行动与流动，晨曦金负责重要状态，珊瑚色只用于风险提醒。

## Colors

色彩采用完整但克制的水乡清晨调色板，避免整页只剩深绿色。

**The Three-Energy Rule.** 翠绿表示生命与行动，天青表示信息流，晨曦金表示选择和重要状态；三者不能在同一元素上争夺主导权。

## Typography

展示文字使用宋体系统表达江南文化感，操作和正文使用系统无衬线保证移动端可读性。大标题只属于页面主命题和旅行护照封面，不进入紧凑操作区域。

**The Quiet Label Rule.** 标签不依赖夸张字距或全大写制造科技感，层级来自尺寸、色彩和位置。

## Layout

桌面内容限制在 1320px 内，每页以一个核心装置组织首屏：中心式页面使用环绕结构，路线类页面使用侧栏加时间流，档案类页面使用护照封面与内页。760px 以下改为纵向叙事，环绕元素回到文档流，地图节点重新分布，固定底部导航保留安全区。

## Elevation & Depth

深度由真实背景、半透明膜片、柔和偏移阴影和局部光场共同形成。阴影必须有方向和模糊，不使用无偏移霓虹光圈代替层级。

## Shapes

主要场景容器使用克制的 8px 圆角；小型命令按钮和语音核心可以使用圆形或胶囊形。地图节点、运河轨迹和行程时间线采用各自语义形态，不把它们重新包进通用矩形卡片。

## Components

### Buttons

- 返回和主命令使用胶囊形，状态切换按钮使用 8px 圆角。
- Hover 通过位移、亮度和边界变化表达，不改变稳定尺寸。
- Focus 使用清晰的晨曦金外轮廓。

### Navigation

- 底部导航是一条低矮、半透明的旅行控制带。
- 当前页面使用翠绿膜片和晨曦金文字，其他入口保持高对比但后退一层。
- 移动端隐藏英文副标题，保留图标和中文名称。

### Signature Components

- 问题星群围绕 AI 核心组织快捷问题。
- 运河地图用路线流线和发光定位节点表达空间关系。
- 语音声场用同心水纹显示连接、聆听、识别和思考状态。

## Do's and Don'ts

### Do:

- **Do** 让页面核心任务在首屏成为最大的视觉装置。
- **Do** 使用真实景区数据，并对票务、开放时间和班次标注官方核验提醒。
- **Do** 在移动端重新编排空间关系，而不是简单缩小桌面布局。

### Don't:

- **Don't** 用同尺寸“图标 + 标题 + 正文”卡片铺满所有页面。
- **Don't** 伪造实时天气、余票、酒店库存或用户历史足迹。
- **Don't** 让装饰光效遮挡按钮、状态文字或地图节点。
