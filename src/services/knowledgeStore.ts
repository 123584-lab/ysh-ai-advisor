import buildingKnowledge from "../knowledge/building.json";
import combatKnowledge from "../knowledge/combat.json";
import heroKnowledge from "../knowledge/hero.json";
import resourceKnowledge from "../knowledge/resource.json";
import troopKnowledge from "../knowledge/troop.json";
import unlockKnowledge from "../knowledge/unlock.json";

export type StoredKnowledgeItem = {
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

export type StoredKnowledgeGroup = {
  id: string;
  label: string;
  items: StoredKnowledgeItem[];
};

const defaultKnowledgeGroups: StoredKnowledgeGroup[] = [
  { id: "hero", label: "Hero", items: heroKnowledge as StoredKnowledgeItem[] },
  { id: "troop", label: "Troop", items: troopKnowledge as StoredKnowledgeItem[] },
  { id: "building", label: "Building", items: buildingKnowledge as StoredKnowledgeItem[] },
  { id: "combat", label: "Combat", items: combatKnowledge as StoredKnowledgeItem[] },
  { id: "resource", label: "Resource", items: resourceKnowledge as StoredKnowledgeItem[] },
  { id: "unlock", label: "Unlock", items: unlockKnowledge as StoredKnowledgeItem[] },
];

function cloneGroups(groups: StoredKnowledgeGroup[]): StoredKnowledgeGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      keywords: [...(item.keywords ?? [])],
      steps: [...(item.steps ?? [])],
      risk: [...(item.risk ?? [])],
    })),
  }));
}

export function getKnowledgeGroups(): StoredKnowledgeGroup[] {
  return cloneGroups(defaultKnowledgeGroups);
}

export function getStoredKnowledgeItems(): StoredKnowledgeItem[] {
  return getKnowledgeGroups().flatMap((group) => group.items);
}

export function getStoredKnowledgeGroupItems(groupId: string): StoredKnowledgeItem[] {
  return getKnowledgeGroups().find((group) => group.id === groupId)?.items ?? [];
}

export function getStoredKnowledgeCount(): number {
  return getStoredKnowledgeItems().length;
}
