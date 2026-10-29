/**
 * arch.js — Architecture Rules dashboard (V2-20).
 *
 * Renders the evaluation produced by the host (`graphData.meta.arch`) and
 * delegates every action to the extension: the rules live in
 * `.aura/arch-rules.json`, the adoption baseline in `.aura/arch-baseline.json`.
 * The pure engine (glob matching, deny/slices/cycles, Ca/Ce) is `AuraArch`
 * (arch-core.js), bundled from `src/arch/arch-core.ts`.
 *
 * window.AuraArchPanel + init(hooks). Hooks: getGraphData, focusNode,
 * showGraphTab, postMessage.
 */
(function () {
    'use strict';

    var hooks = {};
    var $ = function (sel) { return document.querySelector(sel); };
    var focusPath = null;

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function data() {
        return (hooks.getGraphData && hooks.getGraphData()) || null;
    }

    function arch() {
        var d = data();
        return d && d.meta ? d.meta.arch : null;
    }

    function formatInstability(value) {
        return typeof value === 'number' ? value.toFixed(2) : '—';
    }

    function severityBadge(severity) {
        return severity === 'error'
            ? '<span class="arch-badge arch-badge-error">error</span>'
            : '<span class="arch-badge arch-badge-warn">warn</span>';
    }

    function violationTargets(violation) {
        return (violation.linkTypes || [violation.linkType]).join(', ');
    }

    // ============================================================
    // Rendering
    // ============================================================
    function render() {
        var container = $('#arch-content');
        if (!container) return;
        var d = data();
        var evaluation = arch();
        var error = d && d.meta ? d.meta.archError : undefined;

        if (error) {
            container.innerHTML =
                '<div class="arch-notice arch-notice-error">' +
                    '<strong>Invalid architecture rules.</strong>' +
                    '<p>' + escapeHtml(error) + '</p>' +
                    '<p class="arch-muted">Fix <code>.aura/arch-rules.json</code> with <strong>⚙️ Edit rules</strong> in the toolbar above — the rest of Aura keeps working.</p>' +
                '</div>';
            return;
        }

        if (!evaluation) {
            container.innerHTML =
                '<div class="arch-empty">' +
                    '<div class="arch-empty-icon">🏛️</div>' +
                    '<h3>Declare your layers, make them executable</h3>' +
                    '<p>Architecture rules turn the dependency graph into a fitness function: ' +
                    '<em>“<code>domain</code> never depends on <code>ui</code>”</em> is checked on every analysis, ' +
                    'not written in a document.</p>' +
                    '<p>Create <code>.aura/arch-rules.json</code> with your layers, deny rules, slices and exceptions. ' +
                    'The file is seeded from your top-level <code>src/</code> folders.</p>' +
                    '<div class="arch-empty-actions">' +
                        '<button type="button" class="risk-export-btn" id="arch-empty-create">Create / open rules file</button>' +
                    '</div>' +
                '</div>';
            bindEmptyState();
            return;
        }

        var counts = evaluation.counts;
        var html = '';

        // Header summary -------------------------------------------------
        html += '<div class="arch-health-grid">' +
            '<div class="arch-health-card arch-health-error"><div class="arch-health-value">' + counts.newErrors + '</div><div class="arch-health-label">errors</div></div>' +
            '<div class="arch-health-card arch-health-warn"><div class="arch-health-value">' + counts.newWarnings + '</div><div class="arch-health-label">warnings</div></div>' +
            '<div class="arch-health-card"><div class="arch-health-value">' + counts.baselined + '</div><div class="arch-health-label">baselined</div></div>' +
            '<div class="arch-health-card"><div class="arch-health-value">' + evaluation.layers.length + '</div><div class="arch-health-label">layers</div></div>' +
            '<div class="arch-health-card"><div class="arch-health-value">' + evaluation.layerCycles.length + '</div><div class="arch-health-label">layer cycles</div></div>' +
            '<div class="arch-health-card"><div class="arch-health-value">' + evaluation.unlayeredTotal + '</div><div class="arch-health-label">unlayered</div></div>' +
            '</div>';

        if (!evaluation.configured) {
            var missing = evaluation.layers.length === 0
                ? 'No layer is configured yet.'
                : 'Layers are configured, but the rules list is empty.';
            html += '<div class="arch-notice arch-notice-info">' +
                '<strong>No rule is enforced yet.</strong> ' + missing +
                ' Add at least one <code>deny</code>, <code>slices</code> or <code>no-cycles</code> rule to ' +
                '<code>.aura/arch-rules.json</code> with <strong>⚙️ Edit rules</strong> in the toolbar above.' +
                '</div>';
        }

        // Filter banner --------------------------------------------------
        if (focusPath) {
            var matching = evaluation.violations.filter(function (v) { return v.source === focusPath; }).length;
            html += '<div class="arch-filter-banner">' +
                '<span>Filtered on <code>' + escapeHtml(focusPath) + '</code> — ' +
                (matching === 0 ? 'no violation where this file is the source' : matching + ' violation' + (matching === 1 ? '' : 's')) +
                '</span>' +
                '<button type="button" id="arch-filter-clear">Clear filter</button>' +
                '</div>';
        }

        // Layers ---------------------------------------------------------
        html += '<section class="arch-section"><h3>Layers</h3>' +
            '<p class="arch-muted">Ca = external files depending on the layer · Ce = external files the layer depends on · ' +
            'I = Ce / (Ca + Ce), 0 is stable and 1 is unstable.</p>' +
            '<div class="table-scroll"><table class="aura-table arch-layer-table">' +
            '<thead><tr><th>Layer</th><th class="num">Files</th><th class="num">Ca</th><th class="num">Ce</th><th class="num">I</th><th>Instability</th><th class="num">New</th><th class="num">Baselined</th></tr></thead><tbody>';

        var layers = evaluation.layers.slice().sort(function (a, b) { return b.files - a.files || a.name.localeCompare(b.name); });
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var barWidth = typeof layer.instability === 'number' ? Math.round(layer.instability * 100) : 0;
            var barColor = typeof layer.instability === 'number'
                ? 'hsl(' + Math.round(120 - layer.instability * 120) + ', 70%, 55%)'
                : 'var(--aura-border)';
            html += '<tr class="arch-layer-row" data-layer="' + escapeHtml(layer.name) + '">' +
                '<td><span class="arch-layer-dot" data-layer-index="' + i + '"></span>' + escapeHtml(layer.name) + '</td>' +
                '<td class="num">' + layer.files + '</td>' +
                '<td class="num">' + layer.ca + '</td>' +
                '<td class="num">' + layer.ce + '</td>' +
                '<td class="num">' + formatInstability(layer.instability) + '</td>' +
                '<td><div class="arch-instability-bar"><div style="width:' + barWidth + '%;background:' + barColor + '"></div></div></td>' +
                '<td class="num">' + (layer.newViolations > 0 ? '<span class="arch-count-bad">' + layer.newViolations + '</span>' : '0') + '</td>' +
                '<td class="num">' + layer.baselined + '</td>' +
                '</tr>';
        }
        html += '</tbody></table></div></section>';

        // Cycles ---------------------------------------------------------
        if (evaluation.layerCycles.length > 0) {
            html += '<section class="arch-section"><h3>Layer cycles</h3><ul class="arch-cycles">';
            for (var c = 0; c < evaluation.layerCycles.length; c++) {
                var cycle = evaluation.layerCycles[c];
                html += '<li>' + severityBadge(cycle.severity) +
                    '<code>' + cycle.layers.map(function (name) { return escapeHtml(name); }).join(' ↔ ') + '</code>' +
                    '<span class="arch-muted"> (' + escapeHtml(cycle.ruleId) + ')</span></li>';
            }
            html += '</ul></section>';
        }

        // Violations -----------------------------------------------------
        var violations = evaluation.violations.slice();
        if (focusPath) violations = violations.filter(function (v) { return v.source === focusPath; });
        violations.sort(function (a, b) {
            var rank = { error: 0, warn: 1 };
            return (rank[a.severity] - rank[b.severity]) ||
                a.ruleId.localeCompare(b.ruleId) ||
                a.source.localeCompare(b.source) ||
                a.target.localeCompare(b.target);
        });

        html += '<section class="arch-section"><h3>Violations <span class="arch-count-badge">' + violations.length + '</span></h3>';
        if (violations.length === 0) {
            html += '<p class="arch-muted">' + (focusPath ? 'This file has no outgoing violation.' : 'No violation — the architecture matches the rules.') + '</p>';
        } else {
            var byRule = {};
            for (var v = 0; v < violations.length; v++) {
                var violation = violations[v];
                if (!byRule[violation.ruleId]) byRule[violation.ruleId] = [];
                byRule[violation.ruleId].push(violation);
            }
            var ruleIds = Object.keys(byRule).sort();
            for (var r = 0; r < ruleIds.length; r++) {
                var ruleId = ruleIds[r];
                var list = byRule[ruleId];
                var openCount = 0;
                for (var o = 0; o < list.length; o++) if (!list[o].baselined) openCount++;
                html += '<div class="arch-rule-group">' +
                    '<div class="arch-rule-header">' +
                        '<strong>' + escapeHtml(ruleId) + '</strong>' +
                        severityBadge(list[0].severity) +
                        '<span class="arch-muted">' + openCount + ' new · ' + (list.length - openCount) + ' baselined</span>' +
                    '</div>' +
                    '<ul class="arch-violation-list">';
                for (var l = 0; l < list.length; l++) {
                    var item = list[l];
                    html += '<li class="arch-violation' + (item.baselined ? ' arch-violation-baselined' : '') + '" data-source="' + escapeHtml(item.source) + '">' +
                        '<span class="arch-violation-paths">' +
                            '<code>' + escapeHtml(item.source) + '</code>' +
                            '<span class="arch-arrow">→</span>' +
                            '<code>' + escapeHtml(item.target) + '</code>' +
                        '</span>' +
                        '<span class="arch-violation-meta">' +
                            (item.sourceGroup || '?') + ' → ' + (item.targetGroup || '?') +
                            ' · ' + escapeHtml(violationTargets(item)) +
                            (item.baselined ? ' · <span class="arch-baselined-tag">baselined</span>' : '') +
                        '</span>' +
                        '</li>';
                }
                html += '</ul></div>';
            }
        }
        html += '</section>';

        // Unlayered ------------------------------------------------------
        if (evaluation.unlayeredTotal > 0) {
            html += '<section class="arch-section"><h3>Files outside every layer <span class="arch-count-badge">' + evaluation.unlayeredTotal + '</span></h3>' +
                '<p class="arch-muted">They are not part of the layer model. Add a glob to a layer, or list them in <code>exceptions</code>.</p>' +
                '<details class="arch-unlayered"><summary>Show files</summary><ul>';
            for (var u = 0; u < Math.min(evaluation.unlayeredFiles.length, 200); u++) {
                html += '<li><code>' + escapeHtml(evaluation.unlayeredFiles[u]) + '</code></li>';
            }
            html += '</ul></details></section>';
        }

        if (evaluation.rules.strict) {
            html += '<p class="arch-muted">Strict mode is on: files outside the layer model are reported as warnings in the rules file.</p>';
        }

        container.innerHTML = html;
        applyLayerDots(evaluation);
        bindContent(evaluation);
    }

    function applyLayerDots(evaluation) {
        var rows = document.querySelectorAll('.arch-layer-row');
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var name = row.getAttribute('data-layer');
            var key = null;
            for (var k = 0; k < evaluation.layers.length; k++) {
                if (evaluation.layers[k].name === name) { key = k; break; }
            }
            var dot = row.querySelector('.arch-layer-dot');
            if (dot && key !== null && window.layerColor) {
                dot.style.background = window.layerColor(name, key);
            }
        }
    }

    function bindContent(evaluation) {
        var rows = document.querySelectorAll('.arch-violation');
        for (var i = 0; i < rows.length; i++) {
            rows[i].addEventListener('click', function () {
                var source = this.getAttribute('data-source');
                // focusNodeFromView switches tabs itself and defers the actual
                // focus to the next frame, once the graph canvas is visible.
                if (source && hooks.focusNode) hooks.focusNode(source, true);
            });
        }

        var layerRows = document.querySelectorAll('.arch-layer-row');
        for (var j = 0; j < layerRows.length; j++) {
            layerRows[j].addEventListener('click', function () {
                var name = this.getAttribute('data-layer');
                var d = data();
                if (!d || !d.nodes) return;
                var best = null;
                for (var n = 0; n < d.nodes.length; n++) {
                    var node = d.nodes[n];
                    if (node.layer !== name) continue;
                    if (!best || (node.fanIn || 0) > (best.fanIn || 0)) best = node;
                }
                if (best && hooks.focusNode) {
                    hooks.focusNode(best.id, true);
                }
            });
        }

        var clear = $('#arch-filter-clear');
        if (clear) {
            clear.addEventListener('click', function () {
                focusPath = null;
                render();
            });
        }
    }

    function bindEmptyState() {
        var create = $('#arch-empty-create');
        if (create) create.addEventListener('click', function () {
            hooks.postMessage({ type: 'openArchRulesFile' });
        });
    }

    // ============================================================
    // Rules editor (modal)
    // ============================================================
    // ============================================================
    // Structured rules editor (modal)
    // ============================================================
    // The editor keeps a parsed `ArchRules` model. Every change is serialized
    // and re-validated by `AuraArch` (the exact engine used by the analysis),
    // so the form cannot produce a file the host would reject. The raw JSON
    // field is an escape hatch for `edgeTypes` and advanced ordering.
    var editor = { raw: '', model: null, valid: false };

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function defaultModel() {
        try {
            return AuraArch.parseArchRules('{\n  "version": 1\n}\n');
        } catch (e) {
            return { version: 1, edgeTypes: [], layers: [], rules: [], exceptions: [], strict: false };
        }
    }

    function exampleModel() {
        return AuraArch.parseArchRules(JSON.stringify({
            version: 1,
            layers: [
                { name: 'ui', paths: ['src/ui/**', 'src/components/**'] },
                { name: 'application', paths: ['src/app/**', 'src/services/**'] },
                { name: 'domain', paths: ['src/domain/**'] }
            ],
            rules: [
                { id: 'domain-pure', from: 'domain', deny: ['ui', 'application'], severity: 'error' },
                { id: 'app-no-ui', from: 'application', deny: ['ui'] }
            ],
            exceptions: []
        }));
    }

    function setEditorError(message) {
        var error = $('#arch-rules-error');
        if (error) error.textContent = message || '';
        if (message) {
            var status = $('#arch-editor-status');
            if (status) {
                status.textContent = '✕ ' + message;
                status.className = 'arch-editor-status invalid';
            }
        }
    }

    function setEditorStatus(valid) {
        var status = $('#arch-editor-status');
        if (!status) return;
        status.textContent = valid ? '✓ Valid — rules are consistent' : '✕ Fix the issue above before saving';
        status.className = 'arch-editor-status ' + (valid ? 'valid' : 'invalid');
    }

    function setSaveEnabled(enabled) {
        var save = $('#arch-rules-save');
        if (save) save.disabled = !enabled;
    }

    function serializeModel() {
        return AuraArch.serializeArchRules(editor.model);
    }

    function syncRawField() {
        var raw = $('#arch-rules-text');
        if (raw && document.activeElement !== raw) raw.value = editor.raw;
    }

    function validateRaw(text) {
        try {
            var parsed = AuraArch.parseArchRules(text);
            if (!editor.model) editor.model = clone(parsed);
            editor.valid = true;
            setEditorError('');
            setEditorStatus(true);
            setSaveEnabled(true);
            return true;
        } catch (err) {
            editor.valid = false;
            setEditorError(err && err.message ? err.message : 'Invalid rules.');
            setSaveEnabled(false);
            return false;
        }
    }

    function refreshEditor() {
        if (!editor.model) {
            validateRaw(editor.raw);
            return;
        }
        editor.raw = serializeModel();
        syncRawField();
        validateRaw(editor.raw);
    }

    function parseList(value) {
        return String(value == null ? '' : value)
            .split(/[\n,]/)
            .map(function (part) { return part.trim(); })
            .filter(function (part) { return part.length > 0; });
    }

    function parseLines(value) {
        return String(value == null ? '' : value)
            .split(/\n/)
            .map(function (part) { return part.trim(); })
            .filter(function (part) { return part.length > 0; });
    }

    function severityOptions(current) {
        return '<option value="warn"' + (current === 'warn' ? ' selected' : '') + '>warn</option>' +
            '<option value="error"' + (current === 'error' ? ' selected' : '') + '>error</option>';
    }

    function nextRuleId(prefix) {
        var base = String(prefix || 'rule').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'rule';
        var ids = {};
        for (var i = 0; i < editor.model.rules.length; i++) ids[editor.model.rules[i].id] = true;
        var n = 1;
        while (ids[base + '-' + n]) n++;
        return base + '-' + n;
    }

    /** Top-level `src/` folders from the current graph, most populated first. */
    function suggestedLayers() {
        var d = data();
        if (!d || !d.nodes) return [];
        var counts = {};
        var order = [];
        var skip = { test: true, tests: true, __tests__: true };
        for (var i = 0; i < d.nodes.length; i++) {
            var node = d.nodes[i];
            if (!node || node._isSymbol || node._isCluster) continue;
            var match = /^src\/([^/]+)\//.exec(node.id || node.path || '');
            if (!match) continue;
            var name = match[1];
            if (skip[name]) continue;
            if (!counts[name]) { counts[name] = 0; order.push(name); }
            counts[name]++;
        }
        order.sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });
        return order.slice(0, 8);
    }

    /** Layer names are the rule references: keep both sides in sync. */
    function renameLayerReferences(oldName, newName) {
        if (!oldName || oldName === newName) return;
        for (var i = 0; i < editor.model.rules.length; i++) {
            var rule = editor.model.rules[i];
            if (rule.kind !== 'deny') continue;
            if (rule.from === oldName) rule.from = newName;
            rule.deny = rule.deny.map(function (target) {
                return target === oldName ? newName : target;
            });
        }
    }

    function buildFormHtml(model) {
        var html = '';
        var layers = model.layers;

        // Layers ----------------------------------------------------
        html += '<section class="arch-editor-section">' +
            '<div class="arch-editor-section-head">' +
                '<h4>Layers <span class="arch-editor-count">' + layers.length + '</span></h4>' +
                '<button type="button" class="arch-editor-add" id="arch-add-layer">＋ Add layer</button>' +
            '</div>' +
            '<p class="arch-editor-hint">Matched in order — the first matching glob wins. ' +
                '<code>*</code> stays inside one segment, <code>**</code> crosses directories, <code>?</code> matches one character. ' +
                'Files outside every layer are reported as <code>unlayered</code>.</p>';

        if (layers.length === 0) {
            var suggestions = suggestedLayers();
            html += '<p class="arch-editor-empty">No layer yet — add one to start enforcing boundaries.</p>';
            if (suggestions.length > 0) {
                html += '<div><button type="button" class="arch-editor-add" id="arch-seed-layers">Seed ' + suggestions.length + ' layer' + (suggestions.length === 1 ? '' : 's') + ' from src/ folders</button></div>';
            }
        } else {
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                html += '<div class="arch-editor-layer-row">' +
                    '<input class="arch-editor-input" data-layer-name="' + i + '" data-old-name="' + escapeHtml(layer.name) + '" value="' + escapeHtml(layer.name) + '" placeholder="layer name" spellcheck="false">' +
                    '<input class="arch-editor-input" data-layer-paths="' + i + '" value="' + escapeHtml(layer.paths.join(', ')) + '" placeholder="src/ui/**, src/components/**" spellcheck="false">' +
                    '<div class="arch-editor-row-actions">' +
                        '<button type="button" data-layer-up="' + i + '" title="Move up" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
                        '<button type="button" data-layer-down="' + i + '" title="Move down" ' + (i === layers.length - 1 ? 'disabled' : '') + '>↓</button>' +
                        '<button type="button" class="arch-editor-remove" data-layer-remove="' + i + '" title="Remove layer">✕</button>' +
                    '</div>' +
                '</div>';
            }
        }
        html += '</section>';

        // Deny rules -------------------------------------------------
        var denyRules = [];
        for (var d = 0; d < model.rules.length; d++) {
            if (model.rules[d].kind === 'deny') denyRules.push({ rule: model.rules[d], index: d });
        }
        html += '<section class="arch-editor-section">' +
            '<div class="arch-editor-section-head">' +
                '<h4>Deny rules <span class="arch-editor-count">' + denyRules.length + '</span></h4>' +
                '<button type="button" class="arch-editor-add" id="arch-add-deny">＋ Add deny rule</button>' +
            '</div>' +
            '<p class="arch-editor-hint">An edge from <em>from</em> into a forbidden target is a violation. <code>*</code> means any other layer.</p>';
        if (denyRules.length === 0) {
            html += '<p class="arch-editor-empty">No deny rule yet.</p>';
        }
        for (var dr = 0; dr < denyRules.length; dr++) {
            var denyEntry = denyRules[dr];
            var rule = denyEntry.rule;
            var fromOptions = '<option value="">Choose a layer…</option>';
            for (var lo = 0; lo < layers.length; lo++) {
                if (!layers[lo].name) continue;
                fromOptions += '<option value="' + escapeHtml(layers[lo].name) + '"' + (layers[lo].name === rule.from ? ' selected' : '') + '>' + escapeHtml(layers[lo].name) + '</option>';
            }
            fromOptions += '<option value="unlayered"' + (rule.from === 'unlayered' ? ' selected' : '') + '>unlayered</option>';

            var chips = '';
            for (var lc = 0; lc < layers.length; lc++) {
                var targetName = layers[lc].name;
                if (!targetName) continue;
                chips += '<button type="button" class="arch-editor-chip' + (rule.deny.indexOf(targetName) !== -1 ? ' active' : '') + '" data-deny-chip="' + denyEntry.index + '" data-target="' + escapeHtml(targetName) + '">' + escapeHtml(targetName) + '</button>';
            }
            chips += '<button type="button" class="arch-editor-chip' + (rule.deny.indexOf('*') !== -1 ? ' active' : '') + '" data-deny-chip="' + denyEntry.index + '" data-target="*">* (any other layer)</button>';
            chips += '<button type="button" class="arch-editor-chip' + (rule.deny.indexOf('unlayered') !== -1 ? ' active' : '') + '" data-deny-chip="' + denyEntry.index + '" data-target="unlayered">unlayered</button>';

            html += '<div class="arch-editor-rule">' +
                '<div class="arch-editor-rule-head">' +
                    '<span class="arch-badge arch-badge-deny">deny</span>' +
                    '<input class="arch-editor-input arch-editor-rule-id" data-rule-id="' + denyEntry.index + '" value="' + escapeHtml(rule.id) + '" title="Stable rule id — the baseline references it" spellcheck="false">' +
                    '<label class="arch-editor-inline">from <select data-deny-from="' + denyEntry.index + '">' + fromOptions + '</select></label>' +
                    '<label class="arch-editor-inline">severity <select data-rule-severity="' + denyEntry.index + '">' + severityOptions(rule.severity) + '</select></label>' +
                    '<button type="button" class="arch-editor-remove" data-remove-rule="' + denyEntry.index + '" title="Remove rule">✕</button>' +
                '</div>' +
                '<div class="arch-editor-chips-label">Forbid imports into:</div>' +
                '<div class="arch-editor-chips">' + chips + '</div>' +
            '</div>';
        }
        html += '</section>';

        // Slices -----------------------------------------------------
        var sliceRules = [];
        for (var s = 0; s < model.rules.length; s++) {
            if (model.rules[s].kind === 'slices') sliceRules.push({ rule: model.rules[s], index: s });
        }
        html += '<section class="arch-editor-section">' +
            '<div class="arch-editor-section-head">' +
                '<h4>Slices <span class="arch-editor-count">' + sliceRules.length + '</span></h4>' +
                '<button type="button" class="arch-editor-add" id="arch-add-slices">＋ Add slices rule</button>' +
            '</div>' +
            '<p class="arch-editor-hint">Each folder captured by the pattern is a slice. Sibling slices cannot import each other; targets matching a <em>shared</em> glob are allowed.</p>';
        if (sliceRules.length === 0) {
            html += '<p class="arch-editor-empty">No slices rule yet.</p>';
        }
        for (var sr = 0; sr < sliceRules.length; sr++) {
            var sliceEntry = sliceRules[sr];
            var slice = sliceEntry.rule;
            html += '<div class="arch-editor-rule">' +
                '<div class="arch-editor-rule-head">' +
                    '<span class="arch-badge arch-badge-warn">slices</span>' +
                    '<input class="arch-editor-input arch-editor-rule-id" data-rule-id="' + sliceEntry.index + '" value="' + escapeHtml(slice.id) + '" title="Stable rule id — the baseline references it" spellcheck="false">' +
                    '<label class="arch-editor-inline">severity <select data-rule-severity="' + sliceEntry.index + '">' + severityOptions(slice.severity) + '</select></label>' +
                    '<button type="button" class="arch-editor-remove" data-remove-rule="' + sliceEntry.index + '" title="Remove rule">✕</button>' +
                '</div>' +
                '<div class="arch-editor-row">' +
                    '<label class="arch-editor-field">Pattern<input class="arch-editor-input" data-slice-pattern="' + sliceEntry.index + '" value="' + escapeHtml(slice.pattern) + '" placeholder="src/features/*" spellcheck="false"></label>' +
                    '<label class="arch-editor-field">Shared globs<input class="arch-editor-input" data-slice-shared="' + sliceEntry.index + '" value="' + escapeHtml(slice.shared.join(', ')) + '" placeholder="src/shared/**" spellcheck="false"></label>' +
                '</div>' +
            '</div>';
        }
        html += '</section>';

        // Aggregated cycles ------------------------------------------
        var cycleRules = [];
        for (var c = 0; c < model.rules.length; c++) {
            if (model.rules[c].kind === 'no-cycles') cycleRules.push({ rule: model.rules[c], index: c });
        }
        html += '<section class="arch-editor-section">' +
            '<div class="arch-editor-section-head">' +
                '<h4>Layer cycles <span class="arch-editor-count">' + cycleRules.length + '</span></h4>' +
                '<button type="button" class="arch-editor-add" id="arch-add-cycles">＋ Add no-cycles rule</button>' +
            '</div>' +
            '<p class="arch-editor-hint">Tarjan SCCs on the aggregated file → layer graph.</p>';
        if (cycleRules.length === 0) {
            html += '<p class="arch-editor-empty">No cycle rule yet.</p>';
        }
        for (var cr = 0; cr < cycleRules.length; cr++) {
            var cycleEntry = cycleRules[cr];
            html += '<div class="arch-editor-rule">' +
                '<div class="arch-editor-rule-head">' +
                    '<span class="arch-badge arch-badge-warn">no-cycles</span>' +
                    '<input class="arch-editor-input arch-editor-rule-id" data-rule-id="' + cycleEntry.index + '" value="' + escapeHtml(cycleEntry.rule.id) + '" title="Stable rule id — the baseline references it" spellcheck="false">' +
                    '<label class="arch-editor-inline">severity <select data-rule-severity="' + cycleEntry.index + '">' + severityOptions(cycleEntry.rule.severity) + '</select></label>' +
                    '<button type="button" class="arch-editor-remove" data-remove-rule="' + cycleEntry.index + '" title="Remove rule">✕</button>' +
                '</div>' +
            '</div>';
        }
        html += '</section>';

        // Exceptions & options --------------------------------------
        html += '<section class="arch-editor-section">' +
            '<h4>Exceptions & options</h4>' +
            '<p class="arch-editor-hint">Source globs exempted from every rule (one per line).</p>' +
            '<textarea id="arch-editor-exceptions" class="arch-editor-textarea" rows="3" spellcheck="false" placeholder="src/domain/legacy/**">' + escapeHtml(model.exceptions.join('\n')) + '</textarea>' +
            '<label class="arch-editor-check"><input type="checkbox" id="arch-editor-strict"' + (model.strict ? ' checked' : '') + '> Strict — report files outside every layer</label>' +
            '<p class="arch-editor-hint">Edge types: <code>' + escapeHtml(model.edgeTypes.join(', ')) + '</code> — edit them in Raw JSON.</p>' +
        '</section>';

        return html;
    }

    function renderEditor() {
        var form = $('#arch-editor-form');
        if (!form) return;
        if (!editor.model) {
            form.innerHTML = '<p class="arch-editor-empty">The file is not valid JSON yet. Fix it in <strong>Raw JSON</strong> below — the form rebuilds as soon as it parses.</p>';
            var rawWrap = $('#arch-editor-raw-wrap');
            if (rawWrap) rawWrap.open = true;
            validateRaw(editor.raw);
            return;
        }
        form.innerHTML = buildFormHtml(editor.model);
        bindForm();
        refreshEditor();
    }

    function bindForm() {
        var model = editor.model;
        if (!model) return;

        qsa('[data-layer-name]').forEach(function (input) {
            input.addEventListener('input', function () {
                var index = parseInt(this.getAttribute('data-layer-name'), 10);
                var oldName = this.getAttribute('data-old-name') || '';
                var newName = this.value.trim();
                if (newName !== oldName) {
                    // Keep rule references valid while the user types.
                    renameLayerReferences(oldName, newName);
                    this.setAttribute('data-old-name', newName);
                }
                model.layers[index].name = this.value;
                refreshEditor();
            });
            input.addEventListener('change', function () {
                var index = parseInt(this.getAttribute('data-layer-name'), 10);
                var oldName = this.getAttribute('data-old-name') || '';
                var newName = this.value.trim();
                model.layers[index].name = newName;
                renameLayerReferences(oldName, newName);
                renderEditor();
            });
        });

        qsa('[data-layer-paths]').forEach(function (input) {
            input.addEventListener('input', function () {
                model.layers[parseInt(this.getAttribute('data-layer-paths'), 10)].paths = parseList(this.value);
                refreshEditor();
            });
        });

        qsa('[data-layer-up]').forEach(function (button) {
            button.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-layer-up'), 10);
                if (index <= 0) return;
                var moved = model.layers.splice(index, 1)[0];
                model.layers.splice(index - 1, 0, moved);
                renderEditor();
            });
        });
        qsa('[data-layer-down]').forEach(function (button) {
            button.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-layer-down'), 10);
                if (index >= model.layers.length - 1) return;
                var moved = model.layers.splice(index, 1)[0];
                model.layers.splice(index + 1, 0, moved);
                renderEditor();
            });
        });
        qsa('[data-layer-remove]').forEach(function (button) {
            button.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-layer-remove'), 10);
                var removed = model.layers[index] ? model.layers[index].name : '';
                model.layers.splice(index, 1);
                if (removed) {
                    // Layer names are the rule references. Drop the removed
                    // target from deny lists; a rule that started from it is
                    // left with an empty `from` and reported by validation.
                    for (var r = 0; r < model.rules.length; r++) {
                        var rule = model.rules[r];
                        if (rule.kind !== 'deny') continue;
                        if (rule.from === removed) rule.from = '';
                        rule.deny = rule.deny.filter(function (target) {
                            return target !== removed;
                        });
                    }
                }
                renderEditor();
            });
        });

        var addLayer = $('#arch-add-layer');
        if (addLayer) addLayer.addEventListener('click', function () {
            model.layers.push({ name: '', paths: [] });
            renderEditor();
            var inputs = qsa('[data-layer-name]');
            if (inputs.length) inputs[inputs.length - 1].focus();
        });
        var seedLayers = $('#arch-seed-layers');
        if (seedLayers) seedLayers.addEventListener('click', function () {
            var suggestions = suggestedLayers();
            model.layers = suggestions.map(function (name) {
                return { name: name, paths: ['src/' + name + '/**'] };
            });
            renderEditor();
        });

        qsa('[data-rule-id]').forEach(function (input) {
            input.addEventListener('input', function () {
                model.rules[parseInt(this.getAttribute('data-rule-id'), 10)].id = this.value.trim();
                refreshEditor();
            });
        });
        qsa('[data-rule-severity]').forEach(function (select) {
            select.addEventListener('change', function () {
                model.rules[parseInt(this.getAttribute('data-rule-severity'), 10)].severity = this.value;
                refreshEditor();
            });
        });
        qsa('[data-remove-rule]').forEach(function (button) {
            button.addEventListener('click', function () {
                model.rules.splice(parseInt(this.getAttribute('data-remove-rule'), 10), 1);
                renderEditor();
            });
        });

        qsa('[data-deny-from]').forEach(function (select) {
            select.addEventListener('change', function () {
                model.rules[parseInt(this.getAttribute('data-deny-from'), 10)].from = this.value;
                refreshEditor();
            });
        });
        qsa('[data-deny-chip]').forEach(function (chip) {
            chip.addEventListener('click', function () {
                var rule = model.rules[parseInt(this.getAttribute('data-deny-chip'), 10)];
                var target = this.getAttribute('data-target');
                var index = rule.deny.indexOf(target);
                if (index === -1) rule.deny.push(target);
                else rule.deny.splice(index, 1);
                this.classList.toggle('active', index === -1);
                refreshEditor();
            });
        });

        qsa('[data-slice-pattern]').forEach(function (input) {
            input.addEventListener('input', function () {
                model.rules[parseInt(this.getAttribute('data-slice-pattern'), 10)].pattern = this.value.trim();
                refreshEditor();
            });
        });
        qsa('[data-slice-shared]').forEach(function (input) {
            input.addEventListener('input', function () {
                model.rules[parseInt(this.getAttribute('data-slice-shared'), 10)].shared = parseList(this.value);
                refreshEditor();
            });
        });

        var addDeny = $('#arch-add-deny');
        if (addDeny) addDeny.addEventListener('click', function () {
            var from = '';
            for (var i = 0; i < model.layers.length; i++) {
                if (model.layers[i].name) { from = model.layers[i].name; break; }
            }
            model.rules.push({
                id: nextRuleId('deny-' + (from || 'rule')),
                kind: 'deny',
                from: from,
                deny: [],
                severity: 'warn'
            });
            renderEditor();
        });
        var addSlices = $('#arch-add-slices');
        if (addSlices) addSlices.addEventListener('click', function () {
            model.rules.push({
                id: nextRuleId('slices'),
                kind: 'slices',
                pattern: 'src/features/*',
                shared: [],
                severity: 'warn'
            });
            renderEditor();
        });
        var addCycles = $('#arch-add-cycles');
        if (addCycles) addCycles.addEventListener('click', function () {
            model.rules.push({ id: nextRuleId('no-cycles'), kind: 'no-cycles', severity: 'warn' });
            renderEditor();
        });

        var exceptions = $('#arch-editor-exceptions');
        if (exceptions) exceptions.addEventListener('input', function () {
            model.exceptions = parseLines(this.value);
            refreshEditor();
        });
        var strict = $('#arch-editor-strict');
        if (strict) strict.addEventListener('change', function () {
            model.strict = !!this.checked;
            refreshEditor();
        });
    }

    function openRulesEditor() {
        var modal = $('#arch-rules-modal');
        if (!modal) return;
        if (!editor.model && !editor.raw) {
            editor.model = defaultModel();
            editor.raw = serializeModel();
        }
        modal.classList.remove('hidden');
        setEditorError('');
        syncRawField();
        renderEditor();
        hooks.postMessage({ type: 'requestArchRules' });
    }

    function closeRulesEditor() {
        var modal = $('#arch-rules-modal');
        if (modal) modal.classList.add('hidden');
    }

    function setupEditor() {
        var modal = $('#arch-rules-modal');
        var close = $('#arch-rules-close');
        if (close) close.addEventListener('click', closeRulesEditor);
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeRulesEditor();
            });
        }

        var reload = $('#arch-rules-reload');
        if (reload) reload.addEventListener('click', function () {
            hooks.postMessage({ type: 'requestArchRules' });
        });
        var example = $('#arch-rules-example');
        if (example) example.addEventListener('click', function () {
            editor.model = exampleModel();
            editor.raw = serializeModel();
            editor.valid = true;
            syncRawField();
            renderEditor();
        });
        var openFile = $('#arch-rules-open-file');
        if (openFile) openFile.addEventListener('click', function () {
            hooks.postMessage({ type: 'openArchRulesFile' });
            closeRulesEditor();
        });
        var save = $('#arch-rules-save');
        if (save) save.addEventListener('click', function () {
            if (!editor.valid) {
                setEditorError('Fix the validation error before saving.');
                return;
            }
            var text = editor.model ? serializeModel() : editor.raw;
            setEditorError('');
            hooks.postMessage({ type: 'saveArchRules', payload: { text: text } });
        });

        var raw = $('#arch-rules-text');
        if (raw) {
            raw.addEventListener('input', function () {
                editor.raw = this.value;
                try {
                    editor.model = clone(AuraArch.parseArchRules(editor.raw));
                    editor.valid = true;
                    setEditorError('');
                    setEditorStatus(true);
                    setSaveEnabled(true);
                } catch (err) {
                    editor.model = null;
                    editor.valid = false;
                    setEditorError(err && err.message ? err.message : 'Invalid JSON.');
                    setSaveEnabled(false);
                }
            });
            raw.addEventListener('change', function () {
                if (editor.model) renderEditor();
            });
        }
    }

    function onRulesLoaded(text) {
        editor.raw = (typeof text === 'string' && text.trim())
            ? text
            : AuraArch.serializeArchRules(defaultModel());
        try {
            editor.model = clone(AuraArch.parseArchRules(editor.raw));
        } catch (e) {
            editor.model = null;
        }
        syncRawField();
        var modal = $('#arch-rules-modal');
        if (modal) modal.classList.remove('hidden');
        renderEditor();
    }

    function onRulesSaved(text) {
        if (typeof text === 'string' && text.trim()) {
            editor.raw = text;
            try {
                editor.model = clone(AuraArch.parseArchRules(text));
            } catch (e) {
                editor.model = null;
            }
        }
        closeRulesEditor();
    }

    function onRulesError(message) {
        editor.valid = false;
        setEditorError(message || 'Invalid rules.');
        setSaveEnabled(false);
    }

    // ============================================================
    // Markdown report
    // ============================================================
    function buildMarkdown() {
        var d = data();
        var evaluation = arch();
        if (!d || !evaluation) return '';
        var lines = [];
        lines.push('# Architecture violations — ' + (d.meta.projectName || 'project'));
        lines.push('');
        lines.push('Generated ' + new Date().toISOString() + ' by Aura Visualizer.');
        lines.push('');
        lines.push('## Summary');
        lines.push('');
        lines.push('- ' + evaluation.counts.newErrors + ' new error(s), ' + evaluation.counts.newWarnings + ' new warning(s)');
        lines.push('- ' + evaluation.counts.baselined + ' baselined violation(s)');
        lines.push('- ' + evaluation.layers.length + ' layers, ' + evaluation.layerCycles.length + ' layer cycle(s), ' + evaluation.unlayeredTotal + ' unlayered file(s)');
        lines.push('');
        lines.push('## Layers');
        lines.push('');
        lines.push('| Layer | Files | Ca | Ce | I | New violations | Baselined |');
        lines.push('|-------|------:|----:|---:|--:|---------------:|----------:|');
        var layers = evaluation.layers.slice().sort(function (a, b) { return b.files - a.files || a.name.localeCompare(b.name); });
        for (var i = 0; i < layers.length; i++) {
            var l = layers[i];
            lines.push('| ' + l.name + ' | ' + l.files + ' | ' + l.ca + ' | ' + l.ce + ' | ' + formatInstability(l.instability) + ' | ' + l.newViolations + ' | ' + l.baselined + ' |');
        }
        lines.push('');
        lines.push('## Violations');
        lines.push('');
        if (evaluation.violations.length === 0) {
            lines.push('No violation.');
        } else {
            var byRule = {};
            for (var v = 0; v < evaluation.violations.length; v++) {
                var violation = evaluation.violations[v];
                if (!byRule[violation.ruleId]) byRule[violation.ruleId] = [];
                byRule[violation.ruleId].push(violation);
            }
            var ruleIds = Object.keys(byRule).sort();
            for (var r = 0; r < ruleIds.length; r++) {
                var list = byRule[ruleIds[r]];
                lines.push('### ' + ruleIds[r] + ' (' + list[0].severity + ')');
                lines.push('');
                for (var k = 0; k < list.length; k++) {
                    var item = list[k];
                    lines.push('- `' + item.source + '` → `' + item.target + '` (' + violationTargets(item) + ')' + (item.baselined ? ' — *baselined*' : ''));
                }
                lines.push('');
            }
        }
        if (evaluation.layerCycles.length > 0) {
            lines.push('## Layer cycles');
            lines.push('');
            for (var c = 0; c < evaluation.layerCycles.length; c++) {
                lines.push('- ' + evaluation.layerCycles[c].layers.join(' ↔ ') + ' (' + evaluation.layerCycles[c].ruleId + ')');
            }
            lines.push('');
        }
        lines.push('_Rules: `.aura/arch-rules.json` · Baseline: `.aura/arch-baseline.json`._');
        return lines.join('\n') + '\n';
    }

    // ============================================================
    // Public API
    // ============================================================
    function setup() {
        var edit = $('#arch-edit-rules');
        if (edit) edit.addEventListener('click', openRulesEditor);
        var settingsEdit = $('#arch-rules-open');
        if (settingsEdit) settingsEdit.addEventListener('click', openRulesEditor);
        var baseline = $('#arch-baseline');
        if (baseline) baseline.addEventListener('click', function () {
            hooks.postMessage({ type: 'createArchBaseline' });
        });
        var reset = $('#arch-reset-baseline');
        if (reset) reset.addEventListener('click', function () {
            hooks.postMessage({ type: 'resetArchBaseline' });
        });
        var exportBtn = $('#arch-export');
        if (exportBtn) exportBtn.addEventListener('click', function () {
            var markdown = buildMarkdown();
            if (markdown) hooks.postMessage({ type: 'exportArchViolations', payload: { markdown: markdown } });
        });
        setupEditor();
        render();
    }

    window.AuraArchPanel = {
        init: function (h) { hooks = h || {}; },
        setup: setup,
        render: render,
        revealFile: function (nodeId) {
            focusPath = nodeId || null;
            render();
        },
        onRulesLoaded: onRulesLoaded,
        onRulesSaved: onRulesSaved,
        onRulesError: onRulesError,
        openRulesEditor: openRulesEditor,
        buildMarkdown: buildMarkdown,
        clearFilter: function () { focusPath = null; render(); }
    };
})();
