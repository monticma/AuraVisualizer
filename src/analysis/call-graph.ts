/**
 * call-graph.ts — le graphe d'appels, exploitable (lot 3).
 *
 * Aura stockait déjà chaque site d'appel résolu (`function_calls`) mais ne
 * l'exposait qu'au niveau **fichier** : « qui appelle `computeRisk` ? » se
 * répondait au `grep`. Ce module construit le graphe fonction → fonction une
 * fois, puis répond aux cinq questions qui comptent :
 *
 *   callersOf   — qui m'appelle ?
 *   calleesOf   — qu'est-ce que j'appelle ?
 *   impactOf    — si je change, qui casse ? (fermeture transitive inverse)
 *   shortestCallPath — par où l'exécution arrive-t-elle ici ?
 *   entryPoints — où commence l'exécution ?
 *
 * Choix assumés (arbitrés le 2026-11-19) :
 *  - **Identité** = `fichier::nom`. Le parseur ne stocke que les noms, donc
 *    deux surcharges homonymes d'un même fichier fusionnent : c'est le mieux
 *    qu'on puisse faire sans moteur de types, et c'est dit dans la doc.
 *  - **`<module>`** (statements top-level) n'est pas une fonction : il est
 *    retiré des réponses symbole, mais il reste un **point d'entrée** — le
 *    `<module>` d'un script est précisément là où l'exécution commence.
 *  - **Confiance recalculée** : la table `function_calls` n'a pas de colonne
 *    `confidence`, donc on applique la même règle que `symbol-cycles.ts` —
 *    appel local 1.0, cible inter-fichiers unique 0.8, cible ambiguë 0.5
 *    (une expression d'appel qui résout vers plusieurs fichiers est un candidat,
 *    pas une certitude).
 *  - **Ambiguïté groupée** : `$` est appelé 1 756 fois dans la webview d'Aura.
 *    Une réponse qui liste les 1 756 lignes est inutilisable, donc les appelants
 *    sont groupés **par symbole** avec le total, et seuls les détails d'un
 *    symbole précis détaillent les lignes.
 *
 * Pur et déterministe : aucun accès disque, base ou VS Code. Tout est trié
 * (symboles par clé, arêtes par cible, chemins par profondeur puis nom) pour
 * que deux appels sur la même base rendent exactement la même réponse.
 */

/** Nom que le parseur donne aux statements top-level. */
export const MODULE_SYMBOL = '<module>';

/**
 * Ce que le graphe ne voit pas — dit à chaque réponse vide.
 *
 * Le parseur ignore les appels de **méthode** (`db.getCallSites()`), décision
 * prise bien avant ce module. Conséquence directe : un résultat vide n'est pas
 * une preuve que rien n'appelle ce symbole, et un outil qui laisserait croire le
 * contraire ferait exactement ce que le rapport de résolution corrige ailleurs.
 */
export const STATIC_CALL_GRAPH_NOTE =
    'Static call graph: free functions plus `this.`/`self.` calls. A method called on an arbitrary object (db.getCallSites()) is not recorded by the analyser, so an empty result is not a proof that nothing calls this symbol.';

export interface CallSiteInput {
    callerFile: string;
    callerName: string;
    calleeFile: string;
    calleeName: string;
    line: number;
}

export interface CallSymbol {
    /** `fichier::nom` — l'identité canonique. */
    key: string;
    file: string;
    name: string;
    /** `<module>` : statements top-level, pas une fonction. */
    isModule: boolean;
}

export interface CallEdge {
    from: string;
    to: string;
    /** Toutes les lignes d'appel entre ces deux symboles (croissantes). */
    lines: number[];
    /** 1.0 local · 0.8 cible unique inter-fichiers · 0.5 cible ambiguë. */
    confidence: number;
    /** Nombre de fichiers cibles distincts pour cette expression d'appel. */
    targets: number;
}

export interface CallGraph {
    symbols: Map<string, CallSymbol>;
    /** Clé → arêtes sortantes, triées par cible. */
    out: Map<string, CallEdge[]>;
    /** Clé → arêtes entrantes, triées par source. */
    in: Map<string, CallEdge[]>;
    /** Sites retenus, et sites ignorés parce qu'incomplets. */
    sites: number;
    skipped: number;
}

export function symbolKey(file: string, name: string): string {
    return `${file}::${name}`;
}

export function splitSymbolKey(key: string): { file: string; name: string } {
    const cut = key.indexOf('::');
    if (cut < 0) return { file: key, name: '' };
    return { file: key.slice(0, cut), name: key.slice(cut + 2) };
}

