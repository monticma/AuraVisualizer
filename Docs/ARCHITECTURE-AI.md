# Aura AI Extension — Architecture Document

## Vue d'ensemble

Deux composants à ajouter à AuraVisualizer :
1. **Graph DB** — Persister le graphe en SQLite, requêtes graph avancées
2. **MCP Server** — Exposer le graphe aux assistants AI via le protocole MCP

```
┌─────────────────────────────────────────────────────────────┐
│                        VS Code                              │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  Analyzer   │───▶│ extension.ts │───▶│  Webview 3D    │  │
│  │  Worker     │    │              │    │  (app.js)      │  │
│  └─────────────┘    │   ┌──────┐   │    └────────────────┘  │
│                     │   │Graph │   │                        │
│  ┌─────────────┐    │   │  DB  │   │                        │
│  │  History    │───▶│   │.aura/│   │                        │
│  │  Worker     │    │   │graph │   │                        │
│  └─────────────┘    │   │ .db  │   │                        │
│                     │   └──┬───┘   │                        │
│                     └──────┼───────┘                        │
└────────────────────────────┼────────────────────────────────┘
                             │ lecture directe
                   ┌─────────▼──────────┐
                   │   Aura MCP Server  │
                   │  (process séparé)  │
                   │  stdio / SSE       │
                   └─────────┬──────────┘
                             │ MCP protocol
                   ┌─────────▼──────────┐
                   │   AI Assistant     │
                   │  (Copilot/Claude)  │
                   └────────────────────┘
```

---

## Partie 1 : Graph DB (SQLite)

### Choix technique

**`better-sqlite3`** via npm :
- API synchrone (pas de callback hell)
- Performances natives (binding C++)
- Zéro config, un seul fichier `.aura/graph.db`
- Recursive CTEs pour les requêtes graph (chemins, deps transitives)
- ~4MB le binding natif — acceptable pour une extension VS Code

**Alternative considérée** : `sql.js` (SQLite compilé en WASM). Plus portable (pas de native binding), mais ~3× plus lent. On peut migrer plus tard si les native bindings posent problème au packaging VSIX.

### Schéma

```sql
-- Fichiers (1 row = 1 nœud du graphe)
CREATE TABLE nodes (
    id          TEXT PRIMARY KEY,   -- chemin relatif (ex: "src/utils/parser.ts")
    name        TEXT NOT NULL,      -- nom du fichier
    language    TEXT NOT NULL,      -- 'javascript', 'typescript', 'c', 'python', etc.
    extension   TEXT NOT NULL,      -- '.js', '.ts', etc.
    group_name  TEXT NOT NULL,      -- répertoire top-level
    size        INTEGER NOT NULL,   -- bytes
    lines       INTEGER NOT NULL,   -- lignes de code (non-vides)
    complexity  INTEGER NOT NULL,   -- complexité cyclomatique
    fan_in      INTEGER NOT NULL DEFAULT 0,
    fan_out     INTEGER NOT NULL DEFAULT 0,
    last_modified INTEGER NOT NULL DEFAULT 0
);

-- Dépendances (arêtes orientées)
CREATE TABLE edges (
    source  TEXT NOT NULL REFERENCES nodes(id),
    target  TEXT NOT NULL REFERENCES nodes(id),
    type    TEXT NOT NULL,          -- 'import', 'require', 'function-call', '#include', etc.
    label   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (source, target, type)
);

-- Symboles (fonctions, classes, exports par fichier)
CREATE TABLE symbols (
    node_id     TEXT NOT NULL REFERENCES nodes(id),
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL,      -- 'function', 'class', 'struct', 'enum', 'macro', 'export'
    return_type TEXT DEFAULT '',
    params      TEXT DEFAULT '',
    line        INTEGER DEFAULT 0,
    is_dead     INTEGER DEFAULT 0,  -- 1 si dead export/code
    PRIMARY KEY (node_id, name, kind)
);

-- Cycles détectés
CREATE TABLE cycles (
    cycle_id    INTEGER NOT NULL,
    node_id     TEXT NOT NULL REFERENCES nodes(id),
    position    INTEGER NOT NULL,   -- ordre dans le cycle
    PRIMARY KEY (cycle_id, position)
);

-- Métadonnées projet
CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_edges_source ON edges(source);
CREATE INDEX idx_edges_target ON edges(target);
CREATE INDEX idx_symbols_node ON symbols(node_id);
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_nodes_language ON nodes(language);
CREATE INDEX idx_nodes_group ON nodes(group_name);
```

### Requêtes clés (recursive CTEs)

