import { findKnowledgeByQuestion, type KnowledgeItem } from "./knowledgeService";
import type { Hero } from "./heroService";
import type { StoredKnowledgeItem } from "./knowledgeStore";
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

export type QuestionIntent =
  | "hero_acquire"
  | "hero_lineup"
  | "hero_upgrade"
  | "troop_train"
  | "troop_type_upgrade"
  | "resource_shortage"
  | "building_upgrade"
  | "combat_decision"
  | "item_acquire"
  | "unlock_condition"
  | "troop"
  | "hero"
  | "building"
  | "resource"
  | "combat"
  | "general";

type QuestionContext = {
  heroName?: string;
  systemName?: string;
  actions: string[];
};

const knownHeroNames = [
  "吕布",
  "项羽",
  "韩信",
  "刘邦",
  "张良",
  "萧何",
  "曹操",
  "董卓",
  "孙策",
  "关羽",
  "张飞",
  "赵云",
  "诸葛亮",
  "黄忠",
  "马超",
  "刘备",
];

const systemKeywords = ["议事厅", "攻城", "部曲", "兵种", "资源", "声望", "领地", "科技", "天气", "远征", "建筑"];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function getMentionedHeroName(question: string) {
  return knownHeroNames.find((heroName) => question.includes(heroName));
}

function getQuestionContext(question: string): QuestionContext {
  const text = question.trim();
  const actions: string[] = [];

  if (includesAny(text, ["获得", "获取", "哪里", "在哪", "怎么来", "招募", "抽卡", "寻访", "碎片"])) actions.push("acquire");
  if (includesAny(text, ["阵容", "搭配", "配将", "组队"])) actions.push("lineup");
  if (includesAny(text, ["升级", "升星", "突破", "觉醒", "培养", "什么时候升"])) actions.push("upgrade");
  if (includesAny(text, ["解锁", "开启", "入口", "为什么没有", "还没", "没解锁"])) actions.push("unlock");
  if (includesAny(text, ["攻城", "远征", "战斗", "打架", "能不能", "该不该", "损兵"])) actions.push("combat");
  if (includesAny(text, ["不够", "缺", "短缺", "不够用"])) actions.push("shortage");

  return {
    heroName: getMentionedHeroName(text),
    systemName: systemKeywords.find((keyword) => text.includes(keyword)),
    actions,
  };
}

export function detectQuestionIntent(question: string): QuestionIntent {
  const text = question.trim();
  const context = getQuestionContext(text);
  const hasAction = (action: string) => context.actions.includes(action);

  if ((context.heroName || includesAny(text, ["英雄", "武将", "英雄碎片"])) && hasAction("acquire")) return "hero_acquire";
  if (context.heroName && hasAction("lineup")) return "hero_lineup";
  if ((context.heroName || includesAny(text, ["英雄", "武将"])) && hasAction("upgrade")) return "hero_upgrade";
  if (includesAny(text, ["部曲", "主力部曲", "主力"]) && includesAny(text, ["培养", "升级", "练兵"])) return "troop_train";
  if (text.includes("兵种") && includesAny(text, ["升级", "培养"])) return "troop_type_upgrade";
  if (includesAny(text, ["装备", "道具", "材料", "宝物"]) && hasAction("acquire")) return "item_acquire";
  if (hasAction("unlock")) return "unlock_condition";
  if (includesAny(text, ["资源", "粮草", "木材", "铁矿", "声望"]) && (hasAction("shortage") || hasAction("acquire"))) {
    return "resource_shortage";
  }
  if (includesAny(text, ["议事厅", "建筑", "城池", "府"]) && includesAny(text, ["升级", "什么时候升", "先升", "优先"])) {
    return "building_upgrade";
  }
  if (includesAny(text, ["攻城", "远征", "战斗", "打架", "冬天", "冬季"]) && hasAction("combat")) return "combat_decision";

  if (includesAny(text, ["英雄", "武将", "配将", "阵容", "技能", "战法"])) return "hero";
  if (includesAny(text, ["部曲", "兵种", "主力", "骑兵", "步兵", "弓兵", "培养", "练兵"])) return "troop";
  if (includesAny(text, ["议事厅", "建筑", "升级", "城池", "等级"])) return "building";
  if (includesAny(text, ["资源", "粮草", "木材", "铁矿", "采集", "补给", "声望"])) return "resource";
  if (includesAny(text, ["打架", "攻城", "战斗", "远征", "敌人", "兵力", "损兵"])) return "combat";

  return "general";
}

