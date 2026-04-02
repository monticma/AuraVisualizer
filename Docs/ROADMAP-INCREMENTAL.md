# Roadmap — Analyse incrémentale

> Objectif : passer de ~10s (full rebuild) à <1s lors d'un save fichier.

## État actuel

### Ce qui existe déjà
- **File watcher** avec debounce 500ms (`setupFileWatcher()` L750)
- **`pendingUpdates`** Map qui agrège les changements
- **`scanSingleFile()`** dans scanner.ts — peut lire un seul fichier
- **`computeGraphDelta()`** — calcule la différence entre ancien/nouveau graphe
- **`sendGraphDelta()`** — envoie uniquement le delta au webview

### Ce qui bloque
- **`incrementalUpdate()`** appelle `buildGraph(cachedFiles)` sur TOUS les fichiers
- **`importGraphData()`** fait `DELETE FROM` sur les 5 tables + ré-INSERT complet
- **Pas de méthodes DB granulaires** — pas de `updateNode()`, `upsertEdge()`, etc.
- **Pas de cache AST persistant** — les arbres Tree-sitter sont recalculés à chaque run

---

## Architecture cible

```
Fichier sauvegardé
       │
       ▼
  fileWatcher (debounce 500ms)
       │
       ▼
  scanSingleFile(changedFile)
       │
       ▼
  preParseFiles([changedFile])    ← parse AST uniquement pour ce fichier
       │
       ▼
  rebuildFileGraph(changedFile)   ← NOUVEAU : rebuild partiel
       │                            - recalcule imports/exports du fichier
       │                            - met à jour les function-call edges
       │                            - recalcule complexity, LOC, symbols
       │                            - recalcule fan-in/fan-out des voisins
       ▼
  graphDb.updateFile(fileData)    ← NOUVEAU : update SQL granulaire
       │                            - UPDATE nodes SET ... WHERE id = ?
       │                            - DELETE edges WHERE source = ?
       │                            - INSERT edges ...
       │                            - DELETE/INSERT symbols
       ▼
  computeGraphDelta()             ← déjà existant
       │
       ▼
  sendGraphDelta()                ← déjà existant
```

---

## Phases d'implémentation

### Phase 1 — Méthodes DB granulaires
**Effort : faible | Impact : prérequis**

Ajouter à `GraphDB` :

```typescript
// Mise à jour d'un nœud existant
updateNode(node: NodeData): void

// Suppression d'un nœud + ses edges/symbols
deleteNode(nodeId: string): void

// Remplacement des edges d'un fichier source
replaceEdgesForSource(sourceId: string, edges: EdgeData[]): void

// Remplacement des symbols d'un fichier
replaceSymbolsForNode(nodeId: string, symbols: SymbolData[]): void

// Recalcul fan-in/fan-out pour un ensemble de nœuds
updateFanCounts(nodeIds: string[]): void

// Nettoyage des annotations orphelines (pour la feature annotations)
pruneOrphanAnnotations(): void
```

Le `importGraphData()` reste tel quel pour le full scan initial. Les méthodes granulaires servent uniquement pour les updates incrémentaux.

**Tables impactées** : nodes, edges, symbols
**Tables non impactées** : meta (recalculé globalement), cycles (recalculé globalement)

---

### Phase 2 — Rebuild partiel du graphe
**Effort : moyen | Impact : clé**

Créer `rebuildFileGraph(changedFile, cachedFiles, globalIndex)` :

1. **Re-parser le fichier changé** — Tree-sitter AST, extraction symboles + relations
2. **Mettre à jour le globalFunctionIndex** — retirer les anciennes entrées du fichier, ajouter les nouvelles
3. **Recalculer les edges sortants** du fichier changé (imports, function calls, heritage)
4. **Recalculer les edges entrants** — pour chaque fichier qui référençait des symboles du fichier changé, vérifier si les liens sont encore valides
5. **Recalculer complexity + LOC** du fichier changé
6. **Recalculer fan-in/fan-out** des nœuds affectés (le fichier + ses voisins directs)

