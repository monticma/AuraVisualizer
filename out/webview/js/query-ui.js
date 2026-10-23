/**
 * query-ui.js — Query bar (Aura Query Language), saved-queries modal,
 * autocomplete/suggestions and query history.
 *
 * Extracted from app.js (Lot 2d). window.AuraQueryBar + init(hooks). The language
 * itself stays in query.js (global helpers); the query overlay state is exposed
 * through state() for the app.js render accessors (via qsState()).
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
        if (!savedQueries || !savedQueries.length) {
            var empty = document.createElement('div');
            empty.className = 'queries-empty';
            empty.textContent = 'No saved queries yet. Type a query and click ⭐ to save.';
            list.appendChild(empty);
            updateModalButtons();
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

                var expr = document.createElement('div');
                expr.className = 'queries-item-expr';
                expr.textContent = q.expr;
                row.appendChild(expr);

                var mode = document.createElement('div');
                mode.className = 'queries-item-mode';
                mode.textContent = q.mode || 'highlight';
                row.appendChild(mode);

                row.addEventListener('click', function () {
                    modalSelectedId = q.id;
                    renderSavedQueriesModal();
                });
                row.addEventListener('dblclick', function () {
                    modalSelectedId = q.id;
                    applySavedQuery(q);
                    hideQueriesModal();
                });
                list.appendChild(row);
            })(savedQueries[i]);
        }
        updateModalButtons();
    }

    function updateModalButtons() {
        var selectBtn = $('#queries-modal-select');
        var delBtn = $('#queries-modal-delete');
        var hasSel = !!modalSelectedId;
        if (selectBtn) selectBtn.disabled = !hasSel;
        if (delBtn) delBtn.disabled = !hasSel;
    }

    function applySavedQuery(q) {
        if (!q) return;
        var input = $('#qb-input');
        var modeSel = $('#qb-mode');
        setQueryBarOpen(true);
        if (input) input.value = q.expr;
        if (modeSel && q.mode) { modeSel.value = q.mode; queryMode = q.mode; syncQueryState(); }
        runQueryFromInput(q.expr, true);
        queryActiveFavId = q.id;
    }

    function showQueriesModal() {
        var modal = $('#queries-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        // Refresh from DB every time the modal is opened
        try { hooks.postMessage({ type: 'requestSavedQueries' }); } catch (_) { /* noop */ }
        renderSavedQueriesModal();
        // Re-render after async DB response arrives
        setTimeout(function () { renderSavedQueriesModal(); }, 200);
    }

    function hideQueriesModal() {
        var modal = $('#queries-modal');
        if (modal) modal.classList.add('hidden');
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

    function triggerAutocomplete() {
        var input = $('#qb-input');
        if (!input) return;
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
        el.className = 'qb-status' + (kind === 'match' ? ' qb-status-match' : kind === 'error' ? ' qb-status-error' : '');
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

    var pendingRunTimer = null;
    function scheduleQueryRun(expr) {
        if (pendingRunTimer) clearTimeout(pendingRunTimer);
        pendingRunTimer = setTimeout(function () { runQueryFromInput(expr, false); }, 180);
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
            return;
        }
        if (!compiled.ok) {
            queryActive = false;
            syncQueryState();
            setQueryError(compiled.error || 'Invalid expression');
            setQueryStatus('error', 'error');
            return;
        }
        setQueryError('');
        queryFn = compiled.fn;
        queryActive = true;
        evaluateQuery();
        applyQuerySelectMode();
        var total = (hooks.getGraphData() && hooks.getGraphData().nodes) ? hooks.getGraphData().nodes.length : 0;
        setQueryStatus(querySet.size + ' / ' + total + ' match', querySet.size > 0 ? 'match' : '');
        refreshGraphAfterQuery();
        if (pushToHistory) pushHistory(queryExpr);
        syncQueryState();
    }

    function setQueryBarOpen(open) {
        var bar = $('#query-bar');
        var btn = $('#qb-toggle');
        if (!bar) return;
        if (open) {
            bar.classList.remove('collapsed');
        } else {
            bar.classList.add('collapsed');
            hideSuggestions();
        }
        if (btn) btn.classList.toggle('active', open);
    }

    function setupQueryBar() {
        var bar = $('#query-bar');
        var toggleBtn = $('#qb-toggle');
        var input = $('#qb-input');
        var modeSel = $('#qb-mode');
        var clearBtn = $('#qb-clear');
        var saveBtn = $('#qb-save');
        var openListBtn = $('#qb-open-list');
        if (!bar || !input) return;

        toggleBtn && toggleBtn.addEventListener('click', function () {
            setQueryBarOpen(bar.classList.contains('collapsed'));
            if (!bar.classList.contains('collapsed')) {
                setTimeout(function () { input.focus(); }, 50);
            }
        });

        input.addEventListener('input', function () {
            queryHistoryCursor = -1;
            triggerAutocomplete();
            scheduleQueryRun(input.value);
        });
        input.addEventListener('focus', triggerAutocomplete);
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

        modeSel && modeSel.addEventListener('change', function () {
            queryMode = modeSel.value;
            if (queryActive) {
                applyQuerySelectMode();
                refreshGraphAfterQuery();
            }
        });

        clearBtn && clearBtn.addEventListener('click', function () {
            input.value = '';
            runQueryFromInput('');
            hideSuggestions();
        });

        saveBtn && saveBtn.addEventListener('click', function () {
            var expr = (input.value || '').trim();
            if (!expr) return;
            try {
                var compiled = window.AuraQuery.compile(expr);
            } catch (e) {
                setQueryError('Query engine error: ' + (e.message || 'unknown'));
                return;
            }
            if (!compiled || !compiled.ok) {
                setQueryError(compiled.error || 'Invalid expression');
                return;
            }
            // Auto-generate a name from the first 50 chars of the expression
            var name = expr.length > 50 ? expr.slice(0, 47) + '...' : expr;
            var newQ = { id: 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, expr: expr, mode: queryMode, createdAt: Date.now() };
            // Optimistic local update — the modal shows the query immediately
            savedQueries.unshift(newQ);
            if (typeof renderSavedQueriesModal === 'function') renderSavedQueriesModal();
            // Persist in DB
            try {
                hooks.postMessage({
                    type: 'addSavedQuery',
                    payload: { id: newQ.id, name: name, expr: expr, mode: queryMode }
                });
            } catch (_) { /* noop */ }
        });

        openListBtn && openListBtn.addEventListener('click', function () {
            showQueriesModal();
        });

        // Saved-queries modal wiring
        var modal = $('#queries-modal');
        var modalClose = $('#queries-modal-close');
        var modalSelect = $('#queries-modal-select');
        var modalDelete = $('#queries-modal-delete');
        modalClose && modalClose.addEventListener('click', hideQueriesModal);
        modalSelect && modalSelect.addEventListener('click', function () {
            if (!modalSelectedId) return;
            var q = savedQueries.find(function (x) { return x.id === modalSelectedId; });
            if (q) { applySavedQuery(q); hideQueriesModal(); }
        });
        modalDelete && modalDelete.addEventListener('click', function () {
            if (!modalSelectedId) return;
            try {
                hooks.postMessage({
                    type: 'deleteSavedQuery',
                    payload: { id: modalSelectedId }
                });
            } catch (_) { /* noop */ }
            modalSelectedId = null;
        });

        // Modal drag
        if (modal) {
            var header = modal.querySelector('.queries-modal-header');
            if (header) {
                var dragging = false, ox = 0, oy = 0;
                header.addEventListener('mousedown', function (e) {
                    if (e.target.tagName === 'BUTTON') return;
                    dragging = true;
                    var rect = modal.getBoundingClientRect();
                    ox = e.clientX - rect.left;
                    oy = e.clientY - rect.top;
                    modal.style.left = rect.left + 'px';
                    modal.style.top = rect.top + 'px';
                    modal.style.transform = 'none';
                    e.preventDefault();
                });
                document.addEventListener('mousemove', function (e) {
                    if (!dragging) return;
                    var x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - 60));
                    var y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - 40));
                    modal.style.left = x + 'px';
                    modal.style.top = y + 'px';
                });
                document.addEventListener('mouseup', function () { dragging = false; });
            }
            // Esc closes modal when open
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    hideQueriesModal();
                }
            });
        }

        // Ctrl+K / Cmd+K to focus the bar
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                setQueryBarOpen(true);
                setTimeout(function () { input.focus(); input.select(); triggerAutocomplete(); }, 50);
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
        /** Re-run the active query after the dataset changed (graph data). */
        onGraphData: function () {
            if (!queryActive || !queryFn) return;
            evaluateQuery();
            applyQuerySelectMode();
            var data = hooks.getGraphData();
            var totalQ = data && data.nodes ? data.nodes.length : 0;
            setQueryStatus(querySet.size + ' / ' + totalQ + ' match', querySet.size > 0 ? 'match' : '');
        },
        /** Annotations/working-tree changed: re-evaluate and refresh visuals. */
        refreshAfterDataChange: function () {
            if (queryActive) evaluateQuery();
            refreshGraphAfterQuery();
        },
        /** Applied by the host (command palette / editor context menu). */
        applyFromHost: function (expr, mode) {
            var qbInput = $('#qb-input');
            var qbMode = $('#qb-mode');
            setQueryBarOpen(true);
            if (qbInput) qbInput.value = expr;
            if (qbMode && mode) {
                qbMode.value = mode;
                queryMode = mode;
            }
            runQueryFromInput(expr, true);
        },
        setSavedQueries: function (queries) {
            savedQueries = queries;
            if (typeof renderSavedQueriesModal === 'function') renderSavedQueriesModal();
        }
    };
})();
