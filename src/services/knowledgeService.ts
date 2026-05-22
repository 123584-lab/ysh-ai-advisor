import knowledgeData from "../data/knowledge.json";

export type KnowledgeCategory =
  | "新手开荒"
  | "声望系统"
  | "建筑发展"
  | "英雄培养"
  | "英雄系统"
  | "战技系统"
  | "兵法系统"
  | "阵型系统"
  | "天气补给"
  | "势力攻城"
  | "军备系统"
  | "演武系统"
  | "策令系统";

export type KnowledgeItem = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  keywords: string[];
  conclusion: string;
  reason: string;
  steps: string[];
  risk: string[];
};

const knowledgeItems = knowledgeData as KnowledgeItem[];

export function getKnowledgeItems(): KnowledgeItem[] {
  return knowledgeItems;
}

export function findKnowledgeByQuestion(question: string): KnowledgeItem | undefined {
  const text = question.trim();
  if (!text) return undefined;

  return knowledgeItems.find((item) =>
    item.keywords.some((keyword) => text.includes(keyword)),
  );
}
