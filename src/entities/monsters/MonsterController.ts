// ============================================
// AURA MMORPG - Monster Controller
// Handles monster AI, combat, and behavior
// ============================================

import {
    Scene,
    Mesh,
    MeshBuilder,
    Vector3,
    StandardMaterial,
    Color3,
    TransformNode,
} from "@babylonjs/core";
import {
    Monster,
    MonsterTemplate,
    MonsterState,
    MonsterType,
    MonsterBehavior,
    LootTableEntry,
} from "../../types";
import { EventBus, GameEvents } from "../../core/EventBus";

export class MonsterController {
    private scene: Scene;
    private eventBus: EventBus;
    private monster: Monster;
    private template: MonsterTemplate;

    // 3D representation
    private rootNode: TransformNode;
    private bodyMesh: Mesh;

    // AI state
    private thinkTimer: number = 0;
    private thinkInterval: number = 0.5; // AI updates every 0.5 seconds
    private attackTimer: number = 0;
    private patrolIndex: number = 0;
    private patrolPath: Vector3[] = [];

    // Target tracking
    private targetPosition: Vector3 | null = null;
    private playerPosition: Vector3 | null = null;

    constructor(
        scene: Scene,
        eventBus: EventBus,
        template: MonsterTemplate,
        spawnPosition: { x: number; y: number; z: number },
        patrolPath?: { x: number; y: number; z: number }[]
    ) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.template = template;

        // Create monster data
        this.monster = this.createMonster(template, spawnPosition);

        // Create patrol path if provided
        if (patrolPath) {
            this.patrolPath = patrolPath.map(
                (p) => new Vector3(p.x, p.y, p.z)
            );
        }

        // Create 3D mesh
        this.rootNode = new TransformNode(`monster_${this.monster.id}`, scene);
        this.rootNode.position = new Vector3(
            spawnPosition.x,
            spawnPosition.y,
            spawnPosition.z
        );
        this.bodyMesh = this.createMonsterMesh();

