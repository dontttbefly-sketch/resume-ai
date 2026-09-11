/* ============================================================================
 * 内置示例简历 / 空白简历工厂
 *
 * 首次打开时直接加载示例，用户面对的是「改写」而不是「从空白创作」，
 * 这是简历工具降低心理门槛的关键。
 * ========================================================================== */

import type { EntryData, FieldValue, Resume } from "./schema";
import { SECTIONS, type SectionKey } from "./sections";
import { newId } from "../lib/resume";

/** 按描述符造一条空条目（要点类字段默认给一行空输入框，方便直接打字） */
export function makeBlankEntry(desc: {
  entry: { fields: readonly { key: string; control: string }[] };
}): EntryData {
  const values: Record<string, FieldValue> = {};
  for (const f of desc.entry.fields) {
    values[f.key] = f.control === "bullets" ? [""] : "";
  }
  return { id: newId(), values };
}

/** 按描述符把「裸值对象」补全成完整条目，缺失字段填默认空值 */
export function buildEntries(
  desc: { entry: { fields: readonly { key: string; control: string }[] } },
  list: Record<string, FieldValue>[],
): EntryData[] {
  return list.map((raw) => {
    const values: Record<string, FieldValue> = {};
    for (const f of desc.entry.fields) {
      const v = raw[f.key];
      values[f.key] = v ?? (f.control === "bullets" ? [] : "");
    }
    return { id: newId(), values };
  });
}

const SAMPLE: Record<string, Record<string, FieldValue>[]> = {
  basics: [
    {
      name: "陈亦然",
      title: "前端开发工程师",
      phone: "138 0000 0000",
      email: "chenyiran@example.com",
      city: "上海",
      extra: "4 年前端开发经验｜期望薪资 20-30K",
      website: "github.com/chenyiran",
      portfolio: "",
      avatar: "",
      summary: "",
    },
  ],
  strengths: [
    {
      title: "",
      bullets: [
        "4 年前端开发经验，专注数据可视化与性能优化，主导 3 个中台项目从 0 到 1 落地。",
        "熟悉前端工程化与监控体系，能独立完成从需求拆解到上线验收的完整链路。",
      ],
    },
  ],
  work: [
    {
      company: "星野科技有限公司",
      title: "前端开发工程师",
      city: "上海",
      start: "2024-07",
      end: "至今",
      note: "负责经营数据看板与内部中台的前端建设，服务 2 万+ 日活用户。",
      bullets: [
        "主导经营数据看板从 0 到 1 建设，覆盖 12 个业务模块，运营取数耗时从 2 小时降至 5 分钟。",
        "重构首屏加载链路，首屏时间从 3.2s 优化到 0.9s，页面跳出率下降 18%。",
        "沉淀 20+ 可复用业务组件并配套使用文档，团队新页面开发效率提升约 40%。",
      ],
    },
    {
      company: "云栖信息技术有限公司",
      title: "前端开发实习生",
      city: "上海",
      start: "2023-07",
      end: "2023-12",
      note: "",
      bullets: [
        "独立完成营销活动页 8 个，支撑单日峰值 12 万 PV 无故障运行。",
        "接入埋点体系并输出转化漏斗报表，帮助运营定位到 3 个关键流失节点。",
      ],
    },
  ],
  projects: [
    {
      name: "经营数据可视化看板",
      role: "核心开发",
      stack: "React, TypeScript, ECharts",
      start: "2024-09",
      end: "2025-03",
      bullets: [
        "设计并实现 15 类图表组件，支持维度下钻与多图联动筛选。",
        "用虚拟滚动与增量渲染支撑万级数据表格，交互帧率稳定在 55fps 以上。",
      ],
    },
  ],
  education: [
    {
      school: "上海交通大学",
      degree: "本科",
      major: "计算机科学与技术",
      start: "2020-09",
      end: "2024-06",
      note: "GPA 3.8/4.0，专业排名前 10%；两次获校级一等奖学金。",
    },
  ],
  certificates: [{ category: "证书", content: "大学英语六级 / 计算机二级" }],
  skills: [
    { category: "前端框架", content: "React 19 / Vue 3 / TypeScript，熟悉 Hooks 与状态管理（Zustand、Redux）" },
    { category: "工程化", content: "Vite / Webpack / pnpm，熟悉 CI 流水线与前端监控体系" },
    { category: "可视化", content: "ECharts / D3，具备复杂图表与大数据量渲染调优经验" },
  ],
};

export function blankVisibility(): Record<string, boolean> {
  const v: Record<string, boolean> = {};
  for (const s of SECTIONS) v[s.key] = s.defaultVisible;
  return v;
}

export function buildSampleResume(): Resume {
  const sections: Record<string, EntryData[]> = {};
  for (const desc of SECTIONS) {
    sections[desc.key] = buildEntries(desc, SAMPLE[desc.key] ?? []);
  }
  return { sections, visibility: blankVisibility(), updatedAt: Date.now() };
}

export function buildEmptyResume(): Resume {
  const sections: Record<string, EntryData[]> = {};
  for (const desc of SECTIONS) {
    const min = desc.entry.minItems ?? 0;
    sections[desc.key] = min > 0 ? [makeBlankEntry(desc)] : [];
  }
  return { sections, visibility: blankVisibility(), updatedAt: Date.now() };
}

/** 供 store 使用：把可能缺 key 的旧数据补齐成完整结构 */
export function normalizeSections(
  raw: Record<string, EntryData[]> | undefined,
): Record<string, EntryData[]> {
  const out: Record<string, EntryData[]> = {};
  for (const desc of SECTIONS) {
    const list = raw?.[desc.key as SectionKey];
    if (Array.isArray(list) && list.length > 0) {
      out[desc.key] = list;
    } else {
      const min = desc.entry.minItems ?? 0;
      out[desc.key] = min > 0 ? [makeBlankEntry(desc)] : [];
    }
  }
  return out;
}
