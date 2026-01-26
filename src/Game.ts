// ============================================
// AURA MMORPG - Game Class
// Main game orchestrator
// ============================================

import { Vector3 } from "@babylonjs/core";
import { GameEngine } from "./core/GameEngine";
import { EventBus, GameEvents } from "./core/EventBus";
import { PlayerController } from "./entities/player/PlayerController";
import { MonsterController } from "./entities/monsters/MonsterController";
import { NPCController, STARTER_ZONE_NPCS } from "./entities/npcs/NPCController";
import { HUDManager } from "./ui/HUDManager";
import { MONSTER_TEMPLATES } from "./data/MonsterTemplates";
import { CharacterClass, Monster } from "./types";

export class Game {
    private engine: GameEngine;
    private eventBus: EventBus;
    private player: PlayerController | null = null;
    private monsters: MonsterController[] = [];
    private npcs: NPCController[] = [];
    private hud: HUDManager | null = null;

    private isInitialized: boolean = false;
    private selectedClass: CharacterClass = CharacterClass.WARRIOR;

    constructor(canvasId: string) {
        this.engine = new GameEngine(canvasId);
        this.eventBus = this.engine.getEventBus();

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Game update loop
        this.eventBus.on(GameEvents.GAME_UPDATE, (event) => {
            this.update(event.data.deltaTime);
        });

        // Monster death - give XP to player
        this.eventBus.on(GameEvents.MONSTER_DIED, (event) => {
            if (this.player) {
                this.player.gainExperience(event.data.experience);
            }
        });

        // Monster attack - damage player
        this.eventBus.on("monster_attack", (event) => {
            if (this.player && event.data.targetId === "player") {
                this.player.takeDamage(event.data.damage);
            }
        });

        // Target selection - update target frame
        this.eventBus.on(GameEvents.TARGET_SELECTED, (event) => {
            this.updateTargetFrame(event.data.targetId);
        });

        // Damage dealt - apply to target
        this.eventBus.on(GameEvents.DAMAGE_DEALT, (event) => {
            const targetMonster = this.monsters.find(
                (m) => m.getMonster().id === event.data.targetId
            );
            if (targetMonster) {
                targetMonster.takeDamage(event.data.damage, event.data.sourceId);
            }
        });
    }

    public async start(): Promise<void> {
        // Show class selection
        this.showClassSelection();
    }

    private showClassSelection(): void {
        // Create class selection UI
        const container = document.createElement("div");
        container.id = "classSelection";
        container.innerHTML = `
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 40px;
        border-radius: 15px;
        border: 2px solid #666;
        text-align: center;
        font-family: 'Segoe UI', sans-serif;
        color: white;
        z-index: 1000;
      ">
        <h1 style="margin-bottom: 30px; color: #ffcc00;">🎮 AURA</h1>
        <h2 style="margin-bottom: 20px;">Choisissez votre classe</h2>
        <div style="display: flex; gap: 20px; justify-content: center;">
          <button class="class-btn" data-class="warrior" style="
            padding: 20px 30px;
            font-size: 16px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            background: linear-gradient(180deg, #cc3333, #881111);
            color: white;
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            ⚔️ Guerrier<br>
            <small style="opacity: 0.8;">Tank • Mêlée</small>
          </button>
          <button class="class-btn" data-class="mage" style="
            padding: 20px 30px;
            font-size: 16px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            background: linear-gradient(180deg, #3366cc, #112288);
            color: white;
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            🔮 Mage<br>
            <small style="opacity: 0.8;">DPS • Distance</small>
          </button>
          <button class="class-btn" data-class="druid" style="
            padding: 20px 30px;
            font-size: 16px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            background: linear-gradient(180deg, #33aa33, #116611);
            color: white;
            transition: transform 0.2s, box-shadow 0.2s;
          ">
            🌿 Druide<br>
            <small style="opacity: 0.8;">Hybride • Polyvalent</small>
          </button>
        </div>
        <p style="margin-top: 30px; opacity: 0.7; font-size: 14px;">
          Utilisez WASD pour vous déplacer, 1-6 pour les compétences<br>
          Cliquez sur les ennemis pour les cibler, Echap pour annuler
        </p>
      </div>
    `;

        document.body.appendChild(container);

        // Add hover effects
        const buttons = container.querySelectorAll(".class-btn");
        buttons.forEach((btn) => {
            btn.addEventListener("mouseenter", () => {
                (btn as HTMLElement).style.transform = "scale(1.1)";
                (btn as HTMLElement).style.boxShadow = "0 0 20px rgba(255, 255, 255, 0.3)";
            });
            btn.addEventListener("mouseleave", () => {
                (btn as HTMLElement).style.transform = "scale(1)";
                (btn as HTMLElement).style.boxShadow = "none";
            });
            btn.addEventListener("click", () => {
                const classType = (btn as HTMLElement).dataset.class;
                this.selectClass(classType as string);
                container.remove();
            });
        });
    }