```sql
-- Dépendances transitives (tous les fichiers dont X dépend, profondeur N)
WITH RECURSIVE deps(id, depth) AS (
    SELECT target, 1 FROM edges WHERE source = ?
    UNION
    SELECT e.target, d.depth + 1
    FROM edges e JOIN deps d ON e.source = d.id
    WHERE d.depth < ?
)
SELECT DISTINCT id, MIN(depth) as depth FROM deps GROUP BY id;

-- Dépendants transitifs (tous les fichiers qui dépendent de X)
WITH RECURSIVE dependents(id, depth) AS (
    SELECT source, 1 FROM edges WHERE target = ?
    UNION
    SELECT e.source, d.depth + 1
    FROM edges e JOIN dependents d ON e.target = d.id
    WHERE d.depth < ?
)
SELECT DISTINCT id, MIN(depth) as depth FROM dependents GROUP BY id;

-- Plus court chemin entre A et B
WITH RECURSIVE path(id, route, depth) AS (
    SELECT ?, ?, 0
    UNION
    SELECT e.target, p.route || ' → ' || e.target, p.depth + 1
    FROM edges e JOIN path p ON e.source = p.id
    WHERE p.depth < 20 AND INSTR(p.route, e.target) = 0
)
SELECT route, depth FROM path WHERE id = ? ORDER BY depth LIMIT 1;

-- Hotspots (fichiers les plus impactants)
SELECT n.id, n.lines, n.complexity, n.fan_in, n.fan_out,
       (n.complexity * n.fan_in) AS impact_score
FROM nodes n ORDER BY impact_score DESC LIMIT ?;
```

### Intégration dans le pipeline existant

```
analyzer-worker.ts
    ↓ postMessage({ graphData, files })
extension.ts::refreshAnalysis()
    ├── webviewProvider.sendGraphData(graphData)    ← existant
    └── graphDb.importGraphData(graphData)          ← NOUVEAU
```

**Nouveau fichier : `src/graph-db.ts`**

```typescript
interface GraphDB {
    // Lifecycle
    open(dbPath: string): void;
    close(): void;

    // Import (appelé après chaque analyse)
    importGraphData(data: GraphData): void;  // REPLACE INTO = upsert total

    // Queries exposées
    getDependencies(fileId: string, depth: number): { id: string; depth: number }[];
    getDependents(fileId: string, depth: number): { id: string; depth: number }[];
    findPath(from: string, to: string): string[] | null;
    getHotspots(limit: number): NodeRow[];
    getDeadCode(): { nodeId: string; symbol: string }[];
    getCycles(): string[][];
    getNodeDetail(fileId: string): NodeRow & { symbols: SymbolRow[]; deps: string[]; dependents: string[] };
    getArchitectureOverview(): { language: string; count: number; totalLoc: number; avgComplexity: number }[];
    searchSymbols(query: string): { nodeId: string; name: string; kind: string; line: number }[];

    // Raw query (pour le MCP server)
    query(sql: string, params?: unknown[]): unknown[];
}
```

**Emplacement DB** : `.aura/graph.db` dans le workspace root.

**Timing** : La DB est reconstruite (INSERT OR REPLACE) à chaque `refreshAnalysis()`. Pas de diff — c'est un snapshot complet. Avec des tailles de graphe typ. < 5000 nœuds, l'import prend < 100ms.

---

## Partie 2 : MCP Server

### Choix technique

**`@modelcontextprotocol/sdk`** — SDK TypeScript officiel MCP.

**Transport** : `stdio` (standard pour les MCP servers locaux). Le process est lancé par VS Code ou configuré dans `mcp.json`.

**Process séparé** : Le MCP server est un script Node.js indépendant qui lit `.aura/graph.db` directement. Il n'a PAS besoin que l'extension VS Code soit active — la DB persiste.

### Resources MCP

| URI | Description |
|-----|-------------|
| `aura://overview` | Résumé projet : fichiers, langages, groupes, métriques agrégées |
| `aura://nodes` | Liste de tous les nœuds avec métriques (id, language, LOC, complexity, fan-in/out) |
| `aura://node/{id}` | Détail d'un fichier : métriques + symboles + deps + dependents |

### Tools MCP

| Tool | Paramètres | Description |
|------|-----------|-------------|
| `find_dependencies` | `file: string, depth?: number` | Dépendances transitives d'un fichier |
| `find_dependents` | `file: string, depth?: number` | Qui dépend de ce fichier (impact analysis) |
| `find_path` | `from: string, to: string` | Plus court chemin de dépendance entre 2 fichiers |
| `find_cycles` | — | Tous les cycles de dépendances circulaires |
| `find_dead_code` | — | Exports non utilisés par fichier |
| `get_hotspots` | `limit?: number, sort_by?: string` | Fichiers les plus complexes / impactants |
| `search_symbols` | `query: string, kind?: string` | Chercher une fonction/classe/export par nom |
| `get_architecture` | — | Vue par langage/groupe avec métriques agrégées |

