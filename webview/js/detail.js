/**
 * detail.js — Node detail panel, multi-selection panel and the note editor
 * that lives in its footer.
 *
 * Extracted from app.js (Lot 2c). window.AuraDetail + init(hooks). The panel
 * element is shared with app.js (same DOM node); state stays in app.js and is
 * reached through hooks.
 */
(function () {
    'use strict';

    var hooks = {};
    var $ = function (sel) { return document.querySelector(sel); };
    var detailPanel = document.getElementById('detail-panel');

    // ============================================================
    // Detail Panel
    // ============================================================
    function showDetailPanel(node) {
        if (node._isSymbol) return;

        // Cluster meta-node detail panel
        if (node._isCluster) {
            detailPanel.classList.remove('collapsed');
            $('#panel-icon').textContent = '📁';
            $('#panel-filename').textContent = node.name;
            $('#panel-path').textContent = node._clusterGroup;
            $('#panel-language').textContent = node._clusterCount + ' files';
            $('#panel-language').style.color = node._clusterColor || '#78909c';
            $('#panel-group').textContent = node._clusterGroup;
            $('#panel-community').textContent = '—';
            $('#panel-community').style.color = '';
            $('#panel-loc').textContent = '—';
            $('#panel-size').textContent = '—';
            $('#panel-mtime').textContent = '—';
            $('#panel-git').textContent = '—';
            $('#panel-fanout').textContent = node.fanOut || 0;
            $('#panel-fanin').textContent = node.fanIn || 0;
            $('#panel-complexity').textContent = '—';
            $('#panel-symbols-count').textContent = '0';
            $('#symbols-section').style.display = 'none';

            // Show member files in deps section
            var depsUl = $('#panel-deps');
            depsUl.innerHTML = '';
            $('#deps-count').textContent = node._memberIds ? node._memberIds.length : 0;
            if (node._memberIds) {
                for (var mi = 0; mi < node._memberIds.length; mi++) {
                    var memberId = node._memberIds[mi];
                    var memberNode = null;
                    for (var x = 0; x < hooks.getGraphData().nodes.length; x++) {
                        if (hooks.getGraphData().nodes[x].id === memberId) { memberNode = hooks.getGraphData().nodes[x]; break; }
                    }
                    var li = document.createElement('li');
                    li.innerHTML =
                        '<span class="dep-arrow">📄</span>' +
                        '<span>' + (memberNode ? memberNode.name : memberId) + '</span>';
                    depsUl.appendChild(li);
                }
            }

            // Clusters have no note editor
            var noteSection = $('#note-section');
            if (noteSection) noteSection.style.display = 'none';
            var depUl = $('#panel-dependents');
            depUl.innerHTML = '';
            $('#dependents-count').textContent = '0';
            return;
        }

        detailPanel.classList.remove('collapsed');

        $('#panel-icon').textContent = LANGUAGE_ICONS[node.language] || '📄';
        $('#panel-filename').textContent = node.name;
        $('#panel-path').textContent = node.path;
        $('#panel-language').textContent = node.language;
        $('#panel-language').style.color = LANGUAGE_COLORS[node.language] || '#fff';
        $('#panel-group').textContent = node.group;
        var cid = hooks.getCommunityMap()[node.id];
        var commEl = $('#panel-community');
        if (cid !== undefined && hooks.getCommunityNames()[cid]) {
            commEl.textContent = hooks.getCommunityNames()[cid].name;
            commEl.style.color = hooks.getCommunityColors()[cid] || '#fff';
        } else {
            commEl.textContent = '—';
            commEl.style.color = '';
        }
        $('#panel-loc').textContent = node.linesOfCode.toLocaleString();
        $('#panel-size').textContent = formatBytes(node.size);
        
        if (node.lastModified) {
            var date = new Date(node.lastModified);
            $('#panel-mtime').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } else {
            $('#panel-mtime').textContent = '—';
        }
        var gitState = hooks.dirtyStateOf(node);
        var gitEl = $('#panel-git');
        if (gitEl) {
            gitEl.textContent = gitState ? (hooks.getGitStateLabels()[gitState] || gitState) : '—';
            gitEl.style.color = gitState ? '#ffb300' : '';
        }
        updateNoteEditor(node);
        $('#panel-fanout').textContent = node.fanOut;
        $('#panel-fanin').textContent = node.fanIn;
        $('#panel-complexity').textContent = node.complexity || 1;

        var symbolCount = node.symbols ? node.symbols.totalSymbols : 0;
        $('#panel-symbols-count').textContent = symbolCount;

        var symbolsSection = $('#symbols-section');
        var symbolsList = $('#symbols-list');
        symbolsList.innerHTML = '';

        if (node.symbols && node.symbols.totalSymbols > 0) {
            symbolsSection.style.display = 'block';
            $('#symbols-total').textContent = node.symbols.totalSymbols;

            // Explode button
            var explodeBtn = document.createElement('button');
            explodeBtn.className = 'explode-btn';
            explodeBtn.textContent = hooks.getExplodedNode() && hooks.getExplodedNode().id === node.id ? '⊖ Collapse' : '⊕ Explode File';
            explodeBtn.addEventListener('click', function() {
                if (hooks.getExplodedNode() && hooks.getExplodedNode().id === node.id) {
                    hooks.collapseExplosion();
                } else {
                    hooks.explodeFile(node);
                }
            });
            symbolsList.appendChild(explodeBtn);

            // Functions
            for (var i = 0; i < node.symbols.functions.length; i++) {
                var fn = node.symbols.functions[i];
                var item = document.createElement('div');
                item.className = 'symbol-item symbol-item-clickable';
                var flowBtn = document.createElement('button');
                flowBtn.className = 'flow-trace-btn';
                flowBtn.textContent = '⑂';
                flowBtn.title = 'Function flowchart for ' + fn.name;
                (function(funcName, fileId, funcLine, lang) {
                    flowBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (window.AuraFlowView) window.AuraFlowView.open(fileId, funcLine, lang, funcName);
                    });
                })(fn.name, node.id, fn.line, node.language);
                item.appendChild(flowBtn);
                var traceBtn = document.createElement('button');
                traceBtn.className = 'flow-trace-btn';
                traceBtn.textContent = '▶';
                traceBtn.title = 'Trace call flow from ' + fn.name;
                (function(funcName, fileId) {
                    traceBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        hooks.startFlowTrace(fileId, funcName);
                    });
                })(fn.name, node.id);
                item.appendChild(traceBtn);
                var iconSpan = document.createElement('span');
                iconSpan.className = 'symbol-icon';
                iconSpan.textContent = SYMBOL_ICONS['function'] || '⚡';
                item.appendChild(iconSpan);
                var nameSpan = document.createElement('span');
                nameSpan.className = 'symbol-name';
                nameSpan.textContent = fn.name;
                item.appendChild(nameSpan);
                var metaSpan = document.createElement('span');
                metaSpan.className = 'symbol-meta';
                metaSpan.textContent = fn.returnType + '(' + shortenParams(fn.params) + ') L' + fn.line;
                item.appendChild(metaSpan);
                (function(line) {
                    item.addEventListener('dblclick', function() {
                        hooks.postMessage({ type: 'openFile', payload: { path: node.path, line: line } });
                    });
                })(fn.line);
                symbolsList.appendChild(item);
            }

            // Structs
            for (var j = 0; j < node.symbols.structs.length; j++) {
                var s = node.symbols.structs[j];
                var sItem = document.createElement('div');
                sItem.className = 'symbol-item';
                sItem.innerHTML =
                    '<span class="symbol-icon">' + (SYMBOL_ICONS[s.type] || '📦') + '</span>' +
                    '<span class="symbol-name">' + s.name + '</span>' +
                    '<span class="symbol-meta">' + s.type + '</span>';
                symbolsList.appendChild(sItem);
            }

            // Enums
            for (var k = 0; k < node.symbols.enums.length; k++) {
                var en = node.symbols.enums[k];
                var eItem = document.createElement('div');
                eItem.className = 'symbol-item';
                eItem.innerHTML =
                    '<span class="symbol-icon">' + (SYMBOL_ICONS['enum'] || '🏷️') + '</span>' +
                    '<span class="symbol-name">' + en.name + '</span>' +
                    '<span class="symbol-meta">enum</span>';
                symbolsList.appendChild(eItem);
            }

            // Macros
            var macros = node.symbols.macros.slice(0, 15);
            for (var m = 0; m < macros.length; m++) {
                var mac = macros[m];
                var mItem = document.createElement('div');
                mItem.className = 'symbol-item';
                mItem.innerHTML =
                    '<span class="symbol-icon">' + (SYMBOL_ICONS[mac.type] || '⚙️') + '</span>' +
                    '<span class="symbol-name">' + mac.name + '</span>' +
                    '<span class="symbol-meta">' + mac.type + '</span>';
                symbolsList.appendChild(mItem);
            }
        } else {
            symbolsSection.style.display = 'none';
        }

        // Dead exports section
        if (node.deadExports && node.deadExports.length > 0) {
            var deadSection = document.createElement('div');
            deadSection.className = 'dead-exports-section';
            deadSection.innerHTML =
                '<div class="dead-exports-header">☠️ Dead code <span class="dead-count">' +
                node.deadExports.length + '</span></div>';
            for (var de = 0; de < node.deadExports.length; de++) {
                var dItem = document.createElement('div');
                dItem.className = 'symbol-item dead-export-item';
                dItem.innerHTML =
                    '<span class="symbol-icon">⚠️</span>' +
                    '<span class="symbol-name dead-name">' + node.deadExports[de] + '</span>' +
                    '<span class="symbol-meta">unused</span>';
                deadSection.appendChild(dItem);
            }
            symbolsList.appendChild(deadSection);
            symbolsSection.style.display = 'block';
        }

        // Cycles section
        if (node.cycleIds && node.cycleIds.length > 0 && hooks.getGraphData().meta.cycles) {
            var cycleSection = document.createElement('div');
            cycleSection.className = 'dead-exports-section';
            cycleSection.innerHTML =
                '<div class="dead-exports-header" style="color:#ff9800">🔄 Circular dependencies <span class="dead-count" style="background:rgba(255,152,0,0.2);color:#ff9800">' +
                node.cycleIds.length + '</span></div>';
            for (var cy = 0; cy < node.cycleIds.length; cy++) {
                var cycle = hooks.getGraphData().meta.cycles[node.cycleIds[cy]];
                if (!cycle) continue;
                var cNames = [];
                for (var cn = 0; cn < cycle.length; cn++) {
                    var parts = cycle[cn].split('/');
                    cNames.push(parts[parts.length - 1]);
                }
                var cycItem = document.createElement('div');
                cycItem.className = 'symbol-item';
                cycItem.innerHTML =
                    '<span class="symbol-icon">🔄</span>' +
                    '<span class="symbol-name" style="color:#ff9800;font-size:10px">' + cNames.join(' → ') + ' → ' + cNames[0] + '</span>';
                cycleSection.appendChild(cycItem);
            }
            symbolsList.appendChild(cycleSection);
            symbolsSection.style.display = 'block';
        }

        // Dependencies (outgoing)
        var deps = [];
        var currentLinks = hooks.getGraphData().links;
        for (var di = 0; di < currentLinks.length; di++) {
            var dl = currentLinks[di];
            var dsId = typeof dl.source === 'object' ? dl.source.id : dl.source;
            if (dsId === node.id) deps.push(dl);
        }
        var depsUl = $('#panel-deps');
        depsUl.innerHTML = '';
        $('#deps-count').textContent = deps.length;
        for (var dd = 0; dd < deps.length; dd++) {
            (function(d) {
                var targetId = typeof d.target === 'object' ? d.target.id : d.target;
                var targetNode = null;
                for (var x = 0; x < hooks.getGraphData().nodes.length; x++) {
                    if (hooks.getGraphData().nodes[x].id === targetId) { targetNode = hooks.getGraphData().nodes[x]; break; }
                }
                var li = document.createElement('li');
                var typeClass = d.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
                var labelStr = d.label ? ' <span class="dep-label">' + d.label + '</span>' : '';
                li.innerHTML =
                    '<span class="dep-arrow">→</span>' +
                    '<span>' + (targetNode ? targetNode.name : targetId) + '</span>' +
                    labelStr +
                    '<span class="' + typeClass + '">' + d.type + '</span>';
                li.addEventListener('click', function() {
                    if (targetNode) hooks.selectNode(targetNode);
                });
                depsUl.appendChild(li);
            })(deps[dd]);
        }

        // Dependents (incoming)
        var dependents = [];
        for (var ri = 0; ri < currentLinks.length; ri++) {
            var rl = currentLinks[ri];
            var rtId = typeof rl.target === 'object' ? rl.target.id : rl.target;
            if (rtId === node.id) dependents.push(rl);
        }
        var depUl = $('#panel-dependents');
        depUl.innerHTML = '';
        $('#dependents-count').textContent = dependents.length;
        for (var rr = 0; rr < dependents.length; rr++) {
            (function(d) {
                var sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                var sourceNode = null;
                for (var x = 0; x < hooks.getGraphData().nodes.length; x++) {
                    if (hooks.getGraphData().nodes[x].id === sourceId) { sourceNode = hooks.getGraphData().nodes[x]; break; }
                }
                var li = document.createElement('li');
                var typeClass = d.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
                var labelStr = d.label ? ' <span class="dep-label">' + d.label + '</span>' : '';
                li.innerHTML =
                    '<span class="dep-arrow">←</span>' +
                    '<span>' + (sourceNode ? sourceNode.name : sourceId) + '</span>' +
                    labelStr +
                    '<span class="' + typeClass + '">' + d.type + '</span>';
                li.addEventListener('click', function() {
                    if (sourceNode) hooks.selectNode(sourceNode);
                });
                depUl.appendChild(li);
            })(dependents[rr]);
        }

        hooks.updateExplorerSelection();
    }

    function showMultiSelectPanel() {
        detailPanel.classList.remove('collapsed');

        // Multi-selection has no note editor
        var noteSectionMs = $('#note-section');
        if (noteSectionMs) noteSectionMs.style.display = 'none';

        var nodes = [];
        hooks.getMultiSelectedNodes().forEach(function(n) { nodes.push(n); });

        var totalLoc = 0;
        var totalComplexity = 0;
        var totalSymbols = 0;
        var languages = {};
        for (var i = 0; i < nodes.length; i++) {
            totalLoc += nodes[i].linesOfCode || 0;
            totalComplexity += nodes[i].complexity || 1;
            totalSymbols += (nodes[i].symbols ? nodes[i].symbols.totalSymbols : 0);
            var lang = nodes[i].language || 'unknown';
            languages[lang] = (languages[lang] || 0) + 1;
        }
        var avgComplexity = nodes.length > 0 ? (totalComplexity / nodes.length).toFixed(1) : 0;

        $('#panel-icon').textContent = '📌';
        $('#panel-filename').textContent = nodes.length + ' files selected';
        $('#panel-path').textContent = 'Multi-selection';
        $('#panel-language').textContent = Object.keys(languages).join(', ');
        $('#panel-language').style.color = '#93c5fd';
        $('#panel-group').textContent = '—';
        $('#panel-community').textContent = '—';
        $('#panel-community').style.color = '';
        $('#panel-loc').textContent = totalLoc.toLocaleString();
        $('#panel-size').textContent = '—';
        $('#panel-mtime').textContent = '—';
        $('#panel-fanout').textContent = '—';
        $('#panel-fanin').textContent = '—';
        $('#panel-complexity').textContent = avgComplexity;
        $('#panel-symbols-count').textContent = totalSymbols;

        var symbolsSection = $('#symbols-section');
        var symbolsList = $('#symbols-list');
        symbolsList.innerHTML = '';

        // Language breakdown
        symbolsSection.style.display = 'block';
        $('#symbols-total').textContent = nodes.length;

        var langKeys = Object.keys(languages);
        for (var li = 0; li < langKeys.length; li++) {
            var langItem = document.createElement('div');
            langItem.className = 'symbol-item';
            langItem.innerHTML =
                '<span class="symbol-icon">' + (LANGUAGE_ICONS[langKeys[li]] || '📄') + '</span>' +
                '<span class="symbol-name">' + langKeys[li] + '</span>' +
                '<span class="symbol-meta">' + languages[langKeys[li]] + ' files</span>';
            symbolsList.appendChild(langItem);
        }

        // List selected files
        var filesSection = document.createElement('div');
        filesSection.className = 'dead-exports-section';
        filesSection.innerHTML =
            '<div class="dead-exports-header" style="color:#93c5fd">📌 Selected files <span class="dead-count" style="background:rgba(147,197,253,0.2);color:#93c5fd">' +
            nodes.length + '</span></div>';
        for (var fi = 0; fi < nodes.length; fi++) {
            (function(node) {
                var fItem = document.createElement('div');
                fItem.className = 'symbol-item symbol-item-clickable';
                fItem.innerHTML =
                    '<span class="symbol-icon">' + (LANGUAGE_ICONS[node.language] || '📄') + '</span>' +
                    '<span class="symbol-name">' + node.name + '</span>' +
                    '<span class="symbol-meta">' + node.linesOfCode + ' lines</span>';
                fItem.addEventListener('click', function() {
                    hooks.selectNode(node);
                });
                filesSection.appendChild(fItem);
            })(nodes[fi]);
        }
        symbolsList.appendChild(filesSection);

        // Internal links count
        var depsUl = $('#panel-deps');
        depsUl.innerHTML = '';
        $('#deps-count').textContent = hooks.getMultiSelectedLinks().size;
        hooks.getMultiSelectedLinks().forEach(function(link) {
            var srcId = typeof link.source === 'object' ? link.source.id : link.source;
            var tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            var srcNode = null, tgtNode = null;
            for (var x = 0; x < hooks.getGraphData().nodes.length; x++) {
                if (hooks.getGraphData().nodes[x].id === srcId) srcNode = hooks.getGraphData().nodes[x];
                if (hooks.getGraphData().nodes[x].id === tgtId) tgtNode = hooks.getGraphData().nodes[x];
            }
            var liEl = document.createElement('li');
            var typeClass = link.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
            var labelStr = link.label ? ' <span class="dep-label">' + link.label + '</span>' : '';
            liEl.innerHTML =
                '<span class="dep-arrow">→</span>' +
                '<span>' + (srcNode ? srcNode.name : srcId) + ' → ' + (tgtNode ? tgtNode.name : tgtId) + '</span>' +
                labelStr +
                '<span class="' + typeClass + '">' + link.type + '</span>';
            depsUl.appendChild(liEl);
        });

        var depUl = $('#panel-dependents');
        depUl.innerHTML = '';
        $('#dependents-count').textContent = '0';
    }

    function shortenParams(params) {
        if (!params) return '';
        if (params.length > 40) return params.substring(0, 37) + '...';
        return params;
    }

    function setupPanelClose() {
        $('#panel-close').addEventListener('click', function() {
            detailPanel.classList.add('collapsed');
            hooks.setSelectedNode(null);
            if (hooks.getMultiSelectedNodes().size > 0) {
                hooks.clearMultiSelection();
                hooks.refreshGraphVisuals();
            }
        });
        setupNoteEditor();
    }

    // ============================================================
    // Note editor (detail panel)
    // ============================================================
    var noteSelectedColor = 'yellow';

    function setupNoteEditor() {
        var colorsEl = $('#note-colors');
        if (colorsEl) {
            colorsEl.innerHTML = '';
            Object.keys(hooks.getNoteColors()).forEach(function(key) {
                var sw = document.createElement('span');
                sw.className = 'note-swatch' + (key === 'yellow' ? ' active' : '');
                sw.dataset.color = key;
                sw.style.background = hooks.getNoteColors()[key];
                sw.title = key;
                sw.addEventListener('click', function() {
                    noteSelectedColor = key;
                    var all = colorsEl.querySelectorAll('.note-swatch');
                    for (var i = 0; i < all.length; i++) { all[i].classList.toggle('active', all[i].dataset.color === key); }
                });
                colorsEl.appendChild(sw);
            });
        }
        var saveBtn = $('#note-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                if (!hooks.getSelectedNode() || hooks.getSelectedNode()._isCluster || hooks.getSelectedNode()._isSymbol) return;
                var text = $('#note-input').value || '';
                hooks.postMessage({
                    type: 'saveNote',
                    payload: { path: hooks.getSelectedNode().id || hooks.getSelectedNode().path, text: text, color: noteSelectedColor }
                });
            });
        }
        var delBtn = $('#note-delete');
        if (delBtn) {
            delBtn.addEventListener('click', function() {
                if (!hooks.getSelectedNode() || hooks.getSelectedNode()._isCluster || hooks.getSelectedNode()._isSymbol) return;
                hooks.postMessage({
                    type: 'deleteNote',
                    payload: { path: hooks.getSelectedNode().id || hooks.getSelectedNode().path }
                });
            });
        }
    }

    /** Populate the note editor from the selected node's note (or clear it). */
    function updateNoteEditor(node) {
        var section = $('#note-section');
        var input = $('#note-input');
        if (!section || !input) return;
        if (!node || node._isCluster || node._isSymbol) {
            section.style.display = 'none';
            return;
        }
        section.style.display = 'block';
        var note = hooks.getAnnotation(node);
        input.value = note ? note.text : '';
        noteSelectedColor = note ? note.color : 'yellow';
        var colorsEl = $('#note-colors');
        if (colorsEl) {
            var all = colorsEl.querySelectorAll('.note-swatch');
            for (var i = 0; i < all.length; i++) { all[i].classList.toggle('active', all[i].dataset.color === noteSelectedColor); }
        }
        var delBtn = $('#note-delete');
        if (delBtn) delBtn.style.display = note ? '' : 'none';
    }

    // ============================================================
    // Public API
    // ============================================================
    window.AuraDetail = {
        init: function (h) { hooks = h || {}; },
        setup: setupPanelClose,
        show: showDetailPanel,
        showMultiSelect: showMultiSelectPanel,
        refreshEditor: updateNoteEditor
    };
})();
