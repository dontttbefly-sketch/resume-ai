/* ============================================================================
 * 唯一的业务配置文件
 *
 * 想新增模块（例如「获奖经历」「论文发表」「校园经历」）？
 * 只需在下面的 SECTIONS 数组里追加一段配置，编辑器、预览、显示开关、
 * 重置逻辑会全部自动支持，任何组件都不用改。
 *
 * 三种排版器（layout）任选其一：
 *   header      抬头，只给「基本信息」用
 *   entries     时间线条目，适合任何「有起止时间 + 若干要点」的经历
 *   skill-list  左标签右内容的双列列表，适合技能、证书、语言能力
 * ========================================================================== */

import type { SectionDescriptor } from "./schema";

const SECTION_DEFS = [
  {
    key: "basics",
    label: "基本信息",
    layout: "header",
    defaultVisible: true,
    entry: {
      itemNoun: "基本信息",
      addable: false,
      removable: false,
      sortable: false,
      minItems: 1,
      fields: [
        {
          key: "name",
          label: "姓名",
          control: "text",
          role: "primary",
          colSpan: 1,
          required: true,
          placeholder: "邹康平",
        },
        {
          key: "title",
          label: "求职意向",
          control: "text",
          role: "secondary",
          colSpan: 1,
          required: true,
          placeholder: "AI 产品经理",
        },
        {
          key: "phone",
          label: "手机号",
          control: "text",
          role: "meta",
          colSpan: 1,
          required: true,
          placeholder: "138 0000 0000",
        },
        {
          key: "email",
          label: "邮箱",
          control: "text",
          role: "meta",
          colSpan: 1,
          required: true,
          placeholder: "chenyiran@example.com",
        },
        {
          key: "city",
          label: "城市",
          control: "text",
          role: "meta",
          colSpan: 1,
          placeholder: "深圳",
        },
        {
          key: "extra",
          label: "补充信息",
          control: "text",
          role: "meta",
          colSpan: 1,
          placeholder: "2 年工作经验｜期望薪资 15-30K",
          hint: "会拼在联系方式那一行，用「｜」分隔几项。",
        },
        {
          key: "website",
          label: "个人主页",
          control: "text",
          role: "meta",
          colSpan: 1,
          placeholder: "github.com/dontttbefly-sketch",
        },
        {
          key: "portfolio",
          label: "作品集",
          control: "text",
          role: "meta",
          colSpan: 1,
          placeholder: "https://example.github.io/portfolio/",
        },
        {
          key: "avatar",
          label: "证件照",
          control: "image",
          role: "avatar",
          colSpan: 1,
          hint: "可选。建议正方形，会等比裁切显示。",
        },
        {
          key: "qr",
          label: "作品二维码",
          control: "image",
          role: "qr",
          colSpan: 1,
          hint: "可选。放在证件照旁边，扫码直达作品集。用干净的白底二维码图，别带圆角卡托。",
        },
        {
          key: "summary",
          label: "个人简介",
          control: "textarea",
          role: "body",
          colSpan: 2,
          placeholder: "用一两句话说明你的定位与优势。",
          hint: "建议 40–80 字。想写多条优势，用下面的「个人优势」模块。",
        },
      ],
    },
  },

  {
    key: "strengths",
    label: "个人优势",
    layout: "entries",
    defaultVisible: true,
    entry: {
      itemNoun: "一条个人优势",
      addable: true,
      removable: true,
      sortable: true,
      fields: [
        {
          key: "title",
          label: "小标题",
          control: "text",
          role: "primary",
          colSpan: 2,
          placeholder: "留空则只显示要点列表",
        },
        {
          key: "bullets",
          label: "优势要点",
          control: "bullets",
          role: "bullets",
          colSpan: 2,
          placeholder: "做过完整的从 0 到 1 的 AI native 项目落地交付",
          hint: "回车新增一条；留空回车删除本条。",
        },
      ],
    },
  },

  {
    key: "work",
    label: "工作经历",
    layout: "entries",
    defaultVisible: true,
    entry: {
      itemNoun: "一段工作经历",
      addable: true,
      removable: true,
      sortable: true,
      fields: [
        {
          key: "company",
          label: "公司",
          control: "text",
          role: "primary",
          colSpan: 2,
          required: true,
          placeholder: "深圳市蓝禾技术有限公司",
        },
        {
          key: "title",
          label: "职位",
          control: "text",
          role: "secondary",
          colSpan: 1,
          required: true,
          placeholder: "AI 项目经理",
        },
        {
          key: "city",
          label: "城市",
          control: "text",
          role: "meta",
          colSpan: 1,
          placeholder: "深圳",
        },
        {
          key: "start",
          label: "开始时间",
          control: "month",
          role: "date",
          colSpan: 1,
          placeholder: "2026-03",
        },
        {
          key: "end",
          label: "结束时间",
          control: "month",
          role: "date",
          colSpan: 1,
          placeholder: "至今",
        },
        {
          key: "note",
          label: "一句话概述",
          control: "textarea",
          role: "body",
          colSpan: 2,
          placeholder: "在天猫图拉斯主导过多个 AI 结合业务的降本增效项目",
        },
        {
          key: "bullets",
          label: "职责要点",
          control: "bullets",
          role: "bullets",
          colSpan: 2,
          placeholder: "负责…，使…从 40% 提升至 70%",
          hint: "回车新增一条；留空回车删除本条。建议每条都带数字。",
        },
      ],
    },
  },

  {
    key: "projects",
    label: "项目经历",
    layout: "entries",
    defaultVisible: true,
    entry: {
      itemNoun: "一段项目经历",
      addable: true,
      removable: true,
      sortable: true,
      fields: [
        {
          key: "name",
          label: "项目名称",
          control: "text",
          role: "primary",
          colSpan: 2,
          required: true,
          placeholder: "小红书电商",
        },
        {
          key: "role",
          label: "担任角色",
          control: "text",
          role: "secondary",
          colSpan: 1,
          placeholder: "总负责人",
        },
        {
          key: "stack",
          label: "关键词",
          control: "tags",
          role: "meta",
          colSpan: 1,
          placeholder: "竞品分析, 数据分析, 团队管理",
          hint: "用逗号分隔，预览时显示成小标签。",
        },
        {
          key: "start",
          label: "开始时间",
          control: "month",
          role: "date",
          colSpan: 1,
          placeholder: "2023-02",
        },
        {
          key: "end",
          label: "结束时间",
          control: "month",
          role: "date",
          colSpan: 1,
          placeholder: "2023-05",
        },
        {
          key: "bullets",
          label: "职责要点",
          control: "bullets",
          role: "bullets",
          colSpan: 2,
          placeholder: "负责…，浏览量最高 20000+",
        },
      ],
    },
  },

  {
    key: "education",
    label: "教育经历",
    layout: "entries",
    defaultVisible: true,
    entry: {
      itemNoun: "一段教育经历",
      addable: true,
      removable: true,
      sortable: true,
      fields: [
        {
          key: "school",
          label: "学校",
          control: "text",
          role: "primary",
          colSpan: 2,
          required: true,
          placeholder: "广州大学",
        },
        {
          key: "degree",
          label: "学历",
          control: "text",
          role: "secondary",
          colSpan: 1,
          placeholder: "本科",
        },
        {
          key: "major",
          label: "专业",
          control: "text",
          role: "secondary",
          colSpan: 1,
          placeholder: "给水排水工程",
        },
        {
          key: "start",
          label: "开始时间",
          control: "month",
          role: "date",
          colSpan: 1,
          placeholder: "2021",
        },
        {
          key: "end",
          label: "结束时间",
          control: "month",
          role: "date",
          colSpan: 1,
          placeholder: "2025",
          hint: "在读可填「至今」",
        },
        {
          key: "note",
          label: "补充说明",
          control: "textarea",
          role: "body",
          colSpan: 2,
          placeholder: "GPA / 专业排名 / 主修课程 / 在校经历…",
        },
      ],
    },
  },

  {
    key: "certificates",
    label: "资格证书",
    layout: "skill-list",
    defaultVisible: true,
    entry: {
      itemNoun: "一项证书",
      addable: true,
      removable: true,
      sortable: true,
      fields: [
        {
          key: "category",
          label: "分类",
          control: "text",
          role: "primary",
          colSpan: 1,
          placeholder: "证书",
        },
        {
          key: "content",
          label: "内容",
          control: "textarea",
          role: "body",
          colSpan: 2,
          placeholder: "英语专业四级 / 驾驶证 C1 / 计算机二级",
        },
      ],
    },
  },

  {
    key: "skills",
    label: "技能",
    layout: "skill-list",
    defaultVisible: true,
    entry: {
      itemNoun: "一类技能",
      addable: true,
      removable: true,
      sortable: true,
      fields: [
        {
          key: "category",
          label: "分类",
          control: "text",
          role: "primary",
          colSpan: 1,
          required: true,
          placeholder: "AI 能力",
        },
        {
          key: "content",
          label: "内容",
          control: "textarea",
          role: "body",
          colSpan: 2,
          placeholder: "Claude Code / Codex / Coze / n8n，熟悉 LLM、RAG、Agent",
        },
      ],
    },
  },
] as const satisfies readonly SectionDescriptor[];

/** 所有模块的 key，由上面的配置自动推导 */
export type SectionKey = (typeof SECTION_DEFS)[number]["key"];

/**
 * 带完整类型的描述符：可选字段（minItems / required / hint）都可见，
 * key 也收窄成联合类型而不是宽 string。
 */
export interface TypedSectionDescriptor extends SectionDescriptor {
  key: SectionKey;
}

/** 模块清单，顺序即简历上的展示顺序 */
export const SECTIONS: readonly TypedSectionDescriptor[] = SECTION_DEFS;

/** key -> 描述符，供按 key 查找 */
export const SECTION_MAP = Object.fromEntries(
  SECTION_DEFS.map((s) => [s.key, s as SectionDescriptor]),
) as Record<SectionKey, SectionDescriptor>;

/** 所有模块的 key 列表，顺序与 SECTIONS 一致 */
export const SECTION_KEYS: readonly SectionKey[] = SECTION_DEFS.map((s) => s.key);

/** 按 key 取描述符，带兜底避免旧数据里的未知 key 引发崩溃 */
export function getSection(key: string): SectionDescriptor | undefined {
  return SECTION_MAP[key as SectionKey];
}
