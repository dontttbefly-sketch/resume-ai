/* ============================================================================
 * JD 关键词词典
 *
 * 面向「AI 相关 / 产品相关」岗位。匹配方式是纯字符串比对（英文不区分大小写），
 * 所以不需要分词库，结果可解释、可预期。
 *
 * 权重含义：
 *   3  核心词 —— 缺了基本做不了这个岗位
 *   2  重要词 —— 影响匹配度与话术切入点
 *   1  加分词 —— 有更好，没有不致命
 *
 * 想扩充？直接在对应分组里加一条即可，匹配逻辑不用改。
 * ========================================================================== */

export type LexGroup = "ai" | "product" | "data" | "delivery" | "ecom" | "soft";

export interface LexEntry {
  /** 规范名，界面上展示这个 */
  term: string;
  /** 在 JD / 简历里可能出现的其他写法 */
  aliases: readonly string[];
  weight: 1 | 2 | 3;
  group: LexGroup;
}

export const LEX_GROUP_LABEL: Record<LexGroup, string> = {
  ai: "AI 与大模型",
  product: "产品能力",
  data: "数据与分析",
  delivery: "项目与协作",
  ecom: "电商与客服",
  soft: "通用素质",
};

export const JD_LEXICON: readonly LexEntry[] = [
  /* ------------------------------ AI 与大模型 ------------------------------ */
  {
    term: "大模型应用",
    aliases: ["大模型", "大语言模型", "llm", "large language model", "大模型应用"],
    weight: 3,
    group: "ai",
  },
  {
    term: "Prompt 工程",
    aliases: ["prompt", "提示词", "提示工程", "prompt engineering"],
    weight: 3,
    group: "ai",
  },
  {
    term: "RAG 检索增强",
    aliases: ["rag", "检索增强", "检索增强生成", "知识检索"],
    weight: 3,
    group: "ai",
  },
  {
    term: "Agent 智能体",
    aliases: ["agent", "智能体", "ai agent", "multi-agent", "多智能体"],
    weight: 3,
    group: "ai",
  },
  {
    term: "AI 产品",
    aliases: ["ai 产品", "ai产品", "人工智能产品", "智能化产品", "ai 应用", "ai应用"],
    weight: 3,
    group: "ai",
  },
  {
    term: "知识库",
    aliases: ["知识库", "知识图谱", "语料库", "知识管理"],
    weight: 2,
    group: "ai",
  },
  {
    term: "模型微调",
    aliases: ["微调", "fine-tune", "finetune", "sft", "lora"],
    weight: 2,
    group: "ai",
  },
  {
    term: "向量与 embedding",
    aliases: ["向量", "embedding", "向量数据库", "语义检索"],
    weight: 2,
    group: "ai",
  },
  {
    term: "对话系统",
    aliases: ["对话系统", "多轮对话", "会话系统", "意图识别", "nlu", "对话管理"],
    weight: 2,
    group: "ai",
  },
  {
    term: "模型效果评估",
    aliases: ["模型评估", "效果评估", "评测", "badcase", "bad case", "效果调优", "标注"],
    weight: 2,
    group: "ai",
  },
  {
    term: "AI 平台工具",
    aliases: ["coze", "扣子", "dify", "langchain", "工作流平台", "低代码平台", "bot 平台"],
    weight: 2,
    group: "ai",
  },
  {
    term: "智能客服",
    aliases: ["智能客服", "客服机器人", "机器人训练", "客服助手", "会话机器人"],
    weight: 2,
    group: "ai",
  },
  {
    term: "AIGC",
    aliases: ["aigc", "生成式", "生成式 ai", "文生图", "文生视频"],
    weight: 2,
    group: "ai",
  },
  {
    term: "NLP",
    aliases: ["nlp", "自然语言处理", "文本分类", "文本挖掘"],
    weight: 2,
    group: "ai",
  },
  {
    term: "模型接口",
    aliases: ["api", "接口对接", "模型调用", "openai", "接口联调"],
    weight: 2,
    group: "ai",
  },
  {
    term: "语音能力",
    aliases: ["语音识别", "asr", "tts", "语音合成", "智能语音"],
    weight: 1,
    group: "ai",
  },
  {
    term: "视觉能力",
    aliases: ["ocr", "图像识别", "计算机视觉", "多模态"],
    weight: 1,
    group: "ai",
  },
  {
    term: "机器学习",
    aliases: ["机器学习", "深度学习", "算法模型", "模型训练"],
    weight: 1,
    group: "ai",
  },

  /* ------------------------------- 产品能力 ------------------------------- */
  {
    term: "需求分析",
    aliases: ["需求分析", "需求梳理", "需求调研", "需求管理", "需求拆解"],
    weight: 3,
    group: "product",
  },
  {
    term: "PRD",
    aliases: ["prd", "产品需求文档", "需求文档", "需求说明书"],
    weight: 3,
    group: "product",
  },
  {
    term: "产品设计",
    aliases: ["产品设计", "功能设计", "产品规划", "方案设计", "产品方案"],
    weight: 3,
    group: "product",
  },
  {
    term: "原型设计",
    aliases: ["原型", "axure", "墨刀", "原型图", "线框图", "交互稿"],
    weight: 2,
    group: "product",
  },
  {
    term: "设计工具",
    aliases: ["figma", "sketch", "蓝湖", "设计稿"],
    weight: 2,
    group: "product",
  },
  {
    term: "竞品分析",
    aliases: ["竞品分析", "竞品调研", "市场分析", "行业调研", "对标分析"],
    weight: 2,
    group: "product",
  },
  {
    term: "用户调研",
    aliases: ["用户调研", "用户访谈", "用户研究", "问卷", "可用性测试"],
    weight: 2,
    group: "product",
  },
  {
    term: "用户画像",
    aliases: ["用户画像", "用户分层", "人群运营", "用户标签"],
    weight: 2,
    group: "product",
  },
  {
    term: "用户体验",
    aliases: ["用户体验", "交互体验", "易用性", "ue", "ux"],
    weight: 2,
    group: "product",
  },
  {
    term: "版本迭代",
    aliases: ["迭代", "版本管理", "发版", "灰度", "上线节奏"],
    weight: 2,
    group: "product",
  },
  {
    term: "需求评审",
    aliases: ["需求评审", "评审会", "对齐会", "需求对齐"],
    weight: 2,
    group: "product",
  },
  {
    term: "指标体系",
    aliases: ["指标体系", "北极星指标", "核心指标", "kpi", "okr", "指标拆解"],
    weight: 2,
    group: "product",
  },
  {
    term: "业务流程",
    aliases: ["业务流程", "用户场景", "场景设计", "流程设计", "业务链路"],
    weight: 2,
    group: "product",
  },
  {
    term: "埋点",
    aliases: ["埋点", "数据采集", "事件上报", "日志采集"],
    weight: 2,
    group: "product",
  },
  {
    term: "AB 测试",
    aliases: ["ab 测试", "ab测试", "abtest", "a/b 测试", "ab实验", "对照实验"],
    weight: 2,
    group: "product",
  },
  {
    term: "产品运营",
    aliases: ["产品运营", "用户运营", "内容运营", "运营策略"],
    weight: 2,
    group: "product",
  },

  /* ------------------------------ 数据与分析 ------------------------------ */
  {
    term: "数据分析",
    aliases: ["数据分析", "数据洞察", "数据驱动", "数据运营", "分析报告"],
    weight: 3,
    group: "data",
  },
  {
    term: "SQL",
    aliases: ["sql", "hive", "数据库查询", "写查询"],
    weight: 2,
    group: "data",
  },
  {
    term: "Python",
    aliases: ["python", "pandas", "脚本处理"],
    weight: 2,
    group: "data",
  },
  {
    term: "数据看板",
    aliases: ["看板", "仪表盘", "dashboard", "报表", "数据可视化", "可视化"],
    weight: 2,
    group: "data",
  },
  {
    term: "多维表格",
    aliases: ["多维表", "bitable", "飞书多维表格", "airtable", "低代码表格"],
    weight: 2,
    group: "data",
  },
  {
    term: "漏斗分析",
    aliases: ["漏斗", "转化链路", "路径分析", "归因分析"],
    weight: 2,
    group: "data",
  },
  {
    term: "留存与活跃",
    aliases: ["留存", "复购", "活跃度", "dau", "mau", "渗透率"],
    weight: 2,
    group: "data",
  },
  {
    term: "转化与 ROI",
    aliases: ["转化率", "转化效果", "gmv", "roi", "roas", "投产比"],
    weight: 2,
    group: "data",
  },
  {
    term: "指标口径",
    aliases: ["指标口径", "数据口径", "取数逻辑", "口径定义"],
    weight: 1,
    group: "data",
  },
  {
    term: "Excel",
    aliases: ["excel", "vlookup", "数据透视表", "表格处理"],
    weight: 1,
    group: "data",
  },
  {
    term: "BI 工具",
    aliases: ["bi", "tableau", "power bi", "quickbi", "帆软", "finebi"],
    weight: 1,
    group: "data",
  },

  /* ----------------------------- 项目与协作 ----------------------------- */
  {
    term: "项目管理",
    aliases: ["项目管理", "项目推进", "项目跟进", "进度管理", "项目交付"],
    weight: 3,
    group: "delivery",
  },
  {
    term: "跨部门协作",
    aliases: ["跨部门", "跨团队", "跨职能", "协同", "协调资源"],
    weight: 2,
    group: "delivery",
  },
  {
    term: "敏捷方法",
    aliases: ["敏捷", "scrum", "sprint", "kanban", "看板管理"],
    weight: 2,
    group: "delivery",
  },
  {
    term: "落地推进",
    aliases: ["落地", "推进落地", "交付", "实施", "闭环"],
    weight: 2,
    group: "delivery",
  },
  {
    term: "流程规范",
    aliases: ["sop", "流程规范", "标准化", "文档化", "方法论"],
    weight: 2,
    group: "delivery",
  },
  {
    term: "复盘沉淀",
    aliases: ["复盘", "总结沉淀", "经验沉淀", "知识沉淀"],
    weight: 1,
    group: "delivery",
  },
  {
    term: "培训赋能",
    aliases: ["培训", "赋能", "带教", "知识分享", "内部培训"],
    weight: 1,
    group: "delivery",
  },
  {
    term: "供应商管理",
    aliases: ["供应商", "外包管理", "乙方管理", "三方合作"],
    weight: 1,
    group: "delivery",
  },

  /* ----------------------------- 电商与客服 ----------------------------- */
  {
    term: "电商业务",
    aliases: ["电商", "天猫", "淘宝", "京东", "拼多多", "抖音电商", "店铺运营"],
    weight: 2,
    group: "ecom",
  },
  {
    term: "客服体系",
    aliases: ["客服", "客户服务", "售前", "售后", "在线客服", "服务体验"],
    weight: 2,
    group: "ecom",
  },
  {
    term: "知识库运营",
    aliases: ["知识库运营", "知识治理", "内容治理", "话术库", "知识资产"],
    weight: 2,
    group: "ecom",
  },
  {
    term: "会话分析",
    aliases: ["会话分析", "对话分析", "聊天记录", "接待记录", "原声分析"],
    weight: 2,
    group: "ecom",
  },
  {
    term: "服务质量指标",
    aliases: ["质检", "满意度", "dsat", "csat", "nps", "服务水平"],
    weight: 2,
    group: "ecom",
  },
  {
    term: "询单转化",
    aliases: ["询单转化", "询单", "催付", "挽单", "成交转化"],
    weight: 2,
    group: "ecom",
  },
  {
    term: "大促运营",
    aliases: ["大促", "双十一", "618", "活动运营", "促销"],
    weight: 1,
    group: "ecom",
  },

  /* ------------------------------ 通用素质 ------------------------------ */
  {
    term: "沟通表达",
    aliases: ["沟通", "表达", "沟通能力", "协调沟通"],
    weight: 1,
    group: "soft",
  },
  {
    term: "自驱力",
    aliases: ["自驱", "主动", "owner 意识", "责任心", "能扛事"],
    weight: 1,
    group: "soft",
  },
  {
    term: "抗压与节奏",
    aliases: ["抗压", "快节奏", "适应快", "高强度"],
    weight: 1,
    group: "soft",
  },
  {
    term: "逻辑思维",
    aliases: ["逻辑", "结构化思维", "分析能力", "抽象能力"],
    weight: 1,
    group: "soft",
  },
  {
    term: "学习能力",
    aliases: ["学习能力", "快速学习", "自学习", "探索能力"],
    weight: 1,
    group: "soft",
  },
  {
    term: "英语能力",
    aliases: ["英语", "英文", "英文读写", "英语流利"],
    weight: 1,
    group: "soft",
  },
];
