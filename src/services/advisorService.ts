import {
  findHeroByName,
  recommendLineup,
  recommendLineupFromOwnedHeroes,
  type Hero,
  type LineupRecommendation,
} from "./heroService";
import { findKnowledgeByQuestion, type KnowledgeItem } from "./knowledgeService";
import type { PlayerState } from "./playerStateService";

export type AdvisorAnswer = {
  conclusion: string;
  reason: string;
  steps: string[];
  risks: string[];
};

export type ChatHistory = {
  role: "player" | "advisor";
  content: string;
  timestamp: number;
};

const defaultAdvisorAnswer: AdvisorAnswer = {
  conclusion: "开荒期先稳资源、再扩领地，主力部曲不要频繁分散。",
  reason: "新手阶段最大的风险不是发展慢，而是资源、兵力与建筑节奏彼此脱节。",
  steps: ["优先升级议事厅与关键资源建筑。", "培养一支稳定主力部曲。", "围绕声望上限逐步扩张领地。"],
  risks: ["盲目攻打高等级资源地会损兵。", "补给不足时连续出征，会拖慢后续发展。"],
};

function isDevelopmentQuestion(text: string) {
  return [
    "我现在该做什么",
    "下一步做什么",
    "现在优先干什么",
    "发展",
    "开荒",
    "优先",
    "下一步",
  ].some((keyword) => text.includes(keyword));
}

function isLineupQuestion(text: string) {
  return ["怎么配将", "我现在怎么组队", "推荐阵容", "配将", "组队", "阵容"].some((keyword) =>
    text.includes(keyword),
  );
}

function isMechanismQuestion(text: string, matchedKnowledge?: KnowledgeItem) {
  return Boolean(
    matchedKnowledge ||
      ["是什么", "有什么用", "怎么用", "规则", "机制", "为什么", "如何"].some((keyword) =>
        text.includes(keyword),
      ),
  );
}

function answerToContent(answer: AdvisorAnswer): string {
  return [
    `结论：${answer.conclusion}`,
    `原因：${answer.reason}`,
    `操作步骤：${answer.steps.join("；")}`,
    `风险提醒：${answer.risks.join("；")}`,
  ].join("\n");
}

function contentToAnswer(content: string): AdvisorAnswer {
  const readLine = (label: string) =>
    content
      .split("\n")
      .find((line) => line.startsWith(`${label}：`))
      ?.replace(`${label}：`, "")
      .trim() ?? "";

  const splitList = (value: string) =>
    value
      .split("；")
      .map((item) => item.trim())
      .filter(Boolean);

  const conclusion = readLine("结论");
  const reason = readLine("原因");
  const steps = splitList(readLine("操作步骤"));
  const risks = splitList(readLine("风险提醒"));

  if (!conclusion && !reason && steps.length === 0 && risks.length === 0) {
    return {
      conclusion: content,
      reason: "这是从历史记录中恢复的军师答复。",
      steps: [],
      risks: [],
    };
  }

  return { conclusion, reason, steps, risks };
}

function getLatestAdvisorAnswer(history: ChatHistory[]): AdvisorAnswer | undefined {
  const latestAdvisor = [...history].reverse().find((item) => item.role === "advisor");
  return latestAdvisor ? contentToAnswer(latestAdvisor.content) : undefined;
}

function createContextualAnswer(question: string, history: ChatHistory[]): AdvisorAnswer | undefined {
  const previousAnswer = getLatestAdvisorAnswer(history);
  if (!previousAnswer) return undefined;

  if (["为什么", "为啥", "原因呢", "怎么说"].some((keyword) => question.includes(keyword))) {
    return {
      conclusion: "承接上一条建议，关键判断仍是先稳住主线节奏。",
      reason: previousAnswer.reason,
      steps: ["先按上一条结论确认当前资源与兵力状态。", ...previousAnswer.steps.slice(0, 2)],
      risks: previousAnswer.risks,
    };
  }

  if (["然后呢", "接下来", "下一步", "后面呢", "之后呢"].some((keyword) => question.includes(keyword))) {
    return {
      conclusion: "下一步应把上一条建议落到具体执行顺序上。",
      reason: previousAnswer.conclusion,
      steps:
        previousAnswer.steps.length > 0
          ? previousAnswer.steps
          : ["先完成当前最紧急目标。", "再根据资源、兵力和天气状态决定是否扩张。"],
      risks: previousAnswer.risks,
    };
  }

  if (/^那.+呢[？?]?$/.test(question)) {
    return {
      conclusion: "这属于上一条问策的延伸，需要结合当前阶段一起判断。",
      reason: previousAnswer.conclusion,
      steps: ["先按关键词重新确认具体系统。", "再沿用上一条建议中的资源、兵力和风险判断。", "若命中具体知识，优先执行对应知识的步骤。"],
      risks: previousAnswer.risks,
    };
  }

  return undefined;
}

