import buildingKnowledge from "../knowledge/building.json";
import combatKnowledge from "../knowledge/combat.json";
import heroKnowledge from "../knowledge/hero.json";
import resourceKnowledge from "../knowledge/resource.json";
import troopKnowledge from "../knowledge/troop.json";
import unlockKnowledge from "../knowledge/unlock.json";

export type KnowledgeCategory =
  | "英雄系统"
  | "部曲系统"
  | "建筑系统"
  | "战斗系统"
  | "资源系统"
  | "解锁条件";

type RawKnowledgeItem = {
  id: string;
  title: string;
  category: KnowledgeCategory;
  keywords: string[];
  content: string;
  summary: string;
};

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

const rawKnowledgeItems = [
  ...(heroKnowledge as RawKnowledgeItem[]),
  ...(troopKnowledge as RawKnowledgeItem[]),
  ...(buildingKnowledge as RawKnowledgeItem[]),
  ...(combatKnowledge as RawKnowledgeItem[]),
  ...(resourceKnowledge as RawKnowledgeItem[]),
  ...(unlockKnowledge as RawKnowledgeItem[]),
];

const knowledgeItems: KnowledgeItem[] = rawKnowledgeItems.map((item) => ({
  id: item.id,
  title: item.title,
  category: item.category,
  keywords: item.keywords,
  conclusion: item.summary,
  reason: item.content,
  steps: item.content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean),
  risk: ["请以知识库原文为准；未在知识库中出现的规则、数值或掉落不应编造。"],
}));

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
