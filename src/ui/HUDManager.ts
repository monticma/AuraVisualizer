// ============================================
// AURA MMORPG - HUD Manager
// Handles all UI elements using Babylon.js GUI
// ============================================

import {
    AdvancedDynamicTexture,
    Rectangle,
    TextBlock,
    StackPanel,
    Control,
    Image,
    Button,
    Grid,
} from "@babylonjs/gui";
import { Scene } from "@babylonjs/core";
import { Character, CharacterClass, PlayerAbility } from "../types";
import { EventBus, GameEvents } from "../core/EventBus";
import { CLASS_DEFINITIONS } from "../data/ClassDefinitions";

export class HUDManager {
    private scene: Scene;
    private eventBus: EventBus;
    private guiTexture: AdvancedDynamicTexture;

    // UI Elements
    private healthBar: Rectangle | null = null;
    private healthText: TextBlock | null = null;
    private resourceBar: Rectangle | null = null;
    private resourceText: TextBlock | null = null;
    private experienceBar: Rectangle | null = null;
    private levelText: TextBlock | null = null;
    private abilityBar: StackPanel | null = null;
    private targetFrame: Rectangle | null = null;
    private targetNameText: TextBlock | null = null;
    private targetHealthBar: Rectangle | null = null;
    private combatLog: StackPanel | null = null;
    private castBar: Rectangle | null = null;
    private castBarFill: Rectangle | null = null;
    private castBarText: TextBlock | null = null;

    // State
    private currentCharacter: Character | null = null;
    private combatLogMessages: string[] = [];
    private maxCombatLogMessages: number = 5;

    constructor(scene: Scene, eventBus: EventBus) {
        this.scene = scene;
        this.eventBus = eventBus;

        // Create fullscreen GUI
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

        this.createHUD();
        this.setupEventListeners();
    }

    private createHUD(): void {
        this.createPlayerFrame();
        this.createTargetFrame();
        this.createAbilityBar();
        this.createExperienceBar();
        this.createCombatLog();
        this.createCastBar();
    }

    private createPlayerFrame(): void {
        // Player frame container
        const playerFrame = new Rectangle("playerFrame");
        playerFrame.width = "280px";
        playerFrame.height = "80px";
        playerFrame.cornerRadius = 10;
        playerFrame.color = "#333333";
        playerFrame.thickness = 2;
        playerFrame.background = "rgba(0, 0, 0, 0.7)";
        playerFrame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        playerFrame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        playerFrame.left = "20px";
        playerFrame.top = "20px";
        this.guiTexture.addControl(playerFrame);

        // Level circle
        this.levelText = new TextBlock("levelText", "1");
        this.levelText.color = "white";
        this.levelText.fontSize = 18;
        this.levelText.fontWeight = "bold";
        this.levelText.width = "40px";
        this.levelText.height = "40px";
        this.levelText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.levelText.left = "10px";
        playerFrame.addControl(this.levelText);

        // Health bar background
        const healthBarBg = new Rectangle("healthBarBg");
        healthBarBg.width = "200px";
        healthBarBg.height = "22px";
        healthBarBg.cornerRadius = 5;
        healthBarBg.background = "#2a2a2a";
        healthBarBg.thickness = 0;
        healthBarBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        healthBarBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        healthBarBg.left = "60px";
        healthBarBg.top = "15px";
        playerFrame.addControl(healthBarBg);

        // Health bar fill
        this.healthBar = new Rectangle("healthBar");
        this.healthBar.width = "100%";
        this.healthBar.height = "100%";
        this.healthBar.cornerRadius = 5;
        this.healthBar.background = "#22aa22";
        this.healthBar.thickness = 0;
        this.healthBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        healthBarBg.addControl(this.healthBar);

        // Health text
        this.healthText = new TextBlock("healthText", "100/100");
        this.healthText.color = "white";
        this.healthText.fontSize = 12;
        this.healthText.fontWeight = "bold";
        this.healthText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        healthBarBg.addControl(this.healthText);

        // Resource bar background
        const resourceBarBg = new Rectangle("resourceBarBg");
        resourceBarBg.width = "200px";
        resourceBarBg.height = "18px";
        resourceBarBg.cornerRadius = 5;
        resourceBarBg.background = "#2a2a2a";
        resourceBarBg.thickness = 0;
        resourceBarBg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        resourceBarBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        resourceBarBg.left = "60px";
        resourceBarBg.top = "42px";
        playerFrame.addControl(resourceBarBg);

        // Resource bar fill
        this.resourceBar = new Rectangle("resourceBar");
        this.resourceBar.width = "100%";
        this.resourceBar.height = "100%";
        this.resourceBar.cornerRadius = 5;
        this.resourceBar.background = "#2266cc"; // Will be updated based on class
        this.resourceBar.thickness = 0;
        this.resourceBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        resourceBarBg.addControl(this.resourceBar);

        // Resource text
        this.resourceText = new TextBlock("resourceText", "100/100");
        this.resourceText.color = "white";
        this.resourceText.fontSize = 11;
        this.resourceText.fontWeight = "bold";
        resourceBarBg.addControl(this.resourceText);
    }

