# Roadmap : Tree-sitter & Langages Avancés

> Branche : `languages`
> Base : `AI` @ `6d87032` (v1.0.0)

---

## Vue d'ensemble

Remplacer les parsers regex par **Tree-sitter** (AST) pour obtenir :
- Parsing fiable et structurel (plus de faux positifs regex)
- Ajout facile de nouveaux langages (Java, Go, Rust, C#, etc.)
- Détection de `extends` / `implements` (héritage)
- Fondation pour community detection, blast radius, execution flows

---

## Architecture actuelle (regex)

```
scanner.ts           → scan fichiers, assigne language via LANGUAGE_MAP
parsers/base-parser  → classe de base (parse, extractMatches)
parsers/c-parser     → 192 lignes, regex: includes, func defs, structs, enums, macros, calls
parsers/js-parser    → 354 lignes, regex: import/require/dynamic, funcs, classes, exports, calls
parsers/ts-parser    → 6 lignes, hérite de JSParser
parsers/py-parser    → 186 lignes, regex: import/from, funcs, classes, __all__, decorators, calls
parsers/html-parser  → 39 lignes, regex: script/link/img
parsers/css-parser   → 37 lignes, regex: @import, url()
graph-builder.ts     → 411 lignes, pipeline 8 phases, résolution targets, dead code, cycles
```

Total parsers : ~852 lignes | Total analyzer : ~1,387 lignes
Exécution : Worker thread (analyzer-worker.ts)

---

## Architecture cible (Tree-sitter)

```
scanner.ts             → inchangé (scan fichiers, LANGUAGE_MAP étendu)
parsers/base-parser    → méthode parse() retourne toujours Relation[]
                          nouvelle méthode extractSymbolsTS() via Tree-sitter AST
parsers/ts-c-parser    → Tree-sitter C/C++ : includes, fonctions, structs, macros, calls
parsers/ts-js-parser   → Tree-sitter JavaScript : imports, exports, fonctions, classes, calls
parsers/ts-ts-parser   → Tree-sitter TypeScript : hérite JS + types, interfaces, extends
parsers/ts-py-parser   → Tree-sitter Python : imports, fonctions, classes, decorators, calls
parsers/html-parser    → garde regex (Tree-sitter HTML peu utile pour nos besoins)
parsers/css-parser     → garde regex (idem)
parsers/ts-java-parser → NOUVEAU : Java imports, classes, interfaces, extends/implements
parsers/ts-go-parser   → NOUVEAU : Go imports, funcs, structs, interfaces
parsers/ts-rust-parser → NOUVEAU : Rust use/mod, funcs, structs, traits, impl
graph-builder.ts       → phase 2-3 enrichies avec heritage edges (extends/implements)
```

---

## Phases d'implémentation

### Phase 1 — Infrastructure Tree-sitter WASM
- [x] Installer `web-tree-sitter` (WASM, compatible worker threads)
- [x] Créer `src/analyzer/tree-sitter-loader.ts` : init Parser, charger les .wasm des langages
- [x] Bundler les fichiers `.wasm` dans le build (esbuild config)
- [x] Tester : parser un fichier C, obtenir l'AST, valider dans un test unitaire
- [x] Adapter `base-parser.ts` : ajouter `parseWithAST(tree: Tree)` optionnel

### Phase 1b — Enrichir le schéma de la DB
- [x] Étendre la table `symbols` : ajouter colonnes `visibility` (public/private/protected), `return_type`, `parameters` (JSON), `is_static`, `is_async`
- [x] Nouveaux kinds de symboles : `interface`, `trait`, `type_alias`, `method` (distinct de `function`)
- [x] Nouveaux types d'edges : `extends`, `implements` dans la table `edges`
- [x] Adapter `importGraph()` dans graph-db.ts pour stocker les champs enrichis
- [x] Adapter les méthodes de query (`getNodeDetail`, `searchSymbols`) pour retourner les nouvelles infos
- [x] Adapter le MCP server pour exposer les nouvelles données (heritage, visibility, types)
- [x] Migration : `importGraph()` doit rester rétro-compatible (champs optionnels, defaults)
- [x] Tests : étendre graph-db.test.ts avec les nouveaux kinds et edge types

### Phase 2 — Migrer le C Parser vers Tree-sitter
- [x] Créer `ts-c-parser.ts` basé sur Tree-sitter
- [x] Extraire : `#include` (preproc_include), function_definition, struct_specifier, enum_specifier, macro (preproc_def/preproc_function_def)
- [x] Extraire : appels de fonctions (call_expression)
- [x] Tests : migrer + étendre `c-parser.test.ts`
- [x] Comparer résultats regex vs Tree-sitter sur un vrai projet
- [x] Remplacer CParser dans le registry quand OK

### Phase 3 — Migrer le JS/TS Parser
- [x] Créer `ts-js-parser.ts` basé sur Tree-sitter JavaScript
- [x] Extraire : import_statement, export_statement, function_declaration, class_declaration, arrow_function, call_expression
- [x] Créer `ts-ts-parser.ts` basé sur Tree-sitter TypeScript
- [x] Extraire en plus : interface_declaration, type_alias, extends/implements clauses
- [x] **Nouveau edge type : `extends`** et **`implements`**
- [x] Tests : migrer + étendre `js-parser.test.ts`
- [x] Remplacer JSParser/TSParser dans le registry

### Phase 4 — Migrer le Python Parser
- [x] Créer `ts-py-parser.ts` basé sur Tree-sitter Python
- [x] Extraire : import_statement, import_from_statement, function_definition, class_definition, decorated_definition, call (expression_statement)
- [x] Détecter héritage Python : `class Foo(Bar, Baz)` → edges extends
- [x] Tests : migrer + étendre py-parser tests
- [x] Remplacer PyParser dans le registry

### Phase 5 — Nouveaux langages
- [x] **Java** : `tree-sitter-java` — imports, classes, interfaces, extends/implements, methods, calls
- [x] **Go** : `tree-sitter-go` — imports, funcs, structs, interfaces, method receivers
- [x] **Rust** : `tree-sitter-rust` — use/mod, fn, struct, trait, impl blocks
- [x] Étendre LANGUAGE_MAP dans scanner.ts (.java, .go, .rs)
- [x] Étendre PARSER_REGISTRY dans graph-builder.ts
- [x] Tests unitaires par langage
- [x] Mettre à jour webview : couleurs, icônes, filtres pour les nouveaux langages

### Phase 6 — Héritage & Interfaces dans le graphe
- [x] Nouveaux types d'edges dans graph-builder.ts : `extends`, `implements`
- [x] Stocker dans graph-db.ts (schema edges)
- [x] Exposer dans MCP server : `find_dependencies` inclut les edges heritage
- [x] Visualisation webview : couleur et style d'edge distinct pour extends/implements
- [x] Flèches en pointillé pour `implements`, flèches pleines pour `extends`

### Phase 7 — Nettoyage & validation
- [x] Supprimer les anciens parsers regex (c-parser, js-parser, py-parser)
- [x] Vérifier que tous les tests passent (anciens + nouveaux)
- [ ] Tester sur 3+ projets réels (C, JS/TS, Python, mixte)
- [x] Vérifier la taille du bundle (ajout des .wasm)
- [ ] Mettre à jour README et walkthrough
- [ ] Build .vsix et vérifier

### Phase 8 (optionnelle) — Pool de workers pour le parsing
> À implémenter uniquement si le temps d'analyse dépasse ~5 secondes sur un projet typique.

- [ ] Mesurer le temps de parsing Tree-sitter sur des projets de 500, 1000, 2000 fichiers
- [ ] Si trop lent : créer `src/analyzer/parse-worker.ts` (worker dédié au parsing)
- [ ] Pool de N workers (4 par défaut, configurable) — chacun charge web-tree-sitter + grammaires WASM
- [ ] Le coordinateur (analyzer-worker.ts) distribue les fichiers par lots au pool
- [ ] Chaque parse-worker retourne `Relation[] + Symbol[]` via postMessage
- [ ] Le coordinateur merge les résultats puis exécute le graph-builder pipeline (single thread)
- [ ] DB import reste single thread (pas de concurrence)
- [ ] Lazy init : les workers du pool ne chargent que les grammaires des langages détectés dans le lot
- [ ] Benchmark avant/après pour valider le gain

---

## Fichiers WASM nécessaires

| Langage | Package npm | Taille ~wasm |
|---------|-------------|-------------|
| C / C++ | `tree-sitter-c` / `tree-sitter-cpp` | ~200 KB |
| JavaScript | `tree-sitter-javascript` | ~150 KB |
| TypeScript | `tree-sitter-typescript` | ~250 KB |
| Python | `tree-sitter-python` | ~150 KB |
| Java | `tree-sitter-java` | ~200 KB |
| Go | `tree-sitter-go` | ~200 KB |
| Rust | `tree-sitter-rust` | ~250 KB |
| `web-tree-sitter` (runtime) | `web-tree-sitter` | ~300 KB |

Total estimé : ~1.5-2 MB supplémentaires dans le .vsix

---

## Risques & décisions

| Risque | Mitigation |
|--------|-----------|
| Taille du .vsix (+2 MB) | Acceptable — actuellement 1.3 MB, passera à ~3 MB |
| web-tree-sitter dans worker thread | Testé et supporté (WASM fonctionne dans workers Node.js) |
| Breaking changes parsing | Migration progressive parser par parser, tests comparatifs |
| Perf init (charger les .wasm) | Lazy loading — ne charger que les grammaires des langages détectés |
| Régression dead code / cycles | Garder les test fixtures existants, ajouter des cas |

---

## Métriques de succès

- [x] Tous les tests existants passent (181/181)
- [x] ≥ 3 nouveaux langages supportés (Java, Go, Rust)
- [x] Edges `extends` / `implements` détectés pour JS/TS, Python, Java
- [x] Taille .vsix ≤ 5 MB (bundle out/ = 20 MB dont 17 MB WASM, JS seul ~590 KB)
- [ ] Temps d'analyse ≤ 2x le temps actuel pour un même projet