function createPlayerStateAnswer(playerState: PlayerState): AdvisorAnswer {
  const resourceSummary = `当前木材${playerState.wood}、石料${playerState.stone}、粮草${playerState.food}、铁矿${playerState.iron}。`;
  const prestigeLandLimit = Math.floor(playerState.prestige / 100);
  const shouldExpandTerritory = playerState.territoryCount < prestigeLandLimit;
  const isWinter = playerState.season.includes("冬");
  const isHallLow = playerState.hallLevel < 6;
  const isPowerLow = playerState.mainTroopPower < 15000;

  return {
    conclusion: isWinter
      ? "你现在应以升议事厅、稳主力、近距离补资源为主，暂缓远征。"
      : "你现在应围绕议事厅、声望领地和主力战力三件事推进。",
    reason: `军师读取到当前状态：议事厅${playerState.hallLevel}级、声望${playerState.prestige}、领地${playerState.territoryCount}块、主力战力${playerState.mainTroopPower}、季节为${playerState.season}。${resourceSummary}`,
    steps: [
      isHallLow
        ? `先把议事厅从${playerState.hallLevel}级继续往上升，议事厅会带动坞堡、科技和领地上限。`
        : `议事厅已到${playerState.hallLevel}级，可以把重心转向科技、军营和主力部曲强化。`,
      shouldExpandTerritory
        ? `声望${playerState.prestige}，当前领地${playerState.territoryCount}块，仍有扩张空间，优先补高价值资源地。`
        : `声望${playerState.prestige}，领地数量已接近当前声望节奏，先清理低收益地块再扩张。`,
      isPowerLow
        ? `主力战力${playerState.mainTroopPower}偏低，先集中培养一队主力，补英雄等级、战技和军备。`
        : `主力战力${playerState.mainTroopPower}已具备推进能力，可以低损刷更高价值目标。`,
      isWinter
        ? "当前是冬季，不建议远征，优先近距离刷地、囤粮、恢复士气。"
        : `当前是${playerState.season}，可在补给安全的前提下推进资源地和势力目标。`,
    ],
    risks: [
      isWinter ? "冬季远征会增加粮耗并拖慢行军。" : "推进过快时要确认补给线安全。",
      isPowerLow ? "主力战力不足时挑战高级地容易损兵。" : "战力足够也不要忽视兵种克制和阵型匹配。",
      "声望与领地规划脱节，会造成资源产出跟不上建筑节奏。",
    ],
  };
}

function createLineupAnswer(recommendation: LineupRecommendation): AdvisorAnswer {
  const lineupNames = recommendation.lineup
    .map((hero) => `${hero.name}（${hero.camp}·${hero.troopType}·${hero.role}）`)
    .join("、");

  return {
    conclusion: `推荐阵容：${lineupNames}。`,
    reason: `推荐阵型：${recommendation.formation}。推荐兵法方向：${recommendation.strategyDirection}`,
    steps: [
      `先以${recommendation.lineup[0]?.name ?? "核心英雄"}作为阵容核心，围绕其兵种和定位配队。`,
      `适用场景：${recommendation.scenarios.join("、")}。`,
      "上阵前检查统率上限、兵种一致性、战技触发条件和前后排站位。",
    ],
    risks: recommendation.risks,
  };
}

function createKnowledgeAnswer(knowledge: KnowledgeItem): AdvisorAnswer {
  return {
    conclusion: knowledge.conclusion,
    reason: knowledge.reason,
    steps: knowledge.steps,
    risks: knowledge.risk,
  };
}

function mergeAnswers(answers: AdvisorAnswer[]): AdvisorAnswer {
  const [primary, ...rest] = answers;
  const supportingReasons = rest.map((answer) => answer.reason).filter(Boolean);
  const steps = answers.flatMap((answer) => answer.steps).slice(0, 6);
  const risks = answers.flatMap((answer) => answer.risks).slice(0, 5);

  return {
    conclusion: primary.conclusion,
    reason: [primary.reason, ...supportingReasons].join(" "),
    steps,
    risks,
  };
}

export function generateAdvisorAnswer(
  question: string,
  playerState: PlayerState,
  heroes: Hero[],
  history: ChatHistory[],
): AdvisorAnswer {
  const text = question.trim();
  const explicitHero = findHeroByName(text, heroes);
  const lineupRecommendation = explicitHero
    ? recommendLineup(text, heroes)
    : isLineupQuestion(text)
      ? recommendLineupFromOwnedHeroes(playerState.ownedHeroes, heroes)
      : undefined;
  const matchedKnowledge = findKnowledgeByQuestion(text);
  const developmentQuestion = isDevelopmentQuestion(text);

  const answerParts: AdvisorAnswer[] = [];
  if (lineupRecommendation) answerParts.push(createLineupAnswer(lineupRecommendation));
  if (developmentQuestion) answerParts.push(createPlayerStateAnswer(playerState));
  if (matchedKnowledge) answerParts.push(createKnowledgeAnswer(matchedKnowledge));

  if (answerParts.length > 1) {
    return mergeAnswers(answerParts);
  }

  if (lineupRecommendation) return createLineupAnswer(lineupRecommendation);
  if (developmentQuestion) return createPlayerStateAnswer(playerState);
  if (isMechanismQuestion(text, matchedKnowledge) && matchedKnowledge) return createKnowledgeAnswer(matchedKnowledge);

  return createContextualAnswer(text, history) ?? defaultAdvisorAnswer;
}

export const advisorAnswerToContent = answerToContent;
export const advisorContentToAnswer = contentToAnswer;