function stateSummary(playerState: PlayerState) {
  const ownedHeroText = playerState.ownedHeroes.length > 0 ? playerState.ownedHeroes.join("、") : "尚未录入已有英雄";
  return `当前议事厅${playerState.hallLevel}级，声望${playerState.prestige}，领地${playerState.territoryCount}块，主力战力${playerState.mainTroopPower}，当前季节为${playerState.season}，已有英雄：${ownedHeroText}。`;
}

function fallbackAnswer(): AdvisorAnswer {
  return {
    conclusion: "军师暂缺该项详细情报，请补充你想问的是获取、培养、搭配、升级还是解锁。",
    reason: "当前问题没有明确命中英雄、系统或动作组合；为了避免答非所问，军师不会强行套用开荒、建筑或阵容模板。",
    steps: [
      "如果问英雄来源，请写成“某某怎么获得”。",
      "如果问阵容，请写成“某某阵容怎么搭配”。",
      "如果问系统入口，请写成“为什么还没解锁某系统”。",
    ],
    risks: ["信息不完整时强行判断，容易给出与问题对象无关的建议。"],
  };
}

function createHeroAcquireAnswer(heroName: string | undefined, playerState: PlayerState): AdvisorAnswer {
  const target = heroName ?? "目标英雄";
  return {
    conclusion: `这是英雄获取问题。当前版本未接入真实英雄获取配置，不能断言${target}的固定来源。`,
    reason: `${stateSummary(playerState)} ${target}的获取方式需要以游戏内英雄图鉴、卡池说明和活动配置为准；军师不能把获取问题回答成阵容搭配。`,
    steps: [
      "先查看招募、寻访或抽卡入口，确认当前卡池是否包含目标英雄。",
      "查看限时活动、阶段奖励、主线任务或开服目标。",
      "检查英雄碎片合成入口，关注碎片商店、活动兑换和任务奖励。",
      "查看商店兑换、势力商店或功勋兑换是否有目标英雄或碎片。",
      "如果图鉴有“获取途径”，优先以游戏内配置为准。",
    ],
    risks: [
      "当前未接入真实掉落、卡池和活动表，不能编造具体必然渠道。",
      "限时英雄可能受服务器阶段、活动周期或渠道影响。",
      "抽卡或兑换前要确认目标英雄确实在当前获取池内。",
    ],
  };
}

function createHeroLineupAnswer(heroName: string | undefined, playerState: PlayerState): AdvisorAnswer {
  const target = heroName ?? "该英雄";
  return {
    conclusion: `这是${target}阵容搭配问题，应围绕${target}做主将定位、兵种适配和战法联动判断。`,
    reason: `${stateSummary(playerState)} 当前版本未接入${target}真实技能与兵种适配资料，因此只能给通用配将思路，不会套用吕布或其他英雄阵容。`,
    steps: [
      `先确认${target}在游戏内的定位：输出、前排、辅助或控制。`,
      "再查看其推荐兵种和技能触发条件，优先选择同兵种或能触发联动的副将。",
      "阵容至少保证输出、承伤、辅助三类职责中的两类，不要只堆输出。",
      "战法方向围绕核心定位选择：爆发、控制、续航或减伤，不要分散投入。",
    ],
    risks: [
      `缺少${target}真实技能资料时，不能断言最优阵容。`,
      "只按稀有度配将，可能导致兵种、阵型和战法触发脱节。",
      "如果你补充该英雄技能或已拥有英雄列表，军师可以给更具体的搭配顺序。",
    ],
  };
}

