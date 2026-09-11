/* ============================================================================
 * Supabase 客户端
 *
 * 账号系统与云同步都走这里。anon key 是「公开密钥」，设计上就会出现在
 * 前端 —— 真正的安全边界是数据库的 RLS 行级策略（每人只能读写自己的行）。
 *
 * 自部署者：想用你自己的 Supabase 项目，设 VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY 两个环境变量即可覆盖内置默认值。
 * ========================================================================== */

import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://hlujoblhzymllmormwiv.supabase.co";
const ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_sUNv5CnYd1l2_IHGADaoTQ_kLarzrv8";

export const supabase = createClient(URL, ANON_KEY);
