/**
 * AuraTreeProvider.ts — Activity Bar TreeView showing codebase stats.
 */

import * as vscode from 'vscode';
import type { GraphData, GraphNode } from './analyzer/index';

type TreeEntry =
    | { kind: 'header'; label: string; icon: string }
    | { kind: 'stat'; label: string; value: string; icon: string }
    | { kind: 'file'; node: GraphNode; metric: string };

class AuraTreeItem extends vscode.TreeItem {
    constructor(
        public readonly entry: TreeEntry,
        collapsible: vscode.TreeItemCollapsibleState
    ) {
        const label = entry.kind === 'file'
            ? entry.node.name
            : entry.kind === 'stat'
                ? `${entry.label}: ${entry.value}`
                : entry.label;

        super(label, collapsible);

        if (entry.kind === 'header') {
            this.iconPath = new vscode.ThemeIcon(entry.icon);
        } else if (entry.kind === 'stat') {
            this.iconPath = new vscode.ThemeIcon(entry.icon);
        } else if (entry.kind === 'file') {
            this.description = entry.metric;
            this.iconPath = new vscode.ThemeIcon('file');
            this.command = {
                command: 'auraVisualizer.openFileFromTree',
                title: 'Open File',
                arguments: [entry.node.path]
            };
            this.tooltip = `${entry.node.path}\nComplexity: ${entry.node.complexity}\nLines: ${entry.node.linesOfCode}\nFan-in: ${entry.node.fanIn} / Fan-out: ${entry.node.fanOut}`;
        }
    }
}

export class AuraTreeProvider implements vscode.TreeDataProvider<AuraTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<AuraTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private data: GraphData | undefined;

    update(data: GraphData): void {
        this.data = data;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: AuraTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AuraTreeItem): AuraTreeItem[] {
        if (!this.data) {
            return [new AuraTreeItem(
                { kind: 'stat', label: 'No data', value: 'Open a workspace and run Aura', icon: 'info' },
                vscode.TreeItemCollapsibleState.None
            )];
        }

        if (!element) {
            return [
                new AuraTreeItem({ kind: 'header', label: 'Stats', icon: 'graph' }, vscode.TreeItemCollapsibleState.Expanded),
                new AuraTreeItem({ kind: 'header', label: 'Most Complex', icon: 'flame' }, vscode.TreeItemCollapsibleState.Collapsed),
                new AuraTreeItem({ kind: 'header', label: 'Largest Files', icon: 'file-binary' }, vscode.TreeItemCollapsibleState.Collapsed),
                new AuraTreeItem({ kind: 'header', label: 'Orphan Files', icon: 'warning' }, vscode.TreeItemCollapsibleState.Collapsed),
            ];
        }

        if (element.entry.kind !== 'header') return [];

        const d = this.data;

        switch (element.entry.label) {
            case 'Stats': {
                const langs = Object.entries(d.meta.languageStats)
                    .map(([lang, s]) => `${lang}: ${s.count}`)
                    .join(', ');
                return [
                    this.stat('Files', String(d.meta.totalFiles), 'file'),
                    this.stat('Links', String(d.meta.totalLinks), 'link'),
                    this.stat('Function Calls', String(d.meta.functionCallLinks), 'symbol-method'),
                    this.stat('Groups', String(d.meta.groups.length), 'folder'),
                    this.stat('Languages', langs, 'symbol-color'),
                ];
            }
            case 'Most Complex': {
                return [...d.nodes]
                    .sort((a, b) => b.complexity - a.complexity)
                    .slice(0, 10)
                    .map(n => new AuraTreeItem(
                        { kind: 'file', node: n, metric: `complexity: ${n.complexity}` },
                        vscode.TreeItemCollapsibleState.None
                    ));
            }
            case 'Largest Files': {
                return [...d.nodes]
                    .sort((a, b) => b.linesOfCode - a.linesOfCode)
                    .slice(0, 10)
                    .map(n => new AuraTreeItem(
                        { kind: 'file', node: n, metric: `${n.linesOfCode} lines` },
                        vscode.TreeItemCollapsibleState.None
                    ));
            }
            case 'Orphan Files': {
                return d.nodes
                    .filter(n => n.fanIn === 0 && n.fanOut === 0)
                    .map(n => new AuraTreeItem(
                        { kind: 'file', node: n, metric: n.language },
                        vscode.TreeItemCollapsibleState.None
                    ));
            }
            default:
                return [];
        }
    }

    private stat(label: string, value: string, icon: string): AuraTreeItem {
        return new AuraTreeItem(
            { kind: 'stat', label, value, icon },
            vscode.TreeItemCollapsibleState.None
        );
    }
}