**Données persistantes nécessaires** :
- `globalFunctionIndex` : Map `"family:funcName" → Set<fileId>` — garder en mémoire entre les updates
- `cachedFiles` : déjà maintenu, mettre à jour l'entrée du fichier changé

**Ce qui n'est PAS recalculé** (trop coûteux pour un delta) :
- Cycles — recalculés uniquement sur full refresh
- Dead code — recalculés uniquement sur full refresh  
- Meta stats — recalculées uniquement sur full refresh

---

### Phase 3 — Intégration dans le pipeline
**Effort : faible | Impact : finalisation**

Modifier `incrementalUpdate()` dans extension.ts :

```
AVANT : scanSingleFile → buildGraph(ALL files) → importGraphData(ALL) → delta
APRÈS : scanSingleFile → rebuildFileGraph(1 file) → graphDb.updateFile() → delta
```

Étapes :
1. `scanSingleFile()` récupère le contenu + metadata du fichier modifié
2. `preParseFiles([changedFile])` parse son AST
3. `rebuildFileGraph()` recalcule uniquement ce qui change
4. `graphDb.updateNode()` + `replaceEdgesForSource()` + `replaceSymbolsForNode()`
5. `computeGraphDelta()` + `sendGraphDelta()` (déjà en place)

Pour les fichiers **créés** : même flow + `INSERT INTO nodes`
Pour les fichiers **supprimés** : `graphDb.deleteNode()` + retirer du globalIndex + recalculer fan-in des voisins

---

### Phase 4 — Cache AST persistant (optionnel)
**Effort : moyen | Impact : optimisation du démarrage initial**

Stocker les AST parsés dans une table `ast_cache` :

```sql
CREATE TABLE ast_cache (
    node_id   TEXT PRIMARY KEY,
    hash      TEXT,           -- SHA-256 du contenu
    ast_data  BLOB            -- AST sérialisé ou skip (re-parse si absent)
);
```

Au démarrage :
1. Charger les hash depuis `ast_cache`
2. Scanner les fichiers, comparer les hash
3. Ne re-parser que les fichiers dont le hash a changé
4. Pour les fichiers inchangés, réutiliser les données en DB

**Gain estimé** : démarrage ~2-3s au lieu de ~10s sur un projet stable (la plupart des fichiers n'ont pas changé).

---

## Estimation de gains

| Scénario | Actuel | Après Phase 3 | Après Phase 4 |
|----------|--------|---------------|---------------|
| Premier lancement | ~10s | ~10s | ~10s |
| Relancement (rien changé) | ~10s | ~10s | **~2s** |
| Save 1 fichier | ~10s | **<0.5s** | **<0.5s** |
| Save + create fichier | ~10s | **<1s** | **<1s** |
| Gros refactor (50 fichiers) | ~10s | ~8s (fallback full) | **~5s** |

---

## Risques et contraintes

| Risque | Mitigation |
|--------|------------|
| Désynchronisation DB vs graphe en mémoire | Fallback full rebuild si incohérence détectée |
| Cycles non recalculés en incrémental | Acceptable — les cycles changent rarement, recalculés au full refresh |
| Dead code incorrect après rename | Recalcul dead code uniquement sur full refresh ou commande manuelle |
| globalFunctionIndex en mémoire (RAM) | ~1-2 MB pour 400 fichiers, négligeable |
| Heritage edges cassés après delete | Le recalcul des edges entrants (Phase 2, étape 4) couvre ce cas |

---

## Prérequis pour la feature Annotations

La feature d'annotations sur les nœuds nécessite :
- Table `annotations` séparée, **non touchée** par `importGraphData()`
- Clé = `node_id` (chemin relatif, stable entre les rebuilds)
- Nettoyage optionnel des annotations orphelines après chaque import (`pruneOrphanAnnotations()`)
- Compatible avec l'incrémental sans modification supplémentaire

---

## Ordre recommandé

1. **Phase 1** (DB granulaire) — prérequis, peut être fait indépendamment
2. **Phase 2** (rebuild partiel) — le plus gros morceau, le plus impactant
3. **Phase 3** (intégration) — câblage final, rapide
4. **Phase 4** (cache AST) — optimisation bonus, peut attendre
