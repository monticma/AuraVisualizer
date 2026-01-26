// ============================================
// AURA MMORPG - Game Engine
// Main game controller and Babylon.js setup
// ============================================

import {
    Engine,
    Scene,
    ArcRotateCamera,
    Vector3,
    HemisphericLight,
    DirectionalLight,
    ShadowGenerator,
    Color3,
    Color4,
    MeshBuilder,
    StandardMaterial,
    Texture,
    PointerEventTypes,
} from "@babylonjs/core";
import "@babylonjs/loaders";
import { GameState, Character, Monster, NPC } from "../types";
import { InputManager } from "./InputManager";
import { EventBus } from "./EventBus";

export class GameEngine {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private camera: ArcRotateCamera;
    private shadowGenerator: ShadowGenerator | null = null;

    private inputManager: InputManager;
    private eventBus: EventBus;

    private gameState: GameState | null = null;
    private isRunning: boolean = false;
    private lastFrameTime: number = 0;

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas with id '${canvasId}' not found`);
        }
        this.canvas = canvas;

        // Initialize Babylon.js engine
        this.engine = new Engine(this.canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
        });

        // Create scene
        this.scene = this.createScene();

        // Setup camera
        this.camera = this.createCamera();

        // Initialize managers
        this.eventBus = EventBus.getInstance();
        this.inputManager = new InputManager(this.scene, this.eventBus);

        // Handle window resize
        window.addEventListener("resize", () => {
            this.engine.resize();
        });

        // Setup pointer events for selection
        this.setupPointerEvents();
    }

    private createScene(): Scene {
        const scene = new Scene(this.engine);

        // Clear color (sky)
        scene.clearColor = new Color4(0.4, 0.6, 0.9, 1);

        // Ambient light
        const ambientLight = new HemisphericLight(
            "ambientLight",
            new Vector3(0, 1, 0),
            scene
        );
        ambientLight.intensity = 0.4;
        ambientLight.groundColor = new Color3(0.2, 0.2, 0.3);

        // Directional light (sun)
        const sunLight = new DirectionalLight(
            "sunLight",
            new Vector3(-1, -2, -1),
            scene
        );
        sunLight.intensity = 0.8;
        sunLight.position = new Vector3(50, 100, 50);

        // Shadows
        this.shadowGenerator = new ShadowGenerator(2048, sunLight);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurKernel = 32;

        // Create ground (placeholder terrain)
        this.createGround(scene);

        return scene;
    }

    private createCamera(): ArcRotateCamera {
        const camera = new ArcRotateCamera(
            "camera",
            -Math.PI / 2, // Alpha (rotation around Y)
            Math.PI / 3,  // Beta (tilt)
            15,           // Radius (distance from target)
            new Vector3(0, 1, 0), // Target position
            this.scene
        );

        camera.attachControl(this.canvas, true);

        // Camera limits
        camera.lowerBetaLimit = 0.1;
        camera.upperBetaLimit = Math.PI / 2 - 0.1;
        camera.lowerRadiusLimit = 5;
        camera.upperRadiusLimit = 30;

        // Smooth camera movement
        camera.inertia = 0.7;
        camera.panningInertia = 0.7;

        // Disable default panning (we'll handle movement ourselves)
        camera.panningSensibility = 0;

        return camera;
    }

    private createGround(scene: Scene): void {
        // Create a large terrain plane
        const ground = MeshBuilder.CreateGround(
            "ground",
            { width: 200, height: 200, subdivisions: 32 },
            scene
        );

        // Ground material
        const groundMaterial = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.5, 0.2);
        groundMaterial.specularColor = new Color3(0.1, 0.1, 0.1);
        ground.material = groundMaterial;

        // Receive shadows
        ground.receiveShadows = true;
    }

    private setupPointerEvents(): void {
        this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERPICK:
                    if (pointerInfo.pickInfo?.hit) {
                        const pickedMesh = pointerInfo.pickInfo.pickedMesh;
                        if (pickedMesh) {
                            this.eventBus.emit({
                                type: "mesh_clicked",
                                data: {
                                    meshId: pickedMesh.id,
                                    meshName: pickedMesh.name,
                                    position: pointerInfo.pickInfo.pickedPoint,
                                },
                                timestamp: Date.now(),
                            });
                        }
                    }
                    break;
            }
        });
    }

    public getScene(): Scene {
        return this.scene;
    }

    public getCamera(): ArcRotateCamera {
        return this.camera;
    }

    public getShadowGenerator(): ShadowGenerator | null {
        return this.shadowGenerator;
    }

    public getEventBus(): EventBus {
        return this.eventBus;
    }

    public getInputManager(): InputManager {
        return this.inputManager;
    }

    public setGameState(state: GameState): void {
        this.gameState = state;
    }

    public getGameState(): GameState | null {
        return this.gameState;
    }

    public start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.lastFrameTime = performance.now();

        // Main game loop
        this.engine.runRenderLoop(() => {
            const currentTime = performance.now();
            const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
            this.lastFrameTime = currentTime;

            if (!this.gameState?.isPaused) {
                this.update(deltaTime);
            }

            this.scene.render();
        });

        console.log("🎮 Aura MMORPG started!");
    }

    public stop(): void {
        this.isRunning = false;
        this.engine.stopRenderLoop();
    }

    private update(deltaTime: number): void {
        // Process input
        this.inputManager.update(deltaTime);

        // Update game systems (will be expanded)
        this.eventBus.emit({
            type: "game_update",
            data: { deltaTime },
            timestamp: Date.now(),
        });
    }

    public dispose(): void {
        this.stop();
        this.inputManager.dispose();
        this.scene.dispose();
        this.engine.dispose();
    }
}
