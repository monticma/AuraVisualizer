// ============================================
// AURA MMORPG - Class Definitions
// Warrior, Mage, Druid (MVP classes)
// ============================================

import {
    ClassDefinition,
    CharacterClass,
    CharacterRole,
    ResourceType,
    Ability,
    AbilityType,
    DamageType,
    Talent,
} from "../types";

// ============================================
// CLASS DEFINITIONS
// ============================================

export const CLASS_DEFINITIONS: Record<CharacterClass, ClassDefinition> = {
    [CharacterClass.WARRIOR]: {
        id: CharacterClass.WARRIOR,
        name: "Guerrier",
        role: CharacterRole.TANK,
        description:
            "Un combattant au corps à corps robuste qui protège ses alliés et absorbe les dégâts ennemis.",
        resourceType: ResourceType.RAGE,
        baseStats: {
            health: 120,
            resource: 0, // Rage starts at 0
            strength: 20,
            intellect: 5,
            agility: 10,
            stamina: 18,
            spirit: 8,
            armor: 25,
        },
        abilities: [
            "warrior_strike",
            "warrior_heroic_strike",
            "warrior_shield_block",
            "warrior_taunt",
            "warrior_charge",
            "warrior_execute",
        ],
    },

    [CharacterClass.MAGE]: {
        id: CharacterClass.MAGE,
        name: "Mage",
        role: CharacterRole.DPS,
        description:
            "Un maître des arcanes qui déchaîne des sorts dévastateurs de feu, de glace et d'arcane.",
        resourceType: ResourceType.MANA,
        baseStats: {
            health: 80,
            resource: 150,
            strength: 5,
            intellect: 22,
            agility: 8,
            stamina: 10,
            spirit: 15,
            armor: 5,
        },
        abilities: [
            "mage_fireball",
            "mage_frostbolt",
            "mage_arcane_missiles",
            "mage_frost_nova",
            "mage_blink",
            "mage_pyroblast",
        ],
    },

    [CharacterClass.DRUID]: {
        id: CharacterClass.DRUID,
        name: "Druide",
        role: CharacterRole.HYBRID,
        description:
            "Un gardien de la nature capable de se transformer et de soigner, offrant une grande polyvalence.",
        resourceType: ResourceType.MANA,
        baseStats: {
            health: 100,
            resource: 120,
            strength: 12,
            intellect: 16,
            agility: 12,
            stamina: 14,
            spirit: 18,
            armor: 15,
        },
        abilities: [
            "druid_wrath",
            "druid_rejuvenation",
            "druid_moonfire",
            "druid_healing_touch",
            "druid_bear_form",
            "druid_entangling_roots",
        ],
    },

    // Future classes (not in MVP, but defined for completeness)
    [CharacterClass.PALADIN]: {
        id: CharacterClass.PALADIN,
        name: "Paladin",
        role: CharacterRole.HYBRID,
        description: "Un guerrier saint qui combine combat et pouvoirs divins.",
        resourceType: ResourceType.MANA,
        baseStats: {
            health: 110,
            resource: 100,
            strength: 18,
            intellect: 12,
            agility: 8,
            stamina: 16,
            spirit: 12,
            armor: 22,
        },
        abilities: [],
    },

    [CharacterClass.ARCHER]: {
        id: CharacterClass.ARCHER,
        name: "Archer",
        role: CharacterRole.DPS,
        description: "Un tireur d'élite qui frappe de loin avec précision.",
        resourceType: ResourceType.FOCUS,
        baseStats: {
            health: 90,
            resource: 100,
            strength: 10,
            intellect: 8,
            agility: 22,
            stamina: 12,
            spirit: 10,
            armor: 10,
        },
        abilities: [],
    },

    [CharacterClass.ROGUE]: {
        id: CharacterClass.ROGUE,
        name: "Voleur",
        role: CharacterRole.DPS,
        description:
            "Un assassin furtif spécialisé dans les attaques surprises et les poisons.",
        resourceType: ResourceType.ENERGY,
        baseStats: {
            health: 85,
            resource: 100,
            strength: 12,
            intellect: 6,
            agility: 22,
            stamina: 11,
            spirit: 8,
            armor: 8,
        },
        abilities: [],
    },
};

// ============================================
// ABILITY DEFINITIONS
// ============================================

