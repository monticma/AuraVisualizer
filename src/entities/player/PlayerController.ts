// ============================================
// AURA MMORPG - Player Controller
// Handles player movement, abilities, and state
// ============================================

import {
    Scene,
    Mesh,
    MeshBuilder,
    Vector3,
    StandardMaterial,
    Color3,
    TransformNode,
    Animation,
    AnimationGroup,
} from "@babylonjs/core";
import {
    Character,
    CharacterClass,
    CharacterStats,
    PlayerAbility,
    Equipment,
    EquipmentSlot,
} from "../../types";
import { EventBus, GameEvents } from "../../core/EventBus";
import { CLASS_DEFINITIONS, ABILITIES, LEVEL_CONFIG, getExperienceForLevel } from "../../data/ClassDefinitions";

export class PlayerController {
    private scene: Scene;
    private eventBus: EventBus;
    private character: Character;

    // 3D representation
    private rootNode: TransformNode;
    private bodyMesh: Mesh;

    // Movement
    private movementSpeed: number = 7;
    private rotationSpeed: number = 0.1;
    private targetRotation: number = 0;
    private isMoving: boolean = false;

    // Combat
    private globalCooldown: number = 0;
    private isCasting: boolean = false;
    private currentCastTime: number = 0;
    private castingAbility: PlayerAbility | null = null;

    constructor(
        scene: Scene,
        eventBus: EventBus,
        characterClass: CharacterClass,
        name: string = "Héros"
    ) {
        this.scene = scene;
        this.eventBus = eventBus;

        // Create character data
        this.character = this.createCharacter(characterClass, name);

        // Create 3D mesh
        this.rootNode = new TransformNode("player_root", scene);
        this.bodyMesh = this.createPlayerMesh();

        // Setup event listeners
        this.setupEventListeners();
    }

    private createCharacter(
        characterClass: CharacterClass,
        name: string
    ): Character {
        const classDef = CLASS_DEFINITIONS[characterClass];

        // Calculate initial stats
        const stats: CharacterStats = {
            ...classDef.baseStats,
            maxHealth: classDef.baseStats.health,
            maxResource: classDef.baseStats.resource,
            critChance: 5 + classDef.baseStats.agility / 20,
            critDamage: 150,
            attackSpeed: 1.0,
            movementSpeed: 7,
        };

        // Create abilities from class definition
        const abilities: PlayerAbility[] = classDef.abilities.map((abilityId) => {
            const ability = ABILITIES[abilityId];
            return {
                ...ability,
                currentCooldown: 0,
                isOnCooldown: false,
            };
        });

        return {
            id: `player_${Date.now()}`,
            name,
            class: characterClass,
            level: 1,
            experience: 0,
            experienceToNextLevel: getExperienceForLevel(1),
            stats,
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
            equipment: {} as Equipment,
            inventory: [],
            abilities,
            talents: [],
            currentTarget: null,
        };
    }

    private createPlayerMesh(): Mesh {
        // Create a simple capsule for the player (placeholder)
        const body = MeshBuilder.CreateCapsule(
            "player_body",
            {
                height: 2,
                radius: 0.4,
                tessellation: 16,
                subdivisions: 4,
            },
            this.scene
        );

        body.parent = this.rootNode;
        body.position.y = 1; // Stand on ground

        // Material based on class
        const material = new StandardMaterial("player_material", this.scene);

        switch (this.character.class) {
            case CharacterClass.WARRIOR:
                material.diffuseColor = new Color3(0.8, 0.2, 0.2); // Red
                break;
            case CharacterClass.MAGE:
                material.diffuseColor = new Color3(0.2, 0.2, 0.8); // Blue
                break;
            case CharacterClass.DRUID:
                material.diffuseColor = new Color3(0.2, 0.7, 0.3); // Green
                break;
            default:
                material.diffuseColor = new Color3(0.5, 0.5, 0.5);
        }

        material.specularColor = new Color3(0.3, 0.3, 0.3);
        body.material = material;

        // Add a simple "head" indicator
        const head = MeshBuilder.CreateSphere(
            "player_head",
            { diameter: 0.5 },
            this.scene
        );
        head.parent = this.rootNode;
        head.position.y = 2.2;
        head.material = material;

        return body;
    }

