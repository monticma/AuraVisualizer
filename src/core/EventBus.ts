// ============================================
// AURA MMORPG - Event Bus
// Centralized event system for game communication
// ============================================

import { GameEvent, EventHandler } from "../types";

export class EventBus {
    private static instance: EventBus;
    private listeners: Map<string, Set<EventHandler>> = new Map();
    private eventQueue: GameEvent[] = [];

    private constructor() { }

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    public on(eventType: string, handler: EventHandler): void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)!.add(handler);
    }

    public off(eventType: string, handler: EventHandler): void {
        const handlers = this.listeners.get(eventType);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    public emit(event: GameEvent): void {
        const handlers = this.listeners.get(event.type);
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(event);
                } catch (error) {
                    console.error(`Error in event handler for ${event.type}:`, error);
                }
            });
        }

        // Also emit to wildcard listeners
        const wildcardHandlers = this.listeners.get("*");
        if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => {
                try {
                    handler(event);
                } catch (error) {
                    console.error(`Error in wildcard event handler:`, error);
                }
            });
        }
    }

    public queue(event: GameEvent): void {
        this.eventQueue.push(event);
    }

    public processQueue(): void {
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift()!;
            this.emit(event);
        }
    }

    public clear(): void {
        this.listeners.clear();
        this.eventQueue = [];
    }
}

// Common event types
export const GameEvents = {
    // Player events
    PLAYER_MOVE: "player_move",
    PLAYER_ATTACK: "player_attack",
    PLAYER_USE_ABILITY: "player_use_ability",
    PLAYER_LEVEL_UP: "player_level_up",
    PLAYER_DIED: "player_died",
    PLAYER_RESPAWN: "player_respawn",

    // Target events
    TARGET_SELECTED: "target_selected",
    TARGET_CLEARED: "target_cleared",

    // Combat events
    COMBAT_START: "combat_start",
    COMBAT_END: "combat_end",
    DAMAGE_DEALT: "damage_dealt",
    DAMAGE_RECEIVED: "damage_received",
    HEAL_RECEIVED: "heal_received",

    // Monster events
    MONSTER_SPAWN: "monster_spawn",
    MONSTER_DIED: "monster_died",
    MONSTER_AGGRO: "monster_aggro",
    MONSTER_RESET: "monster_reset",

    // NPC events
    NPC_INTERACT: "npc_interact",
    DIALOGUE_START: "dialogue_start",
    DIALOGUE_END: "dialogue_end",
    SHOP_OPEN: "shop_open",
    SHOP_CLOSE: "shop_close",

    // Quest events
    QUEST_ACCEPTED: "quest_accepted",
    QUEST_PROGRESS: "quest_progress",
    QUEST_COMPLETE: "quest_complete",
    QUEST_TURNED_IN: "quest_turned_in",

    // Inventory events
    ITEM_PICKED_UP: "item_picked_up",
    ITEM_DROPPED: "item_dropped",
    ITEM_EQUIPPED: "item_equipped",
    ITEM_UNEQUIPPED: "item_unequipped",
    ITEM_USED: "item_used",

    // UI events
    UI_OPEN: "ui_open",
    UI_CLOSE: "ui_close",
    TOOLTIP_SHOW: "tooltip_show",
    TOOLTIP_HIDE: "tooltip_hide",

    // System events
    GAME_UPDATE: "game_update",
    GAME_PAUSED: "game_paused",
    GAME_RESUMED: "game_resumed",
    GAME_SAVED: "game_saved",
    GAME_LOADED: "game_loaded",

    // Input events
    KEY_PRESSED: "key_pressed",
    KEY_RELEASED: "key_released",
    MESH_CLICKED: "mesh_clicked",
} as const;
