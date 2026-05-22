import heroData from "../data/heroes.json";

export type Hero = {
  id: string;
  name: string;
  camp: string;
  troopType: string;
  role: string;
  rarity: string;
  tags: string[];
};

export type LineupRecommendation = {
  lineup: Hero[];
  formation: string;
  strategyDirection: string;
  scenarios: string[];
  risks: string[];
};

const heroes = heroData as Hero[];

export function getHeroes(): Hero[] {
  return heroes;
}

export function findHeroByName(name: string, heroPool: Hero[] = heroes): Hero | undefined {
  const text = name.trim();
  if (!text) return undefined;

  return heroPool.find((hero) => text.includes(hero.name));
}

export function findHeroesByNames(names: string[], heroPool: Hero[] = heroes): Hero[] {
  return names
    .map((name) => heroPool.find((hero) => hero.name === name.trim()))
    .filter(Boolean) as Hero[];
}

function findHero(options: {
  camp?: string;
  troopType?: string;
  role?: string;
  excludedIds?: string[];
  tag?: string;
  heroPool?: Hero[];
}) {
  return (options.heroPool ?? heroes).find((hero) => {
    if (options.excludedIds?.includes(hero.id)) return false;
    if (options.camp && hero.camp !== options.camp) return false;
    if (options.troopType && hero.troopType !== options.troopType) return false;
    if (options.role && hero.role !== options.role) return false;
    if (options.tag && !hero.tags.includes(options.tag)) return false;
    return true;
  });
}

function uniqueLineup(lineup: Hero[]) {
  const seen = new Set<string>();
  return lineup.filter((hero) => {
    if (seen.has(hero.id)) return false;
    seen.add(hero.id);
    return true;
  });
}

function getFormation(hero: Hero) {
  if (hero.troopType === "骑兵") return "锋矢阵";
  if (hero.troopType === "弓兵") return "雁行阵";
  return "鱼鳞阵";
}

function getStrategyDirection(hero: Hero) {
  if (hero.troopType === "骑兵") return "优先选择先手、突击、追击和破防方向兵法。";
  if (hero.troopType === "弓兵") return "优先选择远程增伤、谋略输出、控制和后排保护方向兵法。";
  return "优先选择减伤、反击、承伤和稳定续航方向兵法。";
}

export function recommendLineup(heroName: string, heroPool: Hero[] = heroes): LineupRecommendation | undefined {
  const coreHero = findHeroByName(heroName, heroPool);
  if (!coreHero) return undefined;

  const excludedIds = [coreHero.id];
  const sameTroopSupport =
    findHero({
      camp: coreHero.camp,
      troopType: coreHero.troopType,
      role: "辅助",
      excludedIds,
      heroPool,
    }) ??
    findHero({
      troopType: coreHero.troopType,
      role: "辅助",
      excludedIds,
      heroPool,
    });

  if (sameTroopSupport) excludedIds.push(sameTroopSupport.id);

  const frontHero =
    coreHero.role === "前排"
      ? findHero({
          camp: coreHero.camp,
          role: "输出",
          excludedIds,
          heroPool,
        })
      : findHero({
          camp: coreHero.camp,
          role: "前排",
          excludedIds,
          heroPool,
        }) ??
        findHero({
          role: "前排",
          excludedIds,
          heroPool,
        });

  if (frontHero) excludedIds.push(frontHero.id);

  const fallbackHero =
    findHero({
      camp: coreHero.camp,
      excludedIds,
      heroPool,
    }) ??
    findHero({
      troopType: coreHero.troopType,
      excludedIds,
      heroPool,
    }) ??
    findHero({
      excludedIds,
      heroPool,
    });

  const lineup = uniqueLineup([coreHero, sameTroopSupport, frontHero, fallbackHero].filter(Boolean) as Hero[]).slice(0, 3);

  return {
    lineup,
    formation: getFormation(coreHero),
    strategyDirection: getStrategyDirection(coreHero),
    scenarios:
      coreHero.role === "辅助"
        ? ["低损开荒", "主力续航", "驻防消耗"]
        : ["资源地推进", "主力会战", coreHero.troopType === "骑兵" ? "快速突击" : "稳定攻坚"],
    risks: [
      `${coreHero.name}作为${coreHero.role}时，需要确认队伍里有承伤、输出和辅助三类职责。`,
      `若兵种不统一，${getFormation(coreHero)}与兵法触发可能打折。`,
      "遇到克制兵种或冬季远征时，应先降低目标难度。",
    ],
  };
}

export function recommendLineupFromOwnedHeroes(
  ownedHeroNames: string[],
  heroPool: Hero[] = heroes,
): LineupRecommendation | undefined {
  const ownedHeroes = findHeroesByNames(ownedHeroNames, heroPool);
  if (ownedHeroes.length === 0) return undefined;

  const coreHero =
    ownedHeroes.find((hero) => hero.role === "输出" && hero.rarity === "传说") ??
    ownedHeroes.find((hero) => hero.role === "输出") ??
    ownedHeroes[0];

  return recommendLineup(coreHero.name, ownedHeroes.length >= 3 ? ownedHeroes : heroPool);
}