    private setupEventListeners(): void {
        // Movement
        this.eventBus.on(GameEvents.PLAYER_MOVE, (event) => {
            this.handleMovement(event.data.direction, event.data.deltaTime);
        });

        // Ability usage
        this.eventBus.on(GameEvents.PLAYER_USE_ABILITY, (event) => {
            this.useAbility(event.data.slotIndex);
        });

        // Target selection
        this.eventBus.on("mesh_clicked", (event) => {
            if (event.data.meshName.startsWith("monster_")) {
                this.setTarget(event.data.meshId);
            } else if (event.data.meshName.startsWith("npc_")) {
                this.interactWithNPC(event.data.meshId);
            }
        });

        // Tab targeting
        this.eventBus.on("tab_target", () => {
            // Will be implemented with monster system
        });

        // Clear target
        this.eventBus.on("escape_pressed", () => {
            this.clearTarget();
        });
    }

    private handleMovement(
        direction: { x: number; z: number },
        deltaTime: number
    ): void {
        if (this.isCasting) {
            // Interrupt cast on movement (optional behavior)
            this.interruptCast();
        }

        this.isMoving = direction.x !== 0 || direction.z !== 0;

        if (!this.isMoving) return;

        // Calculate camera-relative movement direction
        const cameraRotation = this.scene.activeCamera?.absoluteRotation.toEulerAngles().y || 0;

        const moveX = direction.x * Math.cos(cameraRotation) - direction.z * Math.sin(cameraRotation);
        const moveZ = direction.x * Math.sin(cameraRotation) + direction.z * Math.cos(cameraRotation);

        // Apply movement
        const speed = this.movementSpeed * deltaTime;
        this.rootNode.position.x += moveX * speed;
        this.rootNode.position.z += moveZ * speed;

        // Rotate player to face movement direction
        if (moveX !== 0 || moveZ !== 0) {
            this.targetRotation = Math.atan2(moveX, moveZ);
            this.rootNode.rotation.y = this.lerpAngle(
                this.rootNode.rotation.y,
                this.targetRotation,
                this.rotationSpeed * deltaTime * 60
            );
        }

        // Update character position
        this.character.position = {
            x: this.rootNode.position.x,
            y: this.rootNode.position.y,
            z: this.rootNode.position.z,
        };
        this.character.rotation = this.rootNode.rotation.y;
    }

    private lerpAngle(current: number, target: number, t: number): number {
        let diff = target - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return current + diff * Math.min(t, 1);
    }

    public update(deltaTime: number): void {
        // Update cooldowns
        this.globalCooldown = Math.max(0, this.globalCooldown - deltaTime);

        this.character.abilities.forEach((ability) => {
            if (ability.isOnCooldown) {
                ability.currentCooldown = Math.max(0, ability.currentCooldown - deltaTime);
                if (ability.currentCooldown <= 0) {
                    ability.isOnCooldown = false;
                }
            }
        });

        // Update casting
        if (this.isCasting && this.castingAbility) {
            this.currentCastTime += deltaTime;
            if (this.currentCastTime >= this.castingAbility.castTime) {
                this.completeCast();
            }
        }

        // Natural resource regeneration
        this.regenerateResource(deltaTime);
    }

    private regenerateResource(deltaTime: number): void {
        const classDef = CLASS_DEFINITIONS[this.character.class];

        // Different regen based on resource type
        let regenRate = 0;
        switch (classDef.resourceType) {
            case "mana":
                regenRate = (this.character.stats.spirit / 5) * deltaTime;
                break;
            case "energy":
                regenRate = 10 * deltaTime; // Fixed regen
                break;
            case "rage":
                // Rage decays out of combat
                regenRate = -2 * deltaTime;
                break;
            case "focus":
                regenRate = 5 * deltaTime;
                break;
        }

        this.character.stats.resource = Math.max(
            0,
            Math.min(
                this.character.stats.maxResource,
                this.character.stats.resource + regenRate
            )
        );
    }