    private createTargetFrame(): void {
        this.targetFrame = new Rectangle("targetFrame");
        this.targetFrame.width = "250px";
        this.targetFrame.height = "60px";
        this.targetFrame.cornerRadius = 10;
        this.targetFrame.color = "#333333";
        this.targetFrame.thickness = 2;
        this.targetFrame.background = "rgba(0, 0, 0, 0.7)";
        this.targetFrame.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.targetFrame.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.targetFrame.top = "20px";
        this.targetFrame.isVisible = false;
        this.guiTexture.addControl(this.targetFrame);

        // Target name
        this.targetNameText = new TextBlock("targetName", "Target Name");
        this.targetNameText.color = "#cc4444";
        this.targetNameText.fontSize = 14;
        this.targetNameText.fontWeight = "bold";
        this.targetNameText.height = "25px";
        this.targetNameText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.targetNameText.top = "8px";
        this.targetFrame.addControl(this.targetNameText);

        // Target health bar background
        const targetHealthBg = new Rectangle("targetHealthBg");
        targetHealthBg.width = "220px";
        targetHealthBg.height = "18px";
        targetHealthBg.cornerRadius = 5;
        targetHealthBg.background = "#2a2a2a";
        targetHealthBg.thickness = 0;
        targetHealthBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        targetHealthBg.top = "32px";
        this.targetFrame.addControl(targetHealthBg);

        // Target health bar fill
        this.targetHealthBar = new Rectangle("targetHealthBar");
        this.targetHealthBar.width = "100%";
        this.targetHealthBar.height = "100%";
        this.targetHealthBar.cornerRadius = 5;
        this.targetHealthBar.background = "#cc4444";
        this.targetHealthBar.thickness = 0;
        this.targetHealthBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        targetHealthBg.addControl(this.targetHealthBar);
    }

    private createAbilityBar(): void {
        const abilityContainer = new Rectangle("abilityContainer");
        abilityContainer.width = "520px";
        abilityContainer.height = "60px";
        abilityContainer.cornerRadius = 10;
        abilityContainer.color = "#333333";
        abilityContainer.thickness = 2;
        abilityContainer.background = "rgba(0, 0, 0, 0.7)";
        abilityContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        abilityContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        abilityContainer.top = "-20px";
        this.guiTexture.addControl(abilityContainer);

        this.abilityBar = new StackPanel("abilityBar");
        this.abilityBar.isVertical = false;
        this.abilityBar.height = "50px";
        this.abilityBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        abilityContainer.addControl(this.abilityBar);

        // Create 10 ability slots
        for (let i = 0; i < 10; i++) {
            const slot = this.createAbilitySlot(i);
            this.abilityBar.addControl(slot);
        }
    }

    private createAbilitySlot(index: number): Rectangle {
        const slot = new Rectangle(`abilitySlot_${index}`);
        slot.width = "48px";
        slot.height = "48px";
        slot.cornerRadius = 5;
        slot.color = "#555555";
        slot.thickness = 2;
        slot.background = "#1a1a1a";
        slot.paddingLeft = "2px";
        slot.paddingRight = "2px";

        // Hotkey label
        const hotkeyText = new TextBlock(
            `hotkey_${index}`,
            index === 9 ? "0" : `${index + 1}`
        );
        hotkeyText.color = "#888888";
        hotkeyText.fontSize = 10;
        hotkeyText.fontWeight = "bold";
        hotkeyText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        hotkeyText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        hotkeyText.top = "2px";
        hotkeyText.left = "-2px";
        slot.addControl(hotkeyText);

        return slot;
    }

    private createExperienceBar(): void {
        const xpBarBg = new Rectangle("xpBarBg");
        xpBarBg.width = "100%";
        xpBarBg.height = "8px";
        xpBarBg.background = "#1a1a1a";
        xpBarBg.thickness = 0;
        xpBarBg.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.guiTexture.addControl(xpBarBg);

        this.experienceBar = new Rectangle("xpBar");
        this.experienceBar.width = "0%";
        this.experienceBar.height = "100%";
        this.experienceBar.background = "#8844cc";
        this.experienceBar.thickness = 0;
        this.experienceBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        xpBarBg.addControl(this.experienceBar);
    }

