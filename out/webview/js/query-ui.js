/**
 * query-ui.js — Query palette (Aura Query Language): floating window, live
 * evaluation, autocomplete/suggestions, saved queries and history.
 *
 * Extracted from app.js (Lot 2d). window.AuraQueryBar + init(hooks). The language
 * itself stays in query.js (global helpers); the query overlay state is exposed
 * through state() for the app.js render accessors (via qsState()).
 *
 * The query is a floating palette in the same family as Warps and the maps, not
 * a bar in the layout grid: opening it never takes height from the graph. It is
 * centred the first time, then remembers where the user dropped it.
 */
(function () {
    'use strict';

    var hooks = {};
    var $ = function (sel) { return document.querySelector(sel); };

    // ---- State (moved from app.js) ----
    var queryActive = false;
    var queryMode = 'highlight';
    var queryExpr = '';
    var queryFn = null;
    var querySet = new Set();
    var savedQueries = [];
    var queryActiveFavId = null;
    var modalSelectedId = null;
    var queryHistory = [];
    var queryHistoryCursor = -1;
    var queryHistoryDraft = '';
    var QUERY_HISTORY_MAX = 30;
    var QUERY_MODES = ['highlight', 'filter', 'select'];
    var MODE_LABELS = { highlight: 'Highlight', filter: 'Filter', select: 'Select' };
    var PALETTE_POS_KEY = 'aura.query.palette.pos.v1';

    // Shared snapshot for the app.js render accessors (stable Set reference).
    var queryState = { active: false, mode: 'highlight', set: querySet };
    function syncQueryState() {
        queryState.active = queryActive;
        queryState.mode = queryMode;
    }

    function buildQueryContext() {
        // Derive cycle membership directly from hooks.getGraph() data so `incycle` works
        // even when the "Cycles" visual toggle has never been activated.
        var cycleSet = hooks.getCycleNodeIds();
        if (cycleSet.size === 0 && hooks.getGraphData() && hooks.getGraphData().meta && hooks.getGraphData().meta.cycles && hooks.getGraphData().meta.cycles.length > 0) {
            cycleSet = new Set();
            for (var i = 0; i < hooks.getGraphData().meta.cycles.length; i++) {
                var cyc = hooks.getGraphData().meta.cycles[i];
                for (var j = 0; j < cyc.length; j++) { cycleSet.add(cyc[j]); }
            }
        }
        return {
            communityName: function(id) {
                var cid = hooks.getCommunityMap()[id];
                if (cid !== undefined && hooks.getCommunityNames()[cid]) { return hooks.getCommunityNames()[cid].name; }
                return '';
            },
            cycleNodeIds: cycleSet,
            pinnedNodes: typeof hooks.getPinnedNodes() !== 'undefined' ? hooks.getPinnedNodes() : new Set(),
            dirtySet: new Set(Object.keys(hooks.getWorkingTree())),
            cochangeScore: hooks.getCochangeScore || function() { return 0; },
            notes: hooks.getAnnotations()
        };
    }

    function evaluateQuery() {
        querySet.clear();
        if (!queryFn || !hooks.getGraphData() || !hooks.getGraphData().nodes) return;
        var ctx = buildQueryContext();
        for (var i = 0; i < hooks.getGraphData().nodes.length; i++) {
            var node = hooks.getGraphData().nodes[i];
            window.AuraQuery.prepareNode(node, ctx);
            try {
                if (queryFn(node)) querySet.add(node.id);
            } catch (e) { /* skip */ }
        }
    }

    function refreshGraphAfterQuery() {
        if (!hooks.getGraph()) return;
        // Force re-evaluation of node/link callbacks by re-applying them
        hooks.getGraph().nodeColor(hooks.getGraph().nodeColor());
        hooks.getGraph().linkColor(hooks.getGraph().linkColor());
        hooks.getGraph().nodeVisibility(hooks.getGraph().nodeVisibility());
        hooks.getGraph().linkVisibility(hooks.getGraph().linkVisibility());
        hooks.getGraph().nodeThreeObject(hooks.getGraph().nodeThreeObject());
        if (hooks.refreshCommunityPaletteCounts) hooks.refreshCommunityPaletteCounts();
    }

    function applyQuerySelectMode() {
        if (queryMode !== 'select') return;
        // Replace multi-selection with the matched set
        hooks.getMultiSelectedNodes().clear();
        if (!hooks.getGraphData()) return;
        for (var i = 0; i < hooks.getGraphData().nodes.length; i++) {
            if (querySet.has(hooks.getGraphData().nodes[i].id)) {
                hooks.getMultiSelectedNodes().add(hooks.getGraphData().nodes[i]);
            }
        }
    }

    // ---------- Saved queries (DB-backed, modal UI) ----------

    function renderSavedQueriesModal() {
        var list = $('#queries-modal-list');
        if (!list) return;
        list.innerHTML = '';
        updateSavedCount();
        if (!savedQueries || !savedQueries.length) {
            var empty = document.createElement('div');
            empty.className = 'queries-empty';
            empty.textContent = 'No saved queries yet. Type a query and click ⭐ Save.';
            list.appendChild(empty);
            return;
        }
        // Reset selection if it points to a missing id
        if (modalSelectedId && !savedQueries.some(function (q) { return q.id === modalSelectedId; })) {
            modalSelectedId = null;
        }
        for (var i = 0; i < savedQueries.length; i++) {
            (function (q) {
                var row = document.createElement('div');
                row.className = 'queries-item';
                if (modalSelectedId === q.id) row.classList.add('selected');
                row.dataset.id = q.id;

                var name = document.createElement('div');
                name.className = 'queries-item-name';
                name.textContent = q.name;
                row.appendChild(name);

                // Legacy rows were saved before the name field existed, so their
                // name was the expression: printing both showed the same line
                // twice for nothing.
                if (q.expr && q.expr !== q.name) {
                    var expr = document.createElement('div');
                    expr.className = 'queries-item-expr';
                    expr.textContent = q.expr;
                    row.appendChild(expr);
                }

                var mode = document.createElement('div');
                mode.className = 'queries-item-mode';
                mode.textContent = q.mode || 'highlight';
                row.appendChild(mode);

                // One row = one query: a single click applies it (the palette is
                // already open); ✏️ renames it in place, ✕ removes it.
                var edit = document.createElement('button');
                edit.type = 'button';
                edit.className = 'queries-item-edit';
                edit.textContent = '✏️';
                edit.title = 'Rename this saved query';
                edit.addEventListener('click', function (e) {
                    e.stopPropagation();
                    beginQueryRename(row, q);
                });
                row.appendChild(edit);

                var del = document.createElement('button');
                del.type = 'button';
                del.className = 'queries-item-del';
                del.textContent = '✕';
                del.title = 'Delete this saved query';
                del.addEventListener('click', function (e) {
                    e.stopPropagation();
                    deleteSavedQuery(q.id);
                });
                row.appendChild(del);

                row.title = 'Click to apply — ' + q.expr;
                row.addEventListener('click', function () {
                    modalSelectedId = q.id;
                    applySavedQuery(q);
                });
                list.appendChild(row);
            })(savedQueries[i]);
        }
    }

    function updateSavedCount() {
        var slot = $('#qb-saved-count');
        if (!slot) return;
        slot.textContent = savedQueries && savedQueries.length ? '(' + savedQueries.length + ')' : '';
    }

    function deleteSavedQuery(id) {
        try { hooks.postMessage({ type: 'deleteSavedQuery', payload: { id: id } }); } catch (_) { /* noop */ }
        savedQueries = (savedQueries || []).filter(function (q) { return q.id !== id; });
        if (modalSelectedId === id) modalSelectedId = null;
        if (queryActiveFavId === id) queryActiveFavId = null;
        renderSavedQueriesModal();
    }

    /** Rename a query on the spot — same flow as the Communities palette. */
    function beginQueryRename(row, q) {
        if (!row || !q || row.querySelector('.queries-item-rename')) return;
        var nameEl = row.querySelector('.queries-item-name');
        if (!nameEl) return;

        var input = document.createElement('input');
        input.className = 'queries-item-rename';
        input.type = 'text';
        input.maxLength = 60;
        input.value = q.name;
        input.placeholder = 'Query name';
        input.title = 'Enter to save · Escape to cancel';
        nameEl.replaceWith(input);
        input.focus();
        input.select();

        var finished = false;
        function finish(save) {
            if (finished) return;
            finished = true;
            input.removeEventListener('blur', onBlur);
            if (!save) { renderSavedQueriesModal(); return; }
            var label = input.value.trim() || q.name;
            q.name = label;
            try {
                hooks.postMessage({
                    type: 'updateSavedQuery',
                    payload: { id: q.id, name: label, expr: q.expr, mode: q.mode }
                });
            } catch (_) { /* noop */ }
            // Applying this query loaded its name into the palette: keep them in sync.
            if (queryActiveFavId === q.id) {
                var nameField = $('#qb-name');
                if (nameField) nameField.value = label;
            }
            renderSavedQueriesModal();
        }
        function onBlur() { finish(true); }
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', onBlur);
        // The row applies a query on click: editing its name must not.
        input.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    function applySavedQuery(q) {
        if (!q) return;
        var input = $('#qb-input');
        var nameField = $('#qb-name');
        setQueryPaletteOpen(true);
        if (q.mode) setQueryMode(q.mode, true);
        if (input) input.value = q.expr;
        if (nameField) nameField.value = q.name || '';
        runQueryFromInput(q.expr, true);
        queryActiveFavId = q.id;
        focusPalette(false);
    }

    /** The saved list lives inside the palette — collapsed until asked for. */
    function showSavedList() {
        var box = $('#query-saved');
        if (box) box.classList.remove('hidden');
        // Refresh from DB every time the list is revealed
        try { hooks.postMessage({ type: 'requestSavedQueries' }); } catch (_) { /* noop */ }
        renderSavedQueriesModal();
        // Re-render after the async DB response arrives
        setTimeout(function () { renderSavedQueriesModal(); }, 200);
    }

    function hideSavedList() {
        var box = $('#query-saved');
        if (box) box.classList.add('hidden');
    }

    // ---------- Autocomplete ----------
    var suggestActiveIndex = -1;
    var suggestItems = [];

    function distinctValues(prop, limit) {
        if (!hooks.getGraphData() || !hooks.getGraphData().nodes) return [];
        var seen = Object.create(null);
        var out = [];
        for (var i = 0; i < hooks.getGraphData().nodes.length && out.length < (limit || 25); i++) {
            var v = hooks.getGraphData().nodes[i][prop];
            if (v == null || v === '') continue;
            var key = String(v);
            if (seen[key]) continue;
            seen[key] = true;
            out.push(key);
        }
        return out.sort();
    }

    function communityValues() {
        var out = [];
        var seen = Object.create(null);
        Object.keys(hooks.getCommunityNames() || {}).forEach(function (cid) {
            var n = hooks.getCommunityNames()[cid] && hooks.getCommunityNames()[cid].name;
            if (!n || seen[n]) return;
            seen[n] = true;
            out.push(n);
        });
        return out.sort();
    }

    function buildSuggestions(text, caret) {
        // Find current token (identifier or value being typed)
        var before = text.slice(0, caret);
        var ctx = analyzeQueryContext(before);
        var items = [];

        var addOp = function () {
            window.AuraQuery.operators.forEach(function (op) {
                items.push({ insert: op + ' ', label: op, kind: 'op' });
            });
        };
        var addLogic = function () {
            ['AND', 'OR', 'NOT'].forEach(function (k) {
                items.push({ insert: k + ' ', label: k, kind: 'kw' });
            });
        };
        var addFields = function (prefix) {
            var fields = window.AuraQuery.listFields();
            fields.forEach(function (f) {
                if (!prefix || f.indexOf(prefix.toLowerCase()) === 0) {
                    var t = window.AuraQuery.fieldType(f);
                    items.push({
                        insert: f + ' ',
                        label: f,
                        kind: t || 'field',
                        replaceTokenLen: prefix ? prefix.length : 0
                    });
                }
            });
        };
        var addValues = function (field, prefix) {
            var t = window.AuraQuery.fieldType(field);
            var prop = window.AuraQuery.fieldProp(field);
            var vals = [];
            if (t === 'string' && prop) {
                if (field === 'community') vals = communityValues();
                else vals = distinctValues(prop, 30);
            }
            vals.forEach(function (v) {
                if (!prefix || v.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
                    items.push({
                        insert: '"' + v.replace(/"/g, '\\"') + '" ',
                        label: '"' + v + '"',
                        kind: 'value',
                        replaceTokenLen: prefix ? prefix.length + 0 : 0,
                        // include opening quote consumed
                        consumeQuote: ctx.partial && ctx.partial.charAt(0) === '"'
                    });
                }
            });
            if (t === 'bool') {
                ['true', 'false'].forEach(function (v) {
                    items.push({ insert: v + ' ', label: v, kind: 'value' });
                });
            }
        };

        switch (ctx.expecting) {
            case 'field':
                addFields(ctx.partial);
                if (!ctx.partial) addLogic();
                break;
            case 'op':
                addOp();
                break;
            case 'value':
                addValues(ctx.field, ctx.partialValue);
                break;
            case 'logic':
                addLogic();
                break;
        }
        // Cap result list
        return items.slice(0, 30).map(function (item) {
            item.tokenStart = ctx.tokenStart != null ? ctx.tokenStart : caret;
            return item;
        });
    }

    /**
     * Scan from the beginning of the input to figure out where we stand:
     * - 'field'   → user is typing a field name
     * - 'op'      → user just finished a field and needs an operator
     * - 'value'   → user is typing a value after an operator
     * - 'logic'   → user just finished a comparison and needs AND / OR
     */
    function analyzeQueryContext(text) {
        // Tokenize loosely with same rules as query.js (sufficient for completion)
        var tokens = [];
        var i = 0, n = text.length;
        while (i < n) {
            var c = text[i];
            if (/\s/.test(c)) { i++; continue; }
            if (c === '"' || c === "'") {
                var q = c, s = i; i++;
                while (i < n && text[i] !== q) { if (text[i] === '\\') i++; i++; }
                if (i < n) i++;
                tokens.push({ kind: 'string', start: s, end: i, value: text.slice(s, i) });
                continue;
            }
            if (/[A-Za-z_]/.test(c)) {
                var s2 = i;
                while (i < n && /[A-Za-z0-9_]/.test(text[i])) i++;
                tokens.push({ kind: 'ident', start: s2, end: i, value: text.slice(s2, i) });
                continue;
            }
            if (/[0-9]/.test(c)) {
                var s3 = i;
                while (i < n && /[0-9.]/.test(text[i])) i++;
                tokens.push({ kind: 'number', start: s3, end: i, value: text.slice(s3, i) });
                continue;
            }
            // Operators / punctuation (consume up to 2 chars)
            var two = text.slice(i, i + 2);
            if (['==','!=','>=','<=','&&','||','!~'].indexOf(two) !== -1) {
                tokens.push({ kind: 'op', start: i, end: i + 2, value: two });
                i += 2;
                continue;
            }
            tokens.push({ kind: 'op', start: i, end: i + 1, value: c });
            i++;
        }

        var lastEnd = tokens.length ? tokens[tokens.length - 1].end : 0;
        var endedAtBoundary = lastEnd < text.length; // trailing space after last token
        var last = tokens[tokens.length - 1];
        var prev = tokens[tokens.length - 2];

        var KEYWORDS = { 'AND':1, 'OR':1, 'NOT':1, 'IN':1, 'and':1, 'or':1, 'not':1, 'in':1 };
        var OP_CHARS = { '==':1,'!=':1,'>=':1,'<=':1,'>':1,'<':1,'~':1,'!~':1 };

        // No tokens or last token is logic keyword → expect a field
        if (!last) return { expecting: 'field', partial: '', tokenStart: 0 };

        // If we're still INSIDE the last token (no trailing space), treat it as partial
        if (!endedAtBoundary) {
            if (last.kind === 'ident' && !KEYWORDS[last.value]) {
                // Partial field OR logic keyword
                if (!prev || (prev.kind === 'ident' && KEYWORDS[prev.value]) || prev.kind === 'op') {
                    return { expecting: 'field', partial: last.value, tokenStart: last.start };
                }
                // After op: numeric/bool field with bare ident starts a value
                if (prev && prev.kind === 'op' && OP_CHARS[prev.value]) {
                    var fieldTok2 = tokens[tokens.length - 3];
                    return {
                        expecting: 'value',
                        field: fieldTok2 ? fieldTok2.value : '',
                        partialValue: last.value,
                        tokenStart: last.start
                    };
                }
                return { expecting: 'field', partial: last.value, tokenStart: last.start };
            }
            if (last.kind === 'string') {
                // Inside a quoted string after an op — value completion
                var fieldTok = tokens[tokens.length - 3];
                return {
                    expecting: 'value',
                    field: fieldTok ? fieldTok.value : '',
                    partialValue: last.value.slice(1).replace(/"$/, ''),
                    tokenStart: last.start
                };
            }
            // Inside an operator being typed
            if (last.kind === 'op') {
                return { expecting: 'op', partial: last.value, tokenStart: last.start };
            }
        }

        // Trailing space — what comes after?
        if (last.kind === 'ident' && KEYWORDS[last.value]) {
            return { expecting: 'field', partial: '', tokenStart: text.length };
        }
        if (last.kind === 'op') {
            // Operator just typed → expect value
            var fTok = tokens[tokens.length - 2];
            return { expecting: 'value', field: fTok ? fTok.value : '', partialValue: '', tokenStart: text.length };
        }
        if (last.kind === 'string' || last.kind === 'number') {
            return { expecting: 'logic', partial: '', tokenStart: text.length };
        }
        if (last.kind === 'ident') {
            // After a field identifier with trailing space → expect operator
            return { expecting: 'op', partial: '', tokenStart: text.length };
        }
        return { expecting: 'field', partial: '', tokenStart: text.length };
    }

    function showSuggestions(items) {
        var box = $('#qb-suggest');
        if (!box) return;
        suggestItems = items || [];
        suggestActiveIndex = items && items.length ? 0 : -1;
        if (!suggestItems.length) {
            box.classList.add('hidden');
            box.innerHTML = '';
            return;
        }
        box.innerHTML = '';
        for (var i = 0; i < suggestItems.length; i++) {
            (function (item, idx) {
                var row = document.createElement('div');
                row.className = 'qb-suggest-item' + (idx === suggestActiveIndex ? ' active' : '');
                var label = document.createElement('span');
                label.className = 'qb-suggest-label';
                label.textContent = item.label;
                var kind = document.createElement('span');
                kind.className = 'qb-suggest-kind';
                kind.textContent = item.kind || '';
                row.appendChild(label);
                row.appendChild(kind);
                row.addEventListener('mousedown', function (e) {
                    e.preventDefault(); // keep input focus
                    applySuggestion(idx);
                });
                box.appendChild(row);
            })(suggestItems[i], i);
        }
        box.classList.remove('hidden');
        // Placed once visible: the height is only knowable after the rows exist.
        positionSuggestBox(box);
    }

    function hideSuggestions() {
        var box = $('#qb-suggest');
        if (box) box.classList.add('hidden');
        suggestItems = [];
        suggestActiveIndex = -1;
    }

    function applySuggestion(index) {
        var input = $('#qb-input');
        if (!input || index < 0 || index >= suggestItems.length) return;
        var item = suggestItems[index];
        var caret = input.selectionStart || input.value.length;
        var before = input.value.slice(0, caret);
        var after = input.value.slice(caret);
        var replaceLen = item.replaceTokenLen || 0;
        var head = before.slice(0, before.length - replaceLen);
        // Avoid double space
        if (head.length && !/\s$/.test(head)) {
            // already has a partial we removed; nothing to add
        }
        var newValue = head + item.insert + after;
        var newCaret = (head + item.insert).length;
        input.value = newValue;
        input.setSelectionRange(newCaret, newCaret);
        // Re-trigger autocomplete + live evaluation
        triggerAutocomplete();
        scheduleQueryRun(newValue);
    }

    function triggerAutocomplete(force) {
        var input = $('#qb-input');
        if (!input) return;
        // Opening the palette must not bury its own buttons under the field
        // list: suggestions only come back once there is something to complete
        // (or when a caller explicitly forces them).
        if (!force && !input.value.trim()) { hideSuggestions(); return; }
        var caret = input.selectionStart || input.value.length;
        var items = buildSuggestions(input.value, caret);
        showSuggestions(items);
    }

    // ---------- History ----------
    function pushHistory(expr) {
        if (!expr) return;
        // Remove duplicate
        queryHistory = queryHistory.filter(function (e) { return e !== expr; });
        queryHistory.push(expr);
        if (queryHistory.length > QUERY_HISTORY_MAX) queryHistory.shift();
        queryHistoryCursor = -1;
    }

    function navigateHistory(delta) {
        var input = $('#qb-input');
        if (!input || queryHistory.length === 0) return false;
        if (queryHistoryCursor === -1) {
            // Entering history navigation
            if (delta > 0) return false; // ↓ does nothing when not in history
            queryHistoryDraft = input.value;
            queryHistoryCursor = queryHistory.length - 1;
        } else {
            queryHistoryCursor += delta;
            if (queryHistoryCursor < 0) queryHistoryCursor = 0;
            if (queryHistoryCursor >= queryHistory.length) {
                // Past newest → restore draft
                queryHistoryCursor = -1;
                input.value = queryHistoryDraft;
                input.setSelectionRange(input.value.length, input.value.length);
                return true;
            }
        }
        input.value = queryHistory[queryHistoryCursor];
        input.setSelectionRange(input.value.length, input.value.length);
        return true;
    }

    // ---------- Run / save ----------
    function setQueryStatus(text, kind) {
        var el = $('#qb-status');
        if (!el) return;
        el.textContent = text;
        el.className = 'query-summary' + (kind === 'match' ? ' qb-status-match' : kind === 'error' ? ' qb-status-error' : '');
    }

    function setQueryError(msg) {
        var input = $('#qb-input');
        var err = $('#qb-error');
        if (msg) {
            if (input) input.classList.add('qb-error-state');
            if (err) { err.textContent = msg; err.classList.remove('hidden'); }
            setQueryStatus('error', 'error');
        } else {
            if (input) input.classList.remove('qb-error-state');
            if (err) { err.textContent = ''; err.classList.add('hidden'); }
        }
    }

    function totalNodes() {
        var data = hooks.getGraphData();
        return data && data.nodes ? data.nodes.length : 0;
    }

    /** The live summary line — the home of the future aggregates (COUNT, SUM…). */
    function matchSummary(matched, total) {
        if (!total) return 'no file loaded';
        if (!matched) return 'no match · ' + total + ' files';
        var pct = Math.round((matched / total) * 100);
        return matched + ' / ' + total + ' files · ' + pct + '%';
    }

    /** Chip in the view bar: what is applied, how many files, in which mode. */
    function updateChip() {
        var chip = $('#query-chip');
        var main = $('#query-chip-open');
        if (!chip) return;
        if (!queryActive || !queryExpr) { chip.classList.add('hidden'); return; }
        chip.classList.remove('hidden');
        if (main) {
            main.textContent = '🔍 ' + queryExpr + ' · ' + querySet.size +
                (querySet.size === 1 ? ' file · ' : ' files · ') + (MODE_LABELS[queryMode] || queryMode);
            main.title = queryExpr + ' — ' + querySet.size + ' / ' + totalNodes() + ' files, ' +
                (MODE_LABELS[queryMode] || queryMode) + '. Click to edit.';
        }
    }

    function setQueryMode(mode, silent) {
        if (QUERY_MODES.indexOf(mode) < 0) mode = 'highlight';
        queryMode = mode;
        syncQueryState();
        var btns = document.querySelectorAll('#qb-modes [data-mode]');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('active', btns[i].getAttribute('data-mode') === mode);
        }
        if (!silent && queryActive) {
            applyQuerySelectMode();
            refreshGraphAfterQuery();
        }
        updateChip();
    }

    var pendingRunTimer = null;
    function scheduleQueryRun(expr) {
        if (pendingRunTimer) clearTimeout(pendingRunTimer);
        pendingRunTimer = setTimeout(function () { runQueryFromInput(expr, false); }, 180);
    }

    /**
     * Focus the field the user is about to need: the name on a fresh palette
     * (typing a name never summons the field list), the expression when one is
     * already there.
     */
    function focusPalette(preferName) {
        var nameField = $('#qb-name');
        var input = $('#qb-input');
        setTimeout(function () {
            if (preferName && nameField) { nameField.focus(); nameField.select(); return; }
            if (input) { input.focus(); input.select(); }
        }, 30);
    }

    /** A readable fallback, so an unnamed query never repeats its expression. */
    function defaultQueryName() {
        var n = (savedQueries ? savedQueries.length : 0) + 1;
        var taken = function (label) {
            return (savedQueries || []).some(function (q) {
                return String(q.name || '').toLowerCase() === label.toLowerCase();
            });
        };
        while (taken('Query ' + n)) n++;
        return 'Query ' + n;
    }

    function saveCurrentQuery() {
        var input = $('#qb-input');
        var nameField = $('#qb-name');
        var expr = (input && input.value || '').trim();
        if (!expr) return;
        var compiled;
        try {
            compiled = window.AuraQuery.compile(expr);
        } catch (e) {
            setQueryError('Query engine error: ' + (e.message || 'unknown'));
            return;
        }
        if (!compiled || !compiled.ok) {
            setQueryError(compiled.error || 'Invalid expression');
            return;
        }
        var name = (nameField && nameField.value || '').trim() || defaultQueryName();
        // Same name = same saved query: Save overwrites instead of piling up twins.
        var clash = null;
        for (var i = 0; i < (savedQueries || []).length; i++) {
            if (String(savedQueries[i].name || '').toLowerCase() === name.toLowerCase()) {
                clash = savedQueries[i];
                break;
            }
        }
        var id = clash ? clash.id : 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        var entry = {
            id: id,
            name: name,
            expr: expr,
            mode: queryMode,
            createdAt: clash ? clash.createdAt : Date.now()
        };
        // Optimistic local update — the list shows it immediately
        savedQueries = clash
            ? (savedQueries || []).map(function (q) { return q.id === id ? entry : q; })
            : [entry].concat(savedQueries || []);
        queryActiveFavId = id;
        if (nameField) nameField.value = name;
        renderSavedQueriesModal();
        showSavedList(); // reveal the list so the save is visible
        // Persist in DB
        try {
            hooks.postMessage({
                type: clash ? 'updateSavedQuery' : 'addSavedQuery',
                payload: { id: id, name: name, expr: expr, mode: queryMode }
            });
        } catch (_) { /* noop */ }
    }

    function runQueryFromInput(expr, pushToHistory) {
        queryExpr = (expr || '').trim();
        queryActiveFavId = null;
        if (!queryExpr) {
            queryActive = false;
            queryFn = null;
            querySet.clear();
            syncQueryState(); // clearing must re-enable every node visually
            setQueryError('');
            setQueryStatus('—', '');
            refreshGraphAfterQuery();
            updateChip();
            return;
        }
        var compiled;
        try {
            compiled = window.AuraQuery.compile(queryExpr);
        } catch (e) {
            queryActive = false;
            syncQueryState();
            setQueryError('Query engine error: ' + (e.message || 'unknown'));
            setQueryStatus('error', 'error');
            updateChip();
            return;
        }
        if (!compiled.ok) {
            queryActive = false;
            syncQueryState();
            setQueryError(compiled.error || 'Invalid expression');
            setQueryStatus('error', 'error');
            updateChip();
            return;
        }
        setQueryError('');
        queryFn = compiled.fn;
        queryActive = true;
        evaluateQuery();
        applyQuerySelectMode();
        setQueryStatus(matchSummary(querySet.size, totalNodes()), querySet.size > 0 ? 'match' : '');
        refreshGraphAfterQuery();
        if (pushToHistory) pushHistory(queryExpr);
        syncQueryState();
        updateChip();
        // V3-12 — let the app record the place in the navigation trail.
        if (typeof hooks.onApplied === 'function') hooks.onApplied(queryExpr, queryMode);
    }

    // ---------- Palette: position, geometry, autocomplete placement ----------

    function readPalettePos() {
        try {
            var raw = window.localStorage.getItem(PALETTE_POS_KEY);
            if (!raw) return null;
            var p = JSON.parse(raw);
            if (p && typeof p.left === 'number' && typeof p.top === 'number') return p;
        } catch (_) { /* noop */ }
        return null;
    }

    function savePalettePos() {
        var el = $('#query-palette');
        if (!el) return;
        try {
            window.localStorage.setItem(PALETTE_POS_KEY, JSON.stringify({
                left: Math.round(parseFloat(el.style.left) || 0),
                top: Math.round(parseFloat(el.style.top) || 0)
            }));
        } catch (_) { /* noop */ }
    }

    /** Clamp to the viewport — a stored position can outlive a window resize. */
    function placePalette(left, top) {
        var el = $('#query-palette');
        if (!el) return;
        var w = el.offsetWidth || 380;
        var maxLeft = Math.max(0, window.innerWidth - Math.min(w, window.innerWidth - 8) - 4);
        var maxTop = Math.max(0, window.innerHeight - 48);
        el.style.left = Math.round(Math.max(0, Math.min(left, maxLeft))) + 'px';
        el.style.top = Math.round(Math.max(0, Math.min(top, maxTop))) + 'px';
        // The list is a sibling overlay: it must follow the input while dragging.
        var box = $('#qb-suggest');
        if (box && !box.classList.contains('hidden')) positionSuggestBox(box);
    }

    function centrePalette() {
        var el = $('#query-palette');
        if (!el) return;
        placePalette(
            (window.innerWidth - (el.offsetWidth || 380)) / 2,
            (window.innerHeight - (el.offsetHeight || 240)) / 2
        );
    }

    // Opening state is owned here, never read back from the DOM: another path
    // (host, Trail, Esc) may hide the window and the toggle would desync.
    var paletteOpen = false;

    var paletteWired = false;
    function wirePaletteDrag() {
        var el = $('#query-palette');
        if (!el || paletteWired) return;
        var header = el.querySelector('.float-window-header');
        if (!header) return;
        paletteWired = true;
        var dragging = false, ox = 0, oy = 0;
        header.addEventListener('mousedown', function (e) {
            var tag = e.target && e.target.tagName;
            if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'INPUT') return;
            var rect = el.getBoundingClientRect();
            dragging = true;
            ox = e.clientX - rect.left;
            oy = e.clientY - rect.top;
            el.style.left = Math.round(rect.left) + 'px';
            el.style.top = Math.round(rect.top) + 'px';
            e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            placePalette(e.clientX - ox, e.clientY - oy);
        });
        document.addEventListener('mouseup', function () {
            if (!dragging) return;
            dragging = false;
            savePalettePos();
        });
    }

    function setQueryPaletteOpen(open) {
        var el = $('#query-palette');
        var btn = $('#qb-toggle');
        if (!el) return;
        paletteOpen = !!open;
        if (open) {
            var stored = readPalettePos();
            el.classList.remove('hidden');
            wirePaletteDrag();
            // Measured while visible: `hidden` is display:none, so the size is 0
            // before this point and centring would land in the top-left corner.
            if (stored) placePalette(stored.left, stored.top);
            else centrePalette();
        } else {
            el.classList.add('hidden');
            hideSuggestions();
            hideSavedList();
        }
        if (btn) btn.classList.toggle('active', open);
    }

    /**
     * The palette is `overflow: hidden` (float-window shell), so the suggestion
     * list cannot be an absolutely positioned child — it would be clipped. It is
     * `position: fixed` and placed from the input's viewport rectangle instead.
     */
    function positionSuggestBox(box) {
        var input = $('#qb-input');
        if (!input || !box) return;
        var rect = input.getBoundingClientRect();
        var spaceBelow = window.innerHeight - rect.bottom - 8;
        var spaceAbove = rect.top - 8;
        var wanted = Math.min(box.scrollHeight || 220, 260);
        var above = spaceBelow < Math.min(wanted, 140) && spaceAbove > spaceBelow;
        var height = Math.max(60, Math.min(wanted, above ? spaceAbove : spaceBelow));
        box.style.left = Math.round(rect.left) + 'px';
        box.style.width = Math.round(rect.width) + 'px';
        box.style.maxHeight = Math.round(height) + 'px';
        box.style.top = Math.round(above ? rect.top - 4 - height : rect.bottom + 4) + 'px';
    }

    function setupQueryBar() {
        var palette = $('#query-palette');
        var toggleBtn = $('#qb-toggle');
        var input = $('#qb-input');
        var clearBtn = $('#qb-clear');
        var saveBtn = $('#qb-save');
        var savedBtn = $('#qb-open-list');
        var closeBtn = $('#query-palette-close');
        var resetBtn = $('#query-palette-reset');
        if (!palette || !input) return;

        // Paint the segmented mode control from the real state.
        setQueryMode(queryMode, true);

        toggleBtn && toggleBtn.addEventListener('click', function () {
            var opening = !paletteOpen;
            setQueryPaletteOpen(opening);
            if (opening) focusPalette(!input.value.trim());
        });
        closeBtn && closeBtn.addEventListener('click', function () { setQueryPaletteOpen(false); });
        resetBtn && resetBtn.addEventListener('click', function () {
            try { window.localStorage.removeItem(PALETTE_POS_KEY); } catch (_) { /* noop */ }
            centrePalette();
        });

        // Chip in the view bar — visible only while a query is applied.
        var chipOpen = $('#query-chip-open');
        var chipClear = $('#query-chip-clear');
        chipOpen && chipOpen.addEventListener('click', function () {
            setQueryPaletteOpen(true);
            focusPalette(!input.value.trim());
        });
        chipClear && chipClear.addEventListener('click', function () {
            input.value = '';
            runQueryFromInput('');
            hideSuggestions();
        });

        // Modes — all three apply live: there is no Apply button to miss.
        var modeBtns = document.querySelectorAll('#qb-modes [data-mode]');
        for (var m = 0; m < modeBtns.length; m++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    setQueryMode(btn.getAttribute('data-mode'));
                });
            })(modeBtns[m]);
        }

        input.addEventListener('input', function () {
            queryHistoryCursor = -1;
            triggerAutocomplete();
            scheduleQueryRun(input.value);
        });
        // No autocomplete on focus: it would cover the palette the moment it opens.
        input.addEventListener('blur', function () {
            // small delay so click on suggestion still works
            setTimeout(hideSuggestions, 120);
        });

        input.addEventListener('keydown', function (e) {
            var box = $('#qb-suggest');
            var hasSuggest = suggestItems.length > 0 && box && !box.classList.contains('hidden');
            if (hasSuggest && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                if (e.key === 'ArrowDown') suggestActiveIndex = (suggestActiveIndex + 1) % suggestItems.length;
                else suggestActiveIndex = (suggestActiveIndex - 1 + suggestItems.length) % suggestItems.length;
                showSuggestions(suggestItems);
                return;
            }
            if (hasSuggest && (e.key === 'Tab' || e.key === 'Enter')) {
                if (suggestActiveIndex >= 0) {
                    e.preventDefault();
                    applySuggestion(suggestActiveIndex);
                    return;
                }
            }
            if (e.key === 'Escape') {
                if (hasSuggest) { hideSuggestions(); return; }
                input.value = '';
                runQueryFromInput('');
                return;
            }
            if (e.key === 'Enter') {
                if (pendingRunTimer) clearTimeout(pendingRunTimer);
                runQueryFromInput(input.value, true);
                hideSuggestions();
                return;
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                if (navigateHistory(e.key === 'ArrowUp' ? -1 : 1)) {
                    e.preventDefault();
                    triggerAutocomplete();
                    scheduleQueryRun(input.value);
                }
            }
        });

        clearBtn && clearBtn.addEventListener('click', function () {
            input.value = '';
            runQueryFromInput('');
            hideSuggestions();
            input.focus();
        });

        saveBtn && saveBtn.addEventListener('click', saveCurrentQuery);

        // The name is a label, not a query: Enter hands over to the expression.
        var nameField = $('#qb-name');
        nameField && nameField.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            input.focus();
            input.select();
        });

        // Saved list: a collapsible section inside the palette.
        savedBtn && savedBtn.addEventListener('click', function () {
            var box = $('#query-saved');
            var opening = !box || box.classList.contains('hidden');
            if (opening) showSavedList(); else hideSavedList();
            savedBtn.classList.toggle('active', opening);
        });

        // Escape closes the palette when the input is not the one handling it.
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (e.target === input) return;
            if (paletteOpen) setQueryPaletteOpen(false);
        });

        // Re-anchor the suggestions when the viewport changes underneath them.
        window.addEventListener('resize', function () {
            var box = $('#qb-suggest');
            if (box && !box.classList.contains('hidden')) positionSuggestBox(box);
        });

        // Ctrl+K / Cmd+K — open the palette and put the caret in the expression.
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                setQueryPaletteOpen(true);
                focusPalette(!input.value.trim());
            }
        });
    }

    // ============================================================
    // Public API
    // ============================================================
    window.AuraQueryBar = {
        init: function (h) { hooks = h || {}; },
        setup: setupQueryBar,
        state: function () { return queryState; },
        getExpression: function () { return queryExpr; },
        /** Open/close the palette from outside (Trail, commands, tests). */
        setOpen: setQueryPaletteOpen,
        isOpen: function () { return paletteOpen; },
        /** Re-run the active query after the dataset changed (graph data). */
        onGraphData: function () {
            if (!queryActive || !queryFn) { updateChip(); return; }
            evaluateQuery();
            applyQuerySelectMode();
            setQueryStatus(matchSummary(querySet.size, totalNodes()), querySet.size > 0 ? 'match' : '');
            updateChip();
        },
        /** Annotations/working-tree changed: re-evaluate and refresh visuals. */
        refreshAfterDataChange: function () {
            if (queryActive) evaluateQuery();
            refreshGraphAfterQuery();
            updateChip();
        },
        /** Applied by the host (command palette / editor context menu / Trail). */
        applyFromHost: function (expr, mode) {
            var qbInput = $('#qb-input');
            var nameField = $('#qb-name');
            setQueryPaletteOpen(true);
            if (mode) setQueryMode(mode, true);
            if (qbInput) qbInput.value = expr || '';
            // A query coming from outside is not a saved one: no name to reuse.
            if (nameField) nameField.value = '';
            runQueryFromInput(expr || '', true);
            focusPalette(false);
        },
        setSavedQueries: function (queries) {
            savedQueries = queries;
            renderSavedQueriesModal();
        }
    };
})();
