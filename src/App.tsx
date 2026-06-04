import { FormEvent, useEffect, useRef, useState } from "react";
import {
  advisorAnswerToContent as answerToContent,
  advisorContentToAnswer as contentToAnswer,
  generateAdvisorAnswer,
  type AdvisorAnswer,
  type ChatHistory,
} from "./services/advisorService";
import { advisorProvider } from "./services/advisorProvider";
import { getHeroes } from "./services/heroService";
import { getPlayerState, updatePlayerState, type PlayerState } from "./services/playerStateService";
import buildingKnowledge from "./knowledge/building.json";
import combatKnowledge from "./knowledge/combat.json";
import heroKnowledge from "./knowledge/hero.json";
import resourceKnowledge from "./knowledge/resource.json";
import troopKnowledge from "./knowledge/troop.json";
import unlockKnowledge from "./knowledge/unlock.json";

export type AdvisorCategory =
  | "新手开荒"
  | "英雄配将"
  | "建筑发展"
  | "部曲战斗"
  | "势力攻城"
  | "天气补给"
  | "军备兵法";

export type AdvisorSection =
  | "home"
  | "beginner"
  | "development"
  | "heroes"
  | "troops"
  | "battle"
  | "resources"
  | "technology"
  | "military"
  | "records"
  | "settings";

export type ChatMessage = ChatHistory & {
  id: number;
  answer?: AdvisorAnswer;
};

export type MilitaryPanel = {
  stage: string;
  targets: string[];
  risks: string[];
};

export type DailyOrder = {
  task: string;
  reason: string;
  priority: "最高" | "高" | "中";
  risk: string;
  benefit: string;
};

export type AdvisorApi = {
  ask: (question: string, history: ChatHistory[], playerState: PlayerState) => Promise<string>;
};

const HISTORY_STORAGE_KEY = "yishanhe-advisor-chat-history";
const MAX_HISTORY_COUNT = 20;

const categories: AdvisorCategory[] = [
  "新手开荒",
  "英雄配将",
  "建筑发展",
  "部曲战斗",
  "势力攻城",
  "天气补给",
  "军备兵法",
];

const navItems: Array<{ section: AdvisorSection; label: string; icon: string; category: AdvisorCategory }> = [
  { section: "home", label: "军师首页", icon: "⌂", category: "新手开荒" },
  { section: "beginner", label: "新手开荒", icon: "⚔", category: "新手开荒" },
  { section: "development", label: "发展路线", icon: "▣", category: "建筑发展" },
  { section: "heroes", label: "英雄配将", icon: "♞", category: "英雄配将" },
  { section: "troops", label: "部曲培养", icon: "⚑", category: "部曲战斗" },
  { section: "battle", label: "战斗策略", icon: "╳", category: "军备兵法" },
  { section: "resources", label: "资源规划", icon: "◎", category: "建筑发展" },
  { section: "technology", label: "科技研究", icon: "冊", category: "军备兵法" },
  { section: "military", label: "军情分析", icon: "◈", category: "势力攻城" },
  { section: "records", label: "问答记录", icon: "☷", category: "天气补给" },
  { section: "settings", label: "军师设置", icon: "⚙", category: "军备兵法" },
];

const dailyOrderIcons = ["城", "盔", "穗", "旗", "令"];

const recommendedQuestions = [
  "我现在该先升什么建筑？",
  "声望有什么用？",
  "冬季能不能远征？",
  "攻城前要准备什么？",
  "阵型应该怎么搭配？",
];

const topTabs = ["今日军令", "热门攻略", "智能配将", "攻城助手", "天气补给"];

const navViewMock: Record<
  AdvisorSection,
  {
    title: string;
    placeholder: string;
    orders?: DailyOrder[];
  }