    private useAbility(slotIndex: number): void {
        if (slotIndex >= this.character.abilities.length) return;

        const ability = this.character.abilities[slotIndex];

        // Check if can use
        if (!this.canUseAbility(ability)) return;

        // Check range to target if needed
        if (ability.range > 0 && !this.character.currentTarget) {
            console.log("Pas de cible sélectionnée");
            return;
        }

        // Instant cast or start casting
        if (ability.castTime === 0) {
            this.executeAbility(ability);
        } else {
            this.startCast(ability);
        }
    }

    private canUseAbility(ability: PlayerAbility): boolean {
        // Check cooldown
        if (ability.isOnCooldown) {
            console.log(`${ability.name} est en recharge`);
            return false;
        }

        // Check GCD
        if (this.globalCooldown > 0) {
            return false;
        }

        // Check resource
        if (ability.resourceCost > 0 && this.character.stats.resource < ability.resourceCost) {
            console.log("Pas assez de ressource");
            return false;
        }

        // Check level
        if (ability.requiredLevel > this.character.level) {
            console.log(`Niveau ${ability.requiredLevel} requis`);
            return false;
        }

        // Check if already casting
        if (this.isCasting) {
            return false;
        }

        return true;
    }

    private startCast(ability: PlayerAbility): void {
        this.isCasting = true;
        this.currentCastTime = 0;
        this.castingAbility = ability;

        this.eventBus.emit({
            type: "cast_start",
            data: {
                abilityId: ability.id,
                abilityName: ability.name,
                castTime: ability.castTime,
            },
            timestamp: Date.now(),
        });
    }

    private completeCast(): void {
        if (!this.castingAbility) return;

        this.executeAbility(this.castingAbility);

        this.isCasting = false;
        this.castingAbility = null;
        this.currentCastTime = 0;

        this.eventBus.emit({
            type: "cast_complete",
            data: {},
            timestamp: Date.now(),
        });
    }

    private interruptCast(): void {
        if (!this.isCasting) return;

        this.eventBus.emit({
            type: "cast_interrupted",
            data: { abilityId: this.castingAbility?.id },
            timestamp: Date.now(),
        });

        this.isCasting = false;
        this.castingAbility = null;
        this.currentCastTime = 0;
    }

    private executeAbility(ability: PlayerAbility): void {
        // Consume resource
        if (ability.resourceCost > 0) {
            this.character.stats.resource -= ability.resourceCost;
        } else if (ability.resourceCost < 0) {
            // Generate resource (like Warrior's Charge)
            this.character.stats.resource = Math.min(
                this.character.stats.maxResource,
                this.character.stats.resource - ability.resourceCost
            );
        }

        // Start cooldown
        if (ability.cooldown > 0) {
            ability.isOnCooldown = true;
            ability.currentCooldown = ability.cooldown;
        }

        // Set GCD (1.5 seconds standard)
        this.globalCooldown = 1.5;

        // Calculate damage/healing
        let value = 0;
        if (ability.minDamage && ability.maxDamage) {
            value = Math.floor(
                Math.random() * (ability.maxDamage - ability.minDamage + 1) +
                ability.minDamage
            );

            // Apply stats scaling
            if (ability.damageType === "physical") {
                value += Math.floor(this.character.stats.strength * 0.5);
            } else {
                value += Math.floor(this.character.stats.intellect * 0.5);
            }

            // Check for crit
            const isCrit = Math.random() * 100 < this.character.stats.critChance;
            if (isCrit) {
                value = Math.floor(value * (this.character.stats.critDamage / 100));
            }

            this.eventBus.emit({
                type: GameEvents.DAMAGE_DEALT,
                data: {
                    sourceId: this.character.id,
                    targetId: this.character.currentTarget,
                    abilityId: ability.id,
                    damage: value,
                    isCrit,
                    damageType: ability.damageType,
                },
                timestamp: Date.now(),
            });
        } else if (ability.healAmount) {
            value = ability.healAmount;
            value += Math.floor(this.character.stats.intellect * 0.3);

            const isCrit = Math.random() * 100 < this.character.stats.critChance;
            if (isCrit) {
                value = Math.floor(value * 1.5);
            }

            this.eventBus.emit({
                type: GameEvents.HEAL_RECEIVED,
                data: {
                    sourceId: this.character.id,
                    targetId: this.character.id, // Self-heal for now
                    abilityId: ability.id,
                    healing: value,
                    isCrit,
                },
                timestamp: Date.now(),
            });

            // Apply healing
            this.character.stats.health = Math.min(
                this.character.stats.maxHealth,
                this.character.stats.health + value
            );
        }

        console.log(`🔮 ${ability.name} utilisé! ${value > 0 ? `(${value})` : ""}`);
    }

