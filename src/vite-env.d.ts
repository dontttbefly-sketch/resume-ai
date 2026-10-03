/// <reference types="vite/client" />

/** 由 vite.config.ts 的 define 注入：本机是否已配置模型 API key */
declare const __HAS_LLM_KEY__: boolean;

/** 由 vite.config.ts 的 define 注入：是否运行在带投递服务桥接的本机开发服务器上 */
declare const __HAS_BOSS_BRIDGE__: boolean;
