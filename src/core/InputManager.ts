// ============================================
// AURA MMORPG - Input Manager
// Handles keyboard and mouse input
// ============================================

import { Scene, KeyboardEventTypes, KeyboardInfo } from "@babylonjs/core";
import { EventBus, GameEvents } from "./EventBus";

export interface KeyBindings {
    moveForward: string;
    moveBackward: string;
    moveLeft: string;
    moveRight: string;
    jump: string;
    autoRun: string;
    interact: string;
    attack: string;
    ability1: string;
    ability2: string;
    ability3: string;
    ability4: string;
    ability5: string;
    ability6: string;
    ability7: string;
    ability8: string;
    ability9: string;
    ability0: string;
    openInventory: string;
    openCharacter: string;
    openQuests: string;
    openMap: string;
    openTalents: string;
    toggleTargetFrame: string;
    tabTarget: string;
    escape: string;
}

const DEFAULT_KEYBINDINGS: KeyBindings = {
    moveForward: "KeyW",
    moveBackward: "KeyS",
    moveLeft: "KeyA",
    moveRight: "KeyD",
    jump: "Space",
    autoRun: "NumLock",
    interact: "KeyE",
    attack: "Digit1",
    ability1: "Digit1",
    ability2: "Digit2",
    ability3: "Digit3",
    ability4: "Digit4",
    ability5: "Digit5",
    ability6: "Digit6",
    ability7: "Digit7",
    ability8: "Digit8",
    ability9: "Digit9",
    ability0: "Digit0",
    openInventory: "KeyI",
    openCharacter: "KeyC",
    openQuests: "KeyL",
    openMap: "KeyM",
    openTalents: "KeyN",
    toggleTargetFrame: "KeyV",
    tabTarget: "Tab",
    escape: "Escape",
};

export class InputManager {
    private scene: Scene;
    private eventBus: EventBus;
    private keybindings: KeyBindings;

    // Current input state
    private keysDown: Set<string> = new Set();
    private moveDirection: { x: number; z: number } = { x: 0, z: 0 };
    private isAutoRunning: boolean = false;

    constructor(scene: Scene, eventBus: EventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.keybindings = { ...DEFAULT_KEYBINDINGS };

        this.setupKeyboardEvents();
    }

    private setupKeyboardEvents(): void {
        this.scene.onKeyboardObservable.add((kbInfo: KeyboardInfo) => {
            const code = kbInfo.event.code;

            switch (kbInfo.type) {
                case KeyboardEventTypes.KEYDOWN:
                    if (!this.keysDown.has(code)) {
                        this.keysDown.add(code);
                        this.handleKeyDown(code);
                    }
                    break;

                case KeyboardEventTypes.KEYUP:
                    this.keysDown.delete(code);
                    this.handleKeyUp(code);
                    break;
            }
        });
    }

    private handleKeyDown(code: string): void {
        // Emit key press event
        this.eventBus.emit({
            type: GameEvents.KEY_PRESSED,
            data: { code },
            timestamp: Date.now(),
        });

        // Handle specific keys
        if (code === this.keybindings.tabTarget) {
            this.eventBus.emit({
                type: "tab_target",
                data: {},
                timestamp: Date.now(),
            });
        }

        if (code === this.keybindings.escape) {
            this.eventBus.emit({
                type: "escape_pressed",
                data: {},
                timestamp: Date.now(),
            });
        }

        if (code === this.keybindings.interact) {
            this.eventBus.emit({
                type: "interact_pressed",
                data: {},
                timestamp: Date.now(),
            });
        }

        // Ability hotkeys
        for (let i = 1; i <= 9; i++) {
            if (code === this.keybindings[`ability${i}` as keyof KeyBindings]) {
                this.eventBus.emit({
                    type: GameEvents.PLAYER_USE_ABILITY,
                    data: { slotIndex: i - 1 },
                    timestamp: Date.now(),
                });
            }
        }
        if (code === this.keybindings.ability0) {
            this.eventBus.emit({
                type: GameEvents.PLAYER_USE_ABILITY,
                data: { slotIndex: 9 },
                timestamp: Date.now(),
            });
        }

        // UI toggles
        if (code === this.keybindings.openInventory) {
            this.eventBus.emit({
                type: GameEvents.UI_OPEN,
                data: { panel: "inventory" },
                timestamp: Date.now(),
            });
        }
        if (code === this.keybindings.openCharacter) {
            this.eventBus.emit({
                type: GameEvents.UI_OPEN,
                data: { panel: "character" },
                timestamp: Date.now(),
            });
        }
        if (code === this.keybindings.openQuests) {
            this.eventBus.emit({
                type: GameEvents.UI_OPEN,
                data: { panel: "quests" },
                timestamp: Date.now(),
            });
        }
        if (code === this.keybindings.openMap) {
            this.eventBus.emit({
                type: GameEvents.UI_OPEN,
                data: { panel: "map" },
                timestamp: Date.now(),
            });
        }
        if (code === this.keybindings.openTalents) {
            this.eventBus.emit({
                type: GameEvents.UI_OPEN,
                data: { panel: "talents" },
                timestamp: Date.now(),
            });
        }

        // Auto-run toggle
        if (code === this.keybindings.autoRun) {
            this.isAutoRunning = !this.isAutoRunning;
        }
    }

    private handleKeyUp(code: string): void {
        this.eventBus.emit({
            type: GameEvents.KEY_RELEASED,
            data: { code },
            timestamp: Date.now(),
        });
    }

    public update(deltaTime: number): void {
        // Calculate movement direction based on keys pressed
        this.moveDirection = { x: 0, z: 0 };

        if (this.isKeyDown(this.keybindings.moveForward) || this.isAutoRunning) {
            this.moveDirection.z += 1;
        }
        if (this.isKeyDown(this.keybindings.moveBackward)) {
            this.moveDirection.z -= 1;
            this.isAutoRunning = false; // Cancel auto-run when moving backward
        }
        if (this.isKeyDown(this.keybindings.moveLeft)) {
            this.moveDirection.x -= 1;
        }
        if (this.isKeyDown(this.keybindings.moveRight)) {
            this.moveDirection.x += 1;
        }

        // Normalize diagonal movement
        const length = Math.sqrt(
            this.moveDirection.x * this.moveDirection.x +
            this.moveDirection.z * this.moveDirection.z
        );
        if (length > 0) {
            this.moveDirection.x /= length;
            this.moveDirection.z /= length;

            // Emit movement event
            this.eventBus.emit({
                type: GameEvents.PLAYER_MOVE,
                data: {
                    direction: this.moveDirection,
                    deltaTime,
                },
                timestamp: Date.now(),
            });
        }
    }

    public isKeyDown(keyCode: string): boolean {
        return this.keysDown.has(keyCode);
    }

    public getMoveDirection(): { x: number; z: number } {
        return { ...this.moveDirection };
    }

    public isMoving(): boolean {
        return this.moveDirection.x !== 0 || this.moveDirection.z !== 0;
    }

    public setKeybinding(action: keyof KeyBindings, keyCode: string): void {
        this.keybindings[action] = keyCode;
    }

    public getKeybindings(): KeyBindings {
        return { ...this.keybindings };
    }

    public dispose(): void {
        this.keysDown.clear();
    }
}
