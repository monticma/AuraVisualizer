// ============================================
// AURA MMORPG - NPC Controller
// Handles NPC interactions, dialogue, and services
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
    NPC,
    NPCType,
    DialogueTree,
    DialogueOption,
    NPCService,
    MerchantData,
    TrainerData,
    CharacterClass,
} from "../../types";
import { EventBus, GameEvents } from "../../core/EventBus";

export class NPCController {
    private scene: Scene;
    private eventBus: EventBus;
    private npc: NPC;

    // 3D representation
    private rootNode: TransformNode;
    private bodyMesh: Mesh;
    private nameplate: Mesh | null = null;

    // Interaction state
    private isPlayerNearby: boolean = false;
    private interactionRadius: number = 5;

    constructor(scene: Scene, eventBus: EventBus, npcData: NPC) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.npc = npcData;

        // Create 3D representation
        this.rootNode = new TransformNode(`npc_${this.npc.id}`, scene);
        this.rootNode.position = new Vector3(
            npcData.position.x,
            npcData.position.y,
            npcData.position.z
        );
        this.rootNode.rotation.y = npcData.rotation;

        this.bodyMesh = this.createNPCMesh();

        // Setup event listeners
        this.setupEventListeners();
    }

    private createNPCMesh(): Mesh {
        // Create humanoid capsule
        const body = MeshBuilder.CreateCapsule(
            `${this.npc.id}_body`,
            {
                height: 2,
                radius: 0.4,
                tessellation: 16,
                subdivisions: 4,
            },
            this.scene
        );

        body.parent = this.rootNode;
        body.position.y = 1;

        // Material based on NPC type
        const material = new StandardMaterial(`${this.npc.id}_material`, this.scene);

        switch (this.npc.type) {
            case NPCType.QUEST_GIVER:
                material.diffuseColor = new Color3(0.9, 0.8, 0.2); // Gold/Yellow
                break;
            case NPCType.MERCHANT:
                material.diffuseColor = new Color3(0.2, 0.7, 0.3); // Green
                break;
            case NPCType.CLASS_TRAINER:
                material.diffuseColor = new Color3(0.3, 0.5, 0.9); // Blue
                break;
            case NPCType.BANKER:
                material.diffuseColor = new Color3(0.7, 0.5, 0.2); // Brown/Bronze
                break;
            case NPCType.INNKEEPER:
                material.diffuseColor = new Color3(0.9, 0.5, 0.3); // Orange
                break;
            case NPCType.REPAIR:
                material.diffuseColor = new Color3(0.5, 0.5, 0.5); // Gray
                break;
            default:
                material.diffuseColor = new Color3(0.6, 0.6, 0.6);
        }

        material.specularColor = new Color3(0.2, 0.2, 0.2);
        body.material = material;

        // Make clickable
        body.isPickable = true;
        body.id = this.npc.id;
        body.name = `npc_${this.npc.id}`;

        // Add quest indicator if quest giver with available quests
        if (this.npc.type === NPCType.QUEST_GIVER) {
            this.addQuestIndicator();
        }

        return body;
    }

    private addQuestIndicator(): void {
        const indicator = MeshBuilder.CreateBox(
            `${this.npc.id}_quest_indicator`,
            { size: 0.3 },
            this.scene
        );
        indicator.parent = this.rootNode;
        indicator.position.y = 2.8;

        const material = new StandardMaterial(
            `${this.npc.id}_indicator_material`,
            this.scene
        );
        material.diffuseColor = new Color3(1, 0.9, 0);
        material.emissiveColor = new Color3(0.5, 0.45, 0);
        indicator.material = material;

        // Rotate the indicator for visual effect
        this.scene.onBeforeRenderObservable.add(() => {
            indicator.rotation.y += 0.02;
        });
    }

    private setupEventListeners(): void {
        // Handle interaction
        this.eventBus.on(GameEvents.NPC_INTERACT, (event) => {
            if (event.data.npcId === this.npc.id) {
                this.interact();
            }
        });

        // Handle mesh click
        this.eventBus.on("mesh_clicked", (event) => {
            if (event.data.meshId === this.npc.id) {
                this.interact();
            }
        });
    }

    public update(deltaTime: number, playerPosition: Vector3): void {
        const distance = Vector3.Distance(this.rootNode.position, playerPosition);
        this.isPlayerNearby = distance <= this.interactionRadius;

        // Face towards player when nearby
        if (this.isPlayerNearby) {
            const direction = playerPosition.subtract(this.rootNode.position);
            const targetRotation = Math.atan2(direction.x, direction.z);

            // Smooth rotation
            let diff = targetRotation - this.rootNode.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            this.rootNode.rotation.y += diff * deltaTime * 3;
        }
    }

    private interact(): void {
        if (!this.isPlayerNearby) {
            console.log("Trop loin pour interagir");
            return;
        }

        this.eventBus.emit({
            type: GameEvents.DIALOGUE_START,
            data: {
                npcId: this.npc.id,
                npcName: this.npc.name,
                npcTitle: this.npc.title,
                npcType: this.npc.type,
                dialogue: this.npc.dialogue,
                services: this.npc.services,
            },
            timestamp: Date.now(),
        });

        console.log(`💬 ${this.npc.name}: "${this.npc.dialogue.greeting}"`);
    }

    // Getters
    public getNPC(): NPC {
        return this.npc;
    }

    public getPosition(): Vector3 {
        return this.rootNode.position.clone();
    }

    public isNearPlayer(): boolean {
        return this.isPlayerNearby;
    }

    public dispose(): void {
        this.rootNode.dispose();
        this.bodyMesh.dispose();
        if (this.nameplate) {
            this.nameplate.dispose();
        }
    }
}

