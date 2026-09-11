/* ============================================================================
 * 简历数据模型
 *
 * 设计原则：数据与「业务字段名」解耦。编辑器与预览渲染器都只认识下面的
 * 描述符（Descriptor），不认识 school / company / name 这些具体字段名。
 * 因此新增模块只需改 data/sections.ts，组件零改动。
 * ========================================================================== */

/** 单值字段是 string；要点列表是 string[] */
export type FieldValue = string | string[];

/** 编辑器用哪种输入控件 */
export type FieldControl =
  | "text" // 单行文本
  | "textarea" // 多行文本（自动撑高）
  | "month" // 年月文本，支持「至今」这类自由填写
  | "tags" // 逗号分隔的标签，预览时渲染成小标签
  | "bullets" // 要点列表，可增删、可上下移动
  | "image"; // 图片：存 URL 或 dataURL，编辑器支持选图与压缩

/**
 * 字段在【预览】里的排版角色。预览渲染器按角色排布，不认识字段名。
 * 想调整某字段在简历上的位置，只改它的 role 即可。
 */
export type FieldRole =
  | "primary" // 主标题：学校 / 公司 / 项目名 / 技能分类
  | "secondary" // 副标题：职位 / 学历 / 担任角色
  | "date" // 右对齐日期（等宽数字，不跳动）
  | "meta" // 灰色次要信息：城市 / 邮箱 / 专业 / 技术栈
  | "bullets" // 要点列表
  | "avatar" // 证件照：抬头右侧，只出现在 header 排版里
  | "qr" // 二维码：抬头右侧、证件照旁边，只出现在 header 排版里
  | "body"; // 普通段落：个人简介 / 技能内容

export interface FieldDescriptor {
  key: string;
  label: string;
  control: FieldControl;
  role: FieldRole;
  /** 编辑器是 2 列网格；1 占一列，2 独占整行。相邻两个 1 会自动并排。 */
  colSpan?: 1 | 2;
  placeholder?: string;
  /** 参与「完成度自检」 */
  required?: boolean;
  /** 输入框下方的灰色提示 */
  hint?: string;
}

export interface EntryDescriptor {
  /** 按钮与摘要文案用，例如「一段工作经历」 */
  itemNoun: string;
  fields: readonly FieldDescriptor[];
  addable: boolean;
  removable: boolean;
  sortable: boolean;
  /** 最少保留几条，默认 0。基本信息的 minItems 为 1 且不可删。 */
  minItems?: number;
}

/** 预览用哪种排版器 */
export type SectionLayout =
  | "header" // 简历抬头：大字姓名 + 职位 + 联系方式 + 个人简介
  | "entries" // 时间线条目：教育 / 工作 / 项目
  | "skill-list"; // 左标签右内容的双列列表

export interface SectionDescriptor {
  key: string;
  label: string;
  layout: SectionLayout;
  entry: EntryDescriptor;
  defaultVisible: boolean;
}

/** 一条条目实例（一段工作经历 / 一条技能） */
export interface EntryData {
  id: string;
  /** fieldKey -> 值，与 FieldDescriptor.key 一一对应 */
  values: Record<string, FieldValue>;
}

/** 整份简历 */
export interface Resume {
  /** sectionKey -> 条目数组。基本信息也是数组，长度恒为 1，让编辑器逻辑统一。 */
  sections: Record<string, EntryData[]>;
  /** sectionKey -> 是否显示 */
  visibility: Record<string, boolean>;
  updatedAt: number;
}
