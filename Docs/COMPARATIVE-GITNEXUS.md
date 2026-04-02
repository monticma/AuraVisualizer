# Analyse Comparative : Aura vs GitNexus

> Date : 1 avril 2026
> GitNexus : v1.5.0 — 21k ⭐, 56 contributeurs, 14+ langages
> Aura : v1.0.0 — Extension VS Code avec visu 3D

## Positionnement

| | Aura | GitNexus |
|---|------|----------|
| **Type** | Extension VS Code (webview 3D) | CLI + Web UI (browser) |
| **Point fort** | Visualisation 3D interactive intégrée | Knowledge graph + MCP pour agents IA |
| **Parsing** | Tree-sitter AST (10 langages) | Tree-sitter AST (14+ langages) |
| **Base de données** | sql.js (SQLite WASM) | LadybugDB (graph DB native) |
| **Visu** | 3d-force-graph + THREE.js | Sigma.js + Graphology (WebGL 2D) |
| **MCP** | 9 tools, 3 resources | 7 tools, 6 resources, 2 prompts, 4 skills |
| **Avantage Aura** | Intégré dans VS Code, visu 3D, Time Travel, heatmaps, Tree-sitter, blast radius, community detection | — |
| **Avantage GitNexus** | — | multi-repo, wiki auto-générée, recherche sémantique |

---

## Fonctionnalités à reproduire — Classées par priorité

### 🟢 Haute valeur, faisable
 
#### 1. ~~Tree-sitter parsing~~ ✅ FAIT
- **Aura** : Tree-sitter AST pour 10 langages (C/H, JS, TS, Python, Java, Go, Rust, CSS, HTML) + grammaires WASM
- **Résultat** : Parsing fiable, plus de regex, ajout de langages trivial
- **Commit** : branche `languages`, phases 1-7 complétées, 181 tests

#### 2. ~~Héritage & interfaces (`extends` / `implements`)~~ ✅ FAIT
- **Aura** : Détection extends/implements pour JS/TS, Python, Java, Go (struct embedding), Rust (trait impl)
- **Résultat** : Edges heritage dans le graphe, couleurs distinctes (rose = extends, violet = implements)
- **Commit** : Phase 6 (`639dbc8`)

#### 3. ~~Blast radius amélioré (impact analysis)~~ ✅ FAIT
- **Aura** : Shift+RightClick déclenche un blast radius directionnel (dependents uniquement)
- **Résultat** : BFS par profondeur avec coloration gradient (blanc → rouge → orange → jaune → vert), halo lumineux sur le nœud source, slider de profondeur 1-5 réutilisé
- **MCP** : `find_dependents` enrichi avec `blast_radius[]`, niveaux de risque (high/medium/low), résumé
- **Commit** : `3d53d34` + bugfixes (`0eea34e`, `59900a1`)

#### 4. Git-diff impact
- **GitNexus** : `detect_changes()` tool — mappe les lignes changées vers les symboles et process affectés, calcule un risk_level
- **Aura** : Time Travel montre les fichiers changés visuellement, mais pas l'impact en cascade
- **Gain** : Combiner Time Travel + blast radius — "ce commit a touché 3 fichiers, voilà les 12 fichiers potentiellement affectés"
- **Effort** : Moyen — connecter git diff au graphe de dépendances existant

#### 5. ~~Community detection automatique~~ ✅ FAIT
- **Aura** : Algorithme de Louvain complet en TypeScript + JavaScript (webview), détecte les modules architecturaux par couplage de dépendances
- **Résultat** : Mode heatmap "Communities" avec palette flottante interactive (select all/none, toggle individuel), nommage automatique par fichier hub (plus haut fan-in), minimum 2 membres par communauté, filtrage visuel (nœuds + liens grisés pour communautés désélectionnées)
- **MCP** : Tool `get_communities` (9 tools total) avec noms, tailles, groupement par communauté
- **Commit** : `8ffc773` + améliorations (`c5499ea`, `101025c`, `2062ca9`, `325232f`)

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
| **Time Travel** | Navigation commit par commit avec timeline |
| **File explosion** | Éclater un fichier en ses symboles individuels en 3D |
| **Blast radius directionnel** | Shift+RightClick : BFS dependents, coloration par profondeur, halo source |
| **Community detection** | Louvain algorithm, palette interactive, nommage par hub file, filtrage visuel |
| **Heritage edges** | extends/implements détectés pour JS/TS, Python, Java, Go, Rust |
| **Dynamic filters** | Boutons de filtre langue affichés uniquement si fichiers présents |
| **DAG layout** | Basculer entre force-directed et layout hiérarchique |
| **Dead code visuel** | Coloration orange→rouge des fichiers avec exports inutilisés |
| **Cycles visuels** | Highlight des boucles de dépendances circulaires |
| **Multi-selection** | Shift+click pour stats agrégées |
| **Raccourcis clavier** | Touches uniques (F, L, G, H, P, D, O, X, C, 1-5) |

---

## Recommandation : ordre d'implémentation

1. ~~**Tree-sitter**~~ ✅ — Complété (10 langages, 12 grammaires WASM)
2. ~~**Héritage & interfaces**~~ ✅ — Complété (extends/implements)
3. ~~**Blast radius amélioré**~~ ✅ — Complété (Shift+RightClick, profondeur, MCP enrichi)
4. ~~**Community detection**~~ ✅ — Complété (Louvain, palette, nommage, filtrage)
5. **Git-diff impact** — Connecte Time Travel au graphe
