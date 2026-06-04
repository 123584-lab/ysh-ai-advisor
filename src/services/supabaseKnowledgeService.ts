import {
  getKnowledgeGroups,
  type StoredKnowledgeGroup,
  type StoredKnowledgeItem,
} from "./knowledgeStore";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE_NAME = "knowledge_items";

type SupabaseKnowledgeRow = {
  id: string;
  group_id: string;
  title: string;
  category: string;
  keywords: string[] | null;
  content: string | null;
  summary: string | null;
  steps: string[] | null;
  risk: string[] | null;
};

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function getHeaders(prefer?: string): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY ?? "",
    Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ""}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function rowToItem(row: SupabaseKnowledgeRow): StoredKnowledgeItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    keywords: row.keywords ?? [],
    content: row.content ?? "",
    summary: row.summary ?? "",
    steps: row.steps ?? [],
    risk: row.risk ?? [],
  };
}

function itemToRow(groupId: string, item: StoredKnowledgeItem): SupabaseKnowledgeRow {
  return {
    id: item.id,
    group_id: groupId,
    title: item.title,
    category: item.category,
    keywords: item.keywords ?? [],
    content: item.content ?? "",
    summary: item.summary ?? "",
    steps: item.steps ?? [],
    risk: item.risk ?? [],
  };
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase 请求失败：${response.status}`);
  }

  return response;
}

export async function fetchSupabaseKnowledgeGroups(): Promise<StoredKnowledgeGroup[]> {
  const response = await request(`${TABLE_NAME}?select=*&order=created_at.asc`, {
    headers: getHeaders(),
  });
  const rows = (await response.json()) as SupabaseKnowledgeRow[];
  const baseGroups = getKnowledgeGroups();

  return baseGroups.map((group) => ({
    ...group,
    items: rows.filter((row) => row.group_id === group.id).map(rowToItem),
  }));
}

export async function fetchKnowledgeGroupsWithFallback(): Promise<StoredKnowledgeGroup[]> {
  try {
    const groups = await fetchSupabaseKnowledgeGroups();
    const totalCount = groups.reduce((total, group) => total + group.items.length, 0);
    return totalCount > 0 ? groups : getKnowledgeGroups();
  } catch (error) {
    console.warn("Supabase 知识库读取失败，已回退到本地 JSON。", error);
    return getKnowledgeGroups();
  }
}

export async function fetchKnowledgeItemsWithFallback(): Promise<StoredKnowledgeItem[]> {
  const groups = await fetchKnowledgeGroupsWithFallback();
  return groups.flatMap((group) => group.items);
}

export async function createSupabaseKnowledgeItem(groupId: string, item: StoredKnowledgeItem): Promise<StoredKnowledgeItem> {
  const response = await request(TABLE_NAME, {
    method: "POST",
    headers: getHeaders("return=representation"),
    body: JSON.stringify(itemToRow(groupId, item)),
  });
  const rows = (await response.json()) as SupabaseKnowledgeRow[];
  return rowToItem(rows[0]);
}

export async function updateSupabaseKnowledgeItem(groupId: string, item: StoredKnowledgeItem): Promise<StoredKnowledgeItem> {
  const response = await request(`${TABLE_NAME}?id=eq.${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    headers: getHeaders("return=representation"),
    body: JSON.stringify(itemToRow(groupId, item)),
  });
  const rows = (await response.json()) as SupabaseKnowledgeRow[];
  return rowToItem(rows[0]);
}

export async function deleteSupabaseKnowledgeItem(id: string): Promise<void> {
  await request(`${TABLE_NAME}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
}

export async function importLocalKnowledgeToSupabase(): Promise<number> {
  const rows = getKnowledgeGroups().flatMap((group) =>
    group.items.map((item) => itemToRow(group.id, item)),
  );

  await request(`${TABLE_NAME}?on_conflict=id`, {
    method: "POST",
    headers: getHeaders("resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify(rows),
  });

  return rows.length;
}

export function getSupabaseKnowledgeConfigStatus(): "configured" | "missing" {
  return isSupabaseConfigured() ? "configured" : "missing";
}