export function isModuleKey(key: string): boolean {
    return splitSymbolKey(key).name === MODULE_SYMBOL;
}

// ── Construction ───────────────────────────────────────────────

function compareEdges(a: CallEdge, b: CallEdge): number {
    return a.to.localeCompare(b.to) || a.from.localeCompare(b.from);
}

/**
 * Build the symbol graph. A call expression that resolves to several files
 * (`foo()` where five files export `foo`) stays in the graph — with 0.5
 * confidence — because dropping it would hide a real caller; the tools group
 * those candidates so the answer stays readable.
 */
export function buildCallGraph(sites: readonly CallSiteInput[]): CallGraph {
    const symbols = new Map<string, CallSymbol>();
    const edges = new Map<string, CallEdge>();
    const skipped = { count: 0 };

    const siteValid = (site: CallSiteInput): boolean =>
        !!site
        && typeof site.callerFile === 'string' && site.callerFile.length > 0
        && typeof site.callerName === 'string' && site.callerName.length > 0
        && typeof site.calleeFile === 'string' && site.calleeFile.length > 0
        && typeof site.calleeName === 'string' && site.calleeName.length > 0;

    // Une expression d'appel = (fichier appelant, fonction appelante, ligne,
    // nom appelé). Elle peut produire plusieurs sites (cibles candidates) :
    // c'est la taille de cet ensemble qui dit si la cible est ambiguë.
    const expressions = new Map<string, CallSiteInput[]>();
    let kept = 0;
    for (const site of sites) {
        if (!siteValid(site)) { skipped.count++; continue; }
        kept++;
        const key = [site.callerFile, site.callerName, site.line, site.calleeName].join('\u0000');
        const list = expressions.get(key);
        if (list) list.push(site);
        else expressions.set(key, [site]);
    }

    const register = (file: string, name: string): string => {
        const key = symbolKey(file, name);
        if (!symbols.has(key)) symbols.set(key, { key, file, name, isModule: name === MODULE_SYMBOL });
        return key;
    };

    for (const group of expressions.values()) {
        const targets = new Set(group.map(site => site.calleeFile));
        const confidence = (site: CallSiteInput): number =>
            site.callerFile === site.calleeFile ? 1 : (targets.size > 1 ? 0.5 : 0.8);
        for (const site of group) {
            const from = register(site.callerFile, site.callerName);
            const to = register(site.calleeFile, site.calleeName);
            const key = `${from}\u0001${to}`;
            let edge = edges.get(key);
            if (!edge) {
                edge = { from, to, lines: [], confidence: confidence(site), targets: targets.size };
                edges.set(key, edge);
            }
            if (!edge.lines.includes(site.line)) edge.lines.push(site.line);
            // La pire confiance de l'arête : une ligne ambiguë rend l'arête ambiguë.
            edge.confidence = Math.min(edge.confidence, confidence(site));
        }
    }

    const out = new Map<string, CallEdge[]>();
    const incoming = new Map<string, CallEdge[]>();
    for (const symbol of symbols.keys()) {
        out.set(symbol, []);
        incoming.set(symbol, []);
    }
    for (const edge of edges.values()) {
        out.get(edge.from)!.push(edge);
        incoming.get(edge.to)!.push(edge);
    }
    for (const list of out.values()) list.sort(compareEdges);
    for (const list of incoming.values()) {
        list.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    }
    for (const edge of edges.values()) edge.lines.sort((a, b) => a - b);

    return { symbols, out, in: incoming, sites: kept, skipped: skipped.count };
}

// ── Résolution d'un symbole ────────────────────────────────────

export interface SymbolMatch {
    key: string;
    file: string;
    name: string;
    isModule: boolean;
}

/**
 * Find the symbols a query designates.
 *
 * Accepted forms, from the most precise to the vaguest:
 *   `src/risk/risk-core.ts::computeRisk`  exact key
 *   `src/risk/risk-core.ts:computeRisk`   file + name
 *   `computeRisk`                         every symbol with that name
 *
 * A bare name is normal: the caller asked about a name, and an export used in
 * five files really is five symbols. Returning all of them (grouped by file) is
 * more honest than picking one.
 */