export const ABILITIES: Record<string, Ability> = {
    // ========== WARRIOR ABILITIES ==========
    warrior_strike: {
        id: "warrior_strike",
        name: "Frappe",
        description: "Une attaque basique qui inflige des dégâts physiques.",
        icon: "ability_warrior_strike",
        type: AbilityType.DAMAGE,
        damageType: DamageType.PHYSICAL,
        resourceCost: 0,
        cooldown: 0,
        castTime: 0,
        range: -1, // Melee
        minDamage: 10,
        maxDamage: 15,
        requiredLevel: 1,
        classRestriction: CharacterClass.WARRIOR,
    },

    warrior_heroic_strike: {
        id: "warrior_heroic_strike",
        name: "Frappe héroïque",
        description: "Une puissante frappe qui consomme de la rage pour infliger des dégâts massifs.",
        icon: "ability_warrior_heroic_strike",
        type: AbilityType.DAMAGE,
        damageType: DamageType.PHYSICAL,
        resourceCost: 15,
        cooldown: 3,
        castTime: 0,
        range: -1,
        minDamage: 25,
        maxDamage: 35,
        requiredLevel: 2,
        classRestriction: CharacterClass.WARRIOR,
    },

    warrior_shield_block: {
        id: "warrior_shield_block",
        name: "Blocage du bouclier",
        description: "Bloque les attaques entrantes, réduisant les dégâts reçus de 50% pendant 5 secondes.",
        icon: "ability_warrior_shield_block",
        type: AbilityType.BUFF,
        resourceCost: 10,
        cooldown: 8,
        castTime: 0,
        range: 0,
        duration: 5,
        requiredLevel: 4,
        classRestriction: CharacterClass.WARRIOR,
    },

    warrior_taunt: {
        id: "warrior_taunt",
        name: "Provocation",
        description: "Force la cible à vous attaquer pendant 3 secondes.",
        icon: "ability_warrior_taunt",
        type: AbilityType.UTILITY,
        resourceCost: 5,
        cooldown: 8,
        castTime: 0,
        range: 30,
        duration: 3,
        requiredLevel: 6,
        classRestriction: CharacterClass.WARRIOR,
    },

    warrior_charge: {
        id: "warrior_charge",
        name: "Charge",
        description: "Chargez vers l'ennemi, l'étourdissant pendant 1 seconde et générant de la rage.",
        icon: "ability_warrior_charge",
        type: AbilityType.UTILITY,
        resourceCost: -10, // Generates rage
        cooldown: 15,
        castTime: 0,
        range: 25,
        duration: 1,
        requiredLevel: 8,
        classRestriction: CharacterClass.WARRIOR,
    },

    warrior_execute: {
        id: "warrior_execute",
        name: "Exécution",
        description: "Frappe mortelle utilisable uniquement sur les ennemis à moins de 20% de vie.",
        icon: "ability_warrior_execute",
        type: AbilityType.DAMAGE,
        damageType: DamageType.PHYSICAL,
        resourceCost: 25,
        cooldown: 6,
        castTime: 0,
        range: -1,
        minDamage: 50,
        maxDamage: 75,
        requiredLevel: 10,
        classRestriction: CharacterClass.WARRIOR,
    },

    // ========== MAGE ABILITIES ==========
    mage_fireball: {
        id: "mage_fireball",
        name: "Boule de feu",
        description: "Lance une boule de feu qui inflige des dégâts de feu.",
        icon: "ability_mage_fireball",
        type: AbilityType.DAMAGE,
        damageType: DamageType.FIRE,
        resourceCost: 20,
        cooldown: 0,
        castTime: 2,
        range: 35,
        minDamage: 30,
        maxDamage: 45,
        requiredLevel: 1,
        classRestriction: CharacterClass.MAGE,
    },

    mage_frostbolt: {
        id: "mage_frostbolt",
        name: "Éclair de givre",
        description: "Lance un éclair de givre qui ralentit la cible de 40% pendant 8 secondes.",
        icon: "ability_mage_frostbolt",
        type: AbilityType.DAMAGE,
        damageType: DamageType.ICE,
        resourceCost: 18,
        cooldown: 0,
        castTime: 2.5,
        range: 35,
        minDamage: 25,
        maxDamage: 35,
        duration: 8,
        requiredLevel: 2,
        classRestriction: CharacterClass.MAGE,
    },

    mage_arcane_missiles: {
        id: "mage_arcane_missiles",
        name: "Projectiles des arcanes",
        description: "Canalise des missiles d'arcane qui touchent 5 fois sur 3 secondes.",
        icon: "ability_mage_arcane_missiles",
        type: AbilityType.DAMAGE,
        damageType: DamageType.ARCANE,
        resourceCost: 35,
        cooldown: 0,
        castTime: 3, // Channeled
        range: 35,
        minDamage: 8,
        maxDamage: 12,
        requiredLevel: 4,
        classRestriction: CharacterClass.MAGE,
    },

    mage_frost_nova: {
        id: "mage_frost_nova",
        name: "Nova de givre",
        description: "Gèle tous les ennemis proches pendant 4 secondes.",
        icon: "ability_mage_frost_nova",
        type: AbilityType.UTILITY,
        damageType: DamageType.ICE,
        resourceCost: 25,
        cooldown: 25,
        castTime: 0,
        range: 0,
        duration: 4,
        minDamage: 15,
        maxDamage: 20,
        requiredLevel: 6,
        classRestriction: CharacterClass.MAGE,
    },

    mage_blink: {
        id: "mage_blink",
        name: "Transfert",
        description: "Vous téléporte instantanément de 15 mètres devant vous.",
        icon: "ability_mage_blink",
        type: AbilityType.UTILITY,
        resourceCost: 15,
        cooldown: 15,
        castTime: 0,
        range: 0,
        requiredLevel: 8,
        classRestriction: CharacterClass.MAGE,
    },

    mage_pyroblast: {
        id: "mage_pyroblast",
        name: "Explosion pyrotechnique",
        description: "Invoque une énorme boule de feu qui inflige des dégâts massifs.",
        icon: "ability_mage_pyroblast",
        type: AbilityType.DAMAGE,
        damageType: DamageType.FIRE,
        resourceCost: 50,
        cooldown: 0,
        castTime: 4,
        range: 35,
        minDamage: 80,
        maxDamage: 120,
        requiredLevel: 10,
        classRestriction: CharacterClass.MAGE,
    },

    // ========== DRUID ABILITIES ==========
    druid_wrath: {
        id: "druid_wrath",
        name: "Colère",
        description: "Lance un éclair de nature sur la cible.",
        icon: "ability_druid_wrath",
        type: AbilityType.DAMAGE,
        damageType: DamageType.NATURE,
        resourceCost: 15,
        cooldown: 0,
        castTime: 1.5,
        range: 35,
        minDamage: 20,
        maxDamage: 28,
        requiredLevel: 1,
        classRestriction: CharacterClass.DRUID,
    },

    druid_rejuvenation: {
        id: "druid_rejuvenation",
        name: "Récupération",
        description: "Soigne la cible sur 12 secondes.",
        icon: "ability_druid_rejuvenation",
        type: AbilityType.HEAL,
        resourceCost: 20,
        cooldown: 0,
        castTime: 0,
        range: 40,
        healAmount: 60, // Total over duration
        duration: 12,
        requiredLevel: 2,
        classRestriction: CharacterClass.DRUID,
    },

    druid_moonfire: {
        id: "druid_moonfire",
        name: "Éclat lunaire",
        description: "Inflige des dégâts d'arcane instantanés et un DoT sur 12 secondes.",
        icon: "ability_druid_moonfire",
        type: AbilityType.DAMAGE,
        damageType: DamageType.ARCANE,
        resourceCost: 18,
        cooldown: 0,
        castTime: 0,
        range: 35,
        minDamage: 12,
        maxDamage: 18,
        duration: 12,
        requiredLevel: 4,
        classRestriction: CharacterClass.DRUID,
    },

    druid_healing_touch: {
        id: "druid_healing_touch",
        name: "Toucher guérisseur",
        description: "Un soin puissant avec un temps d'incantation.",
        icon: "ability_druid_healing_touch",
        type: AbilityType.HEAL,
        resourceCost: 35,
        cooldown: 0,
        castTime: 3,
        range: 40,
        healAmount: 100,
        requiredLevel: 3,
        classRestriction: CharacterClass.DRUID,
    },

    druid_bear_form: {
        id: "druid_bear_form",
        name: "Forme d'ours",
        description: "Se transforme en ours, augmentant l'armure et la vie mais réduisant les dégâts.",
        icon: "ability_druid_bear_form",
        type: AbilityType.BUFF,
        resourceCost: 30,
        cooldown: 0,
        castTime: 0,
        range: 0,
        requiredLevel: 6,
        classRestriction: CharacterClass.DRUID,
    },

    druid_entangling_roots: {
        id: "druid_entangling_roots",
        name: "Sarments",
        description: "Immobilise la cible pendant 8 secondes. Tout dégât brise l'effet.",
        icon: "ability_druid_entangling_roots",
        type: AbilityType.UTILITY,
        damageType: DamageType.NATURE,
        resourceCost: 22,
        cooldown: 0,
        castTime: 1.5,
        range: 30,
        duration: 8,
        requiredLevel: 8,
        classRestriction: CharacterClass.DRUID,
    },
};

