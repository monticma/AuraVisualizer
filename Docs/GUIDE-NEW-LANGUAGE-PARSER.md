# Guide — Ajouter un nouveau langage à AuraVisualizer

> Ce guide est destiné aux agents IA implémentant un nouveau parser de langage.
> Langage de référence : **Go** (`ts-go-parser.ts`).

---

## Vue d'ensemble

L'ajout d'un langage nécessite de modifier **6 fichiers existants** et d'en créer **2 nouveaux** (parser + tests).

### Fichiers à créer
| Fichier | Rôle |
|---------|------|
| `src/analyzer/parsers/ts-{lang}-parser.ts` | Parser Tree-sitter du langage |
| `src/test/ts-{lang}-parser.test.ts` | Tests unitaires du parser |

### Fichiers à modifier
| Fichier | Modification |
|---------|-------------|
| `src/analyzer/scanner.ts` | Ajouter extensions + mapping langue |
| `src/analyzer/graph-builder.ts` | Enregistrer le parser + configurer LANG_FAMILY |
| `src/analyzer/tree-sitter-loader.ts` | Ajouter le fichier WASM grammar |
| `src/analyzer/complexity.ts` | Ajouter un case (ou vérifier que `default` suffit) |
| `esbuild.js` | Copier le `.wasm` dans `out/tree-sitter-wasms/` si nécessaire |
| `package.json` | Ajouter la dépendance grammar WASM si nécessaire |

---

## Étape 1 — Vérifier la disponibilité du grammar WASM

Le package `tree-sitter-wasms` (dépendance existante) contient déjà de nombreux grammars.

```bash
ls node_modules/tree-sitter-wasms/out/ | grep {lang}
```

Si le grammar est inclus (ex: `tree-sitter-ruby.wasm`), aucune dépendance supplémentaire n'est nécessaire.

Si le grammar n'est **pas** dans `tree-sitter-wasms`, il faudra :
1. Trouver un package npm fournissant le `.wasm` (ex: `tree-sitter-{lang}`)
2. L'ajouter dans `package.json` dependencies
3. Mettre à jour `esbuild.js` pour copier le `.wasm` dans `out/tree-sitter-wasms/`

---

## Étape 2 — Scanner : extensions et mapping

**Fichier** : `src/analyzer/scanner.ts`

```typescript
// Ajouter l'extension dans SUPPORTED_EXTENSIONS
export const SUPPORTED_EXTENSIONS = new Set([
    '.c', '.h', '.js', '.ts', '.py', '.css', '.html', '.htm',
    '.java', '.go', '.rs',
    '.rb'    // ← AJOUTER
]);

// Ajouter le mapping extension → language id
export const LANGUAGE_MAP: Record<string, string> = {
    // ... existants ...
    '.rb': 'ruby'    // ← AJOUTER
};
```

**Convention** : le language id doit correspondre à celui utilisé dans `tree-sitter-loader.ts`.

---

## Étape 3 — Tree-sitter Loader : enregistrer le grammar

**Fichier** : `src/analyzer/tree-sitter-loader.ts`

```typescript
const GRAMMAR_FILES: Record<string, string> = {
    // ... existants ...
    'ruby': 'tree-sitter-ruby.wasm',    // ← AJOUTER
};
```

Le nom du `.wasm` doit correspondre exactement au fichier dans `node_modules/tree-sitter-wasms/out/`.

---

## Étape 4 — Créer le parser

**Fichier** : `src/analyzer/parsers/ts-{lang}-parser.ts`

Utiliser `ts-go-parser.ts` comme modèle. Le parser étend `BaseParser` et doit implémenter :

### 4.1 — Structure de base

```typescript
import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

// Builtins du langage à exclure de la détection d'appels
const LANG_BUILTINS = new Set([ /* ... */ ]);
const LANG_KEYWORDS = new Set([ /* ... */ ]);

export class TreeSitter{Lang}Parser extends BaseParser {
    constructor() {
        super('{language_id}');   // doit correspondre à scanner.ts LANGUAGE_MAP
    }

    override get usesTreeSitter(): boolean {
        return true;
    }
```

