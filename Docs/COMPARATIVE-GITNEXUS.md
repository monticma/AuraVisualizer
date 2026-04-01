# Analyse Comparative : Aura vs GitNexus

> Date : 1 avril 2026
> GitNexus : v1.5.0 — 21k ⭐, 56 contributeurs, 14+ langages
> Aura : v1.0.0 — Extension VS Code avec visu 3D

## Positionnement

| | Aura | GitNexus |
|---|------|----------|
| **Type** | Extension VS Code (webview 3D) | CLI + Web UI (browser) |
| **Point fort** | Visualisation 3D interactive intégrée | Knowledge graph + MCP pour agents IA |
| **Parsing** | Regex custom (7 langages) | Tree-sitter AST (14+ langages) |
| **Base de données** | sql.js (SQLite WASM) | LadybugDB (graph DB native) |
| **Visu** | 3d-force-graph + THREE.js | Sigma.js + Graphology (WebGL 2D) |
| **MCP** | 8 tools, 3 resources | 7 tools, 6 resources, 2 prompts, 4 skills |
| **Avantage Aura** | Intégré dans VS Code, visu 3D, Time Machine, heatmaps | — |
| **Avantage GitNexus** | — | AST parsing, community detection, blast radius, multi-repo |

---

## Fonctionnalités à reproduire — Classées par priorité

### 🟢 Haute valeur, faisable