> = {
  home: {
    title: "新手开荒",
    placeholder: "当前应该优先升级什么建筑？",
  },
  beginner: {
    title: "新手开荒",
    placeholder: "开荒期我应该先做什么？",
    orders: [
      {
        task: "优先推进议事厅等级",
        reason: "议事厅会牵动坞堡、科技与领地上限，是开荒阶段的主线。",
        priority: "最高",
        risk: "资源未备齐时硬升，会拖慢征兵与主力恢复。",
        benefit: "打开建筑与科技上限，提升后续发展速度。",
      },
      {
        task: "集中培养一队主力部曲",
        reason: "开荒期兵力分散会导致高级地推进困难，先养成一队更稳。",
        priority: "最高",
        risk: "多队平均培养会造成战技、兵法与装备资源不足。",
        benefit: "降低刷地兵损，提高连续作战能力。",
      },
      {
        task: "补齐基础资源地",
        reason: "木材、石料、粮草、铁矿缺口会直接卡住建筑与征兵节奏。",
        priority: "高",
        risk: "只追高级地可能导致补给线过长，冬季尤其危险。",
        benefit: "形成稳定产出，减少发展等待。",
      },
    ],
  },
  development: {
    title: "发展路线",
    placeholder: "我现在建筑和科技应该怎么排优先级？",
    orders: [
      {
        task: "梳理建筑升级队列",
        reason: "议事厅、军营、仓储与科技建筑决定城内发展上限。",
        priority: "最高",
        risk: "盲目升级边缘建筑会浪费前期紧缺资源。",
        benefit: "减少卡建筑、卡科技、卡领地的连锁问题。",
      },
      {
        task: "围绕声望扩张领地",
        reason: "声望决定领地上限，每提升一段都应及时补占高价值资源地。",
        priority: "高",
        risk: "领地空位闲置会浪费每日资源产出窗口。",
        benefit: "扩大资源盘，支撑后续建筑与军备升级。",
      },
      {
        task: "确定科技主线",
        reason: "科技路线应服务当前主力部曲与资源短板。",
        priority: "中",
        risk: "科技分散会导致关键加成迟迟无法成型。",
        benefit: "提升长期战斗与内政效率。",
      },
    ],
  },
  heroes: {
    title: "英雄配将",
    placeholder: "我这些英雄应该怎么组队？",
    orders: [
      {
        task: "确定主将与核心输出",
        reason: "阵容先看英雄定位，再看兵种、阵型和战技联动。",
        priority: "最高",
        risk: "只按稀有度上阵，可能造成兵种和战技互相脱节。",
        benefit: "更快形成一队可持续开荒或作战的主力。",
      },
      {
        task: "补足前排与辅助位",
        reason: "稳定阵容需要承伤、输出、辅助三类职责互补。",
        priority: "高",
        risk: "纯输出队容易在高兵损地或攻城战中崩盘。",
        benefit: "提高容错，减少频繁回城恢复。",
      },
      {
        task: "同步调整战技方向",
        reason: "英雄定位确定后，战技应围绕控制、爆发或续航集中投入。",
        priority: "中",
        risk: "战技错配会浪费培养材料。",
        benefit: "让阵容强度更早成型。",
      },
    ],
  },
  troops: {
    title: "部曲培养",
    placeholder: "我的主力部曲现在该怎么培养？",
    orders: [
      {
        task: "优先提升主力部曲等级",
        reason: "主力等级直接影响刷地、守城与攻城集结表现。",
        priority: "最高",
        risk: "副队过早分资源会拖慢主力成型。",
        benefit: "提高战力门槛，减少兵损。",
      },
      {
        task: "检查兵种与阵型匹配",
        reason: "兵种和阵型不匹配会影响兵法触发与队伍联动。",
        priority: "高",
        risk: "阵型错误会让战技收益打折。",
        benefit: "提升同等战力下的实战表现。",
      },
      {
        task: "补齐征兵与粮草储备",
        reason: "部曲连续作战依赖兵源和粮草支撑。",
        priority: "中",
        risk: "粮草不足会打断开荒和集结节奏。",
        benefit: "延长连续作战时间。",
      },
    ],
  },
  battle: {
    title: "战斗策略",
    placeholder: "这场战斗我该用什么阵型和打法？",
    orders: [
      {
        task: "先判定敌方兵种克制",
        reason: "战斗前确认敌方主力兵种，可避免硬碰劣势阵容。",
        priority: "最高",
        risk: "不侦查直接进攻容易扩大兵损。",
        benefit: "提高胜率并节省恢复时间。",
      },
      {
        task: "调整阵型与兵法触发",
        reason: "阵型需要与兵种、英雄和兵法方向匹配。",
        priority: "高",
        risk: "阵型联动失效会让战斗强度明显下降。",
        benefit: "提升爆发、控制或续航能力。",
      },
      {
        task: "保留一队机动预备队",
        reason: "战斗中常有补刀、驻防和救援需求。",
        priority: "中",
        risk: "全军压上会缺乏应急手段。",
        benefit: "提高战场调度弹性。",
      },
    ],
  },
  resources: {
    title: "资源规划",
    placeholder: "我现在缺资源，应该先补哪一种？",
    orders: [
      {
        task: "盘点粮草与征兵压力",
        reason: "粮草决定征兵和远征持续力，是战时最容易断档的资源。",
        priority: "最高",
        risk: "粮草不足会直接中断主力恢复。",
        benefit: "保障开荒、攻城与防守连续性。",
      },
      {
        task: "补占短板资源地",
        reason: "资源结构失衡会让建筑和军备升级频繁卡住。",
        priority: "高",
        risk: "只追单项资源会造成新的短板。",
        benefit: "让城建、科技和军备同步推进。",
      },
      {
        task: "缩短补给线距离",
        reason: "远地收益高但维护成本也高，冬季风险更明显。",
        priority: "中",
        risk: "补给断线会造成士气与粮耗压力。",
        benefit: "降低远征风险，提高资源稳定度。",
      },
    ],
  },
  technology: {
    title: "科技研究",
    placeholder: "我当前科技应该先点哪条线？",
    orders: [
      {
        task: "优先研究主力相关科技",
        reason: "科技投入应服务当前主力兵种和战斗定位。",
        priority: "最高",
        risk: "多线平均研究会拖慢关键加成成型。",
        benefit: "让主力部曲更快突破战力瓶颈。",
      },
      {
        task: "补足资源与行军科技",
        reason: "内政科技会缓解资源短板，行军科技会提升调度效率。",
        priority: "高",
        risk: "忽视内政会导致后续升级成本压力过大。",
        benefit: "提升长期发展稳定性。",
      },
      {
        task: "跟随议事厅等级解锁上限",
        reason: "议事厅等级会影响科技上限，需同步推进。",
        priority: "中",
        risk: "科技上限被卡会浪费研究队列。",
        benefit: "保持科技成长不断档。",
      },
    ],
  },
  military: {
    title: "军情分析",
    placeholder: "根据当前军情，我下一步该做什么？",
    orders: [
      {
        task: "判断当前阶段风险",
        reason: "军情分析应先看季节、主力战力、领地与声望空间。",
        priority: "最高",
        risk: "忽视季节和士气会让远征收益变低。",
        benefit: "避免错误开战或错误扩张。",
      },
      {
        task: "确认主力是否适合出征",
        reason: "主力战力不足时应先培养，不宜直接挑战高风险目标。",
        priority: "高",
        risk: "强行出征会扩大兵损并拖慢发展。",
        benefit: "提高作战成功率。",
      },
      {
        task: "设定今日战略目标",
        reason: "明确目标可避免资源、兵力和策令分散。",
        priority: "中",
        risk: "目标过多会造成执行混乱。",
        benefit: "让每日行动更有节奏。",
      },
    ],
  },
  records: {
    title: "问答记录",
    placeholder: "帮我总结刚才的问策重点。",
    orders: [
      {
        task: "回看近期问策结论",
        reason: "连续对话中已有判断，可作为下一步行动依据。",
        priority: "高",
        risk: "重复提问会造成决策信息分散。",
        benefit: "快速沉淀当前阶段策略。",
      },
      {
        task: "确认未执行事项",
        reason: "把未完成建议转成行动项，能提高问策收益。",
        priority: "中",
        risk: "只看结论不执行，发展节奏不会改善。",
        benefit: "减少遗漏，提高执行效率。",
      },
      {
        task: "基于新军情再次提问",
        reason: "军情变化后，建议也应随之更新。",
        priority: "中",
        risk: "沿用旧建议可能不适合当前状态。",
        benefit: "保持策略与实时状态一致。",
      },
    ],
  },
  settings: {
    title: "军师设置",
    placeholder: "我应该怎样设置当前军情数据？",
    orders: [
      {
        task: "更新右侧军情数据",
        reason: "议事厅、声望、领地和主力战力会影响军师判断。",
        priority: "最高",
        risk: "数据过旧会导致建议偏离真实局势。",
        benefit: "让问策结果更贴近当前账号状态。",
      },
      {
        task: "录入已有英雄",
        reason: "配将问题可直接读取已有英雄生成阵容建议。",
        priority: "高",
        risk: "未录入英雄时，配将只能按通用规则判断。",
        benefit: "提高智能配将的可用性。",
      },
      {
        task: "检查季节与资源储备",
        reason: "季节和资源会影响远征、补给与建筑升级节奏。",
        priority: "中",
        risk: "冬季远征和资源短缺都可能放大发展风险。",
        benefit: "让发展建议更稳。",
      },
    ],
  },
};

const militaryPanel: MilitaryPanel = {
  stage: "开荒期",
  targets: ["提升议事厅", "培养主力部曲", "刷声望"],
  risks: ["冬季远征", "士气不足", "补给断线"],
};