        // Setup event listeners
        this.setupEventListeners();
    }

    private createMonster(
        template: MonsterTemplate,
        spawnPosition: { x: number; y: number; z: number }
    ): Monster {
        const healthMultiplier =
            template.type === MonsterType.ELITE
                ? 3
                : template.type === MonsterType.RARE
                    ? 2
                    : template.type === MonsterType.BOSS
                        ? 10
                        : 1;

        return {
            id: `monster_${template.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            templateId: template.id,
            name: template.name,
            level: template.level,
            type: template.type,
            currentHealth: template.baseHealth * healthMultiplier,
            maxHealth: template.baseHealth * healthMultiplier,
            position: { ...spawnPosition },
            spawnPosition: { ...spawnPosition },
            rotation: 0,
            state: MonsterState.IDLE,
            currentTarget: null,
            aggroTable: new Map(),
            respawnTime: 30,
            isDead: false,
        };
    }

    private createMonsterMesh(): Mesh {
        // Size based on monster type
        const scale =
            this.monster.type === MonsterType.BOSS
                ? 2.5
                : this.monster.type === MonsterType.ELITE
                    ? 1.5
                    : this.monster.type === MonsterType.RARE
                        ? 1.3
                        : 1;

        const body = MeshBuilder.CreateSphere(
            `${this.monster.id}_body`,
            { diameter: 1.2 * scale, segments: 16 },
            this.scene
        );

        body.parent = this.rootNode;
        body.position.y = 0.6 * scale;

        // Material based on type
        const material = new StandardMaterial(
            `${this.monster.id}_material`,
            this.scene
        );

        switch (this.monster.type) {
            case MonsterType.BOSS:
                material.diffuseColor = new Color3(0.8, 0.1, 0.8); // Purple
                material.emissiveColor = new Color3(0.2, 0, 0.2);
                break;
            case MonsterType.ELITE:
                material.diffuseColor = new Color3(0.9, 0.7, 0.1); // Gold
                break;
            case MonsterType.RARE:
                material.diffuseColor = new Color3(0.1, 0.6, 0.9); // Blue
                break;
            default:
                material.diffuseColor = new Color3(0.6, 0.3, 0.1); // Brown
        }

        body.material = material;

        // Make clickable for targeting
        body.isPickable = true;
        body.id = this.monster.id;
        body.name = `monster_${this.monster.id}`;

        return body;
    }

    private setupEventListeners(): void {
        // Listen for damage events targeting this monster
        this.eventBus.on(GameEvents.DAMAGE_DEALT, (event) => {
            if (event.data.targetId === this.monster.id) {
                this.takeDamage(event.data.damage, event.data.sourceId);
            }
        });

        // Track player position for AI
        this.eventBus.on(GameEvents.PLAYER_MOVE, (event) => {
            // This would typically get player position from game state
        });
    }

    public update(deltaTime: number, playerPos: Vector3): void {
        if (this.monster.isDead) return;

        this.playerPosition = playerPos;

        // AI think cycle
        this.thinkTimer += deltaTime;
        if (this.thinkTimer >= this.thinkInterval) {
            this.thinkTimer = 0;
            this.think();
        }

        // State-specific behavior
        switch (this.monster.state) {
            case MonsterState.IDLE:
                this.updateIdle(deltaTime);
                break;
            case MonsterState.PATROL:
                this.updatePatrol(deltaTime);
                break;
            case MonsterState.COMBAT:
                this.updateCombat(deltaTime);
                break;
            case MonsterState.PURSUIT:
                this.updatePursuit(deltaTime);
                break;
            case MonsterState.RETURNING:
                this.updateReturning(deltaTime);
                break;
        }
    }

    private think(): void {
        if (!this.playerPosition) return;

        const distanceToPlayer = Vector3.Distance(
            this.rootNode.position,
            this.playerPosition
        );

        const distanceToSpawn = Vector3.Distance(
            this.rootNode.position,
            new Vector3(
                this.monster.spawnPosition.x,
                this.monster.spawnPosition.y,
                this.monster.spawnPosition.z
            )
        );

        // State transitions
        switch (this.monster.state) {
            case MonsterState.IDLE:
            case MonsterState.PATROL:
                // Check for aggro
                if (this.shouldAggro(distanceToPlayer)) {
                    this.enterCombat("player");
                } else if (this.patrolPath.length > 0 && this.monster.state === MonsterState.IDLE) {
                    this.monster.state = MonsterState.PATROL;
                }
                break;

            case MonsterState.COMBAT:
            case MonsterState.PURSUIT:
                // Check for leash (too far from spawn)
                if (distanceToSpawn > this.template.leashRadius) {
                    this.reset();
                }
                // Check if target is in attack range
                else if (distanceToPlayer <= this.template.attackRange) {
                    this.monster.state = MonsterState.COMBAT;
                } else {
                    this.monster.state = MonsterState.PURSUIT;
                }
                break;

            case MonsterState.RETURNING:
                if (distanceToSpawn < 1) {
                    this.monster.state = MonsterState.IDLE;
                    this.monster.currentHealth = this.monster.maxHealth;
                }
                break;
        }
    }

    private shouldAggro(distanceToPlayer: number): boolean {
        if (distanceToPlayer > this.template.aggroRadius) return false;

        switch (this.template.behavior) {
            case MonsterBehavior.AGGRESSIVE:
                return true;
            case MonsterBehavior.TERRITORIAL:
                return distanceToPlayer < this.template.aggroRadius * 0.5;
            case MonsterBehavior.PASSIVE:
                // Only aggro if already in aggro table (was attacked)
                return this.monster.aggroTable.size > 0;
            default:
                return false;
        }
    }

    private enterCombat(targetId: string): void {
        this.monster.state = MonsterState.COMBAT;
        this.monster.currentTarget = targetId;

        this.eventBus.emit({
            type: GameEvents.MONSTER_AGGRO,
            data: {
                monsterId: this.monster.id,
                monsterName: this.monster.name,
                targetId,
            },
            timestamp: Date.now(),
        });

        console.log(`⚔️ ${this.monster.name} vous attaque!`);
    }

    private updateIdle(deltaTime: number): void {
        // Just stand around, maybe small idle animation
    }

    private updatePatrol(deltaTime: number): void {
        if (this.patrolPath.length === 0) {
            this.monster.state = MonsterState.IDLE;
            return;
        }

        const target = this.patrolPath[this.patrolIndex];
        const distance = Vector3.Distance(this.rootNode.position, target);

        if (distance < 0.5) {
            // Reached patrol point, move to next
            this.patrolIndex = (this.patrolIndex + 1) % this.patrolPath.length;
        } else {
            // Move towards patrol point
            this.moveTowards(target, deltaTime);
        }
    }

    private updateCombat(deltaTime: number): void {
        if (!this.playerPosition) return;

        // Face the player
        this.faceTarget(this.playerPosition);

        // Attack timer
        this.attackTimer += deltaTime;
        if (this.attackTimer >= 1 / this.template.attackSpeed) {
            this.attackTimer = 0;
            this.attack();
        }
    }

    private updatePursuit(deltaTime: number): void {
        if (!this.playerPosition) return;

        this.moveTowards(this.playerPosition, deltaTime);
        this.faceTarget(this.playerPosition);
    }

    private updateReturning(deltaTime: number): void {
        const spawnPos = new Vector3(
            this.monster.spawnPosition.x,
            this.monster.spawnPosition.y,
            this.monster.spawnPosition.z
        );

        this.moveTowards(spawnPos, deltaTime);
        this.faceTarget(spawnPos);
    }

    private moveTowards(target: Vector3, deltaTime: number): void {
        const direction = target.subtract(this.rootNode.position).normalize();
        const movement = direction.scale(this.template.movementSpeed * deltaTime);

        this.rootNode.position.addInPlace(movement);

        // Update monster position data
        this.monster.position = {
            x: this.rootNode.position.x,
            y: this.rootNode.position.y,
            z: this.rootNode.position.z,
        };
    }

    private faceTarget(target: Vector3): void {
        const direction = target.subtract(this.rootNode.position);
        this.monster.rotation = Math.atan2(direction.x, direction.z);
        this.rootNode.rotation.y = this.monster.rotation;
    }

    private attack(): void {
        const damage =
            Math.floor(
                Math.random() *
                (this.template.baseDamage.max - this.template.baseDamage.min + 1)
            ) + this.template.baseDamage.min;

        this.eventBus.emit({
            type: "monster_attack",
            data: {
                monsterId: this.monster.id,
                monsterName: this.monster.name,
                targetId: this.monster.currentTarget,
                damage,
            },
            timestamp: Date.now(),
        });
    }

    public takeDamage(amount: number, sourceId: string): void {
        if (this.monster.isDead) return;

        // Apply armor reduction
        const reduction = this.template.armor / (this.template.armor + 400);
        const finalDamage = Math.floor(amount * (1 - reduction));

        this.monster.currentHealth = Math.max(
            0,
            this.monster.currentHealth - finalDamage
        );

        // Add to aggro table
        const currentAggro = this.monster.aggroTable.get(sourceId) || 0;
        this.monster.aggroTable.set(sourceId, currentAggro + finalDamage);

        // Enter combat if not already
        if (this.monster.state === MonsterState.IDLE ||
            this.monster.state === MonsterState.PATROL) {
            this.enterCombat(sourceId);
        }

        // Visual feedback - flash red
        const material = this.bodyMesh.material as StandardMaterial;
        const originalColor = material.diffuseColor.clone();
        material.diffuseColor = new Color3(1, 0, 0);
        setTimeout(() => {
            if (!this.monster.isDead) {
                material.diffuseColor = originalColor;
            }
        }, 100);

        // Check for death
        if (this.monster.currentHealth <= 0) {
            this.die(sourceId);
        }
    }

    private die(killerId: string): void {
        this.monster.isDead = true;
        this.monster.state = MonsterState.DEAD;
        this.monster.currentTarget = null;

        // Visual: fall over or fade out
        this.bodyMesh.scaling.y = 0.1;
        this.bodyMesh.position.y = 0.1;

        // Calculate loot and XP
        const experienceReward = this.template.experienceReward;

        this.eventBus.emit({
            type: GameEvents.MONSTER_DIED,
            data: {
                monsterId: this.monster.id,
                monsterName: this.monster.name,
                killerId,
                experience: experienceReward,
                loot: this.generateLoot(),
            },
            timestamp: Date.now(),
        });

        console.log(`💀 ${this.monster.name} est mort! (+${experienceReward} XP)`);

        // Schedule respawn
        setTimeout(() => this.respawn(), this.monster.respawnTime * 1000);
    }

    private generateLoot(): { itemId: string; quantity: number }[] {
        const loot: { itemId: string; quantity: number }[] = [];

        for (const entry of this.template.lootTable) {
            if (Math.random() < entry.dropChance) {
                const quantity =
                    Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1)) +
                    entry.minQuantity;
                loot.push({ itemId: entry.itemId, quantity });
            }
        }

        return loot;
    }

    private reset(): void {
        this.monster.state = MonsterState.RETURNING;
        this.monster.currentTarget = null;
        this.monster.aggroTable.clear();

        this.eventBus.emit({
            type: GameEvents.MONSTER_RESET,
            data: {
                monsterId: this.monster.id,
                monsterName: this.monster.name,
            },
            timestamp: Date.now(),
        });

        console.log(`🔄 ${this.monster.name} réinitialise`);
    }

    private respawn(): void {
        this.monster.isDead = false;
        this.monster.currentHealth = this.monster.maxHealth;
        this.monster.state = MonsterState.IDLE;
        this.monster.position = { ...this.monster.spawnPosition };
        this.monster.aggroTable.clear();

        this.rootNode.position = new Vector3(
            this.monster.spawnPosition.x,
            this.monster.spawnPosition.y,
            this.monster.spawnPosition.z
        );

        this.bodyMesh.scaling.y = 1;
        this.bodyMesh.position.y = 0.6;

        this.eventBus.emit({
            type: GameEvents.MONSTER_SPAWN,
            data: {
                monsterId: this.monster.id,
                monsterName: this.monster.name,
            },
            timestamp: Date.now(),
        });
    }

    // Getters
    public getMonster(): Monster {
        return this.monster;
    }

    public getPosition(): Vector3 {
        return this.rootNode.position.clone();
    }

    public getRootNode(): TransformNode {
        return this.rootNode;
    }

    public isAlive(): boolean {
        return !this.monster.isDead;
    }

    public dispose(): void {
        this.rootNode.dispose();
        this.bodyMesh.dispose();
    }
}
