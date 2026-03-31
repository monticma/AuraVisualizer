# Aura Visualizer — Roadmap Phase 7

## Ordre d'implémentation

| Priorité | Feature | Effort | Statut |
|----------|---------|--------|--------|
| 1 | Graph Spacing (Spread slider) | 1h | ✅ |
| 2 | Raccourcis clavier | 30min | ✅ |
| 3 | Focus Depth (profondeur click droit) | 1h | ✅ |
| 4 | Dead Code Detection | 3h | ✅ |
| 5 | Circular Dependencies | 2h | ✅ |
| 6 | Multi-sélection | 2h | 🔲 |
| 7 | Bookmarks | 2h | 🔲 |
| 8 | Architecture Layers | 3h | 🔲 |
| 9 | Tree-sitter (proto) | 4h | 🔲 |
| 10 | Diff Mode | 4h | 🔲 |
| 11 | Live Collaboration | 6h+ | 🔲 |

---

## 1. Graph Spacing (Spread slider)

- Slider dans la toolbar pour contrôler l'espacement entre les nœuds
- Agit sur les forces d3 : augmenter `charge strength` (répulsion) et `link distance`
- `graph.d3Force('charge').strength(val)` + `graph.d3Force('link').distance(val)`
- Appeler `graph.d3ReheatSimulation()` après modification pour recalculer le layout
- Range : de "compact" (valeurs actuelles) à "aéré" (×3-5 la répulsion)
- Persister la valeur via `vscode.getState()`
- Permet de naviguer dans les codebases denses sans que les nœuds se chevauchent

## 2. Raccourcis clavier

- `F` → fit-to-view (zoomToFit)
- `L` → toggle labels
- `Esc` → reset (clear selection, pinned, path mode)
- `G` → toggle groups
- `H` → cycle heatmaps
- Ajouter un `keydown` listener dans `app.js`
- Afficher les raccourcis dans le tooltip d'aide existant

## 3. Focus Depth (profondeur click droit)

- Actuellement le click droit sur un node montre uniquement les voisins directs (profondeur 1)
- Ajouter un slider "Depth" dans le footer (range 1 à 5, défaut 1)
- Quand on fait un click droit, parcourir le graphe en BFS jusqu'à la profondeur choisie
- Tous les nœuds atteints restent visibles, les autres sont grisés
- Les liens entre nœuds visibles restent colorés
- Permet de visualiser l'impact d'un fichier sur N niveaux de dépendances
- Raccourci `1-5` pour changer la profondeur rapidement

## 4. Dead Code Detection

- **Analyse** dans `graph-builder.ts` :
  - Fichiers avec `fanIn === 0` (jamais importés) — déjà partiellement via orphans
  - Exports non importés : chaque parser extrait les `exports`, on croise avec les `imports` de tous les fichiers
  - Fonctions/classes exportées mais jamais référencées
- Nouveau champ `deadExports: string[]` sur chaque `GraphNode`
- **Webview** : Bouton ☠️ "Dead Code" → heatmap spécial, les fichiers avec du dead code en rouge
- Panneau détail : liste des exports non utilisés par fichier
- Distinction : fichiers entry-points (main, index) exclus de la détection

## 5. Circular Dependency Detection

- **Algorithme** : Tarjan (SCC) ou DFS avec back-edge detection dans `graph-builder.ts`
- Nouveau champ `cycles: string[][]` dans `GraphData.meta`
- Fonction `findCycles(nodes, links)` → retourne les groupes de nœuds en cycle
- **Webview** : Bouton 🔄 dans la toolbar → highlight les nœuds/liens des cycles
- Les liens cycliques en rouge pulsant, les nœuds en orange
- Panneau détail : liste des cycles détectés avec les fichiers impliqués

## 6. Multi-sélection (Shift+Click) ✅

- `selectedNodes: Set` remplace `selectedNode` unique
- Shift+click ajoute/retire un nœud de la sélection
- Effet visuel : glow sur tous les nœuds sélectionnés
- Les liens **entre** nœuds sélectionnés sont mis en surbrillance
- Panneau détail : résumé agrégé (total LOC, complexité moyenne, langages)
- Click sans Shift → reset à sélection unique (comportement actuel)

## 7. Bookmarks

- Sauvegarder : position caméra, filtres langages actifs, heatmap, node sélectionné, groups
- Stocker via `vscode.getState()` / `setState()` (persiste dans le webview)
- Bouton 🔖 dans la toolbar → dropdown avec les bookmarks nommés
- Commande `auraVisualizer.saveBookmark` / `restoreBookmark`
- UI : petit panneau dropdown avec liste + boutons save/delete/load

## 8. Architecture Layers

- **Détection heuristique** par convention de nommage :
  - `components/`, `views/`, `pages/` → UI layer
  - `services/`, `api/`, `controllers/` → Service layer
  - `models/`, `db/`, `data/`, `store/` → Data layer
  - `utils/`, `helpers/`, `lib/` → Shared/Infra
- Configurable via `auraVisualizer.architectureLayers` dans settings
- **Analyse** : vérifier les imports inter-couches (UI→Data = violation)
- **Visualisation** :
  - Bouton "Layers" → DAG mode (top-down) groupé par couche
  - Violations en liens rouges pointillés
  - Zones colorées par couche (comme les groups/clusters existants)

## 9. Tree-sitter (exploration)

- Remplacer les parsers regex par Tree-sitter pour une extraction AST précise
- `web-tree-sitter` (WASM) fonctionne dans Node.js
- Avantages : résolution de scope, détection des re-exports, support de langages via grammaires existantes (Rust, Go, Java, Swift...)
- Plan : prototype sur le JS parser d'abord, comparer les résultats avec le parser regex actuel
- Si concluant → migration progressive parser par parser

## 10. Diff Mode

- **Snapshots** : sauvegarder `graphData` en JSON horodaté dans le workspace (`.aura/snapshots/`)
- Commande `auraVisualizer.snapshot` → sauvegarde l'état actuel
- Mode diff : sélectionner 2 snapshots → calcul du delta
- **Visualisation** :
  - Nœuds ajoutés → vert avec glow
  - Nœuds supprimés → rouge semi-transparent (fantômes)
  - Nœuds modifiés (complexité/LOC changés) → jaune avec taille proportionnelle au delta
  - Liens ajoutés/supprimés avec couleurs correspondantes
- Barre temporelle en bas pour slider entre snapshots

## 11. Live Collaboration

- **PeerJS** (WebRTC) pour du P2P sans serveur, ou **Y.js** (CRDT) + WebRTC provider
- Flux : hôte partage un room ID → invité rejoint → sync camera + sélection + curseur
- Sync en temps réel : position caméra, nœud sélectionné, annotations
- Curseurs des participants visibles (comme Figma)
- Bouton "Share" → génère un code de session
- **Complexité** : CSP du webview VS Code, il faudra un relay server minimal ou passer par l'extension host comme proxy WebSocket