function createHeroUpgradeAnswer(playerState: PlayerState): AdvisorAnswer {
  return {
    conclusion: "这是英雄培养问题，应优先培养主力阵容核心英雄，再考虑升星、突破、觉醒等高消耗养成。",
    reason: `${stateSummary(playerState)} 英雄培养材料通常更稀缺，集中投入核心主将比平均培养更稳。`,
    steps: [
      "先确定一名核心主将或核心输出。",
      "优先提升等级和关键战法，再看材料余量决定升星、突破或觉醒。",
      "辅助和前排英雄以解锁关键技能、满足阵容职责为主。",
      "阵容未确定前，不建议大量消耗稀有培养材料。",
    ],
    risks: ["平均培养会拖慢主力成型。", "未确认阵容前投入突破材料，可能造成浪费。", "英雄强度还要看兵种和战法联动。"],
  };
}

function createTroopTrainAnswer(playerState: PlayerState): AdvisorAnswer {
  return {
    conclusion: "这是部曲培养问题，应集中培养一队主力部曲，不要把经验、战法和军备分散到多队。",
    reason: `${stateSummary(playerState)} 主力部曲决定开荒、刷地、防守和会战的稳定性。`,
    steps: [
      "先固定一队主力，优先提升主将等级、兵力上限和核心战法。",
      "军备和资源优先给主力队，副队先承担采集、补位或低风险任务。",
      "主力战力稳定前，先刷低损目标，再逐步挑战高级地或战斗目标。",
      "练兵前确认粮草和征兵储备，避免练完无法恢复。",
    ],
    risks: [
      "多队平均培养会导致主力战力不足。",
      "主力未成型就打高级地，容易高损。",
      playerState.season.includes("冬") ? "冬季远征练兵粮耗压力更高。" : "连续练兵要注意粮草消耗。",
    ],
  };
}

function createTroopTypeUpgradeAnswer(playerState: PlayerState): AdvisorAnswer {
  return {
    conclusion: "这是兵种升级问题，不是普通部曲培养。当前版本未接入真实兵种升级配置，因此不编造具体消耗或等级条件。",
    reason: `${stateSummary(playerState)} 兵种升级通常与兵种、军备、训练营、科技或前置任务相关，应先排查这些入口。`,
    steps: [
      "查看兵种、军备、训练营或军营相关入口，确认是否有兵种升级页。",
      "检查议事厅、军营或训练建筑等级是否达到升级条件。",
      "检查科技线中是否有兵种强化或兵种进阶节点。",
      "确认是否缺少粮草、铁矿、材料或前置任务。",
    ],
    risks: [
      "当前未接入真实兵种升级表，不能断言具体消耗。",
      "把兵种升级误当成部曲练级，会导致排查方向错误。",
      "建筑或科技前置未满足时，升级入口可能不会显示。",
    ],
  };
}

function createResourceShortageAnswer(playerState: PlayerState): AdvisorAnswer {
  return {
    conclusion: "这是资源规划问题，应先找出最短板资源，再围绕粮草、资源地和补给线调整。",
    reason: `${stateSummary(playerState)} 当前资源为木材${playerState.wood}、石料${playerState.stone}、粮草${playerState.food}、铁矿${playerState.iron}；资源不足会直接卡建筑、征兵和军备。`,
    steps: [
      "先判断缺口来自建筑升级、征兵、军备还是远征补给。",
      "粮草不足时优先补粮地和近地采集，保证征兵不断档。",
      "木材、石料、铁矿不足时，优先补对应资源地或调整采集目标。",
      "声望有空余领地上限时，优先占高价值资源地。",
    ],
    risks: ["只追高等级远地可能拉长补给线。", "粮草不足时强行远征会拖慢恢复。", "资源结构失衡会让后续建筑和军备连续卡点。"],
  };
}