// ============================================
// SIMPLE TALENT SYSTEM
// ============================================

export const WARRIOR_TALENTS: Talent[] = [
    {
        id: "warrior_improved_strike",
        name: "Frappe améliorée",
        description: "Augmente les dégâts de Frappe de 5% par rang.",
        icon: "talent_warrior_improved_strike",
        tier: 1,
        maxRanks: 3,
        effects: [
            {
                type: "ability_modifier",
                abilityId: "warrior_strike",
                modifier: "damage_increase_5_percent",
            },
        ],
    },
    {
        id: "warrior_thick_skin",
        name: "Peau épaisse",
        description: "Augmente l'armure de 3% par rang.",
        icon: "talent_warrior_thick_skin",
        tier: 1,
        maxRanks: 5,
        effects: [{ type: "stat_bonus", stat: "armor", value: 3 }],
    },
    {
        id: "warrior_vitality",
        name: "Vitalité",
        description: "Augmente la vie maximum de 2% par rang.",
        icon: "talent_warrior_vitality",
        tier: 2,
        maxRanks: 5,
        effects: [{ type: "stat_bonus", stat: "maxHealth", value: 2 }],
    },
];

export const MAGE_TALENTS: Talent[] = [
    {
        id: "mage_improved_fireball",
        name: "Boule de feu améliorée",
        description: "Réduit le temps d'incantation de Boule de feu de 0.1s par rang.",
        icon: "talent_mage_improved_fireball",
        tier: 1,
        maxRanks: 5,
        effects: [
            {
                type: "ability_modifier",
                abilityId: "mage_fireball",
                modifier: "cast_time_reduction_01s",
            },
        ],
    },
    {
        id: "mage_arcane_focus",
        name: "Focalisation arcanique",
        description: "Augmente les chances de coup critique de 1% par rang.",
        icon: "talent_mage_arcane_focus",
        tier: 1,
        maxRanks: 5,
        effects: [{ type: "stat_bonus", stat: "critChance", value: 1 }],
    },
    {
        id: "mage_ice_barrier",
        name: "Barrière de glace",
        description: "Réduit les dégâts reçus de 2% par rang.",
        icon: "talent_mage_ice_barrier",
        tier: 2,
        maxRanks: 3,
        effects: [{ type: "stat_bonus", stat: "armor", value: 5 }],
    },
];

