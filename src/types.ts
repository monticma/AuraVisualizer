// ============================================
// AURA MMORPG - Type Definitions
// ============================================

import { Vector3 } from "@babylonjs/core";

// ============================================
// CHARACTER & CLASSES
// ============================================

export enum CharacterClass {
  WARRIOR = "warrior",
  MAGE = "mage",
  DRUID = "druid",
  PALADIN = "paladin",
  ARCHER = "archer",
  ROGUE = "rogue",
}

export enum CharacterRole {
  TANK = "tank",
  DPS = "dps",
  HEALER = "healer",
  HYBRID = "hybrid",
}

export interface ClassDefinition {
  id: CharacterClass;
  name: string;
  role: CharacterRole;
  description: string;
  baseStats: BaseStats;
  resourceType: ResourceType;
  abilities: string[]; // Ability IDs
}

export enum ResourceType {
  MANA = "mana",
  RAGE = "rage",
  ENERGY = "energy",
  FOCUS = "focus",
}

export interface BaseStats {
  health: number;
  resource: number;
  strength: number;
  intellect: number;
  agility: number;
  stamina: number;
  spirit: number;
  armor: number;
}

export interface CharacterStats extends BaseStats {
  maxHealth: number;
  maxResource: number;
  critChance: number;
  critDamage: number;
  attackSpeed: number;
  movementSpeed: number;
}

export interface Character {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  experience: number;
  experienceToNextLevel: number;
  stats: CharacterStats;
  position: { x: number; y: number; z: number };
  rotation: number;
  equipment: Equipment;
  inventory: InventoryItem[];
  abilities: PlayerAbility[];
  talents: TalentSelection[];
  currentTarget: string | null;
}

// ============================================
// ABILITIES & COMBAT
// ============================================

export enum AbilityType {
  DAMAGE = "damage",
  HEAL = "heal",
  BUFF = "buff",
  DEBUFF = "debuff",
  UTILITY = "utility",
}

export enum DamageType {
  PHYSICAL = "physical",
  FIRE = "fire",
  ICE = "ice",
  NATURE = "nature",
  ARCANE = "arcane",
  HOLY = "holy",
  SHADOW = "shadow",
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: AbilityType;
  damageType?: DamageType;
  resourceCost: number;
  cooldown: number; // in seconds
  castTime: number; // 0 = instant
  range: number; // 0 = self, -1 = melee
  minDamage?: number;
  maxDamage?: number;
  healAmount?: number;
  duration?: number; // for buffs/debuffs
  requiredLevel: number;
  classRestriction?: CharacterClass;
}

export interface PlayerAbility extends Ability {
  currentCooldown: number;
  isOnCooldown: boolean;
}

export interface CombatResult {
  success: boolean;
  damage?: number;
  healing?: number;
  isCrit: boolean;
  sourceId: string;
  targetId: string;
  abilityId: string;
  timestamp: number;
}

// ============================================
// TALENTS
// ============================================

export interface Talent {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: number; // 1-5
  maxRanks: number;
  effects: TalentEffect[];
  prerequisiteId?: string;
}

export interface TalentEffect {
  type: "stat_bonus" | "ability_modifier" | "new_ability";
  stat?: keyof CharacterStats;
  value?: number;
  abilityId?: string;
  modifier?: string;
}

export interface TalentSelection {
  talentId: string;
  currentRanks: number;
}

// ============================================
// EQUIPMENT & INVENTORY
// ============================================

export enum EquipmentSlot {
  HEAD = "head",
  CHEST = "chest",
  LEGS = "legs",
  FEET = "feet",
  HANDS = "hands",
  SHOULDERS = "shoulders",
  MAIN_HAND = "main_hand",
  OFF_HAND = "off_hand",
  TRINKET_1 = "trinket_1",
  TRINKET_2 = "trinket_2",
  NECKLACE = "necklace",
  RING_1 = "ring_1",
  RING_2 = "ring_2",
}

export enum ItemRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
}

export interface Item {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: ItemRarity;
  sellPrice: number;
  requiredLevel: number;
  stackable: boolean;
  maxStack: number;
}

export interface EquipmentItem extends Item {
  slot: EquipmentSlot;
  stats: Partial<BaseStats>;
  classRestriction?: CharacterClass[];
}

export interface ConsumableItem extends Item {
  effect: ItemEffect;
}

export interface ItemEffect {
  type: "heal" | "buff" | "restore_resource";
  value: number;
  duration?: number;
}

export interface InventoryItem {
  item: Item;
  quantity: number;
  slotIndex: number;
}

export interface Equipment {
  [EquipmentSlot.HEAD]?: EquipmentItem;
  [EquipmentSlot.CHEST]?: EquipmentItem;
  [EquipmentSlot.LEGS]?: EquipmentItem;
  [EquipmentSlot.FEET]?: EquipmentItem;
  [EquipmentSlot.HANDS]?: EquipmentItem;
  [EquipmentSlot.SHOULDERS]?: EquipmentItem;
  [EquipmentSlot.MAIN_HAND]?: EquipmentItem;
  [EquipmentSlot.OFF_HAND]?: EquipmentItem;
  [EquipmentSlot.TRINKET_1]?: EquipmentItem;
  [EquipmentSlot.TRINKET_2]?: EquipmentItem;
  [EquipmentSlot.NECKLACE]?: EquipmentItem;
  [EquipmentSlot.RING_1]?: EquipmentItem;
  [EquipmentSlot.RING_2]?: EquipmentItem;
}