export function resolveSymbol(graph: CallGraph, query: string, options: { includeModule?: boolean } = {}): SymbolMatch[] {
    const wanted = String(query || '').trim().replace(/^\.\//, '');
    if (!wanted) return [];
    const includeModule = options.includeModule === true;

    const toMatch = (symbol: CallSymbol): SymbolMatch =>
        ({ key: symbol.key, file: symbol.file, name: symbol.name, isModule: symbol.isModule });

    if (wanted.includes('::')) {
        const symbol = graph.symbols.get(wanted);
        return symbol && (includeModule || !symbol.isModule) ? [toMatch(symbol)] : [];
    }

    // `fichier:nom` — le fichier est ce qui précède le dernier ':' et doit
    // exister tel quel dans le graphe (sinon `a.ts` seul serait mal découpé).
    const colon = wanted.lastIndexOf(':');
    if (colon > 1) {
        const file = wanted.slice(0, colon);
        const name = wanted.slice(colon + 1);
        const symbol = graph.symbols.get(symbolKey(file, name));
        if (symbol) return [toMatch(symbol)];
    }

    const matches: SymbolMatch[] = [];
    for (const symbol of graph.symbols.values()) {
        if (symbol.name !== wanted) continue;
        if (!includeModule && symbol.isModule) continue;
        matches.push(toMatch(symbol));
    }
    matches.sort((a, b) => a.file.localeCompare(b.file));
    return matches;
}

// ── Appelants / appelés ────────────────────────────────────────

export interface CallerEntry {
    symbol: SymbolMatch;
    /** Lignes d'appel dans le fichier appelant. */
    lines: number[];
    confidence: number;
    /** Nombre de fichiers cibles distincts pour cette expression d'appel. */
    targets: number;
}

export interface CallDirectionResult {
    symbol: SymbolMatch;
    /** Groupés par symbole : un appelant apparaît une fois, avec ses lignes. */
    entries: CallerEntry[];
    total: number;
    distinctFiles: number;
    ambiguous: number;
    truncated: boolean;
    /** Appels internes au fichier (exclus par défaut). */
    localTotal: number;
}

export interface CallDirectionOptions {
    limit?: number;
    /** Inclure les appels entre fonctions d'un même fichier (défaut false). */
    includeLocal?: boolean;
    /** Inclure les symboles `<module>` (défaut false). */
    includeModule?: boolean;
}

function directionResult(
    graph: CallGraph,
    match: SymbolMatch,
    edges: readonly CallEdge[],
    peer: (edge: CallEdge) => string,
    options: CallDirectionOptions,
): CallDirectionResult {
    const limit = Math.max(1, Math.min(500, Math.floor(options.limit ?? 50)));
    const includeLocal = options.includeLocal === true;
    const includeModule = options.includeModule === true;

    let localTotal = 0;
    const byPeer = new Map<string, CallerEntry>();
    for (const edge of edges) {
        const peerKey = peer(edge);
        const symbol = graph.symbols.get(peerKey);
        if (!symbol) continue;
        if (!includeModule && symbol.isModule) continue;
        if (!includeLocal && symbol.file === match.file) { localTotal++; continue; }
        const entry = byPeer.get(peerKey);
        if (entry) {
            for (const line of edge.lines) if (!entry.lines.includes(line)) entry.lines.push(line);
            entry.confidence = Math.min(entry.confidence, edge.confidence);
            entry.targets = Math.max(entry.targets, edge.targets);
        } else {
            byPeer.set(peerKey, {
                symbol: { key: symbol.key, file: symbol.file, name: symbol.name, isModule: symbol.isModule },
                lines: [...edge.lines],
                confidence: edge.confidence,
                targets: edge.targets,
            });
        }
    }

    const entries = [...byPeer.values()].sort((a, b) =>
        a.symbol.file.localeCompare(b.symbol.file) || a.symbol.name.localeCompare(b.symbol.name));
    for (const entry of entries) entry.lines.sort((a, b) => a - b);
    const files = new Set(entries.map(entry => entry.symbol.file));

    return {
        symbol: match,
        entries: entries.slice(0, limit),
        total: entries.length,
        distinctFiles: files.size,
        ambiguous: entries.filter(entry => entry.confidence < 0.8).length,
        truncated: entries.length > limit,
        localTotal,
    };
}

/** Qui appelle ce symbole. */
export function callersOf(graph: CallGraph, match: SymbolMatch, options: CallDirectionOptions = {}): CallDirectionResult {
    return directionResult(graph, match, graph.in.get(match.key) ?? [], edge => edge.from, options);
}

/** Qu'appelle ce symbole. */
export function calleesOf(graph: CallGraph, match: SymbolMatch, options: CallDirectionOptions = {}): CallDirectionResult {
    return directionResult(graph, match, graph.out.get(match.key) ?? [], edge => edge.to, options);
}

// ── Impact / chemin ────────────────────────────────────────────

export interface ImpactEntry {
    symbol: SymbolMatch;
    depth: number;
    /** Chemin d'appel le plus court depuis la cible (`moi → a → b`). */
    via: string[];
    confidence: number;
}

export interface ImpactResult {
    symbol: SymbolMatch;
    impacted: ImpactEntry[];
    total: number;
    distinctFiles: number;
    maxDepth: number;
    truncated: boolean;
}

export interface ImpactOptions {
    maxDepth?: number;
    limit?: number;
    includeLocal?: boolean;
}

/**
 * Fermeture transitive **inverse** : tout ce qui peut atteindre ce symbole.
 *
 * L'appelant direct est à la profondeur 1. Les symboles d'un même fichier sont
 * exclus par défaut (changer une fonction impacte ses voisines, mais ce n'est
 * pas ce qu'on demande quand on mesure une rupture d'API).
 */
export function impactOf(graph: CallGraph, match: SymbolMatch, options: ImpactOptions = {}): ImpactResult {
    const maxDepth = Math.max(1, Math.min(20, Math.floor(options.maxDepth ?? 6)));
    const limit = Math.max(1, Math.min(2000, Math.floor(options.limit ?? 200)));
    const includeLocal = options.includeLocal === true;

    const seen = new Map<string, ImpactEntry>([[match.key, { symbol: match, depth: 0, via: [], confidence: 1 }]]);
    const queue: string[] = [match.key];
    const order: ImpactEntry[] = [];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const state = seen.get(current)!;
        if (state.depth >= maxDepth) continue;
        for (const edge of graph.in.get(current) ?? []) {
            const symbol = graph.symbols.get(edge.from);
            if (!symbol || symbol.isModule) continue;
            if (!includeLocal && symbol.file === match.file) continue;
            if (seen.has(symbol.key)) continue;
            const entry: ImpactEntry = {
                symbol: { key: symbol.key, file: symbol.file, name: symbol.name, isModule: symbol.isModule },
                depth: state.depth + 1,
                via: [...state.via, symbol.key],
                confidence: edge.confidence,
            };
            seen.set(symbol.key, entry);
            order.push(entry);
            queue.push(symbol.key);
        }
    }

    order.sort((a, b) => a.depth - b.depth
        || a.symbol.file.localeCompare(b.symbol.file)
        || a.symbol.name.localeCompare(b.symbol.name));
    const distinctFiles = new Set(order.map(entry => entry.symbol.file));
    return {
        symbol: match,
        impacted: order.slice(0, limit),
        total: order.length,
        distinctFiles: distinctFiles.size,
        maxDepth: order.reduce((max, entry) => Math.max(max, entry.depth), 0),
        truncated: order.length > limit,
    };
}