### 4.2 — Méthodes obligatoires à implémenter

| Méthode | Rôle | Retour |
|---------|------|--------|
| `parseAST(tree, fileInfo)` | Extraire les relations d'import | `Relation[]` |
| `extractSymbolsAST(tree, fileInfo)` | Extraire les symboles (fonctions, classes, etc.) | `FileSymbols` |
| `extractCallsAST(tree, fileInfo, globalFunctions)` | Extraire les appels cross-file (résolution) | `Relation[]` |
| `extractCallsFromAST(tree)` | Liste brute des noms de fonctions appelées | `string[]` |
| `extractCallSitesAST(tree, fileInfo)` | Appels avec contexte caller/callee/ligne | `CallSite[]` |

### 4.3 — Méthode optionnelle

| Méthode | Rôle |
|---------|------|
| `extractHeritageRelations(tree, fileInfo)` | extends/implements (si le langage supporte l'héritage) |

### 4.4 — Pattern d'extraction d'imports (`parseAST`)

Parcourir `tree.rootNode` et chercher les nœuds d'import du langage.

```typescript
override parseAST(tree: Parser.Tree, fileInfo: FileInfo): Relation[] {
    const relations: Relation[] = [];
    // Parcourir l'AST pour trouver les imports
    // Utiliser les AST node types spécifiques au langage
    // (consulter https://tree-sitter.github.io/tree-sitter/ pour la grammaire)
    return relations;
}
```

**Astuce** : Pour découvrir les types de nœuds AST d'un langage, parser un échantillon de code et afficher l'arbre :
```typescript
const tree = await parseSource('ruby', 'require "json"\ndef foo; end');
console.log(tree.rootNode.toString());
```

### 4.5 — Pattern d'extraction de symboles (`extractSymbolsAST`)

Retourner un objet `FileSymbols` avec les listes appropriées :

```typescript
override extractSymbolsAST(tree: Parser.Tree, _fileInfo: FileInfo): FileSymbols {
    const symbols: FileSymbols = {
        functions: [], externs: [], structs: [], enums: [],
        macros: [], classes: [], exports: [],
        interfaces: [], traits: [], typeAliases: [], methods: [],
    };

    // Parcourir l'AST et remplir les listes
    // IMPORTANT : chaque fonction doit avoir { name, type, line }
    // Le champ `line` est 1-indexed : node.startPosition.row + 1

    return symbols;
}
```

### 4.6 — Pattern d'extraction d'appels (`extractCallsAST` + `extractCallsFromAST`)

Deux méthodes qui partagent la même logique interne :

```typescript
// 1. Collecter les fonctions définies dans le fichier
private collectDefinedFunctions(node: Parser.SyntaxNode, defined: Set<string>): void {
    if (node.type === 'FUNCTION_DEF_NODE_TYPE') {
        const name = node.childForFieldName('name')?.text;
        if (name) { defined.add(name); }
    }
    for (let i = 0; i < node.childCount; i++) {
        this.collectDefinedFunctions(node.child(i)!, defined);
    }
}

// 2. Collecter les appels (exclure les locaux, builtins, keywords)
private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
    if (node.type === 'CALL_NODE_TYPE') {
        const funcNode = node.childForFieldName('function');
        if (funcNode?.type === 'identifier') {
            const name = funcNode.text;
            if (!LANG_BUILTINS.has(name) && !LANG_KEYWORDS.has(name)
                && !definedHere.has(name)) {
                calls.add(name);
            }
        }
    }
    for (let i = 0; i < node.childCount; i++) {
        this.collectCalls(node.child(i)!, calls, definedHere);
    }
}

// extractCallsAST filtre contre globalFunctions pour les Relation[]
// extractCallsFromAST retourne la liste brute string[]
```

**Types de nœuds d'appel par langage connu** :

| Langage | Définition de fonction | Expression d'appel |
|---------|----------------------|-------------------|
| C | `function_definition` | `call_expression` |
| JavaScript | `function_declaration`, `arrow_function` | `call_expression` |
| TypeScript | (hérite de JS) | (hérite de JS) |
| Python | `function_definition` | `call` |
| Java | `method_declaration` | `method_invocation` |
| Go | `function_declaration` | `call_expression` |
| Rust | `function_item` | `call_expression` |

### 4.7 — Pattern d'extraction de call sites (`extractCallSitesAST`)

C'est la méthode la plus récente — elle track le **scope de la fonction englobante** :

```typescript
override extractCallSitesAST(tree: Parser.Tree, _fileInfo: FileInfo): CallSite[] {
    const definedHere = new Set<string>();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites: CallSite[] = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, '<module>');
    return sites;
}

private collectCallSites(
    node: Parser.SyntaxNode,
    sites: CallSite[],
    definedHere: Set<string>,
    currentFunc: string
): void {
    // 1. Si le nœud est une définition de fonction, changer le scope
    if (node.type === 'FUNCTION_DEF_NODE_TYPE') {
        const name = node.childForFieldName('name')?.text || currentFunc;
        for (let i = 0; i < node.childCount; i++) {
            this.collectCallSites(node.child(i)!, sites, definedHere, name);
        }
        return;  // ← IMPORTANT : return pour ne pas double-parcourir
    }

    // 2. Si le nœud est un appel, enregistrer le call site
    if (node.type === 'CALL_NODE_TYPE') {
        const funcNode = node.childForFieldName('function');
        if (funcNode?.type === 'identifier') {
            const name = funcNode.text;
            if (!LANG_BUILTINS.has(name) && !LANG_KEYWORDS.has(name)) {
                sites.push({
                    callerName: currentFunc,
                    calleeName: name,
                    line: node.startPosition.row + 1,
                    isLocal: definedHere.has(name),
                });
            }
        }
    }

    // 3. Récurser dans les enfants
    for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i)!, sites, definedHere, currentFunc);
    }
}
```

**Points clés** :
- `callerName` = nom de la fonction englobante, ou `'<module>'` si top-level
- `isLocal` = `true` si le callee est défini dans le même fichier
- `line` = numéro de ligne **1-indexed** (`node.startPosition.row + 1`)
- Ne pas filtrer les appels locaux ici (contrairement à `collectCalls`)
- Filtrer uniquement les builtins et keywords

---

## Étape 5 — Enregistrer dans le graph-builder

**Fichier** : `src/analyzer/graph-builder.ts`

### 5.1 — Import + registre

```typescript
// En haut du fichier, ajouter l'import
import { TreeSitter{Lang}Parser } from './parsers/ts-{lang}-parser';

// Dans le registre PARSERS
const PARSERS: Record<string, BaseParser> = {
    // ... existants ...
    '{language_id}': new TreeSitter{Lang}Parser(),
};
```

### 5.2 — LANG_FAMILY

Dans la fonction `buildGraph`, ajouter le langage dans `LANG_FAMILY` :

```typescript
const LANG_FAMILY: Record<string, string> = {
    'c': 'c', 'javascript': 'js', 'typescript': 'js', 'python': 'py',
    'java': 'java', 'go': 'go', 'rust': 'rust',
    'ruby': 'ruby'    // ← AJOUTER (utiliser la même clé si le langage partage un écosystème)
};
```

### 5.3 — SYMBOL_LANGUAGES

```typescript
const SYMBOL_LANGUAGES = new Set([
    'c', 'javascript', 'typescript', 'python', 'java', 'go', 'rust',
    'ruby'    // ← AJOUTER
]);
```

---

## Étape 6 — Complexity (optionnel)

**Fichier** : `src/analyzer/complexity.ts`

Le `default` case retourne `complexity: 1`. Si vous voulez une complexité cyclomatique réelle pour le nouveau langage :

```typescript
case 'ruby':
    return computeCJSComplexity(content);  // Réutiliser si la syntaxe est similaire (if/for/while)
```

Si la syntaxe est très différente de C/JS (ex: indentation-based), créer une nouvelle fonction.

---

## Étape 7 — Écrire les tests

**Fichier** : `src/test/ts-{lang}-parser.test.ts`

Utiliser `ts-go-parser.test.ts` comme modèle. Tests minimum requis :

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitter{Lang}Parser } from '../analyzer/parsers/ts-{lang}-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitter{Lang}Parser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('{language_id}', content);
}
```

### Tests obligatoires

| Catégorie | Quoi tester |
|-----------|------------|
| **Imports** | `parseAST()` extrait les imports du langage |
| **Symboles** | `extractSymbolsAST()` extrait fonctions, classes, méthodes |
| **Appels** | `extractCallsFromAST()` retourne les appels externes, exclut les locaux/builtins |
| **Call sites** | `extractCallSitesAST()` track le caller, la ligne, et `isLocal` |
| **Heritage** | `extractHeritageRelations()` (si applicable) |
| **Metadata** | `usesTreeSitter === true`, `language === '{id}'` |

---

## Étape 8 — Build et validation

```bash
# 1. Vérifier les types
npx tsc --noEmit

