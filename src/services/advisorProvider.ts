import {
  advisorAnswerToContent,
  generateAdvisorAnswer,
  type ChatHistory,
} from "./advisorService";
import { getHeroes } from "./heroService";
import type { PlayerState } from "./playerStateService";
import { fetchKnowledgeItemsWithFallback } from "./supabaseKnowledgeService";

export interface AdvisorProvider {
  answer(question: string, history: ChatHistory[], playerState: PlayerState): Promise<string>;
}

export class LocalAdvisorProvider implements AdvisorProvider {
  async answer(question: string, history: ChatHistory[], playerState: PlayerState): Promise<string> {
    const knowledgeItems = await fetchKnowledgeItemsWithFallback();
    const advisorAnswer = generateAdvisorAnswer(question, playerState, getHeroes(), history, knowledgeItems);
    return advisorAnswerToContent(advisorAnswer);
  }
}

export class RemoteAdvisorProvider implements AdvisorProvider {
  async answer(question: string, history: ChatHistory[], playerState: PlayerState): Promise<string> {
    const response = await fetch("/api/advisor/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        history,
        playerState,
      }),
    });

    if (!response.ok) {
      throw new Error("远程军师接口暂不可用");
    }

    const data = (await response.json()) as { answer?: string };
    return data.answer ?? "";
  }
}

export const advisorProvider: AdvisorProvider = new LocalAdvisorProvider();