### Format de réponse (exemples)

**`find_dependencies("src/extension.ts", 2)`** :
```json
{
    "file": "src/extension.ts",
    "depth": 2,
    "dependencies": [
        { "id": "src/webview/WebviewProvider.ts", "depth": 1 },
        { "id": "src/analyzer/index.ts", "depth": 1 },
        { "id": "src/analyzer/graph-builder.ts", "depth": 2 },
        { "id": "src/analyzer/scanner.ts", "depth": 2 }
    ],
    "total": 4
}
```

**`find_dependents("src/utils/helpers.ts", 3)`** :
```json
{
    "file": "src/utils/helpers.ts",
    "dependents": [
        { "id": "src/api/routes.ts", "depth": 1 },
        { "id": "src/server.ts", "depth": 2 }
    ],
    "total": 2,
    "note": "Modifying this file impacts 2 files transitively"
}
```

### Structure fichiers

```
src/
├── graph-db.ts              # Classe GraphDB (SQLite wrapper + requêtes)
├── mcp-server.ts            # MCP server entry point (stdio)
├── mcp-tools.ts             # Tool handlers (find_dependencies, etc.)
└── mcp-resources.ts         # Resource handlers (aura://overview, etc.)
```

### Configuration MCP (côté utilisateur)

**`.vscode/mcp.json`** dans le workspace :
```json
{
    "servers": {
        "aura": {
            "command": "node",
            "args": ["${workspaceFolder}/node_modules/.vscode-aura/mcp-server.js"],
            "env": {
                "AURA_DB_PATH": "${workspaceFolder}/.aura/graph.db"
            }
        }
    }
}
```

**Alternative** : l'extension enregistre le MCP server programmatiquement via l'API VS Code (`vscode.lm.registerTool` ou en générant le `mcp.json`).

### Build

Nouveau entry point esbuild :
```javascript
// 4ème bundle : MCP server
{
    entryPoints: ['src/mcp-server.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: 'out/mcp-server.js',
    external: ['better-sqlite3']  // native binding, ne pas bundler
}
```

---

## Plan d'exécution

### Phase A : Graph DB (~6h)

| Étape | Description | Effort |
|-------|-------------|--------|
| A1 | Installer `better-sqlite3` + types | 15min |
| A2 | Créer `src/graph-db.ts` (schema + import + queries) | 2h |
| A3 | Intégrer dans `extension.ts` (appel après refreshAnalysis) | 30min |
| A4 | Tests unitaires (`graph-db.test.ts`) | 1h30 |
| A5 | Vérifier build esbuild (external native binding) | 30min |
| A6 | Test end-to-end sur ThorV2 | 1h |

### Phase B : MCP Server (~8h)

| Étape | Description | Effort |
|-------|-------------|--------|
| B1 | Installer `@modelcontextprotocol/sdk` | 15min |
| B2 | Créer `src/mcp-server.ts` (bootstrap + transport stdio) | 1h |
| B3 | Implémenter resources (overview, nodes, node detail) | 1h30 |
| B4 | Implémenter tools (8 tools) | 3h |
| B5 | Build (4ème bundle esbuild) | 30min |
| B6 | Intégrer dans l'extension (auto-register ou générer mcp.json) | 1h |
| B7 | Tests (mcp-server.test.ts) | 1h |

### Dépendances nouvelles

```json
{
    "dependencies": {
        "better-sqlite3": "^11.x"
    },
    "devDependencies": {
        "@types/better-sqlite3": "^7.x",
        "@modelcontextprotocol/sdk": "^1.x"
    }
}
```

---

## Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| `better-sqlite3` native binding dans VSIX | VSIX platform-spécifique | Utiliser `vsce package --target linux-x64` etc. ou fallback `sql.js` (WASM) |
| DB corrompue / crash SQLite | Perte du cache | La DB est reconstructible à tout moment via re-analyse |
| MCP server process orphelin | Fuite mémoire | Cleanup dans `extension.deactivate()` + kill on workspace close |
| Taille DB pour gros repos (>10k fichiers) | Performance | Peu probable : 10k nodes + 50k edges ≈ 5MB SQLite |
| Conflit concurrent extension ↔ MCP server | Write lock SQLite | Extension = seul writer, MCP = read-only (WAL mode) |