    private createCombatLog(): void {
        const logContainer = new Rectangle("combatLogContainer");
        logContainer.width = "300px";
        logContainer.height = "150px";
        logContainer.cornerRadius = 5;
        logContainer.background = "rgba(0, 0, 0, 0.5)";
        logContainer.thickness = 0;
        logContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        logContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        logContainer.left = "20px";
        logContainer.top = "-100px";
        this.guiTexture.addControl(logContainer);

        this.combatLog = new StackPanel("combatLog");
        this.combatLog.isVertical = true;
        this.combatLog.width = "100%";
        this.combatLog.height = "100%";
        this.combatLog.paddingLeft = "10px";
        this.combatLog.paddingTop = "5px";
        logContainer.addControl(this.combatLog);
    }

    private createCastBar(): void {
        const castBarContainer = new Rectangle("castBarContainer");
        castBarContainer.width = "250px";
        castBarContainer.height = "25px";
        castBarContainer.cornerRadius = 5;
        castBarContainer.background = "rgba(0, 0, 0, 0.7)";
        castBarContainer.color = "#555555";
        castBarContainer.thickness = 2;
        castBarContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        castBarContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        castBarContainer.top = "100px";
        castBarContainer.isVisible = false;
        this.guiTexture.addControl(castBarContainer);
        this.castBar = castBarContainer;

        this.castBarFill = new Rectangle("castBarFill");
        this.castBarFill.width = "0%";
        this.castBarFill.height = "100%";
        this.castBarFill.cornerRadius = 5;
        this.castBarFill.background = "#ffaa00";
        this.castBarFill.thickness = 0;
        this.castBarFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        castBarContainer.addControl(this.castBarFill);

        this.castBarText = new TextBlock("castBarText", "Casting...");
        this.castBarText.color = "white";
        this.castBarText.fontSize = 12;
        this.castBarText.fontWeight = "bold";
        castBarContainer.addControl(this.castBarText);
    }

    private setupEventListeners(): void {
        // Damage dealt
        this.eventBus.on(GameEvents.DAMAGE_DEALT, (event) => {
            const critText = event.data.isCrit ? " (CRITIQUE!)" : "";
            this.addCombatLogMessage(
                `Vous infligez ${event.data.damage} dégâts${critText}`,
                "#ffaa00"
            );
        });

        // Damage received
        this.eventBus.on(GameEvents.DAMAGE_RECEIVED, (event) => {
            this.addCombatLogMessage(
                `Vous recevez ${event.data.damage} dégâts`,
                "#ff4444"
            );
        });

        // Healing
        this.eventBus.on(GameEvents.HEAL_RECEIVED, (event) => {
            const critText = event.data.isCrit ? " (CRITIQUE!)" : "";
            this.addCombatLogMessage(
                `Vous êtes soigné de ${event.data.healing}${critText}`,
                "#44ff44"
            );
        });

        // Level up
        this.eventBus.on(GameEvents.PLAYER_LEVEL_UP, (event) => {
            this.addCombatLogMessage(
                `Niveau ${event.data.level} atteint!`,
                "#ffff00"
            );
        });

        // Monster died
        this.eventBus.on(GameEvents.MONSTER_DIED, (event) => {
            this.addCombatLogMessage(
                `${event.data.monsterName} tué (+${event.data.experience} XP)`,
                "#aaaaff"
            );
        });

        // Cast start
        this.eventBus.on("cast_start", (event) => {
            this.showCastBar(event.data.abilityName, event.data.castTime);
        });

        // Cast complete
        this.eventBus.on("cast_complete", () => {
            this.hideCastBar();
        });

        // Cast interrupted
        this.eventBus.on("cast_interrupted", () => {
            this.hideCastBar();
            this.addCombatLogMessage("Incantation interrompue!", "#ff8800");
        });

        // Target selected
        this.eventBus.on(GameEvents.TARGET_SELECTED, (event) => {
            if (this.targetFrame) {
                this.targetFrame.isVisible = true;
            }
        });

        // Target cleared
        this.eventBus.on(GameEvents.TARGET_CLEARED, () => {
            if (this.targetFrame) {
                this.targetFrame.isVisible = false;
            }
        });
    }

