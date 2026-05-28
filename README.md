<!--
 * @Author: Ken Wang
 * @Date: 2022-01-26 17:29:40
 * @LastEditTime: 2022-02-02 16:40:05
 * @LastEditors: your name
 * @Description: 
-->
<br>

<p align="center">
  <img width="200" src="https://github.com/kenmingwang/azusa-player/blob/master/docs/assets/logo2-01.png?raw=true">
</p>

<h3 align="center" style="color:purple">Azusa-Player / 电梓播放器</h3>
<h4 align="center" style="color:purple">A 3rd party Bilibili audio player / 一个 Bilibili 第三方音频播放器</h4>

> **Note:** 本项目 Fork 自开源仓库 [kenmingwang/azusa-player](https://github.com/kenmingwang/azusa-player)，并在此基础上使用 **Gemini 3.1 pro** 通过 **vibe coding** 辅助完成了部分体验优化与功能定制。

## 项目简介

- 本质上是一个 B 站第三方的**音频在线播放器**，以浏览器扩展插件形式展现。
- 目的是让视频**轻量化**为音频，方便日常边工作边听歌，支持无缝后台播放。
- 实现了强大的歌单导入、一键右键添加、以及基于 QQ 音乐引擎的歌词搜索与同步功能。
- 采用极具现代感的 Premium Glassmorphism（毛玻璃）UI 设计，支持深浅模式无缝切换。

## 安装
- 离线安装
  - 本地编译或[下载最新 build 文件](https://github.com/Administration-626/azusa-player/releases)，解压，Chrome 开启开发者模式，加载解压后的文件夹。

## 如何使用

> **⚠️ 注意：** 使用插件前，请确保你当前浏览器**已经登录了 B 站账号**（直接打开 bilibili.com 登录即可），否则插件将无法获取到视频和收藏夹的访问权限，导致加载失败。

### 1. 导入歌单与添加歌曲

**方法一：右键菜单直接添加（推荐！）**
在 B 站网页端，你可以直接**右键点击**任意的视频封面、收藏夹链接或者合集链接，在弹出的右键菜单中选择“添加到电梓播放器”，即可一键将其导入到你的本地歌单中！

**方法二：手动复制链接搜索**
如果你无法使用右键，也可以去 B 站网页端手动复制对应的链接，然后粘贴到插件右上角的搜索框中并回车：
- **单曲 / 多 P 视频**：直接输入 **BV 号**
- **UP 主合集 / 播单**：输入 **合集 / Series 链接**

搜索加载出列表后，点击页面右上角的 `+` 号，即可将该歌单内的所有歌曲一次性保存到插件的本地“我的歌单”中。

### 2. 播放逻辑
在左侧“我的歌单”中点击任意一首歌曲，播放器会**自动将整个歌单加载到播放队列**中，并立即从你点击的这首歌开始播放。你可以随时点击底部的播放栏展开播放器界面。

### 3. 歌词功能
因为 B 站视频没有原生歌词，插件内置了 QQ 音乐歌词匹配引擎：
- 展开播放器界面，点击**歌词 (Lyric)** 图标，即可打开歌词面板。
- 如果没有自动匹配成功，可以在左侧面板手动**搜索歌词**。
- 如果由于翻唱、前奏过长导致歌词对不上，可以调整**歌词偏移 (ms)** 时间轴。你绑定的歌词和偏移量都会永久保存在本地。

### 4. 主题切换
插件内置了高质感的“毛玻璃 (Premium Glassmorphism)” UI。你可以根据系统偏好自动适配，或者手动在设置中切换极具现代感的“浅色珍珠模式 (Light)”和“暗夜模式 (Dark)”。


## 本地开发环境

### Windows

1. 先安装 Node.js LTS。
   - 可以使用 `winget install OpenJS.NodeJS.LTS`
2. 安装完成后，建议先重启电脑，再打开新的 `PowerShell` / `pwsh`。
   - 仅重启终端在部分 Windows 环境下可能不会立即刷新环境变量，重启电脑更稳妥。
3. 验证 `node` 和 `npm` 已经生效：

```powershell
node -v
npm -v
```

4. 进入项目目录后安装依赖：

```powershell
npm install
```

5. 常用命令：

```powershell
npm run dev
npm run build
npm run test:run
```

![imgurl](https://raw.githubusercontent.com/kenmingwang/azusa-player/master/docs/assets/azusa-player-tutorial.png)

## 项目技术栈

- [Chrome Extension](https://developer.chrome.com/docs/extensions/) + [React](https://github.com/facebook/react) + [MUI](https://mui.com/zh/)
- [react-music-player](https://github.com/lijinke666/react-music-player)
- [react-lrc](https://github.com/mebtte/react-lrc)
- [react-chrome-extension-MV3](https://github.com/Sirage-t/react-chrome-extension-MV3)
- 参考了[Listen1](https://github.com/listen1/listen1_chrome_extension)播放器的交互形式

## 项目协议

本项目基于 [MIT License](https://github.com/kenmingwang/azusa-player/blob/master/LICENSE) 许可证发行，以下协议是对于 MIT License 的补充，如有冲突，以以下协议为准。

词语约定：本协议中的“本项目”指 Azusa-Player 项目；“使用者”指签署本协议的使用者；“官方音乐平台”指对本项目内置的包括 QQ 音乐，哔哩哔哩动画等音源，歌词来源的官方平台统称；“版权数据”指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。

1. 本项目的数据来源原理是从各官方音乐平台的公开服务器中拉取数据，经过对数据简单地筛选与合并后进行展示，因此本项目不对数据的准确性负责。
2. 使用本项目的过程中可能会产生版权数据，对于这些版权数据，本项目不拥有它们的所有权，为了避免造成侵权，使用者务必在**24 小时**内清除使用本项目的过程中所产生的版权数据。
3. 本项目内的官方音乐平台别名为本项目内对官方音乐平台的一个称呼，不包含恶意，如果官方音乐平台觉得不妥，可联系本项目更改或移除。
4. 本项目内使用的部分包括但不限于字体、图片等资源来源于互联网，如果出现侵权可联系本项目移除。
5. 由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。
6. 本项目完全免费，且开源发布于 GitHub 面向全世界人用作对技术的学习交流，本项目不对项目内的技术可能存在违反当地法律法规的行为作保证，**禁止在违反当地法律法规的情况下使用本项目**，对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。

若你使用了本项目，将代表你接受以上协议。

音乐视频平台不易，请尊重版权，支持正版。<br>
Contact: kenmingwang1234@gmail.com <br>
Bilibili: [\_Nek7mi](https://space.bilibili.com/1989881)