function createBuildingUpgradeAnswer(playerState: PlayerState): AdvisorAnswer {
  return {
    conclusion: "这是建筑升级问题。议事厅通常是最高优先级，因为它影响发展上限、科技上限和领地节奏。",
    reason: `${stateSummary(playerState)} 如果问“议事厅什么时候升”，判断核心是资源是否足够、主力恢复是否会被影响、是否卡住科技或领地。`,
    steps: [
      `资源允许时，优先把议事厅从当前${playerState.hallLevel}级继续向上推进。`,
      "如果升级会掏空粮草或铁矿，先补资源再升，避免影响征兵。",
      "议事厅不卡时，再补军营、仓储、资源建筑和科技建筑。",
      "每次声望提升后，同步检查领地上限和资源地规划。",
    ],
    risks: ["只升非核心建筑会消耗资源但不提高上限。", "建筑升级过快可能挤压征兵资源。", "议事厅被卡会连带拖慢科技和领地扩张。"],
  };
}

function createCombatDecisionAnswer(playerState: PlayerState): AdvisorAnswer {
  return {
    conclusion: "这是战斗或远征决策问题，应先评估战力、兵力、季节和补给，再判断能不能打。",
    reason: `${stateSummary(playerState)} 战斗决策不能只看目标收益，还要看损兵、粮耗、士气和打完后的恢复能力。`,
    steps: [
      `先以主力战力${playerState.mainTroopPower}为基准，避免挑战明显超出承受范围的目标。`,
      "若是攻城，先确认势力集结、太守或权限、工程车、插旗、军营和主力到位。",
      "若是远征，确认补给距离、粮草和士气，冬季应优先近地整备。",
      "开战前侦查敌方兵种和兵力，按克制关系调整阵型。",
    ],
    risks: [
      "准备不足就攻城，容易高损或失败。",
      playerState.season.includes("冬") ? "当前为冬季，远征会增加粮耗并降低效率。" : "连续作战仍要防止兵力恢复断档。",
      "主力未恢复就继续战斗，会影响后续开荒和防守。",
    ],
  };
}