    public updatePlayerFrame(character: Character): void {
        this.currentCharacter = character;

        // Update level
        if (this.levelText) {
            this.levelText.text = character.level.toString();
        }

        // Update health
        const healthPercent = (character.stats.health / character.stats.maxHealth) * 100;
        if (this.healthBar) {
            this.healthBar.width = `${healthPercent}%`;
            // Color based on health
            if (healthPercent > 50) {
                this.healthBar.background = "#22aa22";
            } else if (healthPercent > 25) {
                this.healthBar.background = "#aaaa22";
            } else {
                this.healthBar.background = "#aa2222";
            }
        }
        if (this.healthText) {
            this.healthText.text = `${Math.floor(character.stats.health)}/${character.stats.maxHealth}`;
        }

        // Update resource
        const resourcePercent =
            (character.stats.resource / character.stats.maxResource) * 100;
        if (this.resourceBar) {
            this.resourceBar.width = `${resourcePercent}%`;
            // Color based on class resource type
            const classDef = CLASS_DEFINITIONS[character.class];
            switch (classDef.resourceType) {
                case "mana":
                    this.resourceBar.background = "#2266cc";
                    break;
                case "rage":
                    this.resourceBar.background = "#cc2222";
                    break;
                case "energy":
                    this.resourceBar.background = "#cccc22";
                    break;
                case "focus":
                    this.resourceBar.background = "#22ccaa";
                    break;
            }
        }
        if (this.resourceText) {
            this.resourceText.text = `${Math.floor(character.stats.resource)}/${character.stats.maxResource}`;
        }

        // Update experience
        const xpPercent =
            (character.experience / character.experienceToNextLevel) * 100;
        if (this.experienceBar) {
            this.experienceBar.width = `${xpPercent}%`;
        }
    }

    public updateTargetFrame(
        name: string,
        currentHealth: number,
        maxHealth: number
    ): void {
        if (this.targetNameText) {
            this.targetNameText.text = name;
        }
        if (this.targetHealthBar) {
            const percent = (currentHealth / maxHealth) * 100;
            this.targetHealthBar.width = `${percent}%`;
        }
    }

    public updateAbilityBar(abilities: PlayerAbility[]): void {
        if (!this.abilityBar) return;

        for (let i = 0; i < 10; i++) {
            const slot = this.abilityBar.children[i] as Rectangle;
            if (!slot) continue;

            if (i < abilities.length) {
                const ability = abilities[i];

                // Add ability name/icon placeholder
                let abilityText = slot.getChildByName(`abilityText_${i}`) as TextBlock;
                if (!abilityText) {
                    abilityText = new TextBlock(`abilityText_${i}`, "");
                    abilityText.color = "white";
                    abilityText.fontSize = 9;
                    abilityText.textWrapping = true;
                    slot.addControl(abilityText);
                }
                abilityText.text = ability.name.substring(0, 6);

                // Update cooldown display
                if (ability.isOnCooldown) {
                    slot.background = "#333333";
                    let cdText = slot.getChildByName(`cd_${i}`) as TextBlock;
                    if (!cdText) {
                        cdText = new TextBlock(`cd_${i}`, "");
                        cdText.color = "#ff4444";
                        cdText.fontSize = 16;
                        cdText.fontWeight = "bold";
                        slot.addControl(cdText);
                    }
                    cdText.text = Math.ceil(ability.currentCooldown).toString();
                    cdText.isVisible = true;
                } else {
                    slot.background = "#1a1a1a";
                    const cdText = slot.getChildByName(`cd_${i}`) as TextBlock;
                    if (cdText) {
                        cdText.isVisible = false;
                    }
                }
            }
        }
    }

    private addCombatLogMessage(message: string, color: string = "white"): void {
        if (!this.combatLog) return;

        // Add new message
        const text = new TextBlock();
        text.text = message;
        text.color = color;
        text.fontSize = 12;
        text.height = "20px";
        text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        text.resizeToFit = true;

        this.combatLog.addControl(text);
        this.combatLogMessages.push(message);

        // Remove old messages
        while (this.combatLogMessages.length > this.maxCombatLogMessages) {
            this.combatLogMessages.shift();
            if (this.combatLog.children.length > 0) {
                this.combatLog.removeControl(this.combatLog.children[0]);
            }
        }
    }

    private showCastBar(abilityName: string, castTime: number): void {
        if (!this.castBar || !this.castBarFill || !this.castBarText) return;

        this.castBar.isVisible = true;
        this.castBarText.text = abilityName;
        this.castBarFill.width = "0%";

        // Animate cast bar
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 50;
            const percent = (elapsed / (castTime * 1000)) * 100;
            if (this.castBarFill) {
                this.castBarFill.width = `${Math.min(percent, 100)}%`;
            }
            if (elapsed >= castTime * 1000) {
                clearInterval(interval);
            }
        }, 50);
    }

    private hideCastBar(): void {
        if (this.castBar) {
            this.castBar.isVisible = false;
        }
    }

    public dispose(): void {
        this.guiTexture.dispose();
    }
}