#### 1. Tree-sitter parsing
- **GitNexus** : Parsing AST complet via Tree-sitter pour 14+ langages (TS, JS, Python, Java, Kotlin, C#, Go, Rust, PHP, Ruby, Swift, C, C++, Dart)
- **Aura** : Regex parsers custom pour 7 langages (C/H, JS, TS, Python, CSS, HTML)
- **Gain** : Parsing bien plus fiable (plus de faux positifs regex), ajout facile de nouveaux langages, détection de constructs complexes (classes, interfaces, decorators)
- **Effort** : Moyen-élevé — remplacer les parsers un par un, tree-sitter WASM existe pour le browser/worker

#### 2. Héritage & interfaces (`extends` / `implements`)
- **GitNexus** : Trace les relations heritage — class inheritance, interfaces, mixins
- **Aura** : Non tracé — seuls import/include/function-call sont détectés
- **Gain** : Visualiser la hiérarchie de classes en 3D (flèches différentes, couleurs distinctes). Très utile pour les projets OOP
- **Effort** : Moyen — nécessite de parser `extends`/`implements` dans JS/TS/Python, ajouter un nouveau type d'edge

#### 3. Blast radius amélioré (impact analysis)
- **GitNexus** : `impact()` tool avec profondeur, score de confiance, filtrage par type de relation, inclusion/exclusion des tests
- **Aura** : `find_dependents` basique (BFS transitive), visu via right-click pin focus
- **Gain** : Coloration par profondeur d'impact (vert → jaune → rouge), filtrage par confiance, meilleure réponse MCP
- **Effort** : Moyen — enrichir la requête SQL existante, ajouter le scoring, adapter la visu

#### 4. Git-diff impact
- **GitNexus** : `detect_changes()` tool — mappe les lignes changées vers les symboles et process affectés, calcule un risk_level
- **Aura** : Time Machine montre les fichiers changés visuellement, mais pas l'impact en cascade
- **Gain** : Combiner Time Machine + blast radius — "ce commit a touché 3 fichiers, voilà les 12 fichiers potentiellement affectés"
- **Effort** : Moyen — connecter git diff au graphe de dépendances existant

#### 5. Community detection automatique
- **GitNexus** : Algorithme de Leiden pour détecter les modules fonctionnels, cohésion scores, labels sémantiques
- **Aura** : Clustering par répertoire uniquement (groupes = dossiers)
- **Gain** : Détecte les vrais modules architecturaux indépendamment de la structure de fichiers. Visualise les communautés comme des clusters 3D avec cohésion
- **Effort** : Moyen — implémenter Louvain/Leiden (bibliothèques JS existent), stocker dans graph-db

---

### 🟡 Intéressant, effort plus conséquent

#### 6. Wiki auto-générée
- **GitNexus** : `gitnexus wiki` génère une documentation complète via LLM depuis le knowledge graph
- **Aura** : Export JSON uniquement
- **Gain** : Générer des docs Markdown depuis le graphe Aura (overview, modules, dépendances critiques)
- **Effort** : Moyen — nécessite intégration LLM API (OpenAI/Anthropic), templates de génération

#### 7. Recherche sémantique (hybrid search)
- **GitNexus** : BM25 + embeddings vectoriels + Reciprocal Rank Fusion
- **Aura** : Recherche par nom/chemin uniquement
- **Gain** : Chercher "authentication logic" et trouver les fichiers pertinents même sans le mot exact
- **Effort** : Élevé — nécessite embeddings (transformers.js), index vectoriel, stockage

#### 8. Multi-file rename coordonné
- **GitNexus** : `rename()` tool — renommage multi-fichier via graphe + recherche textuelle, dry_run, confiance
- **Aura** : Non disponible
- **Gain** : Renommer un symbole avec vision de l'impact sur tout le projet
- **Effort** : Moyen — exploiter le graphe existant pour trouver les usages, appliquer les edits

#### 9. Process / execution flow tracing
- **GitNexus** : Trace les chaînes d'exécution depuis les entry points jusqu'aux leaf functions, regroupe par "process"
- **Aura** : Non disponible — graphe de dépendances fichier-niveau uniquement
- **Gain** : Visualiser les flux d'exécution en 3D (login flow, payment flow, etc.)
- **Effort** : Élevé — nécessite résolution de calls inter-fichiers à granularité symbole

#### 10. Confidence scoring
- **GitNexus** : Chaque relation a un score de confiance (90% CALLS, 85% IMPORTS, etc.)
- **Aura** : Relations binaires (existe ou non)
- **Gain** : Filtrer les relations par confiance, meilleure précision du blast radius
- **Effort** : Moyen — ajouter un champ confidence aux edges, scorer selon le type de détection

---

### 🔴 Non prioritaire / pas applicable

| Feature | Raison |
|---------|--------|
| Web UI browser standalone | Aura a la visu 3D dans VS Code — c'est son avantage compétitif |
| Self-hosted SaaS / Enterprise | Scope commercial, pas pertinent pour le projet |
| Claude Code hooks (PreToolUse/PostToolUse) | Très spécifique à un outil, fragile |
| Multi-repo MCP | Nice-to-have mais pas urgent — la plupart travaillent sur un repo à la fois |
| Agent skills auto-gen (.claude/skills/) | Dépend de l'écosystème Claude, pas universel |
| Cypher queries | SQL existe déjà via graph-db, pas besoin d'un 2e langage de requête |

---

## Ce qu'Aura a et GitNexus n'a PAS

| Feature Aura | Détail |
|-------------|--------|
| **Visualisation 3D** | Force-directed 3D graph avec THREE.js — GitNexus n'a que du 2D WebGL |
| **Intégration VS Code native** | Webview panel, activity bar, commands, keybindings |
| **Heatmaps** | 5 modes de coloration (complexity, fan-in/out, LOC, last modified) |
| **Time Machine** | Navigation commit par commit avec timeline |
| **File explosion** | Éclater un fichier en ses symboles individuels en 3D |
| **DAG layout** | Basculer entre force-directed et layout hiérarchique |
| **Dead code visuel** | Coloration orange→rouge des fichiers avec exports inutilisés |
| **Cycles visuels** | Highlight des boucles de dépendances circulaires |
| **Multi-selection** | Shift+click pour stats agrégées |
| **Raccourcis clavier** | Touches uniques (F, L, G, H, P, D, O, X, C, 1-5) |

---

## Recommandation : ordre d'implémentation

1. **Tree-sitter** — Fondation pour tout le reste
2. **Héritage & interfaces** — Quick win une fois tree-sitter en place
3. **Community detection** — Remplace le clustering naïf par répertoire
4. **Blast radius amélioré** — Enrichit la visu existante (right-click)
5. **Git-diff impact** — Connecte Time Machine au graphe