export const DRUID_TALENTS: Talent[] = [
    {
        id: "druid_natural_healing",
        name: "Guérison naturelle",
        description: "Augmente l'efficacité des soins de 3% par rang.",
        icon: "talent_druid_natural_healing",
        tier: 1,
        maxRanks: 5,
        effects: [
            {
                type: "ability_modifier",
                abilityId: "druid_rejuvenation",
                modifier: "heal_increase_3_percent",
            },
        ],
    },
    {
        id: "druid_natures_grace",
        name: "Grâce de la nature",
        description: "Augmente la régénération de mana de 5% par rang.",
        icon: "talent_druid_natures_grace",
        tier: 1,
        maxRanks: 3,
        effects: [{ type: "stat_bonus", stat: "spirit", value: 5 }],
    },
    {
        id: "druid_thick_hide",
        name: "Peau épaisse",
        description: "Augmente l'armure en forme d'ours de 10% par rang.",
        icon: "talent_druid_thick_hide",
        tier: 2,
        maxRanks: 3,
        effects: [{ type: "stat_bonus", stat: "armor", value: 10 }],
    },
];

export const CLASS_TALENTS: Record<CharacterClass, Talent[]> = {
    [CharacterClass.WARRIOR]: WARRIOR_TALENTS,
    [CharacterClass.MAGE]: MAGE_TALENTS,
    [CharacterClass.DRUID]: DRUID_TALENTS,
    [CharacterClass.PALADIN]: [],
    [CharacterClass.ARCHER]: [],
    [CharacterClass.ROGUE]: [],
};

// ============================================
// LEVEL SCALING
// ============================================

export const LEVEL_CONFIG = {
    maxLevel: 50,
    baseExperiencePerLevel: 100,
    experienceMultiplier: 1.15, // Each level requires 15% more XP
    statGrowthPerLevel: {
        health: 10,
        resource: 5,
        strength: 1,
        intellect: 1,
        agility: 1,
        stamina: 1,
        spirit: 1,
        armor: 2,
    },
};

export function getExperienceForLevel(level: number): number {
    return Math.floor(
        LEVEL_CONFIG.baseExperiencePerLevel *
        Math.pow(LEVEL_CONFIG.experienceMultiplier, level - 1)
    );
}

export function getTotalExperienceForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += getExperienceForLevel(i);
    }
    return total;
}
