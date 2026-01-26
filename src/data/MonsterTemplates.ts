// ============================================
// AURA MMORPG - Monster Templates
// Pre-defined monster configurations
// ============================================

import {
    MonsterTemplate,
    MonsterType,
    MonsterBehavior,
} from "../types";

export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
    // ============================================
    // ZONE 1: Prairies de départ (Niveau 1-10)
    // ============================================

    // Basic monsters (Level 1-3)
    wolf: {
        id: "wolf",
        name: "Loup Sauvage",
        type: MonsterType.NORMAL,
        behavior: MonsterBehavior.AGGRESSIVE,
        level: 2,
        baseHealth: 80,
        baseDamage: { min: 5, max: 9 },
        armor: 10,
        aggroRadius: 15,
        leashRadius: 40,
        attackSpeed: 1.2,
        attackRange: 2,
        movementSpeed: 5,
        abilities: [],
        lootTable: [
            { itemId: "wolf_pelt", dropChance: 0.6, minQuantity: 1, maxQuantity: 2 },
            { itemId: "wolf_fang", dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
        ],
        experienceReward: 25,
        modelId: "wolf",
    },

    boar: {
        id: "boar",
        name: "Sanglier",
        type: MonsterType.NORMAL,
        behavior: MonsterBehavior.TERRITORIAL,
        level: 1,
        baseHealth: 100,
        baseDamage: { min: 4, max: 7 },
        armor: 15,
        aggroRadius: 8,
        leashRadius: 35,
        attackSpeed: 1.0,
        attackRange: 2,
        movementSpeed: 4,
        abilities: [],
        lootTable: [
            { itemId: "boar_meat", dropChance: 0.8, minQuantity: 1, maxQuantity: 3 },
            { itemId: "boar_tusk", dropChance: 0.2, minQuantity: 1, maxQuantity: 1 },
        ],
        experienceReward: 20,
        modelId: "boar",
    },

    bandit: {
        id: "bandit",
        name: "Bandit",
        type: MonsterType.NORMAL,
        behavior: MonsterBehavior.AGGRESSIVE,
        level: 3,
        baseHealth: 120,
        baseDamage: { min: 8, max: 12 },
        armor: 20,
        aggroRadius: 12,
        leashRadius: 45,
        attackSpeed: 1.1,
        attackRange: 2,
        movementSpeed: 4.5,
        abilities: [],
        lootTable: [
            { itemId: "gold_coins", dropChance: 0.9, minQuantity: 5, maxQuantity: 15 },
            { itemId: "bandit_mask", dropChance: 0.1, minQuantity: 1, maxQuantity: 1 },
            { itemId: "rusty_sword", dropChance: 0.05, minQuantity: 1, maxQuantity: 1 },
        ],
        experienceReward: 35,
        modelId: "bandit",
    },

    // Mid-level monsters (Level 4-7)
    giant_spider: {
        id: "giant_spider",
        name: "Araignée Géante",
        type: MonsterType.NORMAL,
        behavior: MonsterBehavior.AGGRESSIVE,
        level: 5,
        baseHealth: 150,
        baseDamage: { min: 12, max: 18 },
        armor: 25,
        aggroRadius: 10,
        leashRadius: 40,
        attackSpeed: 1.4,
        attackRange: 2,
        movementSpeed: 6,
        abilities: ["spider_web", "poison_bite"],
        lootTable: [
            { itemId: "spider_silk", dropChance: 0.7, minQuantity: 1, maxQuantity: 4 },
            { itemId: "spider_venom", dropChance: 0.4, minQuantity: 1, maxQuantity: 2 },
        ],
        experienceReward: 55,
        modelId: "spider",
    },

    goblin_warrior: {
        id: "goblin_warrior",
        name: "Guerrier Gobelin",
        type: MonsterType.NORMAL,
        behavior: MonsterBehavior.AGGRESSIVE,
        level: 6,
        baseHealth: 180,
        baseDamage: { min: 15, max: 22 },
        armor: 35,
        aggroRadius: 15,
        leashRadius: 50,
        attackSpeed: 1.2,
        attackRange: 2,
        movementSpeed: 4.5,
        abilities: [],
        lootTable: [
            { itemId: "gold_coins", dropChance: 1.0, minQuantity: 10, maxQuantity: 25 },
            { itemId: "goblin_ear", dropChance: 0.8, minQuantity: 1, maxQuantity: 2 },
            { itemId: "worn_leather_boots", dropChance: 0.08, minQuantity: 1, maxQuantity: 1 },
        ],
        experienceReward: 65,
        modelId: "goblin",
    },

    // Elite monsters
    alpha_wolf: {
        id: "alpha_wolf",
        name: "Loup Alpha",
        type: MonsterType.ELITE,
        behavior: MonsterBehavior.AGGRESSIVE,
        level: 4,
        baseHealth: 120, // x3 for elite = 360
        baseDamage: { min: 12, max: 18 },
        armor: 30,
        aggroRadius: 18,
        leashRadius: 50,
        attackSpeed: 1.3,
        attackRange: 2,
        movementSpeed: 6,
        abilities: ["howl", "ferocious_bite"],
        lootTable: [
            { itemId: "wolf_pelt", dropChance: 1.0, minQuantity: 2, maxQuantity: 4 },
            { itemId: "alpha_fang", dropChance: 0.5, minQuantity: 1, maxQuantity: 1 },
            { itemId: "leather_boots", dropChance: 0.15, minQuantity: 1, maxQuantity: 1 },
        ],
        experienceReward: 120,
        modelId: "wolf_alpha",
    },

    goblin_chief: {
        id: "goblin_chief",
        name: "Chef Gobelin",
        type: MonsterType.ELITE,
        behavior: MonsterBehavior.AGGRESSIVE,
        level: 8,
        baseHealth: 200, // x3 = 600
        baseDamage: { min: 20, max: 30 },
        armor: 50,
        aggroRadius: 20,
        leashRadius: 60,
        attackSpeed: 1.0,
        attackRange: 2,
        movementSpeed: 4,
        abilities: ["war_cry", "cleave"],
        lootTable: [
            { itemId: "gold_coins", dropChance: 1.0, minQuantity: 50, maxQuantity: 100 },
            { itemId: "goblin_treasure_key", dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
            { itemId: "chiefs_axe", dropChance: 0.1, minQuantity: 1, maxQuantity: 1 },
        ],
        experienceReward: 250,
        modelId: "goblin_chief",
    },

    // Rare spawn
    ancient_treant: {
        id: "ancient_treant",
        name: "Sylvestre Ancien",
        type: MonsterType.RARE,
        behavior: MonsterBehavior.PASSIVE,
        level: 10,
        baseHealth: 300, // x2 = 600
        baseDamage: { min: 25, max: 40 },
        armor: 80,
        aggroRadius: 8,
        leashRadius: 30,
        attackSpeed: 0.7,
        attackRange: 3,
        movementSpeed: 2,
        abilities: ["entangle", "natures_wrath"],
        lootTable: [
            { itemId: "ancient_bark", dropChance: 1.0, minQuantity: 3, maxQuantity: 5 },
            { itemId: "living_wood", dropChance: 0.6, minQuantity: 1, maxQuantity: 2 },
            { itemId: "treant_heart", dropChance: 0.2, minQuantity: 1, maxQuantity: 1 },
            { itemId: "staff_of_nature", dropChance: 0.05, minQuantity: 1, maxQuantity: 1 },
        ],
        experienceReward: 400,
        modelId: "treant",
    },

    // World Boss
    gorrok_the_destroyer: {
        id: "gorrok_the_destroyer",
        name: "Gorrok le Destructeur",
        type: MonsterType.BOSS,
        behavior: MonsterBehavior.AGGRESSIVE,
        level: 10,
        baseHealth: 500, // x10 = 5000
        baseDamage: { min: 40, max: 60 },
        armor: 100,
        aggroRadius: 25,
        leashRadius: 80,
        attackSpeed: 0.8,
        attackRange: 4,
        movementSpeed: 3,
        abilities: ["ground_slam", "enrage", "summon_minions"],
        lootTable: [
            { itemId: "gold_coins", dropChance: 1.0, minQuantity: 200, maxQuantity: 500 },
            { itemId: "gorroks_trophy", dropChance: 1.0, minQuantity: 1, maxQuantity: 1 },
            { itemId: "legendary_sword", dropChance: 0.05, minQuantity: 1, maxQuantity: 1 },
            { itemId: "epic_chestplate", dropChance: 0.1, minQuantity: 1, maxQuantity: 1 },
        ],
        experienceReward: 2000,
        modelId: "gorrok",
    },
};

// Helper to get all monsters for a level range
export function getMonstersForLevelRange(
    minLevel: number,
    maxLevel: number
): MonsterTemplate[] {
    return Object.values(MONSTER_TEMPLATES).filter(
        (m) => m.level >= minLevel && m.level <= maxLevel
    );
}

// Helper to get monsters by type
export function getMonstersByType(type: MonsterType): MonsterTemplate[] {
    return Object.values(MONSTER_TEMPLATES).filter((m) => m.type === type);
}
