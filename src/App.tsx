import { FormEvent, useEffect, useState } from "react";
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

export type AdvisorCategory =
  | "新手开荒"
  | "英雄配将"
  | "建筑发展"
  | "部曲战斗"
  | "势力攻城"
  | "天气补给"
  | "军备兵法";

export type ChatMessage = ChatHistory & {
  id: number;
  answer?: AdvisorAnswer;
};

export type MilitaryPanel = {
  stage: string;
  targets: string[];
  risks: string[];
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

const recommendedQuestions = [
  "我现在该先升什么建筑？",
  "声望有什么用？",
  "冬季能不能远征？",
  "攻城前要准备什么？",
  "阵型应该怎么搭配？",
];

const quickActions = ["热门攻略", "智能配将", "攻城助手", "天气补给"];

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
  const [activeCategory, setActiveCategory] = useState<AdvisorCategory>("新手开荒");
  const [input, setInput] = useState("");
  const [playerState, setPlayerState] = useState<PlayerState>(() => getPlayerState());
  const [editingPlayerState, setEditingPlayerState] = useState<PlayerState>(() => getPlayerState());
  const [isEditingMilitary, setIsEditingMilitary] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const restoredHistory = loadHistory();
    const usableHistory = restoredHistory.length > 0 ? restoredHistory : initialHistory;
    if (restoredHistory.length === 0) saveHistory(usableHistory);
    return usableHistory.map(createMessage);
  });

  async function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;

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

    const answerContent = await mockAdvisorApi.ask(trimmed, historyBeforeAnswer, playerState);
    const advisorMessage: ChatHistory = {
      role: "advisor",
      content: answerContent,
      timestamp: Date.now(),
    };
    const historyAfterAnswer = appendMessage(historyBeforeAnswer, advisorMessage);
    setMessages(historyAfterAnswer.map(createMessage));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(input);
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

  useEffect(() => {
    if (!embedded) return;

    const params = new URLSearchParams(window.location.search);
    console.log("忆山河 AI军师 WebView 参数", {
      playerId: params.get("playerId"),
      stage: params.get("stage"),
      channel: params.get("channel"),
    });
  }, [embedded]);

  return (
    <main
      className={`flex h-screen w-screen items-center justify-center overflow-hidden bg-[#15100b] text-[#34210f] ${
        embedded ? "p-0" : "p-3"
      }`}
    >
      <section
        className={`relative aspect-video h-full w-full overflow-hidden border border-[#916330] bg-[#d8b574] shadow-2xl shadow-black/60 ${
          embedded
            ? "max-h-screen max-w-[calc(100vh*16/9)]"
            : "max-h-[calc(100vh-24px)] max-w-[calc((100vh-24px)*16/9)]"
        }`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(68,37,16,0.12)_1px,transparent_1px),linear-gradient(0deg,rgba(68,37,16,0.10)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,238,190,0.62),rgba(196,139,66,0.22)_55%,rgba(35,21,12,0.26))]" />
        <div className="absolute inset-x-0 top-0 h-1 bg-[#d5aa62]" />

        <div className="relative grid h-full grid-rows-[50px_1fr]">
          <header className="flex items-center justify-between border-b border-[#80582d]/70 bg-[#4a2b17]/92 px-5 text-[#f7e0ad]">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center border border-[#dfb56f] bg-[#9d2e22] text-lg font-semibold text-[#ffe1a0] shadow-inner">
                谋
              </span>
              <h1 className="text-lg font-semibold tracking-[0.16em]">忆山河 · AI智能军师</h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#e7ca91]">
              <span>军师府</span>
              <span className="h-1 w-1 rounded-full bg-[#e7ca91]" />
              <span>战局推演中</span>
            </div>
          </header>

          <div className="grid min-h-0 grid-cols-[138px_minmax(0,1fr)_260px] gap-3 p-3">
            <aside className="flex min-h-0 flex-col border border-[#8c6131]/75 bg-[#5a351c]/88 p-2 text-[#f4daa3] shadow-lg">
              <div className="mb-2 border-b border-[#d8ad68]/35 pb-2 text-center text-xs tracking-[0.18em] text-[#ffd998]">
                军略
              </div>
              <nav className="min-h-0 flex-1 space-y-1.5">
                {categories.map((category) => (
                  <button
                    className={`h-9 w-full border px-2 text-left text-xs transition ${
                      activeCategory === category
                        ? "border-[#f0c270] bg-[#ad3f28] text-[#fff0c5] shadow"
                        : "border-[#b4864a]/35 bg-[#2f1c10]/45 text-[#e8c98e] hover:border-[#e4b66f] hover:bg-[#5b3219]"
                    }`}
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    type="button"
                  >
                    {category}
                  </button>
                ))}
              </nav>
            </aside>

            <section className="grid min-h-0 grid-rows-[62px_1fr_64px] border border-[#9b6d38]/75 bg-[#edd49a]/84 shadow-lg">
              <div className="flex items-center justify-between border-b border-[#9b6d38]/50 bg-[#c79755]/42 px-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center border border-[#8a5c2b] bg-[#4a2b17] text-xl text-[#ffe0a3] shadow-inner">
                    师
                  </div>
                  <div>
                    <div className="text-xs text-[#73451e]">当前问策 · {activeCategory}</div>
                    <div className="text-sm font-semibold text-[#3b2415]">军师以结论 / 原因 / 操作步骤 / 风险提醒呈报</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {quickActions.map((action) => (
                    <button
                      className="border border-[#8e612f]/55 bg-[#f3dca4]/68 px-2.5 py-1.5 text-xs text-[#5c3418] transition hover:bg-[#fff0bf]"
                      key={action}
                      onClick={() => void submitQuestion(action)}
                      type="button"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              <div className="scrollbar-ancient min-h-0 overflow-y-auto p-4">
                <div className="space-y-3">
                  {messages.map((message) =>
                    message.role === "player" ? (
                      <div className="flex justify-end" key={message.id}>
                        <div className="max-w-[70%] border border-[#9f6f35] bg-[#7c2d22] px-4 py-2.5 text-sm leading-6 text-[#ffedc4] shadow">
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
                className="flex items-center gap-3 border-t border-[#9b6d38]/55 bg-[#4a2c18]/92 px-4"
                onSubmit={handleSubmit}
              >
                <input
                  className="h-10 flex-1 border border-[#b88649]/70 bg-[#f1d9a1] px-4 text-sm text-[#3b2415] outline-none placeholder:text-[#8a6133] focus:border-[#ffd184] focus:ring-2 focus:ring-[#ffd184]/35"
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="向军师提问：例如，我现在该先升什么建筑？"
                  value={input}
                />
                <button
                  className="h-10 border border-[#f1c879] bg-[#9d2e22] px-7 text-sm font-semibold text-[#ffe9b5] shadow transition hover:bg-[#b23b2b] active:translate-y-px"
                  type="submit"
                >
                  问策
                </button>
              </form>
            </section>

            <aside className="grid min-h-0 grid-rows-[auto_auto_1fr] border border-[#8c6131]/75 bg-[#3d2617]/90 p-3 text-[#f4daa3] shadow-lg">
              <div className="border-b border-[#d8ad68]/35 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs tracking-[0.2em] text-[#d2a963]">军情面板</div>
                  <button
                    className="border border-[#d2a963]/45 bg-[#7c4b23]/50 px-2 py-1 text-xs text-[#ffe0a3] transition hover:bg-[#9d5a2a]"
                    onClick={openMilitaryEditor}
                    type="button"
                  >
                    修改军情
                  </button>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="text-2xl font-semibold text-[#ffe0a3]">{militaryPanel.stage}</span>
                  <span className="border border-[#b95c42]/55 bg-[#5a221a]/55 px-2 py-1 text-xs text-[#ffd0b6]">需谨慎</span>
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

                <div className="mt-4 border border-[#b4864a]/35 bg-[#21140c]/45 p-3 text-xs leading-5 text-[#e6c891]">
                  沙盘判读：先固本营，再争外势。主力未稳时，不宜多线出征。
                </div>

                <div className="mt-3 border border-[#d2a963]/35 bg-[#7c4b23]/32 p-3 text-xs leading-5 text-[#f2d79f]">
                  快捷问策可直接唤起对应建议，后续可与游戏内建筑、部曲、天气状态联动。
                </div>
              </div>
            </aside>
          </div>
        </div>

        {isEditingMilitary ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#130c07]/72 px-8">
            <form
              className="w-full max-w-3xl border border-[#d2a963]/70 bg-[#3d2617]/96 p-4 text-[#f4daa3] shadow-2xl shadow-black/60"
              onSubmit={handleMilitarySave}
            >
              <div className="mb-4 flex items-center justify-between border-b border-[#d8ad68]/35 pb-3">
                <div>
                  <div className="text-xs tracking-[0.2em] text-[#d2a963]">军情校阅</div>
                  <div className="mt-1 text-lg font-semibold text-[#ffe0a3]">修改军情</div>
                </div>
                <button
                  className="border border-[#b4864a]/50 bg-[#21140c]/45 px-3 py-1.5 text-sm text-[#e6c891] transition hover:bg-[#5a351c]"
                  onClick={() => setIsEditingMilitary(false)}
                  type="button"
                >
                  取消
                </button>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {playerStateFields.map((field) => (
                  <label
                    className={`text-xs text-[#d2a963] ${field.key === "ownedHeroes" ? "col-span-5" : ""}`}
                    key={field.key}
                  >
                    <span className="mb-1 block">{field.label}</span>
                    <input
                      className="h-9 w-full border border-[#b88649]/70 bg-[#f1d9a1] px-2 text-sm text-[#3b2415] outline-none focus:border-[#ffd184] focus:ring-2 focus:ring-[#ffd184]/30"
                      min={field.type === "number" ? 0 : undefined}
                      onChange={(event) => updateEditingField(field.key, event.target.value)}
                      type={field.type}
                      value={formatPlayerStateField(editingPlayerState, field.key)}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[#d8ad68]/25 pt-3">
                <div className="text-xs leading-5 text-[#e6c891]">
                  保存后会立即更新军情面板，并作为下一次问策的判断依据。
                </div>
                <button
                  className="border border-[#f1c879] bg-[#9d2e22] px-6 py-2 text-sm font-semibold text-[#ffe9b5] shadow transition hover:bg-[#b23b2b] active:translate-y-px"
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

function AdminPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: 正式上线必须改为后端鉴权，前端硬编码密码仅用于 Demo。
    if (account === "ysh_admin" && password === "YSH@2026#Advisor!88") {
      setLoggedIn(true);
      setError("");
      return;
    }

    setError("账号或密码不正确");
  }

  if (loggedIn) {
    return (
      <main className="min-h-screen bg-[#15100b] p-8 text-[#f4daa3]">
        <section className="mx-auto max-w-5xl border border-[#916330] bg-[#3d2617]/95 p-6 shadow-2xl shadow-black/50">
          <div className="border-b border-[#d8ad68]/35 pb-4">
            <div className="text-xs tracking-[0.22em] text-[#d2a963]">忆山河</div>
            <h1 className="mt-2 text-2xl font-semibold text-[#ffe0a3]">AI军师后台管理</h1>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-4">
            {["知识库管理", "英雄库管理", "玩家状态模拟", "问答日志"].map((item) => (
              <div
                className="border border-[#d2a963]/35 bg-[#21140c]/45 p-4 text-sm text-[#f4daa3]"
                key={item}
              >
                <div className="text-lg font-semibold text-[#ffe0a3]">{item}</div>
                <div className="mt-3 text-xs leading-5 text-[#d2a963]">静态占位，后续接入管理接口。</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#15100b] p-6 text-[#f4daa3]">
      <form
        className="w-full max-w-sm border border-[#916330] bg-[#3d2617]/95 p-6 shadow-2xl shadow-black/50"
        onSubmit={handleLogin}
      >
        <div className="mb-5 border-b border-[#d8ad68]/35 pb-4">
          <div className="text-xs tracking-[0.22em] text-[#d2a963]">后台入口</div>
          <h1 className="mt-2 text-xl font-semibold text-[#ffe0a3]">AI军师后台登录</h1>
        </div>

        <label className="mb-3 block text-sm text-[#d2a963]">
          账号
          <input
            className="mt-1 h-10 w-full border border-[#b88649]/70 bg-[#f1d9a1] px-3 text-[#3b2415] outline-none focus:border-[#ffd184] focus:ring-2 focus:ring-[#ffd184]/30"
            onChange={(event) => setAccount(event.target.value)}
            value={account}
          />
        </label>

        <label className="mb-4 block text-sm text-[#d2a963]">
          密码
          <input
            className="mt-1 h-10 w-full border border-[#b88649]/70 bg-[#f1d9a1] px-3 text-[#3b2415] outline-none focus:border-[#ffd184] focus:ring-2 focus:ring-[#ffd184]/30"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>

        {error ? <div className="mb-3 text-sm text-[#ffd0b6]">{error}</div> : null}

        <button
          className="h-10 w-full border border-[#f1c879] bg-[#9d2e22] font-semibold text-[#ffe9b5] shadow transition hover:bg-[#b23b2b]"
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
    <div className="flex max-w-[86%] gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center border border-[#8a5c2b] bg-[#4a2b17] text-lg text-[#ffe0a3] shadow-inner">
        师
      </div>
      <div className="border border-[#9d6f38]/70 bg-[#f7e2af]/86 p-3 text-sm shadow">
        <div className="mb-2 flex items-center gap-2 font-semibold text-[#5a3216]">
          <span className="border border-[#a67537] bg-[#5d3519] px-2 py-0.5 text-xs text-[#ffdda1]">军师</span>
          <span>问策回奏</span>
        </div>
        <AnswerSection title="结论" content={answer.conclusion} />
        <AnswerSection title="原因" content={answer.reason} />
        <AnswerSection title="操作步骤" items={answer.steps} />
        <AnswerSection title="风险提醒" items={answer.risks} />
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
      <div className="mb-0.5 font-semibold text-[#8a2d1f]">{title}</div>
      {content ? <p className="leading-6 text-[#3f2813]">{content}</p> : null}
      {items ? (
        <ol className="space-y-0.5 leading-6 text-[#3f2813]">
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
    <div className="border border-[#d2a963]/35 bg-[#21140c]/32 px-2 py-2">
      <div className="text-[#cfa55e]">{label}</div>
      <div className="mt-1 font-semibold text-[#ffe0a3]">{value}</div>
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
      <div className="mb-2 text-sm font-semibold text-[#ffd998]">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            className={`border px-3 py-2 text-sm ${
              tone === "target"
                ? "border-[#d2a963]/45 bg-[#7c4b23]/46"
                : "border-[#b95c42]/55 bg-[#5a221a]/50 text-[#ffd0b6]"
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