const playerStateFields: Array<{
  key: keyof PlayerState;
  label: string;
  type: "number" | "text";
}> = [
  { key: "hallLevel", label: "议事厅等级", type: "number" },
  { key: "prestige", label: "声望", type: "number" },
  { key: "territoryCount", label: "领地数量", type: "number" },
  { key: "mainTroopPower", label: "主力战力", type: "number" },
  { key: "season", label: "当前季节", type: "text" },
  { key: "troopCount", label: "部曲数量", type: "number" },
  { key: "wood", label: "木材", type: "number" },
  { key: "stone", label: "石料", type: "number" },
  { key: "food", label: "粮草", type: "number" },
  { key: "iron", label: "铁矿", type: "number" },
  { key: "ownedHeroes", label: "已有英雄", type: "text" },
];

function parseOwnedHeroes(value: string) {
  return value
    .split(/[、,\s，]+/)
    .map((heroName) => heroName.trim())
    .filter(Boolean);
}

function formatPlayerStateField(playerState: PlayerState, key: keyof PlayerState) {
  const value = playerState[key];
  return Array.isArray(value) ? value.join("、") : value;
}

function generateDailyOrders(playerState: PlayerState): DailyOrder[] {
  const orders: DailyOrder[] = [];
  const landLimit = Math.floor(playerState.prestige / 100);
  const hasTerritoryRoom = playerState.territoryCount < landLimit;
  const isWinter = playerState.season.includes("冬");
  const lowestResource = [
    { name: "木材", value: playerState.wood },
    { name: "石料", value: playerState.stone },
    { name: "粮草", value: playerState.food },
    { name: "铁矿", value: playerState.iron },
  ].sort((a, b) => a.value - b.value)[0];

  if (playerState.hallLevel < 6) {
    orders.push({
      task: `推进议事厅至${playerState.hallLevel + 1}级`,
      reason: "议事厅会影响坞堡、科技与领地上限，是当前发展主轴。",
      priority: "最高",
      risk: "资源未备齐时硬升，会拖慢征兵和主力恢复。",
      benefit: "解锁发展上限，提升后续科技与领地节奏。",
    });
  }

  if (playerState.mainTroopPower < 15000) {
    orders.push({
      task: "集中培养一队主力部曲",
      reason: `当前主力战力${playerState.mainTroopPower.toLocaleString("zh-CN")}，仍需补英雄等级、战技和军备。`,
      priority: "最高",
      risk: "主力未稳就挑战高等级地，容易扩大兵损。",
      benefit: "降低刷地兵损，提高连续作战能力。",
    });
  }

  if (hasTerritoryRoom) {
    orders.push({
      task: "补占高价值资源地",
      reason: `声望${playerState.prestige}约可支撑${landLimit}块领地，当前仅${playerState.territoryCount}块。`,
      priority: "高",
      risk: "远距离铺地会拉长补给线，冬季尤其容易断粮。",
      benefit: "增加资源产出，缓解建筑升级卡点。",
    });
  }

  if (isWinter) {
    orders.push({
      task: "暂停远征，改为近地整备",
      reason: "当前为冬季，行军速度与粮草压力都会影响连续作战。",
      priority: "高",
      risk: "冬季强行远征会增加粮耗，并可能错过集结窗口。",
      benefit: "保存兵力与粮草，为季节转换后的推进蓄势。",
    });
  }

  if (lowestResource) {
    orders.push({
      task: `优先补足${lowestResource.name}`,
      reason: `${lowestResource.name}当前储备最低，可能成为建筑升级或征兵卡点。`,
      priority: orders.length < 3 ? "高" : "中",
      risk: "资源结构失衡会导致议事厅、军营或军备升级断档。",
      benefit: "补齐短板资源，减少发展等待时间。",
    });
  }

  if (orders.length < 3) {
    orders.push({
      task: "完成今日声望与策令任务",
      reason: "声望决定领地上限，策令可补齐当日发展短板。",
      priority: "中",
      risk: "声望和策令满溢会浪费每日成长窗口。",
      benefit: "稳定获取日常成长收益。",
    });
  }

  return orders.slice(0, 5);
}

export function loadHistory(): ChatHistory[] {
  if (typeof window === "undefined") return [];

  try {
    const rawHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!rawHistory) return [];

    const parsedHistory = JSON.parse(rawHistory) as ChatHistory[];
    if (!Array.isArray(parsedHistory)) return [];

    return parsedHistory
      .filter(
        (item) =>
          (item.role === "player" || item.role === "advisor") &&
          typeof item.content === "string" &&
          typeof item.timestamp === "number",
      )
      .slice(-MAX_HISTORY_COUNT);
  } catch {
    return [];
  }
}

export function saveHistory(history: ChatHistory[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    HISTORY_STORAGE_KEY,
    JSON.stringify(history.slice(-MAX_HISTORY_COUNT)),
  );
}

export function appendMessage(history: ChatHistory[], message: ChatHistory): ChatHistory[] {
  const nextHistory = [...history, message].slice(-MAX_HISTORY_COUNT);
  saveHistory(nextHistory);
  return nextHistory;
}

function createMessage(history: ChatHistory, index: number): ChatMessage {
  return {
    ...history,
    id: index + 1,
    answer: history.role === "advisor" ? contentToAnswer(history.content) : undefined,
  };
}

export function mockAdvisorAnswer(question: string, history: ChatHistory[] = []): AdvisorAnswer {
  return generateAdvisorAnswer(question, getPlayerState(), getHeroes(), history);
}

const mockAdvisorApi: AdvisorApi = {
  ask: async (question, history, playerState) => {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return advisorProvider.answer(question, history, playerState);
  },
};

const initialAnswerContent = answerToContent({
    conclusion: "议事厅优先级最高，前期开荒应优先升级。",
    reason: "议事厅影响坞堡等级、科技上限和领地上限，是整体发展的根基。",
    steps: ["保证木材、石料与粮草供给。", "议事厅满足条件时优先升。", "同步补足仓库与关键资源建筑。"],
    risks: ["资源不足时硬升会卡住兵力恢复。", "忽视议事厅会导致科技与领地扩张受限。"],
  });
const initialHistory: ChatHistory[] = [
  { role: "player", content: "我现在该先升什么建筑？", timestamp: Date.now() - 1000 },
  { role: "advisor", content: initialAnswerContent, timestamp: Date.now() },
];