function createUnlockConditionAnswer(question: string, playerState: PlayerState): AdvisorAnswer {
  const isSiege = question.includes("攻城");
  return {
    conclusion: isSiege
      ? "这是攻城解锁条件排查问题，不应按资源或天气泛泛回答。"
      : "这是功能或系统解锁问题，应先排查等级、主线、建筑和前置任务。",
    reason: `${stateSummary(playerState)} 入口未出现通常是账号阶段、主线进度、议事厅等级、势力条件或玩法开放条件未满足。`,
    steps: isSiege
      ? [
          "检查主线阶段或服务器阶段是否已经开放攻城玩法。",
          "确认是否已加入势力、军团或满足参与攻城的组织条件。",
          `检查议事厅当前${playerState.hallLevel}级，很多玩法会被主城或议事厅等级限制。`,
          "确认部曲战力、兵力、军营、工程车、插旗、集结或目标城池开放条件是否满足。",
          "查看地图目标城池是否处于可攻打状态。",
        ]
      : [
          "先检查主线任务和阶段目标是否完成。",
          `检查议事厅当前${playerState.hallLevel}级，确认是否达到系统开放要求。`,
          "查看对应系统是否藏在活动、势力、军备、演武或地图界面。",
          "如果仍无入口，以游戏内红点、任务追踪和系统提示为准。",
        ],
    risks: [
      "未达前置条件时强行寻找入口，容易误判为功能异常。",
      "部分玩法可能受服务器阶段或活动周期限制。",
      "当前未接入真实解锁表，不能断言具体开放等级。",
    ],
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

function createPlayerStateAnswer(playerState: PlayerState): AdvisorAnswer {
  return {
    conclusion: "当前应先稳住议事厅、主力战力和资源地节奏，再考虑外部扩张。",
    reason: stateSummary(playerState),
    steps: [
      `优先检查议事厅${playerState.hallLevel}级是否卡住建筑、科技或领地上限。`,
      `主力战力${playerState.mainTroopPower}未稳定前，先集中培养一队主力。`,
      "根据声望与领地数量判断是否还有资源地扩张空间。",
      playerState.season.includes("冬") ? "当前为冬季，少做远征，多做近地整备。" : "季节允许时，可在补给安全范围内推进资源地。",
    ],
    risks: ["资源、兵力和建筑节奏脱节会拖慢整体成长。", "主力未稳时多线出征，容易扩大兵损。"],
  };
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

  if (includesAny(question, ["为什么", "为啥", "原因呢", "怎么说"])) {
    return {
      conclusion: "这是对上一条问策的追问，军师将沿用上一条结论继续解释。",
      reason: previousAnswer.reason,
      steps: previousAnswer.steps.slice(0, 3),
      risks: previousAnswer.risks,
    };
  }

  if (includesAny(question, ["然后呢", "接下来", "下一步", "后面呢", "之后呢"])) {
    return {
      conclusion: "下一步应把上一条建议转成可执行顺序。",
      reason: previousAnswer.conclusion,
      steps: previousAnswer.steps.length > 0 ? previousAnswer.steps : ["先完成当前最紧急目标。", "再根据资源、兵力和季节决定是否扩张。"],
      risks: previousAnswer.risks,
    };
  }

  return undefined;
}

export function generateAdvisorAnswer(
  question: string,
  playerState: PlayerState,
  _heroes: Hero[],
  history: ChatHistory[],
  knowledgeItems?: StoredKnowledgeItem[],
): AdvisorAnswer {
  const text = question.trim();
  const matchedKnowledge = findKnowledgeByQuestion(text, knowledgeItems);
  if (matchedKnowledge) return createKnowledgeAnswer(matchedKnowledge);

  const intent = detectQuestionIntent(text);
  const context = getQuestionContext(text);

  console.log("Question:", question);
  console.log("Intent:", intent);
  console.log("Detected Intent:", intent);

  switch (intent) {
    case "hero_acquire":
      return createHeroAcquireAnswer(context.heroName, playerState);
    case "hero_lineup":
      return createHeroLineupAnswer(context.heroName, playerState);
    case "hero_upgrade":
      return createHeroUpgradeAnswer(playerState);
    case "troop_train":
      return createTroopTrainAnswer(playerState);
    case "troop_type_upgrade":
      return createTroopTypeUpgradeAnswer(playerState);
    case "resource_shortage":
      return createResourceShortageAnswer(playerState);
    case "building_upgrade":
      return createBuildingUpgradeAnswer(playerState);
    case "combat_decision":
      return createCombatDecisionAnswer(playerState);
    case "item_acquire":
      return createItemAcquireAnswer(playerState);
    case "unlock_condition":
      return createUnlockConditionAnswer(text, playerState);
    case "hero":
      return includesAny(text, ["培养", "升级", "升星"]) ? createHeroUpgradeAnswer(playerState) : fallbackAnswer();
    case "troop":
      return createTroopTrainAnswer(playerState);
    case "building":
      return createBuildingUpgradeAnswer(playerState);
    case "resource":
      return createResourceShortageAnswer(playerState);
    case "combat":
      return createCombatDecisionAnswer(playerState);
    case "general":
      break;
  }

  if (includesAny(text, ["我现在该做什么", "下一步做什么", "现在优先干什么", "发展", "开荒", "优先"])) {
    return createPlayerStateAnswer(playerState);
  }

  return createContextualAnswer(text, history) ?? fallbackAnswer();
}

function createItemAcquireAnswer(playerState: PlayerState): AdvisorAnswer {
  return {
    conclusion: "这是物品获取问题。当前版本未接入真实掉落表，因此只能给通用获取渠道建议，不会编造具体掉落关卡。",
    reason: `${stateSummary(playerState)} 装备、道具和材料通常由副本、活动、任务、商店和兑换系统分发。`,
    steps: [
      "先查看物品详情或图鉴中的获取途径。",
      "检查副本、演武、战斗掉落或日常任务是否产出该材料。",
      "查看限时活动和阶段奖励。",
      "检查商店、功勋、势力或资源兑换入口。",
    ],
    risks: ["当前未接入真实掉落配置，不能保证某个副本必掉。", "活动材料可能有时效。", "兑换前要确认材料是否服务当前主力。"],
  };
}

export const advisorAnswerToContent = answerToContent;
export const advisorContentToAnswer = contentToAnswer;