    private setTarget(targetId: string): void {
        this.character.currentTarget = targetId;

        this.eventBus.emit({
            type: GameEvents.TARGET_SELECTED,
            data: { targetId },
            timestamp: Date.now(),
        });
    }

    private clearTarget(): void {
        this.character.currentTarget = null;

        this.eventBus.emit({
            type: GameEvents.TARGET_CLEARED,
            data: {},
            timestamp: Date.now(),
        });
    }

    private interactWithNPC(npcId: string): void {
        this.eventBus.emit({
            type: GameEvents.NPC_INTERACT,
            data: { npcId },
            timestamp: Date.now(),
        });
    }

    public gainExperience(amount: number): void {
        this.character.experience += amount;

        // Check for level up
        while (
            this.character.experience >= this.character.experienceToNextLevel &&
            this.character.level < LEVEL_CONFIG.maxLevel
        ) {
            this.levelUp();
        }
    }

    private levelUp(): void {
        this.character.experience -= this.character.experienceToNextLevel;
        this.character.level++;
        this.character.experienceToNextLevel = getExperienceForLevel(this.character.level);

        // Increase stats
        const growth = LEVEL_CONFIG.statGrowthPerLevel;
        this.character.stats.maxHealth += growth.health;
        this.character.stats.maxResource += growth.resource;
        this.character.stats.strength += growth.strength;
        this.character.stats.intellect += growth.intellect;
        this.character.stats.agility += growth.agility;
        this.character.stats.stamina += growth.stamina;
        this.character.stats.spirit += growth.spirit;
        this.character.stats.armor += growth.armor;

        // Restore to full
        this.character.stats.health = this.character.stats.maxHealth;
        this.character.stats.resource = this.character.stats.maxResource;

        this.eventBus.emit({
            type: GameEvents.PLAYER_LEVEL_UP,
            data: { level: this.character.level },
            timestamp: Date.now(),
        });

        console.log(`🎉 Niveau ${this.character.level} atteint!`);
    }

    public takeDamage(amount: number): void {
        // Apply armor reduction
        const reduction = this.character.stats.armor /
            (this.character.stats.armor + 400 + 85 * this.character.level);
        const finalDamage = Math.floor(amount * (1 - reduction));

        this.character.stats.health = Math.max(0, this.character.stats.health - finalDamage);

        this.eventBus.emit({
            type: GameEvents.DAMAGE_RECEIVED,
            data: { damage: finalDamage, armor: this.character.stats.armor },
            timestamp: Date.now(),
        });

        if (this.character.stats.health <= 0) {
            this.die();
        }
    }

    private die(): void {
        this.eventBus.emit({
            type: GameEvents.PLAYER_DIED,
            data: {},
            timestamp: Date.now(),
        });

        console.log("💀 Vous êtes mort!");

        // Respawn after 5 seconds
        setTimeout(() => this.respawn(), 5000);
    }

    private respawn(): void {
        this.character.stats.health = this.character.stats.maxHealth * 0.5;
        this.character.stats.resource = this.character.stats.maxResource * 0.5;

        // Move to spawn point (0, 0, 0 for now)
        this.rootNode.position = new Vector3(0, 0, 0);
        this.character.position = { x: 0, y: 0, z: 0 };

        this.eventBus.emit({
            type: GameEvents.PLAYER_RESPAWN,
            data: {},
            timestamp: Date.now(),
        });

        console.log("✨ Vous êtes ressuscité!");
    }

    // Getters
    public getCharacter(): Character {
        return this.character;
    }

    public getPosition(): Vector3 {
        return this.rootNode.position.clone();
    }

    public getRootNode(): TransformNode {
        return this.rootNode;
    }

    public dispose(): void {
        this.rootNode.dispose();
        this.bodyMesh.dispose();
    }
}
