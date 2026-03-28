# AuraVisualizer — Plan d'implémentation

## Vue d'ensemble

Extension VSCode qui intègre le moteur d'analyse d'Aura pour visualiser la codebase active en 3D directement dans un onglet (Webview Panel), avec interaction bidirectionnelle entre le graphe et l'éditeur.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     VSCode Extension                     │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │   Extension   │◄──►│   Analyzer   │    │  Webview    │ │
│  │   Host (TS)   │    │   Core (TS)  │    │  Panel (3D) │ │
│  │              │◄───►│              │    │             │ │
│  │  - Commandes │    │  - Scanner   │    │ - 3d-force  │ │
│  │  - FileWatch │    │  - Parsers   │    │ - Three.js  │ │
│  │  - TreeView  │    │  - Graph     │    │ - UI/UX     │ │
│  │  - StatusBar │    │  - Complexity│    │ - Filtres   │ │
│  └──────┬───────┘    └──────────────┘    └──────┬──────┘ │
│         │          postMessage API               │       │
│         └────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

**Choix techniques :**
- Extension en **TypeScript** (standard VSCode)
- Analyzer : **port TypeScript** du moteur Aura (pur Node, pas d'Express)
- Webview : HTML/JS/CSS avec **3d-force-graph** bundlé
- Communication : API `postMessage` entre extension host et webview
- Build : **esbuild** pour l'extension, assets webview copiés

---

## Phases d'implémentation

### Phase 1 — Scaffolding & Infrastructure

#### 1.1 Initialisation du projet
- [ ] `package.json` avec metadata extension VSCode
- [ ] `tsconfig.json` configuré pour ESM/CommonJS compatible
- [ ] Structure de dossiers :
  ```
  AuraVisualizer/
  ├── src/
  │   ├── extension.ts          # Point d'entrée, activation
  │   ├── commands.ts           # Enregistrement des commandes
  │   ├── webview/
  │   │   └── WebviewProvider.ts # Gestion du panneau Webview
  │   └── analyzer/
  │       ├── index.ts          # Orchestrateur d'analyse
  │       ├── scanner.ts        # Walk récursif du workspace
  │       ├── graph-builder.ts  # Construction du graphe
  │       ├── complexity.ts     # Calcul de complexité
  │       └── parsers/
  │           ├── base-parser.ts
  │           ├── c-parser.ts
  │           ├── js-parser.ts
  │           ├── ts-parser.ts
  │           ├── py-parser.ts
  │           ├── css-parser.ts
  │           └── html-parser.ts
  ├── webview/                  # Assets servis dans la webview
  │   ├── index.html
  │   ├── css/
  │   │   └── style.css
  │   └── js/
  │       ├── app.js            # Logique 3D principale
  │       └── graph-config.js   # Config couleurs/icônes
  ├── resources/
  │   └── icon.png              # Icône de l'extension
  ├── package.json
  ├── tsconfig.json
  ├── esbuild.js                # Script de build
  └── .vscodeignore
  ```

#### 1.2 Configuration `package.json` (contributes)
- [ ] Commande : `auraVisualizer.open` — "Aura: Visualize Codebase"
- [ ] Commande : `auraVisualizer.refresh` — "Aura: Refresh Visualization"
- [ ] Commande : `auraVisualizer.focusFile` — "Aura: Focus Current File"
- [ ] Keybinding : `Ctrl+Shift+A` → `auraVisualizer.open`
- [ ] Vue activité : Icône Aura dans la barre latérale (ActivityBar)
- [ ] Paramètres configurables :
  - `auraVisualizer.excludePaths` : Dossiers à ignorer
  - `auraVisualizer.maxFiles` : Limite de fichiers (défaut: 500)
  - `auraVisualizer.autoRefresh` : Refresh auto sur save (défaut: true)
  - `auraVisualizer.defaultHeatmap` : Mode heatmap par défaut
  - `auraVisualizer.nodeSize` : Multiplicateur de taille

---

### Phase 2 — Moteur d'analyse (Port TypeScript)

#### 2.1 Scanner (`src/analyzer/scanner.ts`)
- [ ] Port de `Aura/analyzer/scanner.js` en TypeScript
- [ ] Utiliser `vscode.workspace.fs` au lieu de `fs` natif (support remote/WSL)
- [ ] Respecter `.gitignore` et les exclusions VSCode (`files.exclude`)
- [ ] Respecter le setting `auraVisualizer.excludePaths`
- [ ] Interface `FileInfo` typée

#### 2.2 Parsers (`src/analyzer/parsers/`)
- [ ] Port de `BaseParser` avec interface TypeScript
- [ ] Port des 6 parsers (C, JS, TS, PY, CSS, HTML)
- [ ] Interface `Relation { source, target, type, label }`
- [ ] Les regex restent identiques — pas de changement fonctionnel

#### 2.3 Complexité (`src/analyzer/complexity.ts`)
- [ ] Port direct de `complexity.js`
- [ ] Interfaces typées pour `ComplexityResult`

#### 2.4 Graph Builder (`src/analyzer/graph-builder.ts`)
- [ ] Port du pipeline 7 phases
- [ ] Interfaces typées : `GraphNode`, `GraphLink`, `GraphData`, `GraphMeta`
- [ ] Extraction de symboles C (fonctions, structs, enums, macros)
- [ ] Résolution de cibles avec la stratégie 6 couches

#### 2.5 Orchestrateur (`src/analyzer/index.ts`)
- [ ] Fonction `analyzeWorkspace(rootPath, options)` → `GraphData`
- [ ] Gestion du cache en mémoire (invalidation sur changement de fichier)
- [ ] Support du cancellation token VSCode pour les grosses codebases
- [ ] Progress reporting via `vscode.window.withProgress()`

---

### Phase 3 — Extension Host & Webview

#### 3.1 Point d'entrée (`src/extension.ts`)
- [ ] `activate()` : Enregistrer commandes, file watcher, status bar
- [ ] `deactivate()` : Cleanup des watchers et disposables
- [ ] FileSystemWatcher sur les fichiers du workspace
  - Sur save/create/delete → re-analyse incrémentale + notification webview

#### 3.2 Webview Provider (`src/webview/WebviewProvider.ts`)
- [ ] Créer `WebviewPanel` avec `vscode.ViewColumn.Beside`
- [ ] Options : `enableScripts: true`, `localResourceRoots`
- [ ] Servir `3d-force-graph` et `three.js` comme ressources locales
- [ ] Gérer le cycle de vie du panel (dispose, reveal, serialize)
- [ ] Protocole de messages bidirectionnel :

  **Extension → Webview :**
  | Message | Payload | Description |
  |---------|---------|-------------|
  | `graphData` | `{ meta, nodes, links }` | Données du graphe complet |
  | `updateGraph` | `{ changedFiles, removedFiles }` | Mise à jour incrémentale |
  | `focusNode` | `{ nodeId }` | Focus sur un fichier spécifique |
  | `themeChanged` | `{ kind, colors }` | Sync thème VSCode |
  | `settings` | `{ ...config }` | Config utilisateur |

  **Webview → Extension :**
  | Message | Payload | Description |
  |---------|---------|-------------|
  | `ready` | `{}` | Webview prête, demande les données |
  | `openFile` | `{ path, line? }` | Ouvrir un fichier dans l'éditeur |
  | `requestRefresh` | `{}` | Demande de re-analyse |
  | `nodeSelected` | `{ nodeId }` | Sync sélection avec l'explorer |
  | `exportImage` | `{ dataUrl }` | Screenshot → sauvegarder |

#### 3.3 Commandes (`src/commands.ts`)
- [ ] `auraVisualizer.open` : Lancer l'analyse + ouvrir la webview
- [ ] `auraVisualizer.refresh` : Forcer la re-analyse
- [ ] `auraVisualizer.focusFile` : Focus le noeud du fichier actif

---

### Phase 4 — Frontend Webview (3D)

#### 4.1 Adaptation du frontend Aura
- [ ] Adapter `app.js` pour fonctionner dans une webview VSCode
  - Remplacer les appels `fetch('/api/analyze')` par réception de `postMessage`
  - Supprimer la modale de saisie de chemin (le workspace est implicite)
  - Adapter le CSS au thème VSCode (variables CSS `--vscode-*`)
- [ ] Conserver toutes les fonctionnalités existantes :
  - Graphe 3D force-directed
  - 5 modes interactifs (Default, Path, DAG, Orphan, Explosion)
  - Filtres par langage, heatmap, groupes, labels
  - Panneau de détails (clic sur noeud)
  - Explorer (arbre de fichiers)
  - Recherche temps réel
  - Zoom, rotation, drag

#### 4.2 Intégration VSCode spécifique
- [ ] **Clic sur noeud → ouvrir le fichier** dans l'éditeur VSCode
  - Double-clic : ouvrir le fichier
  - Simple clic : preview + panneau de détails dans la webview
- [ ] **Clic sur symbole (mode Explosion) → goto ligne** dans l'éditeur
- [ ] **Sync fichier actif** : Quand l'utilisateur change d'onglet dans VSCode,
      highlight le noeud correspondant dans le graphe
- [ ] **Thème VSCode** : Adapter les couleurs au thème actif (dark/light/high-contrast)
  - Background du graphe = `--vscode-editor-background`
  - Texte = `--vscode-editor-foreground`
  - Panneau = `--vscode-sideBar-background`
- [ ] **Content Security Policy** : Configurer la CSP pour la webview

#### 4.3 Bundling des dépendances 3D
- [ ] Inclure `3d-force-graph` dans les assets de la webview
- [ ] Inclure `three.js` (dépendance de 3d-force-graph)
- [ ] Résoudre les chemins avec `webview.asWebviewUri()`

---

### Phase 5 — Fonctionnalités avancées

#### 5.1 Analyse incrémentale
- [ ] Sur save d'un fichier : re-parser uniquement ce fichier
- [ ] Mettre à jour les liens affectés dans le graphe
- [ ] Envoyer un delta au webview (`updateGraph`) au lieu du graphe complet
- [ ] Recalculer fan-in/fan-out uniquement pour les noeuds impactés

#### 5.2 Status Bar
- [ ] Item status bar montrant : `$(eye) Aura: 42 files, 67 links`
- [ ] Clic → ouvre la visualisation
- [ ] Indicateur de chargement pendant l'analyse

#### 5.3 Activity Bar (vue latérale)
- [ ] TreeView dans l'Activity Bar avec icône Aura
- [ ] Sections :
  - **Stats** : Nombre de fichiers, liens, langages
  - **Fichiers par complexité** : Top 10 fichiers les plus complexes
  - **Fichiers orphelins** : Fichiers sans dépendances
  - **Actions** : Boutons Refresh, Open 3D View

#### 5.4 Sauvegarde d'état (Serialization)
- [ ] Implémenter `WebviewPanelSerializer` pour restaurer la vue après reload
- [ ] Sauvegarder : position caméra, filtres actifs, noeud sélectionné

---

### Phase 6 — Polish & Performance

#### 6.1 Performance
- [ ] Analyse en worker thread pour les grosses codebases (>1000 fichiers)
- [ ] Debounce du file watcher (500ms) pour éviter les analyses cascadées
- [ ] Lazy loading des symboles (charger les détails au clic seulement)
- [ ] Limiter le nombre max de noeuds avec pagination ou clustering

#### 6.2 UX
- [ ] Animation de chargement pendant l'analyse
- [ ] Messages d'erreur élégants (workspace vide, aucun fichier supporté)
- [ ] Tooltip contextuel suivant la souris dans la webview
- [ ] Walkthrough / onboarding au premier lancement

#### 6.3 Tests
- [ ] Tests unitaires des parsers (vitest/jest)
- [ ] Tests unitaires du graph-builder
- [ ] Tests d'intégration de l'analyse complète
- [ ] Test de la sérialisation webview

#### 6.4 CI/CD
- [ ] GitHub Actions : lint, test, build
- [ ] Script de packaging : `vsce package`
- [ ] Publication sur le VS Code Marketplace

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Langage extension | TypeScript 5.x |
| Bundler | esbuild |
| 3D Engine | 3d-force-graph + Three.js |
| Tests | Vitest |
| Linting | ESLint |
| Packaging | vsce |
| CI | GitHub Actions |

---

## Dépendances

### Extension (devDependencies)
- `@types/vscode` — Types VSCode API
- `typescript` — Compilateur
- `esbuild` — Bundler
- `@vscode/vsce` — Packaging
- `vitest` — Tests
- `eslint` — Linting

### Webview (bundled)
- `3d-force-graph` — Visualisation 3D
- `three` — Moteur 3D (peer dependency)

---

## Fichiers clés à porter depuis Aura

| Source (Aura)                    | Destination (AuraVisualizer)         | Action        |
|----------------------------------|--------------------------------------|---------------|
| `analyzer/scanner.js`            | `src/analyzer/scanner.ts`            | Port TS       |
| `analyzer/complexity.js`         | `src/analyzer/complexity.ts`         | Port TS       |
| `analyzer/graph-builder.js`      | `src/analyzer/graph-builder.ts`      | Port TS       |
| `analyzer/parsers/base-parser.js`| `src/analyzer/parsers/base-parser.ts`| Port TS       |
| `analyzer/parsers/c-parser.js`   | `src/analyzer/parsers/c-parser.ts`   | Port TS       |
| `analyzer/parsers/js-parser.js`  | `src/analyzer/parsers/js-parser.ts`  | Port TS       |
| `analyzer/parsers/ts-parser.js`  | `src/analyzer/parsers/ts-parser.ts`  | Port TS       |
| `analyzer/parsers/py-parser.js`  | `src/analyzer/parsers/py-parser.ts`  | Port TS       |
| `analyzer/parsers/css-parser.js` | `src/analyzer/parsers/css-parser.ts` | Port TS       |
| `analyzer/parsers/html-parser.js`| `src/analyzer/parsers/html-parser.ts`| Port TS       |
| `public/js/app.js`               | `webview/js/app.js`                  | Adapter       |
| `public/js/graph-config.js`      | `webview/js/graph-config.js`         | Copier        |
| `public/css/style.css`           | `webview/css/style.css`              | Adapter thème |
| `public/index.html`              | `webview/index.html`                 | Adapter       |

---

## Priorité d'implémentation

```
Phase 1 (Scaffolding)     ██████░░░░  Fondation
Phase 2 (Analyzer)        ████████░░  Coeur métier
Phase 3 (Extension Host)  ████████░░  Intégration VSCode
Phase 4 (Frontend)        ██████████  Visualisation
Phase 5 (Avancé)          ████░░░░░░  Nice-to-have
Phase 6 (Polish)          ██░░░░░░░░  Finition
```

Les phases 1→4 constituent le **MVP** (Minimum Viable Product).
Les phases 5→6 sont des améliorations itératives post-MVP.