# 2. Lancer les tests
npx vitest run

# 3. Build esbuild
node esbuild.js

# 4. Vérifier que le grammar WASM est accessible
ls out/tree-sitter-wasms/tree-sitter-{lang}.wasm
```

---

## Checklist récapitulative

```
□ Grammar WASM disponible dans tree-sitter-wasms (ou ajouté manuellement)
□ scanner.ts : SUPPORTED_EXTENSIONS + LANGUAGE_MAP
□ tree-sitter-loader.ts : GRAMMAR_FILES
□ ts-{lang}-parser.ts : classe créée avec les 5 méthodes
   □ parseAST() — imports
   □ extractSymbolsAST() — symboles
   □ extractCallsAST() — appels cross-file (résolution)
   □ extractCallsFromAST() — liste brute d'appels
   □ extractCallSitesAST() — call sites avec scope caller
   □ extractHeritageRelations() — héritage (optionnel)
□ graph-builder.ts : import + PARSERS + LANG_FAMILY + SYMBOL_LANGUAGES
□ complexity.ts : case ajouté (ou default suffisant)
□ ts-{lang}-parser.test.ts : tests unitaires
□ npx tsc --noEmit — pas d'erreurs de types
□ npx vitest run — tous les tests passent
□ node esbuild.js — build OK
```

---

## Types de référence

### CallSite (`src/analyzer/types.ts`)
```typescript
export interface CallSite {
    callerName: string;       // nom de la fonction englobante (ou '<module>')
    calleeName: string;       // nom de la fonction appelée
    line: number;             // numéro de ligne (1-indexed)
    isLocal: boolean;         // true si le callee est défini dans le même fichier
}
```

### FileSymbols (`src/analyzer/types.ts`)
```typescript
export interface FileSymbols {
    functions: SymbolInfo[];
    externs: SymbolInfo[];
    structs: SymbolInfo[];
    enums: SymbolInfo[];
    macros: SymbolInfo[];
    classes: SymbolInfo[];
    exports: SymbolInfo[];
    interfaces: SymbolInfo[];
    traits: SymbolInfo[];
    typeAliases: SymbolInfo[];
    methods: SymbolInfo[];
}
```

### SymbolInfo (`src/analyzer/types.ts`)
```typescript
export interface SymbolInfo {
    name: string;
    type: string;             // 'function', 'class', 'method', 'struct', ...
    returnType?: string;
    params?: string;
    line?: number;            // 1-indexed
    visibility?: 'public' | 'private' | 'protected' | 'internal';
    isStatic?: boolean;
    isAsync?: boolean;
}
```

### Relation (`src/analyzer/types.ts`)
```typescript
export interface Relation {
    source: string;           // file id
    target: string;           // target path/module ou symbol name (pre-résolution)
    type: string;             // 'import', 'function-call', 'extends', ...
    label: string;
    resolvedTarget?: string;
}
```