// ============================================
// MONSTERS
// ============================================

export enum MonsterType {
  NORMAL = "normal",
  ELITE = "elite",
  RARE = "rare",
  BOSS = "boss",
}

export enum MonsterBehavior {
  PASSIVE = "passive", // Only attacks if attacked first
  AGGRESSIVE = "aggressive", // Attacks on sight
  TERRITORIAL = "territorial", // Attacks if player gets too close
}

export interface MonsterTemplate {
  id: string;
  name: string;
  type: MonsterType;
  behavior: MonsterBehavior;
  level: number;
  baseHealth: number;
  baseDamage: { min: number; max: number };
  armor: number;
  aggroRadius: number;
  leashRadius: number;
  attackSpeed: number;
  attackRange: number;
  movementSpeed: number;
  abilities: string[];
  lootTable: LootTableEntry[];
  experienceReward: number;
  modelId: string;
}

export interface Monster {
  id: string;
  templateId: string;
  name: string;
  level: number;
  type: MonsterType;
  currentHealth: number;
  maxHealth: number;
  position: { x: number; y: number; z: number };
  spawnPosition: { x: number; y: number; z: number };
  rotation: number;
  state: MonsterState;
  currentTarget: string | null;
  aggroTable: Map<string, number>;
  respawnTime: number;
  isDead: boolean;
}

export enum MonsterState {
  IDLE = "idle",
  PATROL = "patrol",
  COMBAT = "combat",
  PURSUIT = "pursuit",
  RETURNING = "returning",
  DEAD = "dead",
}

export interface LootTableEntry {
  itemId: string;
  dropChance: number; // 0-1
  minQuantity: number;
  maxQuantity: number;
}

// ============================================
// NPCs
// ============================================

export enum NPCType {
  QUEST_GIVER = "quest_giver",
  MERCHANT = "merchant",
  CLASS_TRAINER = "class_trainer",
  BANKER = "banker",
  FLIGHT_MASTER = "flight_master",
  INNKEEPER = "innkeeper",
  REPAIR = "repair",
}

export interface NPC {
  id: string;
  name: string;
  title?: string;
  type: NPCType;
  position: { x: number; y: number; z: number };
  rotation: number;
  modelId: string;
  dialogue: DialogueTree;
  services: NPCService[];
}

export interface DialogueTree {
  greeting: string;
  options: DialogueOption[];
}

export interface DialogueOption {
  id: string;
  text: string;
  response?: string;
  action?: NPCAction;
  condition?: DialogueCondition;
  nextOptions?: DialogueOption[];
}

export interface DialogueCondition {
  type: "quest_complete" | "quest_active" | "level" | "class" | "item";
  value: string | number;
}

export interface NPCAction {
  type: "open_shop" | "open_bank" | "open_trainer" | "give_quest" | "complete_quest" | "repair";
  data?: any;
}

export interface NPCService {
  type: NPCType;
  data: MerchantData | TrainerData | QuestData;
}

export interface MerchantData {
  items: MerchantItem[];
  buybackMultiplier: number;
}

export interface MerchantItem {
  itemId: string;
  price: number;
  stock: number; // -1 = unlimited
}

export interface TrainerData {
  trainableClass: CharacterClass;
  abilities: TrainableAbility[];
}

export interface TrainableAbility {
  abilityId: string;
  cost: number;
  requiredLevel: number;
}

export interface QuestData {
  availableQuests: string[];
  activeQuests: string[];
}

// ============================================
// QUESTS
// ============================================

export enum QuestObjectiveType {
  KILL = "kill",
  COLLECT = "collect",
  TALK_TO = "talk_to",
  EXPLORE = "explore",
  ESCORT = "escort",
  USE_ITEM = "use_item",
}

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;
  targetId: string; // Monster ID, Item ID, NPC ID, etc.
  requiredCount: number;
  currentCount: number;
  isComplete: boolean;
}

export interface QuestReward {
  experience: number;
  gold: number;
  items?: { itemId: string; quantity: number }[];
  choiceItems?: { itemId: string; quantity: number }[][];
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestReward;
  requiredLevel: number;
  prerequisiteQuestId?: string;
  giverNpcId: string;
  turnInNpcId: string;
}

export interface PlayerQuest extends Quest {
  isActive: boolean;
  isComplete: boolean;
  isTurnedIn: boolean;
}

// ============================================
// WORLD & ZONES
// ============================================

export interface Zone {
  id: string;
  name: string;
  levelRange: { min: number; max: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  monsters: MonsterSpawn[];
  npcs: NPC[];
  quests: string[];
  graveyards: { x: number; y: number; z: number }[];
  music: string;
  ambientSounds: string[];
}

export interface MonsterSpawn {
  templateId: string;
  position: { x: number; y: number; z: number };
  patrolPath?: { x: number; y: number; z: number }[];
  respawnTime: number;
}

// ============================================
// GAME STATE
// ============================================

export interface GameState {
  player: Character;
  currentZone: Zone;
  monsters: Map<string, Monster>;
  npcs: Map<string, NPC>;
  activeQuests: PlayerQuest[];
  completedQuests: string[];
  gameTime: number;
  isPaused: boolean;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface GameEvent {
  type: string;
  data: any;
  timestamp: number;
}

export type EventHandler = (event: GameEvent) => void;