export interface CallPathStep {
    symbol: SymbolMatch;
    /** Ligne d'appel de l'étape précédente vers celle-ci (absente sur la première). */
    line?: number;
    confidence: number;
}

export interface CallPathResult {
    from: SymbolMatch;
    to: SymbolMatch;
    steps: CallPathStep[];
    found: boolean;
}

/**
 * Plus court chemin d'appel entre deux symboles (BFS depuis `from`).
 * Cycle-safe : un symbole déjà visité n'est jamais réexploré, donc une
 * récursion ne boucle pas.
 */
export function shortestCallPath(
    graph: CallGraph,
    from: SymbolMatch,
    to: SymbolMatch,
    options: { maxDepth?: number } = {},
): CallPathResult {
    const maxDepth = Math.max(1, Math.min(30, Math.floor(options.maxDepth ?? 12)));
    if (from.key === to.key) {
        return { from, to, steps: [{ symbol: from, confidence: 1 }], found: true };
    }

    const previous = new Map<string, { from: string; line?: number; confidence: number }>();
    const visited = new Set<string>([from.key]);
    const queue: { key: string; depth: number }[] = [{ key: from.key, depth: 0 }];

    while (queue.length > 0) {
        const { key, depth } = queue.shift()!;
        if (depth >= maxDepth) continue;
        for (const edge of graph.out.get(key) ?? []) {
            if (visited.has(edge.to)) continue;
            visited.add(edge.to);
            previous.set(edge.to, { from: key, line: edge.lines[0], confidence: edge.confidence });
            if (edge.to === to.key) {
                const steps: CallPathStep[] = [];
                let cursor: string | undefined = to.key;
                while (cursor) {
                    const symbol = graph.symbols.get(cursor);
                    const back = previous.get(cursor);
                    if (!symbol) break;
                    steps.unshift({
                        symbol: { key: symbol.key, file: symbol.file, name: symbol.name, isModule: symbol.isModule },
                        ...(back && back.line !== undefined ? { line: back.line } : {}),
                        confidence: back ? back.confidence : 1,
                    });
                    cursor = back?.from;
                }
                return { from, to, steps, found: true };
            }
            queue.push({ key: edge.to, depth: depth + 1 });
        }
    }

    return { from, to, steps: [], found: false };
}