// ============================================
// Pre-defined NPC configurations for starter zone
// ============================================

export const STARTER_ZONE_NPCS: NPC[] = [
    // Quest Giver
    {
        id: "npc_mayor_aldric",
        name: "Maire Aldric",
        title: "Chef du Village",
        type: NPCType.QUEST_GIVER,
        position: { x: 5, y: 0, z: 5 },
        rotation: 0,
        modelId: "human_male",
        dialogue: {
            greeting: "Bienvenue, aventurier ! Notre village a besoin de votre aide.",
            options: [
                {
                    id: "quest_wolves",
                    text: "Que puis-je faire pour vous aider ?",
                    response:
                        "Les loups terrorisent nos fermiers. Pouvez-vous en éliminer 5 ?",
                    action: { type: "give_quest", data: { questId: "kill_wolves" } },
                },
                {
                    id: "about_village",
                    text: "Parlez-moi du village.",
                    response:
                        "Prairieville est un paisible village de fermiers... du moins, c'était le cas avant l'arrivée des monstres.",
                },
                {
                    id: "goodbye",
                    text: "Au revoir.",
                },
            ],
        },
        services: [],
    },

    // Merchant
    {
        id: "npc_merchant_elena",
        name: "Elena",
        title: "Marchande Générale",
        type: NPCType.MERCHANT,
        position: { x: -8, y: 0, z: 3 },
        rotation: Math.PI / 4,
        modelId: "human_female",
        dialogue: {
            greeting: "Bienvenue dans ma boutique ! Que puis-je faire pour vous ?",
            options: [
                {
                    id: "browse",
                    text: "Montrez-moi vos marchandises.",
                    action: { type: "open_shop" },
                },
                {
                    id: "sell",
                    text: "J'ai des choses à vendre.",
                    action: { type: "open_shop", data: { mode: "sell" } },
                },
                {
                    id: "goodbye",
                    text: "Au revoir.",
                },
            ],
        },
        services: [
            {
                type: NPCType.MERCHANT,
                data: {
                    items: [
                        { itemId: "health_potion_small", price: 25, stock: -1 },
                        { itemId: "mana_potion_small", price: 30, stock: -1 },
                        { itemId: "bread", price: 5, stock: -1 },
                        { itemId: "torch", price: 10, stock: -1 },
                        { itemId: "rope", price: 15, stock: 10 },
                    ],
                    buybackMultiplier: 0.25,
                } as MerchantData,
            },
        ],
    },

    // Warrior Trainer
    {
        id: "npc_trainer_brutus",
        name: "Brutus",
        title: "Maître d'Armes",
        type: NPCType.CLASS_TRAINER,
        position: { x: 10, y: 0, z: -5 },
        rotation: -Math.PI / 2,
        modelId: "human_male_warrior",
        dialogue: {
            greeting:
                "La force est la clé de la victoire ! Voulez-vous apprendre l'art du combat ?",
            options: [
                {
                    id: "train",
                    text: "Apprenez-moi de nouvelles techniques.",
                    action: { type: "open_trainer" },
                    condition: { type: "class", value: CharacterClass.WARRIOR },
                },
                {
                    id: "not_warrior",
                    text: "[Cette option apparaît si vous n'êtes pas guerrier]",
                    response:
                        "Vous n'êtes pas un guerrier. Cherchez un maître de votre classe.",
                },
                {
                    id: "goodbye",
                    text: "Au revoir.",
                },
            ],
        },
        services: [
            {
                type: NPCType.CLASS_TRAINER,
                data: {
                    trainableClass: CharacterClass.WARRIOR,
                    abilities: [
                        { abilityId: "warrior_heroic_strike", cost: 50, requiredLevel: 2 },
                        { abilityId: "warrior_shield_block", cost: 100, requiredLevel: 4 },
                        { abilityId: "warrior_taunt", cost: 150, requiredLevel: 6 },
                        { abilityId: "warrior_charge", cost: 200, requiredLevel: 8 },
                        { abilityId: "warrior_execute", cost: 300, requiredLevel: 10 },
                    ],
                } as TrainerData,
            },
        ],
    },

    // Mage Trainer
    {
        id: "npc_trainer_mystara",
        name: "Mystara",
        title: "Archimage",
        type: NPCType.CLASS_TRAINER,
        position: { x: -10, y: 0, z: -8 },
        rotation: Math.PI / 3,
        modelId: "human_female_mage",
        dialogue: {
            greeting: "Les arcanes sont infinies... Souhaitez-vous en apprendre davantage ?",
            options: [
                {
                    id: "train",
                    text: "Enseignez-moi de nouveaux sorts.",
                    action: { type: "open_trainer" },
                    condition: { type: "class", value: CharacterClass.MAGE },
                },
                {
                    id: "goodbye",
                    text: "Au revoir.",
                },
            ],
        },
        services: [
            {
                type: NPCType.CLASS_TRAINER,
                data: {
                    trainableClass: CharacterClass.MAGE,
                    abilities: [
                        { abilityId: "mage_frostbolt", cost: 50, requiredLevel: 2 },
                        { abilityId: "mage_arcane_missiles", cost: 100, requiredLevel: 4 },
                        { abilityId: "mage_frost_nova", cost: 150, requiredLevel: 6 },
                        { abilityId: "mage_blink", cost: 200, requiredLevel: 8 },
                        { abilityId: "mage_pyroblast", cost: 300, requiredLevel: 10 },
                    ],
                } as TrainerData,
            },
        ],
    },

    // Druid Trainer
    {
        id: "npc_trainer_thornweave",
        name: "Thornweave",
        title: "Archidruide",
        type: NPCType.CLASS_TRAINER,
        position: { x: 0, y: 0, z: -12 },
        rotation: Math.PI,
        modelId: "elf_male_druid",
        dialogue: {
            greeting:
                "La nature vous appelle, jeune druide. Êtes-vous prêt à écouter sa voix ?",
            options: [
                {
                    id: "train",
                    text: "Apprenez-moi la voie de la nature.",
                    action: { type: "open_trainer" },
                    condition: { type: "class", value: CharacterClass.DRUID },
                },
                {
                    id: "goodbye",
                    text: "Au revoir.",
                },
            ],
        },
        services: [
            {
                type: NPCType.CLASS_TRAINER,
                data: {
                    trainableClass: CharacterClass.DRUID,
                    abilities: [
                        { abilityId: "druid_rejuvenation", cost: 50, requiredLevel: 2 },
                        { abilityId: "druid_healing_touch", cost: 75, requiredLevel: 3 },
                        { abilityId: "druid_moonfire", cost: 100, requiredLevel: 4 },
                        { abilityId: "druid_bear_form", cost: 200, requiredLevel: 6 },
                        { abilityId: "druid_entangling_roots", cost: 250, requiredLevel: 8 },
                    ],
                } as TrainerData,
            },
        ],
    },

    // Repair NPC
    {
        id: "npc_blacksmith_gorn",
        name: "Gorn",
        title: "Forgeron",
        type: NPCType.REPAIR,
        position: { x: 12, y: 0, z: 8 },
        rotation: -Math.PI / 4,
        modelId: "dwarf_male",
        dialogue: {
            greeting:
                "Votre équipement a l'air usé ! Voulez-vous que je le répare ?",
            options: [
                {
                    id: "repair_all",
                    text: "Réparez tout mon équipement.",
                    action: { type: "repair", data: { all: true } },
                },
                {
                    id: "repair_select",
                    text: "Je veux choisir ce que vous réparez.",
                    action: { type: "repair", data: { select: true } },
                },
                {
                    id: "goodbye",
                    text: "Au revoir.",
                },
            ],
        },
        services: [{ type: NPCType.REPAIR, data: { repairCostMultiplier: 1 } as any }],
    },

    // Innkeeper
    {
        id: "npc_innkeeper_maria",
        name: "Maria",
        title: "Aubergiste",
        type: NPCType.INNKEEPER,
        position: { x: -5, y: 0, z: 10 },
        rotation: Math.PI / 6,
        modelId: "human_female",
        dialogue: {
            greeting:
                "Bienvenue à l'Auberge du Repos du Héros ! Puis-je vous aider ?",
            options: [
                {
                    id: "set_home",
                    text: "Je voudrais faire de cette auberge mon foyer.",
                    response:
                        "Très bien ! Vous ressusciterez ici si vous mourez dans cette zone.",
                },
                {
                    id: "rest",
                    text: "Je voudrais me reposer.",
                    response:
                        "Installez-vous confortablement. Vos points de vie et de mana seront restaurés.",
                },
                {
                    id: "goodbye",
                    text: "Au revoir.",
                },
            ],
        },
        services: [{ type: NPCType.INNKEEPER, data: { homePoint: true } as any }],
    },
];