    private selectClass(classType: string): void {
        switch (classType) {
            case "warrior":
                this.selectedClass = CharacterClass.WARRIOR;
                break;
            case "mage":
                this.selectedClass = CharacterClass.MAGE;
                break;
            case "druid":
                this.selectedClass = CharacterClass.DRUID;
                break;
        }

        this.initializeGame();
    }

    private initializeGame(): void {
        const scene = this.engine.getScene();

        // Create player
        this.player = new PlayerController(
            scene,
            this.eventBus,
            this.selectedClass,
            "Héros"
        );

        // Create HUD
        this.hud = new HUDManager(scene, this.eventBus);

        // Spawn monsters
        this.spawnMonsters();

        // Spawn NPCs
        this.spawnNPCs();

        // Attach camera to player
        const camera = this.engine.getCamera();
        camera.setTarget(this.player.getRootNode().position);

        // Start the game engine
        this.engine.start();
        this.isInitialized = true;

        console.log("🎮 Jeu initialisé avec la classe:", this.selectedClass);
    }

    private spawnMonsters(): void {
        const scene = this.engine.getScene();

        // Spawn various monsters around the map
        const monsterSpawns = [
            {
                template: "wolf", positions: [
                    { x: 20, y: 0, z: 15 },
                    { x: 25, y: 0, z: 20 },
                    { x: 30, y: 0, z: 10 },
                ]
            },
            {
                template: "boar", positions: [
                    { x: -20, y: 0, z: 25 },
                    { x: -25, y: 0, z: 30 },
                ]
            },
            {
                template: "bandit", positions: [
                    { x: 40, y: 0, z: -20 },
                    { x: 45, y: 0, z: -25 },
                    { x: 35, y: 0, z: -15 },
                ]
            },
            {
                template: "goblin_warrior", positions: [
                    { x: -40, y: 0, z: -30 },
                    { x: -45, y: 0, z: -35 },
                ]
            },
            {
                template: "alpha_wolf", positions: [
                    { x: 50, y: 0, z: 30 },
                ]
            },
            {
                template: "giant_spider", positions: [
                    { x: -50, y: 0, z: 40 },
                    { x: -55, y: 0, z: 45 },
                ]
            },
        ];

        for (const spawn of monsterSpawns) {
            const template = MONSTER_TEMPLATES[spawn.template];
            if (!template) continue;

            for (const pos of spawn.positions) {
                const monster = new MonsterController(
                    scene,
                    this.eventBus,
                    template,
                    pos
                );
                this.monsters.push(monster);
            }
        }

        console.log(`👹 ${this.monsters.length} monstres créés`);
    }

    private spawnNPCs(): void {
        const scene = this.engine.getScene();

        for (const npcData of STARTER_ZONE_NPCS) {
            const npc = new NPCController(scene, this.eventBus, npcData);
            this.npcs.push(npc);
        }

        console.log(`🧙 ${this.npcs.length} NPCs créés`);
    }

    private update(deltaTime: number): void {
        if (!this.isInitialized || !this.player) return;

        const playerPos = this.player.getPosition();

        // Update player
        this.player.update(deltaTime);

        // Update camera target
        const camera = this.engine.getCamera();
        camera.setTarget(playerPos);

        // Update monsters
        for (const monster of this.monsters) {
            monster.update(deltaTime, playerPos);

            // Check if monster is attacking player
            const m = monster.getMonster();
            if (m.currentTarget === "player" || m.currentTarget === this.player.getCharacter().id) {
                m.currentTarget = "player";
            }
        }

        // Update NPCs
        for (const npc of this.npcs) {
            npc.update(deltaTime, playerPos);
        }

        // Update HUD
        if (this.hud) {
            this.hud.updatePlayerFrame(this.player.getCharacter());
            this.hud.updateAbilityBar(this.player.getCharacter().abilities);
        }

        // Update target frame
        const targetId = this.player.getCharacter().currentTarget;
        if (targetId) {
            this.updateTargetFrame(targetId);
        }
    }

    private updateTargetFrame(targetId: string): void {
        const targetMonster = this.monsters.find(
            (m) => m.getMonster().id === targetId
        );

        if (targetMonster && this.hud) {
            const m = targetMonster.getMonster();
            this.hud.updateTargetFrame(m.name, m.currentHealth, m.maxHealth);
        }
    }

    public dispose(): void {
        this.player?.dispose();
        this.monsters.forEach((m) => m.dispose());
        this.npcs.forEach((n) => n.dispose());
        this.hud?.dispose();
        this.engine.dispose();
    }
}