// ── Points d'entrée ────────────────────────────────────────────

export type EntryReason = 'main' | 'lifecycle' | 'package' | 'test' | 'root';

export interface EntryPoint {
    symbol: SymbolMatch;
    reason: EntryReason;
    /** Pour `root` : rien ne l'appelle. Pour `package` : la clé du package.json. */
    detail?: string;
}

export interface EntryPointsOptions {
    /** Fichiers désignés par `main` / `bin` du package.json (chemins relatifs). */
    packageEntries?: readonly string[];
    limit?: number;
    includeTests?: boolean;
}

const TEST_PATTERN = /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.[a-z]+$/i;

/**
 * Où l'exécution commence — **heuristique**, et dite comme telle.
 *
 * Quatre signaux : `main`, `activate`/`deactivate` (cycle de vie d'une
 * extension), `main`/`bin` du `package.json`, les tests. Puis un repli :
 * tout symbole qu'aucun autre n'appelle est une racine du graphe.
 *
 * Ce n'est pas une vérité : un rappel enregistré par un framework n'a aucun
 * appelant statique, et un `main` peut n'être jamais exécuté. La liste sert à
 * *proposer* des entrées, pas à décider.
 */
export function entryPoints(graph: CallGraph, options: EntryPointsOptions = {}): EntryPoint[] {
    const limit = Math.max(1, Math.min(1000, Math.floor(options.limit ?? 100)));
    const packageEntries = new Set((options.packageEntries ?? []).map(file => file.replace(/^\.\//, '')));
    const found: EntryPoint[] = [];

    for (const symbol of graph.symbols.values()) {
        const match: SymbolMatch = { key: symbol.key, file: symbol.file, name: symbol.name, isModule: symbol.isModule };
        if (symbol.name === 'main') { found.push({ symbol: match, reason: 'main' }); continue; }
        if (symbol.name === 'activate' || symbol.name === 'deactivate') {
            found.push({ symbol: match, reason: 'lifecycle' });
            continue;
        }
        if (symbol.isModule && packageEntries.has(symbol.file)) {
            found.push({ symbol: match, reason: 'package', detail: symbol.file });
            continue;
        }
        if (symbol.isModule && TEST_PATTERN.test(symbol.file)) {
            if (options.includeTests !== false) found.push({ symbol: match, reason: 'test' });
            continue;
        }
        if (!symbol.isModule && (graph.in.get(symbol.key) ?? []).length === 0) {
            found.push({ symbol: match, reason: 'root' });
        }
    }

    const rank: Record<EntryReason, number> = { main: 0, lifecycle: 1, package: 2, test: 3, root: 4 };
    found.sort((a, b) => rank[a.reason] - rank[b.reason]
        || a.symbol.file.localeCompare(b.symbol.file)
        || a.symbol.name.localeCompare(b.symbol.name));
    return found.slice(0, limit);
}

/** Compteurs du graphe — sert aux tests d'invariant et à la doc. */
export function callGraphStats(graph: CallGraph): {
    sites: number;
    skipped: number;
    symbols: number;
    functions: number;
    moduleSymbols: number;
    edges: number;
    crossFileEdges: number;
    roots: number;
} {
    let edges = 0;
    let crossFile = 0;
    let roots = 0;
    let functions = 0;
    let moduleSymbols = 0;
    for (const symbol of graph.symbols.values()) {
        if (symbol.isModule) moduleSymbols++;
        else functions++;
    }
    for (const [key, list] of graph.out) {
        edges += list.length;
        for (const edge of list) {
            if (splitSymbolKey(edge.from).file !== splitSymbolKey(edge.to).file) crossFile++;
        }
        if (!graph.symbols.get(key)!.isModule && list.length >= 0 && (graph.in.get(key) ?? []).length === 0) roots++;
    }
    return { sites: graph.sites, skipped: graph.skipped, symbols: graph.symbols.size, functions, moduleSymbols, edges, crossFileEdges: crossFile, roots };
}
