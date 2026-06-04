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

const rawBuildingKnowledge = buildingKnowledge as RawKnowledgeItem[];

const rawKnowledgeItems = [
  ...(heroKnowledge as RawKnowledgeItem[]),
  ...(troopKnowledge as RawKnowledgeItem[]),
  ...rawBuildingKnowledge,
  ...(combatKnowledge as RawKnowledgeItem[]),
  ...(resourceKnowledge as RawKnowledgeItem[]),
  ...(unlockKnowledge as RawKnowledgeItem[]),
];

function normalizeKnowledgeItem(item: RawKnowledgeItem): KnowledgeItem {
  return {
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
  };
}

const knowledgeItems: KnowledgeItem[] = rawKnowledgeItems.map(normalizeKnowledgeItem);
const buildingKnowledgeItems: KnowledgeItem[] = rawBuildingKnowledge.map(normalizeKnowledgeItem);

export function getKnowledgeItems(): KnowledgeItem[] {
  return knowledgeItems;
}

export function findKnowledgeByQuestion(question: string): KnowledgeItem | undefined {
  const text = question.trim().toLowerCase();
  if (!text) return undefined;

  const hasAny = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  const scoreItems = (items: KnowledgeItem[]) => {
    let bestItem: KnowledgeItem | undefined;
    let bestScore = 0;

    for (const item of items) {
      let score = 0;
      const title = item.title.toLowerCase();
      const category = item.category.toLowerCase();

      if (text.includes(title)) score += 20;
      if (text.includes(category)) score += 8;

      for (const keyword of item.keywords) {
        const normalizedKeyword = keyword.trim().toLowerCase();
        if (!normalizedKeyword) continue;
        if (text.includes(normalizedKeyword)) score += 10;
        if (normalizedKeyword.includes(text)) score += 6;
      }

      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }

    return bestScore >= 10 ? bestItem : undefined;
  };

  if (hasAny(["建筑", "议事厅", "升级什么建筑", "先升什么", "优先升级"])) {
    return scoreItems(buildingKnowledgeItems);
  }

  const itemHasAny = (item: KnowledgeItem, keywords: string[]) => {
    const searchable = [item.id, item.title, item.category, ...item.keywords]
      .join(" ")
      .toLowerCase();

    return keywords.some((keyword) => searchable.includes(keyword.toLowerCase()));
  };
  const typeFilters: Array<{ questionKeywords: string[]; itemKeywords: string[] }> = [
    {
      questionKeywords: ["项羽", "吕布", "英雄", "武将", "怎么获得"],
      itemKeywords: ["hero", "英雄", "武将", "项羽", "吕布", "招募", "寻访", "抽卡"],
    },
    {
      questionKeywords: ["声望"],
      itemKeywords: ["声望"],
    },
    {
      questionKeywords: ["天气", "冬季", "季节"],
      itemKeywords: ["天气", "冬季", "季节"],
    },
    {
      questionKeywords: ["资源", "粮草", "木材", "铁矿", "石料"],
      itemKeywords: ["resource", "资源", "粮草", "木材", "铁矿", "石料"],
    },
  ];
  const matchedFilter = typeFilters.find((filter) => hasAny(filter.questionKeywords));
  const filteredItems = matchedFilter
    ? knowledgeItems.filter((item) => itemHasAny(item, matchedFilter.itemKeywords))
    : [];
  const candidateItems = filteredItems.length > 0 ? filteredItems : knowledgeItems;

  return scoreItems(candidateItems);
}
