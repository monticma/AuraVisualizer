/**
 * structure.js — Explosion, directory clustering and path/blast helpers.
 *
 * Extracted from app.js (V0-3). The interaction state stays in app.js; this
 * module receives live getters/setters through init(hooks) and never owns the
 * graph. Classic script: window.AuraStructure.
 */
(function () {
    'use strict';

    var hooks = {};

    function init(h) {
        hooks = h || {};
    }

    // ============================================================
    // Multi-node blast — impact cascade seeded from changed files
    // ============================================================
    function startMultiNodeBlast(seedIds) {
        var graph = hooks.getGraph ? hooks.getGraph() : null;
        if (!graph) return;

        // Set up blast infrastructure (state owned by app.js)
        hooks.setBlastMode(true);
        hooks.setPinnedNode({}); // sentinel — not a real node, just truthy
        hooks.getPinnedNodes().clear();
        hooks.getPinnedLinks().clear();
        var blastDepths = {};
        hooks.setBlastDepths(blastDepths);

        var currentNodes = graph.graphData().nodes;
        var currentLinks = graph.graphData().links;
        var visited = new Set();
        var frontier = [];
        var focusDepth = hooks.getFocusDepth ? hooks.getFocusDepth() : 1;

        // Seed: every changed file at depth 0
        var seedSet = new Set(seedIds || []);
        for (var ni = 0; ni < currentNodes.length; ni++) {
            var n = currentNodes[ni];
            if (seedSet.has(n.id)) {
                hooks.getPinnedNodes().add(n);
                blastDepths[n.id] = 0;
                visited.add(n.id);
                frontier.push(n);
            }
        }

        // BFS — follow dependents (reverse edges)
        for (var depth = 0; depth < focusDepth; depth++) {
            var nextFrontier = [];
            for (var f = 0; f < frontier.length; f++) {
                var curr = frontier[f];
                for (var i = 0; i < currentLinks.length; i++) {
                    var l = currentLinks[i];
                    var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                    var targetId = typeof l.target === 'object' ? l.target.id : l.target;
                    if (targetId === curr.id && !visited.has(sourceId)) {
                        visited.add(sourceId);
                        var neighborNode = typeof l.source === 'object' ? l.source : hooks.findNode(sourceId);
                        if (neighborNode) {
                            hooks.getPinnedNodes().add(neighborNode);
                            blastDepths[sourceId] = depth + 1;
                            nextFrontier.push(neighborNode);
                        }
                    }
                }
            }
            frontier = nextFrontier;
        }

        // Collect links between impacted nodes
        for (var j = 0; j < currentLinks.length; j++) {
            var link = currentLinks[j];
            var sid = typeof link.source === 'object' ? link.source.id : link.source;
            var tid = typeof link.target === 'object' ? link.target.id : link.target;
            if (visited.has(sid) && visited.has(tid)) {
                hooks.getPinnedLinks().add(link);
            }
        }

        // blastMode is true here — the internal check rebuilds the impact glow
        if (hooks.refreshFocusVisuals) hooks.refreshFocusVisuals(false);
    }

    // ============================================================
    // File Explosion
    // ============================================================
    function explodeFile(node) {
        if (!node.symbols || !node.symbols.functions.length) return;
        if (hooks.getExplodedNode && hooks.getExplodedNode()) collapseExplosion();

        var graph = hooks.getGraph ? hooks.getGraph() : null;
        if (!graph) return;

        hooks.setExplodedNode(node);
        var graphData = hooks.getGraphData ? hooks.getGraphData() : null;
        var currentData = graph.graphData();
        var subNodes = [];
        var subLinks = [];
        var colors = { 'function': '#81c784', 'struct': '#ce93d8', 'enum': '#ffd54f' };

        var allSymbols = [];
        for (var i = 0; i < node.symbols.functions.length; i++) {
            allSymbols.push(node.symbols.functions[i]);
        }
        for (var j = 0; j < node.symbols.structs.length; j++) {
            allSymbols.push(node.symbols.structs[j]);
        }

        for (var s = 0; s < allSymbols.length; s++) {
            var sym = allSymbols[s];
            var subId = node.id + '::' + sym.name;
            subNodes.push({
                id: subId,
                name: sym.name,
                path: node.path,
                language: node.language,
                linesOfCode: 10,
                size: 0,
                group: node.group,
                fanIn: 0,
                fanOut: 0,
                complexity: 1,
                _isSymbol: true,
                _parentId: node.id,
                _symbolType: sym.type,
                _symbolColor: colors[sym.type] || '#81c784',
                _line: sym.line,
                x: (node.x || 0) + (Math.random() - 0.5) * 60,
                y: (node.y || 0) + (Math.random() - 0.5) * 60,
                z: (node.z || 0) + (Math.random() - 0.5) * 60
            });
            subLinks.push({
                source: node.id,
                target: subId,
                type: 'contains',
                label: 'contains ' + sym.name,
                _isExplosionLink: true
            });
        }

        // Build call edges (not shown immediately — revealed on symbol hover)
        var allCallEdges = [];
        var subIdSet = new Set(subNodes.map(function(n) { return n.id; }));
        if (graphData && graphData.functionCalls) {
            for (var fc = 0; fc < graphData.functionCalls.length; fc++) {
                var call = graphData.functionCalls[fc];
                if (call.callerFile !== node.id) continue;
                var callerId = node.id + '::' + call.callerName;
                // Intra-file: callee is a symbol in the same file
                if (call.calleeFile === node.id) {
                    var calleeId = node.id + '::' + call.calleeName;
                    if (subIdSet.has(callerId) && subIdSet.has(calleeId) && callerId !== calleeId) {
                        allCallEdges.push({
                            source: callerId,
                            target: calleeId,
                            type: 'function-call',
                            label: call.callerName + ' → ' + call.calleeName,
                            _isExplosionLink: true,
                            _isCallEdge: true
                        });
                    }
                }
                // Cross-file: caller symbol → external file node
                else if (subIdSet.has(callerId) && call.calleeFile) {
                    allCallEdges.push({
                        source: callerId,
                        target: call.calleeFile,
                        type: 'function-call',
                        label: call.callerName + ' → ' + call.calleeName + ' (' + call.calleeFile + ')',
                        _isExplosionLink: true,
                        _isCallEdge: true
                    });
                }
            }
        }

        hooks.setExplosionData({
            parentId: node.id,
            subNodeIds: subNodes.map(function(n) { return n.id; })
        });

        var newNodes = currentData.nodes.concat(subNodes);
        var newLinks = currentData.links.concat(subLinks).concat(allCallEdges);
        graph.graphData({ nodes: newNodes, links: newLinks });
    }

    function collapseExplosion() {
        var explosionData = hooks.getExplosionData ? hooks.getExplosionData() : null;
        if (!explosionData) return;
        var graph = hooks.getGraph ? hooks.getGraph() : null;
        if (!graph) return;

        var currentData = graph.graphData();
        var subIds = new Set(explosionData.subNodeIds);

        var filteredNodes = currentData.nodes.filter(function(n) { return !subIds.has(n.id); });
        var filteredLinks = currentData.links.filter(function(l) { return !l._isExplosionLink; });

        graph.graphData({ nodes: filteredNodes, links: filteredLinks });
        hooks.setExplodedNode(null);
        hooks.setExplosionData(null);
        hooks.setHoveredSymbolId(null);
    }

    // ============================================================
    // Directory Clustering
    // ============================================================
    function buildClusteredData(data, expandedGroups) {
        expandedGroups = expandedGroups || new Set();
        var palette = (typeof GROUP_COLORS !== 'undefined' && GROUP_COLORS.length > 0)
            ? GROUP_COLORS
            : ['#64b5f6'];

        // Group nodes by their group property (top-level directory)
        var groups = {};
        for (var i = 0; i < data.nodes.length; i++) {
            var n = data.nodes[i];
            if (n._isSymbol) continue;
            var grp = n.group || '/';
            if (!groups[grp]) groups[grp] = [];
            groups[grp].push(n);
        }

        var clusterNodes = [];
        var clusterLinks = [];
        var nodeToCluster = {}; // nodeId -> clusterId or nodeId

        var colorIdx = 0;
        var groupNames = Object.keys(groups).sort();

        for (var g = 0; g < groupNames.length; g++) {
            var groupName = groupNames[g];
            var members = groups[groupName];

            if (expandedGroups.has(groupName) || members.length === 1) {
                // Expanded: show individual nodes
                for (var m = 0; m < members.length; m++) {
                    clusterNodes.push(members[m]);
                    nodeToCluster[members[m].id] = members[m].id;
                }
            } else {
                // Collapsed: create meta-node
                var totalLoc = 0, totalSize = 0, maxComplexity = 0;
                for (var mc = 0; mc < members.length; mc++) {
                    totalLoc += members[mc].linesOfCode || 0;
                    totalSize += members[mc].size || 0;
                    maxComplexity = Math.max(maxComplexity, members[mc].complexity || 1);
                }
                var color = palette[colorIdx % palette.length];
                var clusterId = '__cluster__' + groupName;
                clusterNodes.push({
                    id: clusterId,
                    name: groupName + '/',
                    path: groupName,
                    language: 'cluster',
                    extension: '',
                    size: totalSize,
                    linesOfCode: totalLoc,
                    lastModified: 0,
                    group: groupName,
                    fanIn: 0,
                    fanOut: 0,
                    complexity: maxComplexity,
                    _isCluster: true,
                    _clusterGroup: groupName,
                    _clusterColor: color,
                    _clusterCount: members.length,
                    _memberIds: members.map(function(n) { return n.id; })
                });
                for (var mi = 0; mi < members.length; mi++) {
                    nodeToCluster[members[mi].id] = clusterId;
                }
                colorIdx++;
            }
        }

        // Remap links
        var linkSet = new Set();
        for (var li = 0; li < data.links.length; li++) {
            var link = data.links[li];
            var srcId = typeof link.source === 'object' ? link.source.id : link.source;
            var tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            var mappedSrc = nodeToCluster[srcId] || srcId;
            var mappedTgt = nodeToCluster[tgtId] || tgtId;
            if (mappedSrc === mappedTgt) continue; // internal link within same cluster
            var lkey = mappedSrc + '|' + mappedTgt;
            if (linkSet.has(lkey)) continue;
            linkSet.add(lkey);
            clusterLinks.push({
                source: mappedSrc,
                target: mappedTgt,
                type: link.type,
                label: link.label
            });
        }

        // Compute cluster fan-in/fan-out
        for (var ci = 0; ci < clusterNodes.length; ci++) {
            var cn = clusterNodes[ci];
            if (cn._isCluster) {
                var fi = 0, fo = 0;
                for (var cl = 0; cl < clusterLinks.length; cl++) {
                    var csrc = typeof clusterLinks[cl].source === 'object' ? clusterLinks[cl].source.id : clusterLinks[cl].source;
                    var ctgt = typeof clusterLinks[cl].target === 'object' ? clusterLinks[cl].target.id : clusterLinks[cl].target;
                    if (csrc === cn.id) fo++;
                    if (ctgt === cn.id) fi++;
                }
                cn.fanIn = fi;
                cn.fanOut = fo;
            }
        }

        return { nodes: clusterNodes, links: clusterLinks };
    }

    // ============================================================
    // Directory Clustering — toggles
    // ============================================================
    function toggleDirectoryGroups() {
        var show = hooks.getShowGroups ? hooks.getShowGroups() : false;
        show = !show;
        if (hooks.setShowGroups) hooks.setShowGroups(show);
        var btn = document.querySelector('#btn-group-dirs');
        if (btn) btn.classList.toggle('active', show);
        if (!show && hooks.getExpandedGroups) hooks.getExpandedGroups().clear();
        if (hooks.applyFilters) hooks.applyFilters();
    }

    function toggleGroupExpansion(groupName) {
        var groups = hooks.getExpandedGroups ? hooks.getExpandedGroups() : new Set();
        if (groups.has(groupName)) {
            groups.delete(groupName);
        } else {
            groups.add(groupName);
        }
        if (hooks.applyFilters) hooks.applyFilters();
    }

    // ============================================================
    // Path Mode — pure BFS, returns { nodes, links } or null
    // ============================================================
    function findPath(start, end, graphData, findNode) {
        if (!graphData || !findNode) return null;

        var queue = [[start, []]];
        var visited = new Set();
        visited.add(start.id);

        var adj = {};
        var links = graphData.links;
        for (var i = 0; i < links.length; i++) {
            var l = links[i];
            var sId = typeof l.source === 'object' ? l.source.id : l.source;
            if (!adj[sId]) adj[sId] = [];

            var tNode = typeof l.target === 'object' ? l.target : findNode(typeof l.target === 'object' ? l.target.id : l.target);
            adj[sId].push({ target: tNode, link: l });
        }

        while (queue.length > 0) {
            var current = queue.shift();
            var currNode = current[0];
            var pathLinks = current[1];

            if (currNode.id === end.id) {
                var nodesInPath = new Set();
                nodesInPath.add(start);
                for (var j = 0; j < pathLinks.length; j++) {
                    var nsId = typeof pathLinks[j].source === 'object' ? pathLinks[j].source.id : pathLinks[j].source;
                    var ntId = typeof pathLinks[j].target === 'object' ? pathLinks[j].target.id : pathLinks[j].target;
                    nodesInPath.add(findNode(nsId));
                    nodesInPath.add(findNode(ntId));
                }
                return { nodes: nodesInPath, links: new Set(pathLinks) };
            }

            var neighbors = adj[currNode.id] || [];
            for (var k = 0; k < neighbors.length; k++) {
                var n = neighbors[k].target;
                var link = neighbors[k].link;
                if (n && !visited.has(n.id)) {
                    visited.add(n.id);
                    var newPathLinks = pathLinks.slice();
                    newPathLinks.push(link);
                    queue.push([n, newPathLinks]);
                }
            }
        }

        return null;
    }

    window.AuraStructure = {
        init: init,
        startMultiNodeBlast: startMultiNodeBlast,
        explodeFile: explodeFile,
        collapseExplosion: collapseExplosion,
        buildClusteredData: buildClusteredData,
        toggleDirectoryGroups: toggleDirectoryGroups,
        toggleGroupExpansion: toggleGroupExpansion,
        findPath: findPath
    };
})();
