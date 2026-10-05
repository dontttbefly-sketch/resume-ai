import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// 字体在 JS 侧引入，Vite 一定会解析并打包，断网也能用
import "@fontsource-variable/inter";
import "@fontsource-variable/noto-sans-sc";
import "./index.css";

import App from "./App";
import { loadMe } from "./lib/account";
import { initCloudSync } from "./lib/cloudSync";
import { loadOwnerData } from "./lib/ownerData";
import { useAuthStore } from "./store/useAuthStore";

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 挂载点");

// 账号会话恢复 + 云同步接线（登录与否都不影响本地使用）
void useAuthStore.getState().init();
initCloudSync();
// 线上：站长登录后取回自己的私人简历（别人取不到）
void loadOwnerData();
// 线上：当前账号的 AI 额度、个人密钥（本地开发和演示版没有账号）
void loadMe();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