function AdvisorPage({ embedded = false }: { embedded?: boolean }) {
  const [activeSection, setActiveSection] = useState<AdvisorSection>("home");
  const [activeCategory, setActiveCategory] = useState<AdvisorCategory>("新手开荒");
  const [activeTopTab, setActiveTopTab] = useState("今日军令");
  const [input, setInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const hasUserAskedRef = useRef(false);
  const [playerState, setPlayerState] = useState<PlayerState>(() => getPlayerState());
  const [editingPlayerState, setEditingPlayerState] = useState<PlayerState>(() => getPlayerState());
  const [isEditingMilitary, setIsEditingMilitary] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const restoredHistory = loadHistory();
    const usableHistory = restoredHistory.length > 0 ? restoredHistory : initialHistory;
    if (restoredHistory.length === 0) saveHistory(usableHistory);
    return usableHistory.map(createMessage);
  });
  const activeNavView = navViewMock[activeSection];
  const displayedDailyOrders = activeNavView.orders ?? generateDailyOrders(playerState);

  function scrollMainContentToBottom(behavior: ScrollBehavior = "smooth") {
    if (!hasUserAskedRef.current) return;

    requestAnimationFrame(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior });
    });
  }

  async function submitQuestion(question: string, shouldAutoScroll = false) {
    const trimmed = question.trim();
    if (!trimmed) return;

    if (shouldAutoScroll) hasUserAskedRef.current = true;

    const playerMessage: ChatHistory = {
      role: "player",
      content: trimmed,
      timestamp: Date.now(),
    };
    const historyBeforeAnswer = appendMessage(
      messages.map(({ role, content, timestamp }) => ({ role, content, timestamp })),
      playerMessage,
    );

    setInput("");
    setMessages(historyBeforeAnswer.map(createMessage));
    scrollMainContentToBottom();

    const answerContent = await mockAdvisorApi.ask(trimmed, historyBeforeAnswer, playerState);
    const advisorMessage: ChatHistory = {
      role: "advisor",
      content: answerContent,
      timestamp: Date.now(),
    };
    const historyAfterAnswer = appendMessage(historyBeforeAnswer, advisorMessage);
    setMessages(historyAfterAnswer.map(createMessage));
    scrollMainContentToBottom();
    if (shouldAutoScroll) {
      requestAnimationFrame(() => {
        hasUserAskedRef.current = false;
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input.trim() || activeNavView.placeholder, true);
  }

  function openMilitaryEditor() {
    setEditingPlayerState(playerState);
    setIsEditingMilitary(true);
  }

  function updateEditingField(key: keyof PlayerState, value: string) {
    setEditingPlayerState((current) => ({
      ...current,
      [key]: key === "season" ? value : key === "ownedHeroes" ? parseOwnedHeroes(value) : Number(value),
    }));
  }

  function handleMilitarySave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updatedState = updatePlayerState(editingPlayerState);
    setPlayerState(updatedState);
    setIsEditingMilitary(false);
  }

  function handleBack() {
    // TODO: 后续由游戏接入层实现返回主界面逻辑。
  }

  useEffect(() => {
    if (!embedded) return;

    const params = new URLSearchParams(window.location.search);
    console.log("忆山河 AI军师 WebView 参数", {
      playerId: params.get("playerId"),
      stage: params.get("stage"),
      channel: params.get("channel"),
    });
  }, [embedded]);

  useEffect(() => {
    if (!hasUserAskedRef.current) return;
    scrollMainContentToBottom();
  }, [messages.length]);

  return (
    <main
      className={`flex h-screen w-screen items-center justify-center overflow-hidden bg-[#172536] text-[#edf2f7] ${
        embedded ? "p-0" : "p-3"
      }`}
    >
      <section
        className={`relative aspect-video h-full w-full overflow-hidden border border-[#d2c08b]/32 bg-[#263b52] shadow-2xl shadow-[#0d1722]/55 ${
          embedded
            ? "max-h-screen max-w-[calc(100vh*16/9)]"
            : "max-h-[calc(100vh-24px)] max-w-[calc((100vh-24px)*16/9)]"
        }`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(232,238,246,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(232,238,246,0.042)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_12%,rgba(150,169,190,0.18),transparent_36%),linear-gradient(135deg,rgba(27,43,62,0.82),rgba(57,79,101,0.58)_48%,rgba(22,39,58,0.78))]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.055),transparent_28%,rgba(255,255,255,0.035)_58%,transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d8c993]/70 to-transparent" />

        <div className="relative grid h-full grid-rows-[42px_1fr]">
          <header className="flex items-center justify-between border-b border-[#d8c993]/24 bg-[#5f7185]/38 px-5 text-[#edf2f7] shadow-sm shadow-[#172536]/20 backdrop-blur-md">
            <div className="ml-7 flex items-center">
              <h1
                className="text-[28px] font-bold leading-none tracking-[1px] text-[#f0dfaa]"
                style={{ textShadow: "0 1px 0 rgba(255,255,255,0.25), 0 2px 6px rgba(0,0,0,0.45)" }}
              >
                军师府
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#c6ced8]">
              <span className="border border-[#d8c993]/14 bg-[#2f4256]/24 px-2 py-0.5 text-[11px] leading-none text-[#cbd5df]">策略推演中</span>
              <button
                aria-label="返回游戏主界面"
                className="group ml-10 grid h-10 w-20 place-items-center bg-transparent text-[#cdb679] drop-shadow-[0_1px_0_rgba(74,55,25,0.62)] transition hover:text-[#e2cc8b] hover:drop-shadow-[0_0_5px_rgba(216,190,118,0.28)]"
                onClick={handleBack}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="h-8 w-14 overflow-visible"
                  fill="none"
                  viewBox="0 0 96 54"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="backArrowGold" x1="17" x2="82" y1="10" y2="41" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#E6D49C" />
                      <stop offset="0.42" stopColor="#BFA765" />
                      <stop offset="1" stopColor="#6E5528" />
                    </linearGradient>
                    <linearGradient id="backArrowEdge" x1="12" x2="80" y1="6" y2="48" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#D8C58C" />
                      <stop offset="1" stopColor="#58411D" />
                    </linearGradient>
                    <filter id="backArrowGlow" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" x="0" y="0" width="96" height="54">
                      <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#C8AB63" floodOpacity="0.18" />
                      <feDropShadow dx="0" dy="1.4" stdDeviation="0.35" floodColor="#4B3517" floodOpacity="0.55" />
                    </filter>
                  </defs>
                  <path
                    d="M80 11H36.5L48.8 22.6L42.5 29.1L18 26.8L41.9 7.5L48.4 14.2L39.2 19.7H80C84.8 19.7 88.5 23.4 88.5 28.1C88.5 32.8 84.8 36.5 80 36.5H43.5L50.9 43.5L44.1 49.5L21.6 31.6H80C82 31.6 83.5 30.1 83.5 28.1C83.5 26.1 82 24.6 80 24.6H25.2L18 26.8L25.2 24.6L42.4 10.7L36.5 11H80Z"
                    fill="url(#backArrowGold)"
                    filter="url(#backArrowGlow)"
                    stroke="url(#backArrowEdge)"
                    strokeLinejoin="round"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M78 14.8H45.8M39.2 15.2L26.8 25.1M78 34.1H48.6M42.4 44.1L28.7 33.2"
                    stroke="#F0DEAA"
                    strokeLinecap="round"
                    strokeOpacity="0.36"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            </div>
          </header>

          <div className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)_260px] gap-3 p-3">
            <aside className="ysh-panel flex min-h-0 flex-col p-2 text-[#d9e0e8]">
              <div className="mb-2 border-b border-[#d8c993]/18 pb-2 text-center text-[11px] tracking-[0.16em] text-[#e4d29d]">
                军师导航
              </div>
              <nav className="scrollbar-ancient min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {navItems.map((item) => (
                  <button
                    className={`flex h-[60px] w-full items-center gap-3 border-l-2 border-y-0 border-r-0 px-3 text-left text-[18px] leading-none transition ${
                      activeSection === item.section
                        ? "border-[#d8c993] bg-gradient-to-r from-[#d7c38b]/22 via-[#8d9aaa]/14 to-transparent text-white"
                        : "border-transparent bg-transparent text-[#c5ced8] hover:border-[#d8c993]/35 hover:bg-[#607589]/18 hover:text-white"
                    }`}
                    key={item.label}
                    onClick={() => {
                      setActiveSection(item.section);
                      setActiveCategory(item.category);
                    }}
                    type="button"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center text-sm text-[#d8c993]">
                      {item.icon}
                    </span>
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <section className="ysh-panel grid min-h-0 grid-rows-[82px_1fr_64px]">
              <div className="border-b border-[#d8c993]/18 bg-[#7f91a3]/18 px-4 py-2.5">
                <div className="mb-2 text-left">
                  <div className="whitespace-nowrap text-sm leading-none text-[#d8c993]">
                    当前问策：<span className="font-semibold text-[#ead69d]">{activeNavView.title}</span>
                  </div>
                </div>
                <div className="flex h-9 items-center gap-2 overflow-hidden">
                  {topTabs.map((action) => (
                    <button
                      className={`flex h-9 items-center whitespace-nowrap border px-3 text-[14px] leading-none transition ${
                        activeTopTab === action
                          ? "border-[#d8c993]/50 bg-[#d2c08b]/10 font-semibold text-white"
                          : "border-[#d8c993]/14 bg-[#596f84]/18 text-[#d9e0e8] hover:border-[#d8c993]/34 hover:text-white"
                      }`}
                      key={action}
                      onClick={() => {
                        setActiveTopTab(action);
                        if (action !== "今日军令") void submitQuestion(action);
                      }}
                      type="button"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              <div className="scrollbar-ancient min-h-0 overflow-y-auto p-4" ref={scrollContainerRef}>
                <div className="space-y-3">
                  <DailyOrdersCard orders={displayedDailyOrders} />
                  {messages.map((message) =>
                    message.role === "player" ? (
                      <div className="flex justify-end" key={message.id}>
                        <div className="max-w-[70%] border border-[#d8c993]/34 bg-[#d2c08b]/14 px-4 py-2.5 text-sm leading-6 text-[#f3e4b8] shadow">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <AdvisorCard answer={message.answer} key={message.id} />
                    ),
                  )}
                </div>
              </div>

              <form
                className="mx-4 mb-2 flex min-w-0 items-center gap-2.5 bg-[#334960]/52 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-4px_10px_rgba(10,22,34,0.22)] backdrop-blur-sm"
                onSubmit={handleSubmit}
              >
                <div className="w-[92px] shrink-0 text-[15px] font-semibold leading-none text-[#ead69d]">向军师问策：</div>
                <input
                  className="h-11 min-w-0 flex-1 border border-[#d8c993]/62 bg-[#263d55]/78 px-4 text-[15px] text-[#f2f6fb] outline-none placeholder:text-[#d9e0e8]/70 shadow-[inset_0_2px_8px_rgba(8,18,30,0.32)] focus:border-[#ead69d]/90 focus:ring-2 focus:ring-[#d8c993]/22"
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={activeNavView.placeholder}
                  value={input}
                />
                <button
                  className="h-11 w-[120px] shrink-0 border border-[#f0dca7]/70 bg-gradient-to-b from-[#f0dca7] via-[#bba366] to-[#71643f] text-[15px] font-semibold text-[#fff6cf] shadow-[inset_0_2px_0_rgba(255,255,255,0.34),inset_0_-6px_12px_rgba(82,62,24,0.24),0_4px_11px_rgba(0,0,0,0.3)] transition hover:from-[#fff0bf] hover:via-[#c8af6e] hover:to-[#7c6c43] active:translate-y-px"
                  type="submit"
                >
                  请教军师
                </button>
              </form>
            </section>

            <aside className="ysh-panel grid min-h-0 grid-rows-[auto_auto_1fr] p-3 text-[#d9e0e8]">
              <div className="border-b border-[#d8c993]/18 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs tracking-[0.2em] text-[#ead69d]">军情概览</div>
                  <button
                    className="border border-[#d8c993]/30 bg-[#596f84]/34 px-2 py-1 text-xs text-[#ead69d] transition hover:bg-[#d2c08b]/14"
                    onClick={openMilitaryEditor}
                    type="button"
                  >
                    修改军情
                  </button>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-xs leading-none text-[#c5ced8]">军情阶段</div>
                    <div className="mt-1 text-lg font-semibold leading-none text-[#ead69d]">{militaryPanel.stage}</div>
                  </div>
                  <span className="border border-[#d8c993]/30 bg-[#d2c08b]/12 px-2 py-1 text-xs text-[#e6d29b]">需谨慎</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <InfoBadge label="议事厅等级" value={`${playerState.hallLevel}级`} />
                <InfoBadge label="声望" value={playerState.prestige.toLocaleString("zh-CN")} />
                <InfoBadge label="领地数量" value={`${playerState.territoryCount}块`} />
                <InfoBadge label="主力战力" value={playerState.mainTroopPower.toLocaleString("zh-CN")} />
                <InfoBadge label="当前季节" value={playerState.season} />
                <InfoBadge label="部曲数量" value={`${playerState.troopCount}队`} />
                <InfoBadge label="已有英雄" value={`${playerState.ownedHeroes.length}名`} />
              </div>

              <div className="scrollbar-ancient min-h-0 overflow-y-auto pr-1">
                <PanelGroup title="推荐目标" items={militaryPanel.targets} tone="target" />
                <PanelGroup title="风险提醒" items={militaryPanel.risks} tone="risk" />

                <div className="mt-4 border border-[#d8c993]/18 bg-[#40566c]/24 p-3 text-xs leading-5 text-[#d4dbe4]">
                  沙盘判读：先固本营，再争外势。主力未稳时，不宜多线出征。
                </div>

                <div className="mt-3 border border-[#d8c993]/18 bg-[#40566c]/24 p-3 text-xs leading-5 text-[#d4dbe4]">
                  快捷问策可直接唤起对应建议，后续可与游戏内建筑、部曲、天气状态联动。
                </div>
              </div>
            </aside>
          </div>
        </div>

        {isEditingMilitary ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#09111c]/72 px-8">
            <form
              className="ysh-panel w-full max-w-3xl p-4 text-[#d7dee8] shadow-2xl shadow-black/60"
              onSubmit={handleMilitarySave}
            >
              <div className="mb-4 flex items-center justify-between border-b border-[#c7b277]/25 pb-3">
                <div>
                  <div className="text-xs tracking-[0.2em] text-[#c7b277]">军情校阅</div>
                  <div className="mt-1 text-lg font-semibold text-[#ead69d]">修改军情</div>
                </div>
                <button
                  className="border border-[#d8c993]/24 bg-[#40566c]/30 px-3 py-1.5 text-sm text-[#c6ced8] transition hover:bg-[#607589]/36"
                  onClick={() => setIsEditingMilitary(false)}
                  type="button"
                >
                  取消
                </button>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {playerStateFields.map((field) => (
                  <label
                    className={`text-xs text-[#c7b277] ${field.key === "ownedHeroes" ? "col-span-5" : ""}`}
                    key={field.key}
                  >
                    <span className="mb-1 block">{field.label}</span>
                    <input
                      className="h-9 w-full border border-[#d8c993]/30 bg-[#5f7185]/34 px-2 text-sm text-[#edf2f7] outline-none focus:border-[#d8c993]/60 focus:ring-2 focus:ring-[#d8c993]/16"
                      min={field.type === "number" ? 0 : undefined}
                      onChange={(event) => updateEditingField(field.key, event.target.value)}
                      type={field.type}
                      value={formatPlayerStateField(editingPlayerState, field.key)}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#c7b277]/20 pt-3">
                <div className="text-xs leading-5 text-[#c6ced8]">
                  保存后会立即更新军情面板，并作为下一次问策的判断依据。
                </div>
                <button
                  className="border border-[#d8c993]/46 bg-gradient-to-b from-[#9f9880] to-[#6f6d63] px-6 py-2 text-sm font-semibold text-[#f7e9bd] shadow transition hover:from-[#b4aa8b] hover:to-[#7b7666] active:translate-y-px"
                  type="submit"
                >
                  保存军情
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}

type AdminKnowledgeItem = {
  id: string;
  title: string;
  category: string;
  keywords?: string[];
  content?: string;
  summary?: string;
  conclusion?: string;
  reason?: string;
  steps?: string[];
  risk?: string[];
};

type AdminKnowledgeGroup = {
  id: string;
  label: string;
  items: AdminKnowledgeItem[];
};

const adminKnowledgeGroups: AdminKnowledgeGroup[] = [
  { id: "hero", label: "Hero", items: heroKnowledge as AdminKnowledgeItem[] },
  { id: "troop", label: "Troop", items: troopKnowledge as AdminKnowledgeItem[] },
  { id: "building", label: "Building", items: buildingKnowledge as AdminKnowledgeItem[] },
  { id: "combat", label: "Combat", items: combatKnowledge as AdminKnowledgeItem[] },
  { id: "resource", label: "Resource", items: resourceKnowledge as AdminKnowledgeItem[] },
  { id: "unlock", label: "Unlock", items: unlockKnowledge as AdminKnowledgeItem[] },
];

const adminKnowledgeCount = adminKnowledgeGroups.reduce((total, group) => total + group.items.length, 0);

function AdminKnowledgeManager({ onBack }: { onBack: () => void }) {
  const [activeGroupId, setActiveGroupId] = useState(adminKnowledgeGroups[0]?.id ?? "");
  const [selectedItemId, setSelectedItemId] = useState(adminKnowledgeGroups[0]?.items[0]?.id ?? "");
  const [searchText, setSearchText] = useState("");

  const activeGroup = adminKnowledgeGroups.find((group) => group.id === activeGroupId) ?? adminKnowledgeGroups[0];
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredItems = activeGroup.items.filter((item) => {
    if (!normalizedSearch) return true;

    const searchableText = [
      item.title,
      item.category,
      item.summary,
      item.content,
      item.conclusion,
      item.reason,
      ...(item.keywords ?? []),
      ...(item.steps ?? []),
      ...(item.risk ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  });
  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? activeGroup.items[0];

  function handleGroupChange(group: AdminKnowledgeGroup) {
    setActiveGroupId(group.id);
    setSelectedItemId(group.items[0]?.id ?? "");
  }

  return (
    <section className="mt-6 border border-[#d8c993]/20 bg-[#31465b]/72 p-4 shadow-lg shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#c7b277]/20 pb-4">
        <div>
          <div className="text-xs tracking-[0.2em] text-[#c7b277]">知识库管理</div>
          <h2 className="mt-1 text-xl font-semibold text-[#ead69d]">规则情报只读总览</h2>
          <p className="mt-1 text-xs text-[#c6ced8]">当前仅支持查看与检索，不提供新增、编辑、删除。</p>
        </div>
        <button
          className="h-9 border border-[#d8c993]/28 bg-[#52687d]/22 px-4 text-sm text-[#d7dee8] transition hover:border-[#d8c993]/48 hover:text-white"
          onClick={onBack}
          type="button"
        >
          返回后台首页
        </button>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <input
          className="h-10 flex-1 border border-[#d8c993]/30 bg-[#24384d]/70 px-3 text-sm text-[#edf2f7] outline-none placeholder:text-[#aeb8c4] focus:border-[#d8c993]/65 focus:ring-2 focus:ring-[#d8c993]/14"
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="搜索 title / category / keywords / content"
          value={searchText}
        />
        <div className="flex h-10 items-center border border-[#d8c993]/20 bg-[#263b50]/58 px-4 text-sm text-[#c6ced8]">
          总记录数：<span className="ml-2 font-semibold text-[#ead69d]">{adminKnowledgeCount}</span>
        </div>
      </div>

      <div className="grid min-h-[520px] grid-cols-[190px_320px_minmax(0,1fr)] gap-4">
        <aside className="border border-[#d8c993]/16 bg-[#263b50]/62 p-2">
          <div className="mb-2 px-2 text-xs tracking-[0.16em] text-[#c7b277]">分类导航</div>
          <div className="space-y-2">
            {adminKnowledgeGroups.map((group) => {
              const isActive = group.id === activeGroup.id;

              return (
                <button
                  className={`flex h-12 w-full items-center justify-between border px-3 text-left text-sm transition ${
                    isActive
                      ? "border-[#d8c993]/50 bg-[#6e6545]/34 text-white"
                      : "border-[#d8c993]/12 bg-[#4d6378]/18 text-[#c6ced8] hover:border-[#d8c993]/32 hover:text-white"
                  }`}
                  key={group.id}
                  onClick={() => handleGroupChange(group)}
                  type="button"
                >
                  <span className="font-semibold">{group.label}</span>
                  <span className="text-xs text-[#ead69d]">{group.items.length}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="border border-[#d8c993]/16 bg-[#263b50]/52 p-3">
          <div className="mb-3 flex items-end justify-between border-b border-[#c7b277]/16 pb-2">
            <div>
              <div className="text-sm font-semibold text-[#ead69d]">{activeGroup.label}</div>
              <div className="mt-1 text-xs text-[#aeb8c4]">
                当前分类记录：{filteredItems.length} / {activeGroup.items.length}
              </div>
            </div>
          </div>

          <div className="max-h-[450px] space-y-2 overflow-y-auto pr-1">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;

                return (
                  <button
                    className={`w-full border p-3 text-left transition ${
                      isSelected
                        ? "border-[#d8c993]/50 bg-[#596f84]/36"
                        : "border-[#d8c993]/12 bg-[#40566c]/22 hover:border-[#d8c993]/30 hover:bg-[#52687d]/26"
                    }`}
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    type="button"
                  >
                    <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="truncate text-[#c7b277]">{item.category}</span>
                      <span className="text-[#c6ced8]">关键词 {item.keywords?.length ?? 0}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="border border-[#d8c993]/12 bg-[#40566c]/18 p-4 text-sm text-[#c6ced8]">未找到匹配记录。</div>
            )}
          </div>
        </section>

        <article className="border border-[#d8c993]/16 bg-[#263b50]/58 p-4">
          {selectedItem ? (
            <div className="space-y-4">
              <div className="border-b border-[#c7b277]/16 pb-3">
                <div className="text-xs tracking-[0.16em] text-[#c7b277]">条目详情</div>
                <h3 className="mt-2 text-xl font-semibold text-[#ead69d]">{selectedItem.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="border border-[#d8c993]/20 bg-[#52687d]/24 px-2 py-1 text-[#d7dee8]">
                    类型：{selectedItem.category}
                  </span>
                  <span className="border border-[#d8c993]/20 bg-[#52687d]/24 px-2 py-1 text-[#d7dee8]">
                    ID：{selectedItem.id}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-[#ead69d]">关键词</div>
                <div className="flex flex-wrap gap-2">
                  {(selectedItem.keywords ?? []).length > 0 ? (
                    selectedItem.keywords?.map((keyword) => (
                      <span className="border border-[#d8c993]/18 bg-[#6e6545]/22 px-2 py-1 text-xs text-[#edf2f7]" key={keyword}>
                        {keyword}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[#aeb8c4]">暂无关键词</span>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-[#ead69d]">摘要</div>
                <p className="border border-[#d8c993]/12 bg-[#40566c]/18 p-3 text-sm leading-6 text-[#d7dee8]">
                  {selectedItem.summary || selectedItem.conclusion || "暂无摘要"}
                </p>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-[#ead69d]">原文内容</div>
                <div className="max-h-[220px] overflow-y-auto whitespace-pre-wrap border border-[#d8c993]/12 bg-[#1f3246]/46 p-3 text-sm leading-6 text-[#d7dee8]">
                  {selectedItem.content || selectedItem.reason || "暂无内容"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-2 text-sm font-semibold text-[#ead69d]">步骤</div>
                  <div className="min-h-24 border border-[#d8c993]/12 bg-[#40566c]/18 p-3 text-sm leading-6 text-[#d7dee8]">
                    {(selectedItem.steps ?? []).length > 0 ? (
                      <ol className="list-decimal space-y-1 pl-4">
                        {selectedItem.steps?.map((step) => <li key={step}>{step}</li>)}
                      </ol>
                    ) : (
                      <span className="text-[#aeb8c4]">暂无步骤</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold text-[#ead69d]">风险</div>
                  <div className="min-h-24 border border-[#d8c993]/12 bg-[#40566c]/18 p-3 text-sm leading-6 text-[#d7dee8]">
                    {(selectedItem.risk ?? []).length > 0 ? (
                      <ul className="list-disc space-y-1 pl-4">
                        {selectedItem.risk?.map((risk) => <li key={risk}>{risk}</li>)}
                      </ul>
                    ) : (
                      <span className="text-[#aeb8c4]">暂无风险</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#c6ced8]">请选择一条知识记录。</div>
          )}
        </article>
      </div>
    </section>
  );
}

function AdminPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem("ysh_admin_authed") === "true");
  const [error, setError] = useState("");
  const [adminView, setAdminView] = useState<"home" | "knowledge">("home");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: 正式上线必须改为后端鉴权，前端硬编码密码仅用于 Demo。
    if (account === "ysh_admin" && password === "YSH@2026#Advisor!88") {
      localStorage.setItem("ysh_admin_authed", "true");
      setLoggedIn(true);
      setError("");
      return;
    }

    setError("账号或密码不正确");
  }

  function handleLogout() {
    localStorage.removeItem("ysh_admin_authed");
    setLoggedIn(false);
    setAdminView("home");
    setAccount("");
    setPassword("");
    setError("");
  }

  if (loggedIn) {
    return (
      <main className="min-h-screen bg-[#2c3e52] p-8 text-[#d7dee8]">
        <section className="ysh-panel mx-auto max-w-7xl p-6">
          <div className="border-b border-[#c7b277]/25 pb-4">
            <div className="text-xs tracking-[0.22em] text-[#c7b277]">忆山河</div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <h1 className="text-2xl font-semibold text-[#ead69d]">AI军师后台管理</h1>
              <button
                className="h-9 border border-[#d8c993]/28 bg-[#52687d]/22 px-4 text-sm text-[#d7dee8] transition hover:border-[#d8c993]/48 hover:text-white"
                onClick={handleLogout}
                type="button"
              >
                退出登录
              </button>
            </div>
          </div>

          {adminView === "home" ? (
            <div className="mt-6 grid grid-cols-4 gap-4">
              {[
                {
                  title: "知识库管理",
                  text: `已接入 ${adminKnowledgeCount} 条知识，支持只读检索。`,
                  action: () => setAdminView("knowledge"),
                },
                { title: "英雄库管理", text: "静态占位，后续接入管理接口。" },
                { title: "玩家状态模拟", text: "静态占位，后续接入管理接口。" },
                { title: "问答日志", text: "静态占位，后续接入管理接口。" },
              ].map((item) => (
                <button
                  className="min-h-32 border border-[#d8c993]/18 bg-[#52687d]/22 p-4 text-left text-sm text-[#d7dee8] transition hover:border-[#d8c993]/40 hover:bg-[#596f84]/32"
                  key={item.title}
                  onClick={item.action}
                  type="button"
                >
                  <div className="text-lg font-semibold text-[#ead69d]">{item.title}</div>
                  <div className="mt-3 text-xs leading-5 text-[#c6ced8]">{item.text}</div>
                </button>
              ))}
            </div>
          ) : (
            <AdminKnowledgeManager onBack={() => setAdminView("home")} />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#2c3e52] p-6 text-[#d7dee8]">
      <form
        className="ysh-panel w-full max-w-sm p-6"
        onSubmit={handleLogin}
      >
        <div className="mb-5 border-b border-[#c7b277]/25 pb-4">
          <div className="text-xs tracking-[0.22em] text-[#c7b277]">后台入口</div>
          <h1 className="mt-2 text-xl font-semibold text-[#ead69d]">AI军师后台登录</h1>
        </div>

        <label className="mb-3 block text-sm text-[#c7b277]">
          账号
          <input
            className="mt-1 h-10 w-full border border-[#d8c993]/30 bg-[#5f7185]/34 px-3 text-[#edf2f7] outline-none focus:border-[#d8c993]/60 focus:ring-2 focus:ring-[#d8c993]/16"
            onChange={(event) => setAccount(event.target.value)}
            value={account}
          />
        </label>

        <label className="mb-4 block text-sm text-[#c7b277]">
          密码
          <input
            className="mt-1 h-10 w-full border border-[#d8c993]/30 bg-[#5f7185]/34 px-3 text-[#edf2f7] outline-none focus:border-[#d8c993]/60 focus:ring-2 focus:ring-[#d8c993]/16"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>

        {error ? <div className="mb-3 text-sm text-[#e9d39a]">{error}</div> : null}

        <button
          className="h-10 w-full border border-[#d8c993]/46 bg-gradient-to-b from-[#9f9880] to-[#6f6d63] font-semibold text-[#f7e9bd] shadow transition hover:from-[#b4aa8b] hover:to-[#7b7666]"
          type="submit"
        >
          登录
        </button>
      </form>
    </main>
  );
}

function HealthPage() {
  const payload = {
    status: "ok",
    service: "ysh-ai-advisor",
    time: new Date().toISOString(),
  };

  return (
    <pre className="m-0 min-h-screen bg-white p-4 text-sm text-black">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

export default function App() {
  const path = window.location.pathname;

  if (path === "/") {
    window.location.replace("/advisor");
    return null;
  }

  if (path === "/advisor") return <AdvisorPage />;
  if (path === "/embed/advisor") return <AdvisorPage embedded />;
  if (path === "/admin") return <AdminPage />;
  if (path === "/api/health") return <HealthPage />;

  return <AdvisorPage />;
}

function AdvisorCard({ answer }: { answer?: AdvisorAnswer }) {
  if (!answer) return null;

  return (
    <div className="max-w-[86%]">
      <div className="ysh-panel-soft p-3 text-sm shadow">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#ead69d]/82">
          <span className="border border-[#d8c993]/24 bg-[#596f84]/28 px-1.5 py-0 text-[11px] text-[#ead69d]/78">
            军令分析
          </span>
          <span className="text-[#d8c993]/68">问策回奏</span>
        </div>
        <AnswerSection title="结论" content={answer.conclusion} />
        <AnswerSection title="原因" content={answer.reason} />
        <AnswerSection title="操作步骤" items={answer.steps} />
        <AnswerSection title="风险提醒" items={answer.risks} />
      </div>
    </div>
  );
}

function DailyOrdersCard({ orders }: { orders: DailyOrder[] }) {
  return (
    <div className="ysh-panel-soft ysh-corner border-[#d8c993]/30 bg-[#1f3349]/70 p-3 text-sm text-[#d9e0e8] shadow-[0_8px_22px_rgba(6,14,24,0.24)]">
      <div className="mb-4 flex items-center justify-between border-b border-[#d8c993]/18 pb-2">
        <div className="flex items-center gap-2">
          <span className="border border-[#d8c993]/36 bg-[#596f84]/42 px-2 py-0.5 text-xs font-semibold text-[#ead69d]">
            令
          </span>
          <span className="font-semibold text-[#ead69d]">今日军令</span>
        </div>
        <span className="text-xs text-[#c5ced8]">据当前军情自动生成</span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {orders.map((order, index) => (
          <div
            className="grid grid-cols-[72px_1fr_132px] items-center gap-5 border border-[#d8c993]/24 bg-gradient-to-r from-[#344d66]/62 to-[#20364f]/70 p-5 shadow-sm shadow-[#06101c]/28"
            key={order.task}
          >
            <div className="grid h-16 w-16 place-items-center border border-[#d8c993]/26 bg-[#40566c]/36 text-2xl text-[#ead69d] shadow-inner">
              {dailyOrderIcons[index % dailyOrderIcons.length]}
            </div>
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-3">
                <div className="truncate text-[22px] font-semibold leading-none text-[#f0dca7]">{order.task}</div>
                <div className="shrink-0 text-lg leading-none text-[#e2c983]">
                  {"★★★★★".slice(0, order.priority === "最高" ? 5 : order.priority === "高" ? 4 : 3)}
                  <span className="text-[#9aa8b7]">
                    {"★★★★★".slice(order.priority === "最高" ? 5 : order.priority === "高" ? 4 : 3)}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-[15px] leading-6">
                <div className="truncate text-[#eef3f8]">原因：{order.reason}</div>
                <div className="truncate text-[#e7cda0]">风险：{order.risk}</div>
                <div className="truncate text-[#dce4ed]">收益：{order.benefit}</div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-4">
              <span
                className={`border px-3 py-1.5 text-sm ${
                  order.priority === "最高"
                    ? "border-[#d8c993]/46 bg-[#d2c08b]/16 text-[#ead69d]"
                    : order.priority === "高"
                      ? "border-[#d8c993]/30 bg-[#5f7185]/34 text-[#e6d29b]"
                      : "border-[#cbd5df]/24 bg-[#40566c]/28 text-[#d9e0e8]"
                }`}
              >
                优先级：{order.priority}
              </span>
              <button
                className="h-10 w-24 border border-[#d8c993]/38 bg-gradient-to-b from-[#9b9582]/78 to-[#676b67]/78 text-lg font-semibold text-[#f7e9bd] shadow transition hover:from-[#b0a78b] hover:to-[#747366]"
                type="button"
              >
                前往
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnswerSection({
  title,
  content,
  items,
}: {
  title: string;
  content?: string;
  items?: string[];
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-0.5 font-semibold text-[#ead69d]">{title}</div>
      {content ? <p className="leading-6 text-[#edf2f7]">{content}</p> : null}
      {items ? (
        <ol className="space-y-0.5 leading-6 text-[#edf2f7]">
          {items.map((item, index) => (
            <li key={item}>
              {index + 1}. {item}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d8c993]/16 bg-[#52687d]/22 px-2 py-2">
      <div className="text-[#c5ced8]">{label}</div>
      <div className="mt-1 font-semibold text-[#ead69d]">{value}</div>
    </div>
  );
}

function PanelGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "target" | "risk";
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-sm font-semibold text-[#ead69d]">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            className={`border px-3 py-2 text-sm ${
              tone === "target"
                ? "border-[#d8c993]/18 bg-[#52687d]/22 text-[#edf2f7]"
                : "border-[#d8c993]/18 bg-[#40566c]/26 text-[#e4c99b]"
            }`}
            key={item}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
