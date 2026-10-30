/**
 * hover.ts — metrics on hover over an import specifier (V3-04).
 *
 * The card is built from the in-memory graph (`cachedGraphData`) and the risk
 * snapshot, so a hover never touches SQLite: it is called on every mouse move
 * and must stay instant. Parsing and resolution live in `hover-core.ts`.
 *
 * Only **import specifiers** are hovered (`from './x'`, `require('x')`,
 * `#include "x"`, `import a.b.C`, `use crate::x` …) — arbitrary text never
 * produces a card.
 */

import * as vscode from 'vscode';
import type { GraphNode } from './analyzer/types';
import type { RiskSnapshot } from './risk/risk-service';
import {
    findFirstSpecifier,
    findImportSpecifier,
    formatHover,
    resolveSpecifier,
    supportsLanguage,
    type HoverLinks,
    type HoverMetrics,
} from './hover-core';

export interface HoverGraphSnapshot {
    nodes: ReadonlyArray<GraphNode>;
}

/** One cached line: the specifier and the node it resolved to. */
interface LineEntry {
    specifier: string;
    start: number;
    end: number;
    nodeId?: string;
    confidence?: number;
}

export class AuraHoverProvider implements vscode.HoverProvider {
    private readonly cache = new Map<string, { version: number; dataset: ReadonlyArray<GraphNode> | undefined; lines: Map<number, LineEntry | null> }>();
    private nodeIndex = new Map<string, GraphNode>();
    private nodeIndexDataset: ReadonlyArray<GraphNode> | undefined;

    constructor(
        private readonly getGraph: () => HoverGraphSnapshot | undefined,
        private readonly getRisk: () => RiskSnapshot | undefined,
        private readonly isEnabled: () => boolean = () => true,
    ) { }

    public dispose(): void {
        this.cache.clear();
        this.nodeIndex.clear();
        this.nodeIndexDataset = undefined;
    }

    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
    ): vscode.Hover | undefined {
        if (token.isCancellationRequested || !this.isEnabled()) return undefined;
        if (document.uri.scheme !== 'file') return undefined;
        if (!supportsLanguage(document.languageId)) return undefined;

        const fileId = this.toNodeId(document);
        if (!fileId) return undefined;

        const entry = this.lineEntry(document, position.line);
        if (!entry) return undefined;
        if (position.character < entry.start || position.character > entry.end) return undefined;
        if (!entry.nodeId) return undefined;

        const node = this.node(entry.nodeId);
        if (!node) return undefined;

        const metrics = this.metrics(node, entry.confidence);
        const markdown = new vscode.MarkdownString(formatHover(metrics, this.links(node.id)));
        markdown.isTrusted = true; // command links
        markdown.supportThemeIcons = false;

        const range = new vscode.Range(position.line, entry.start, position.line, entry.end);
        return new vscode.Hover(markdown, range);
    }

    // ------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------

    /** Workspace-relative POSIX id of the document (same convention as the graph). */
    private toNodeId(document: vscode.TextDocument): string | undefined {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) return undefined;
        const root = folder.uri.fsPath.replace(/\\/g, '/').replace(/\/+$/, '');
        const filePath = document.uri.fsPath.replace(/\\/g, '/');
        if (!filePath.startsWith(root + '/')) return undefined;
        return filePath.slice(root.length + 1);
    }

    /** Analyse (and cache) one line: specifier + resolution, per document version. */
    private lineEntry(document: vscode.TextDocument, lineNumber: number): LineEntry | null {
        const key = document.uri.toString();
        const graph = this.getGraph();
        const dataset = graph ? graph.nodes : undefined;
        let cached = this.cache.get(key);
        if (!cached || cached.version !== document.version || cached.dataset !== dataset) {
            cached = { version: document.version, dataset, lines: new Map() };
            this.cache.set(key, cached);
            if (this.cache.size > 40) {
                const oldest = this.cache.keys().next().value;
                if (oldest !== undefined && oldest !== key) this.cache.delete(oldest);
            }
        }
        if (cached.lines.has(lineNumber)) return cached.lines.get(lineNumber) ?? null;

        const lineText = document.lineAt(lineNumber).text;
        // Cheap pre-filter: only import-ish lines are parsed.
        if (!/\b(import|from|require|include|use|using|source)\b|#\s*include|^(\.|source)\s/.test(lineText)) {
            cached.lines.set(lineNumber, null);
            return null;
        }
        const fileId = this.toNodeId(document);
        if (!fileId) {
            cached.lines.set(lineNumber, null);
            return null;
        }

        // The cursor may sit anywhere on the line; probe with a column inside the
        // specifier once we found one, then rely on the range check in provideHover.
        const probe = this.findAnySpecifier(lineText, document.languageId);
        if (!probe) {
            cached.lines.set(lineNumber, null);
            return null;
        }
        const resolution = resolveSpecifier(probe.value, fileId, this.knownIds(graph));
        const entry: LineEntry = {
            specifier: probe.value,
            start: probe.start,
            end: probe.end,
            nodeId: resolution?.nodeId,
            confidence: resolution?.confidence,
        };
        cached.lines.set(lineNumber, entry);
        return entry;
    }

    /** Find the specifier regardless of the cursor column. */
    private findAnySpecifier(lineText: string, languageId: string) {
        return findFirstSpecifier(lineText, languageId);
    }

    private knownIds(graph: HoverGraphSnapshot | undefined): Set<string> {
        if (!graph) return new Set();
        if (this.nodeIndexDataset !== graph.nodes) {
            this.nodeIndex = new Map();
            for (const node of graph.nodes) this.nodeIndex.set(node.id.replace(/\\/g, '/'), node);
            this.nodeIndexDataset = graph.nodes;
        }
        return new Set(this.nodeIndex.keys());
    }

    private node(nodeId: string): GraphNode | undefined {
        return this.nodeIndex.get(nodeId);
    }

    private metrics(node: GraphNode, confidence: number | undefined): HoverMetrics {
        const risk = this.getRisk()?.byId.get(node.id);
        return {
            id: node.id,
            language: node.language,
            linesOfCode: node.linesOfCode,
            complexity: node.complexity,
            cognitive: node.cognitive,
            fanIn: node.fanIn,
            fanOut: node.fanOut,
            layer: node.layer,
            archViolations: node.archViolations,
            riskBucket: risk?.bucket,
            riskScore: risk?.score,
            confidence,
        };
    }

    /** Command URIs — reuse the commands already registered for @aura. */
    private links(nodeId: string): HoverLinks {
        const arg = encodeURIComponent(JSON.stringify([nodeId]));
        return {
            focus: `command:auraVisualizer.focusPath?${arg}`,
            blast: `command:auraVisualizer.blastRadiusPath?${arg}`,
            open: `command:auraVisualizer.openFileAt?${arg}`,
        };
    }
}
