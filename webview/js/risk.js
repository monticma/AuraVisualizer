/**
 * risk.js — Risk Map Dashboard: churn index, risk scoring/percentiles,
 * dashboard rendering (hot files, rising risk, scatter, bus factor), risk
 * window handling and the markdown report.
 *
 * Extracted from app.js (Lot 2b). window.AuraRiskMap + init(hooks). The shared
 * scoring logic stays in risk-core.js (window.AuraRisk), loaded before this.
 */
(function () {
    'use strict';

    var hooks = {};
    var $ = function (sel) { return document.querySelector(sel); };

    /** Commit list — the commits live in timeline.js now. */
    function timelineCommitsList() {
        return (window.AuraTimeline && window.AuraTimeline.getCommits()) || [];
    }

    // Local HTML escaping (kept out of the app scope, like panels.js).
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================================================
    // Risk Map Dashboard
    // ============================================================
    var riskReportData = null;
    var churnByFile = {};      // file id → { commits, recent, lastDate, authors }
    var RECENT_DAYS = 30;      // fixed window for the "Recently Hot" section
    var CHURN_CAP = 20;        // churn scale used for the scatter axis
    var riskCore = window.AuraRisk; // shared scoring — see src/risk/risk-core.ts
    var RISK_WINDOWS = riskCore.RISK_WINDOWS;
    var riskWindowDays = riskCore.normalizeRiskWindow((window.AURA_CONFIG || {}).riskWindow);
    var riskPercentiles = null; // { complexity, fanIn, fanOut, churn } → lookup(v) → 0..1

    function getChurn(id) {
        var c = id ? churnByFile[id] : null;
        return c ? c.commits : 0;
    }

    function churnOf(node) {
        if (!node) return { commits: 0, recent: 0, lastDate: 0, authors: {} };
        return churnByFile[node.id] || churnByFile[node.path] ||
            { commits: 0, recent: 0, lastDate: 0, authors: {} };
    }

    function computeChurnIndex() {
        churnByFile = {};
        var now = Date.now();
        var day = 24 * 60 * 60 * 1000;
        var cutoff = now - riskWindowDays * day;
        var recentCutoff = now - RECENT_DAYS * day;
        // Follow git renames so a moved file keeps its history (same resolver
        // as the host — see src/risk/risk-core.ts).
        var commits = timelineCommitsList();
        var resolvePath = riskCore.buildRenameResolver(commits);
        for (var i = 0; i < commits.length; i++) {
            var commit = commits[i];
            var when = new Date(commit.date).getTime();
            if (isNaN(when)) when = 0;
            var author = commit.author || 'unknown';
            var files = commit.files || [];
            for (var j = 0; j < files.length; j++) {
                var p = files[j].path;
                if (!p) continue;
                p = resolvePath(p);
                var entry = churnByFile[p];
                if (!entry) entry = churnByFile[p] = { commits: 0, recent: 0, lastDate: 0, authors: {} };
                if (when >= cutoff) entry.commits++;        // churn inside the selected window
                if (when >= recentCutoff) entry.recent++;   // last 30 days, for "Recently Hot"
                if (when > entry.lastDate) entry.lastDate = when;
                entry.authors[author] = true;
            }
        }
    }

    function churnFor(node) {
        return getChurn(node.id) || getChurn(node.path);
    }

    /** Rank every structural metric against the files of *this* repository. */
    function buildRiskPercentiles(nodes) {
        return riskCore.buildRiskPercentiles(nodes, churnFor);
    }

    /** Risk score — implemented in the shared core (src/risk/risk-core.ts). */
    function computeRiskScore(node, pct) {
        return riskCore.computeRiskScore(node, pct || riskPercentiles, churnFor(node));
    }

    /** Written reasons — implemented in the shared core (src/risk/risk-core.ts). */
    function riskReasons(node, pct) {
        var stats = churnOf(node);
        return riskCore.riskReasons(node, pct || riskPercentiles, {
            windowDays: riskWindowDays,
            churn: churnFor(node),
            authorCount: stats.authors ? Object.keys(stats.authors).length : 0
        });
    }

    function riskReasonsText(reasons, separator) {
        return riskCore.riskReasonsText(reasons, separator);
    }

    /** Bucket thresholds — shared with the host (src/risk/risk-core.ts). */
    function riskBucket(score) {
        return riskCore.riskBucket(score);
    }

    function renderRiskDashboard() {
        if (!hooks.getGraphData() || !hooks.getGraphData().nodes) return;
        var nodes = hooks.getGraphData().nodes;
        riskPercentiles = buildRiskPercentiles(nodes);
        var scored = [];
        var maxFanInNode = null;
        var i, n, score;
        for (i = 0; i < nodes.length; i++) {
            n = nodes[i];
            score = computeRiskScore(n, riskPercentiles);
            scored.push({ node: n, score: score, reasons: riskReasons(n, riskPercentiles) });
            if (!maxFanInNode || (n.fanIn || 0) > (maxFanInNode.fanIn || 0)) maxFanInNode = n;
        }
        scored.sort(function(a, b) { return b.score - a.score; });

        var high = [], medium = [], low = [];
        for (i = 0; i < scored.length; i++) {
            var b = riskBucket(scored[i].score);
            if (b === 'high') high.push(scored[i]);
            else if (b === 'medium') medium.push(scored[i]);
            else low.push(scored[i]);
        }

        var total = nodes.length;
        var avgRisk = total > 0 ? scored.reduce(function(s, x) { return s + x.score; }, 0) / total : 0;
        var health = Math.max(0, Math.round(100 - avgRisk));

        riskReportData = {
            scored: scored,
            health: health,
            avgRisk: avgRisk,
            high: high,
            medium: medium,
            low: low,
            total: total,
            windowDays: riskWindowDays
        };

        var el;
        el = $('#risk-health-score'); if (el) el.textContent = health + '%';
        el = $('#risk-total-files'); if (el) el.textContent = total;
        el = $('#risk-avg-risk'); if (el) el.textContent = Math.round(avgRisk);
        el = $('#risk-most-risky');
        if (el) el.textContent = scored.length ? (scored[0].node.name + ' · ' + Math.round(scored[0].score) + '/100') : '—';
        el = $('#risk-most-connected');
        if (el) el.textContent = maxFanInNode ? (maxFanInNode.name + ' · ' + maxFanInNode.fanIn + ' links') : '—';

        var hCount = high.length, mCount = medium.length, lCount = low.length;
        var hPct = total > 0 ? Math.round(hCount / total * 100) : 0;
        var mPct = total > 0 ? Math.round(mCount / total * 100) : 0;
        var lPct = Math.max(0, 100 - hPct - mPct);

        el = $('#risk-high-count'); if (el) el.textContent = hCount;
        el = $('#risk-medium-count'); if (el) el.textContent = mCount;
        el = $('#risk-low-count'); if (el) el.textContent = lCount;
        el = $('#risk-high-pct'); if (el) el.textContent = hPct + '%';
        el = $('#risk-medium-pct'); if (el) el.textContent = mPct + '%';
        el = $('#risk-low-pct'); if (el) el.textContent = lPct + '%';
        el = $('#risk-bar-high'); if (el) el.style.width = hPct + '%';
        el = $('#risk-bar-medium'); if (el) el.style.width = mPct + '%';
        el = $('#risk-bar-low'); if (el) el.style.width = lPct + '%';

        el = $('#risk-high-badge'); if (el) el.textContent = hCount;
        el = $('#risk-medium-badge'); if (el) el.textContent = mCount;
        el = $('#risk-low-badge'); if (el) el.textContent = lCount;

        renderRiskList('#risk-list-high', high, 'high');
        renderRiskList('#risk-list-medium', medium, 'medium');
        renderRiskList('#risk-list-low', low, 'low');
        renderRiskTrend();
        renderRisingRisk();
        renderRiskScatter();
        renderBusFactor();
        renderSymbolCycles();
        renderComplexityTrends();
    }

    /** Per-file complexity slope + sparkline (V2-05). */
    function renderComplexityTrends() {
        var section = document.getElementById('risk-complexity-trends');
        var list = document.getElementById('risk-list-complexity-trends');
        var badge = document.getElementById('risk-complexity-trends-badge');
        if (!section || !list) return;
        var trends = window.AuraTrendUI ? AuraTrendUI.getTrends() : {};
        var currentIds = {};
        var nodes = (hooks.getGraphData() && hooks.getGraphData().nodes) || [];
        for (var n = 0; n < nodes.length; n++) currentIds[nodes[n].id] = true;
        var ranked = Object.keys(trends)
            .map(function(id) { return trends[id]; })
            .filter(function(trend) { return trend.samples >= 2 && currentIds[trend.file]; })
            .sort(function(a, b) {
                if (a.degrading !== b.degrading) return a.degrading ? -1 : 1;
                return b.slopePer30Days - a.slopePer30Days;
            })
            .slice(0, 20);
        if (badge) badge.textContent = ranked.length;
        section.style.display = ranked.length ? '' : 'none';
        list.innerHTML = '';
        for (var i = 0; i < ranked.length; i++) {
            var trend = ranked[i];
            var row = document.createElement('div');
            row.className = 'risk-trend-row';
            row.title = AuraTrendUI.tooltip(trend);
            row.innerHTML =
                '<div class="risk-trend-main">' +
                    AuraTrendUI.sparklineHTML(trend, 70, 18) +
                    '<span class="risk-trend-file">' + escapeHtml(trend.file) + '</span>' +
                    AuraTrendUI.badgeHTML(trend) +
                '</div>' +
                '<div class="risk-trend-detail">' +
                    '<span>Δ ' + (trend.delta >= 0 ? '+' : '') + trend.delta + ' complexity</span>' +
                    '<span>R² ' + trend.r2.toFixed(2) + '</span>' +
                    '<span>' + trend.samples + ' changes</span>' +
                '</div>';
            (function(id) {
                row.addEventListener('click', function() { focusRiskFile(id); });
            })(trend.file);
            list.appendChild(row);
        }
    }

    /** Function-level recursion / mutual recursion (V2-03). */
    function renderSymbolCycles() {
        var section = document.getElementById('risk-symbol-cycles');
        var list = document.getElementById('risk-list-symbol-cycles');
        var badge = document.getElementById('risk-symbol-cycles-badge');
        if (!section || !list) return;
        var cycles = (hooks.getGraphData().meta && hooks.getGraphData().meta.symbolCycles) || [];
        if (badge) badge.textContent = cycles.length;
        section.style.display = cycles.length ? '' : 'none';
        list.innerHTML = '';
        for (var i = 0; i < cycles.length; i++) {
            var cycle = cycles[i];
            var names = (cycle.nodes || []).map(function(n) { return n.name + '()'; });
            if (names.length) names.push(names[0]);
            var chain = names.join(' → ');
            var steps = (cycle.edges || []).map(function(edge) {
                return edge.callerFile + ':' + edge.callLine + '  ' + edge.callerName + '() → ' + edge.calleeName + '()';
            }).join('\n');
            var row = document.createElement('div');
            row.className = 'risk-cycle-row';
            row.title = steps;
            row.innerHTML =
                '<div class="risk-cycle-chain">' + escapeHtml(chain) + '</div>' +
                '<div class="risk-cycle-meta">' +
                    '<span>' + (cycle.kind === 'recursive' ? 'direct recursion' : 'mutual recursion · ' + (cycle.nodes || []).length + ' functions') + '</span>' +
                    '<span>confidence ' + cycle.confidence.toFixed(1) + '</span>' +
                    (cycle.ambiguous ? '<span class="risk-cycle-ambiguous">ambiguous</span>' : '') +
                '</div>';
            (function(fileId) {
                row.addEventListener('click', function() { focusRiskFile(fileId); });
            })(cycle.nodes && cycle.nodes[0] ? cycle.nodes[0].file : '');
            list.appendChild(row);
        }
    }

    function renderRiskList(selector, items, bucket) {
        var el = $(selector);
        if (!el) return;
        el.innerHTML = '';
        if (!items.length) {
            el.innerHTML = '<div class="risk-empty">No files in this bucket.</div>';
            return;
        }
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var n = it.node;
            var reasons = it.reasons || riskReasons(n, riskPercentiles);
            // The row shows the three factors that actually drive the score;
            // hovering reveals the full, numbered explanation.
            var breakdown = escapeHtml(riskReasonsText(reasons.slice(0, 3), ' · '));
            var fullText = riskReasonsText(reasons, '\n');
            var row = document.createElement('div');
            row.className = 'risk-file-row';
            row.setAttribute('data-bucket', bucket);
            row.dataset.id = n.id;
            if (fullText) row.setAttribute('title', fullText);
            row.innerHTML =
                '<span class="risk-file-score">' + Math.round(it.score) + '</span>' +
                '<span class="risk-file-info">' +
                    '<span class="risk-file-name">' + escapeHtml(n.name) + '</span>' +
                    '<span class="risk-file-path">' + escapeHtml(n.path || n.id) + '</span>' +
                    '<span class="risk-file-breakdown">' + breakdown + '</span>' +
                '</span>' +
                '<span class="risk-file-loc">' + (n.linesOfCode || 0) + ' LOC</span>' +
                '<span class="risk-file-open">➤</span>';
            (function(id) {
                row.addEventListener('click', function() { focusRiskFile(id); });
            })(n.id);
            el.appendChild(row);
        }
    }

    function focusRiskFile(id) {
        if (hooks.focusNode) {
            hooks.focusNode(id);
            return;
        }
        hooks.showGraphTab();
        requestAnimationFrame(function() {
            var node = hooks.findNode(id);
            if (node && hooks.getGraph()) {
                // Full selection: highlight, fly camera, and open the detail panel
                hooks.selectNode(node);
            }
        });
    }

    /** Reveal a file inside the Risk tab: expand its bucket, scroll to the row, flash it. */
    function revealRiskFile(id) {
        hooks.showRiskTab();
        var rows = document.querySelectorAll('#risk-list-high .risk-file-row, #risk-list-medium .risk-file-row, #risk-list-low .risk-file-row');
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].dataset.id !== id) continue;
            var list = rows[i].parentElement;
            var header = list ? list.previousElementSibling : null;
            if (list && list.classList.contains('risk-collapsed')) {
                list.classList.remove('risk-collapsed');
                if (header) header.classList.remove('risk-collapsed');
            }
            rows[i].scrollIntoView({ block: 'center' });
            rows[i].classList.add('risk-row-flash');
            (function(row) {
                setTimeout(function() { row.classList.remove('risk-row-flash'); }, 1600);
            })(rows[i]);
            return;
        }
        // Not in the lists (buckets cover every node — should not happen): fall back to the graph
        focusRiskFile(id);
    }

    function generateRiskReportMarkdown(d) {
        var lines = [];
        lines.push('# Aura — Codebase Risk Report');
        lines.push('');
        lines.push('## Codebase Health');
        lines.push('');
        lines.push('- **Health score:** ' + d.health + '%');
        lines.push('- **Total files:** ' + d.total);
        lines.push('- **Average risk:** ' + Math.round(d.avgRisk) + '/100');
        lines.push('- **Distribution:** ' + d.high.length + ' high · ' + d.medium.length + ' medium · ' + d.low.length + ' low');
        lines.push('- **History window:** ' + (d.windowDays || riskWindowDays) + ' days');
        lines.push('');
        lines.push('> Risk = 100 × (0.30·complexity + 0.20·fan-in + 0.10·fan-out + 0.15·cycle + 0.15·dead-code + 0.10·churn),');
        lines.push('> where **complexity, fan-in, fan-out and churn are percentile ranks inside this repository**');
        lines.push('> (0 = lowest of the repo, 1 = highest): a score is a standing relative to this codebase, not an absolute threshold.');
        lines.push('> Buckets: High ≥ 66, Medium 33–65, Low < 33.');
        appendRiskBucket(lines, '🔴 HIGH RISK FILES', d.high);
        appendRiskBucket(lines, '🟡 MEDIUM RISK FILES', d.medium);
        appendRiskBucket(lines, '🟢 LOW RISK FILES', d.low);
        appendRisingBucket(lines);
        appendBusFactor(lines);
        lines.push('');
        lines.push('*Generated by Aura Visualizer*');
        return lines.join('\n');
    }

    function appendRiskBucket(lines, title, items) {
        lines.push('');
        lines.push('## ' + title);
        lines.push('');
        if (!items.length) {
            lines.push('_None._');
            return;
        }
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var n = it.node;
            lines.push('- **' + n.name + '** — risk ' + Math.round(it.score) + '/100 (`' + (n.path || n.id) + '` · ' + (n.linesOfCode || 0) + ' LOC)');
            var reasons = it.reasons;
            if (reasons && reasons.length) {
                lines.push('  - ' + riskReasonsText(reasons, ' · '));
            }
        }
    }

    function renderRiskTrend() {
        var container = $('#risk-trend-chart');
        if (!container) return;

        if (!hooks.getGraphData() || timelineCommitsList().length === 0) {
            container.innerHTML = '<div class="risk-empty">No git history — run Time Travel (⏱️) to scan commits.</div>';
            return;
        }

        var snapshots = window.AuraViews ? window.AuraViews.computeTimelineSnapshots() : null;
        if (!snapshots || snapshots.length < 2) {
            container.innerHTML = '<div class="risk-empty">Not enough data points yet — waiting for commit scan…</div>';
            return;
        }

        // Downsample to keep the SVG light
        var pts = snapshots;
        var MAXP = 240;
        if (pts.length > MAXP) {
            var step = Math.ceil(pts.length / MAXP);
            var ds = [];
            for (var i = 0; i < pts.length; i += step) ds.push(pts[i]);
            if (ds[ds.length - 1] !== pts[pts.length - 1]) ds.push(pts[pts.length - 1]);
            pts = ds;
        }

        var values = [], dates = [];
        for (var i = 0; i < pts.length; i++) {
            values.push(pts[i].complexity || 0);
            dates.push(new Date(pts[i].date));
        }

        var W = 800, H = 180;
        var margin = { top: 12, right: 12, bottom: 24, left: 44 };
        var chartW = W - margin.left - margin.right;
        var chartH = H - margin.top - margin.bottom;

        var minDate = dates[0].getTime();
        var maxDate = dates[dates.length - 1].getTime();
        var dateRange = maxDate - minDate || 1;
        var maxVal = Math.max.apply(null, values) * 1.15 || 1;

        function rx(d) { return margin.left + ((d.getTime() - minDate) / dateRange) * chartW; }
        function ry(v) { return margin.top + chartH - (v / maxVal) * chartH; }

        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', H);

        for (var t = 0; t <= 4; t++) {
            var gv = maxVal * (t / 4);
            var gy = ry(gv);
            var gl = document.createElementNS(ns, 'line');
            gl.setAttribute('x1', margin.left); gl.setAttribute('x2', W - margin.right);
            gl.setAttribute('y1', gy); gl.setAttribute('y2', gy);
            gl.setAttribute('stroke', 'rgba(255,255,255,0.06)');
            svg.appendChild(gl);
            var gt = document.createElementNS(ns, 'text');
            gt.setAttribute('x', margin.left - 6); gt.setAttribute('y', gy + 3);
            gt.setAttribute('text-anchor', 'end'); gt.setAttribute('font-size', '9');
            gt.setAttribute('fill', 'rgba(255,255,255,0.4)');
            gt.textContent = Math.round(gv);
            svg.appendChild(gt);
        }

        var linePath = '';
        var areaPath = '';
        for (var i = 0; i < pts.length; i++) {
            var px = rx(dates[i]).toFixed(1);
            var py = ry(values[i]).toFixed(1);
            linePath += (i === 0 ? 'M' : 'L') + px + ' ' + py;
            areaPath += (i === 0 ? 'M' : 'L') + px + ' ' + py;
        }
        areaPath += 'L' + rx(dates[dates.length - 1]).toFixed(1) + ' ' + (margin.top + chartH) +
                    'L' + rx(dates[0]).toFixed(1) + ' ' + (margin.top + chartH) + 'Z';

        var area = document.createElementNS(ns, 'path');
        area.setAttribute('d', areaPath);
        area.setAttribute('fill', 'rgba(79,195,247,0.12)');
        svg.appendChild(area);

        var line = document.createElementNS(ns, 'path');
        line.setAttribute('d', linePath);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', '#4fc3f7');
        line.setAttribute('stroke-width', '1.5');
        svg.appendChild(line);

        container.innerHTML = '';
        container.appendChild(svg);
    }

    function renderRisingRisk() {
        var container = $('#risk-list-rising');
        if (!container) return;
        container.innerHTML = '';
        var badge = $('#risk-rising-badge');
        if (badge) badge.textContent = 0;

        if (!hooks.getGraphData() || timelineCommitsList().length === 0) {
            container.innerHTML = '<div class="risk-empty">No git history available.</div>';
            return;
        }

        var rows = [];
        var nodes = hooks.getGraphData().nodes || [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var c = churnByFile[n.id] || churnByFile[n.path];
            if (c && c.recent > 0) rows.push({ node: n, recent: c.recent, commits: c.commits });
        }
        if (!rows.length) {
            container.innerHTML = '<div class="risk-empty">No files modified in the last ' + RECENT_DAYS + ' days.</div>';
            return;
        }
        rows.sort(function(a, b) { return b.recent - a.recent; });
        if (badge) badge.textContent = rows.length;
        rows = rows.slice(0, 10);

        for (var j = 0; j < rows.length; j++) {
            var r = rows[j];
            var n = r.node;
            var row = document.createElement('div');
            row.className = 'risk-file-row';
            row.setAttribute('data-bucket', r.recent >= 10 ? 'high' : (r.recent >= 4 ? 'medium' : 'low'));
            row.innerHTML =
                '<span class="risk-file-score">' + r.recent + '</span>' +
                '<span class="risk-file-info">' +
                    '<span class="risk-file-name">' + escapeHtml(n.name) + '</span>' +
                    '<span class="risk-file-path">' + escapeHtml(n.path || n.id) + '</span>' +
                    '<span class="risk-file-breakdown">⏱ ' + r.recent + ' commits / ' + RECENT_DAYS + 'd · ' + r.commits + ' in ' + riskWindowDays + 'd</span>' +
                '</span>' +
                '<span class="risk-file-loc">' + (n.linesOfCode || 0) + ' LOC</span>' +
                '<span class="risk-file-open">➤</span>';
            (function(id) {
                row.addEventListener('click', function() { focusRiskFile(id); });
            })(n.id);
            container.appendChild(row);
        }
    }

    function appendRisingBucket(lines) {
        lines.push('');
        lines.push('## 🔥 RECENTLY HOT (last ' + RECENT_DAYS + ' days)');
        lines.push('');
        if (!hooks.getGraphData() || timelineCommitsList().length === 0) {
            lines.push('_No git history available._');
            return;
        }
        var rows = [];
        var nodes = hooks.getGraphData().nodes || [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var c = churnByFile[n.id] || churnByFile[n.path];
            if (c && c.recent > 0) rows.push({ name: n.name, path: n.path || n.id, recent: c.recent, commits: c.commits, loc: n.linesOfCode || 0 });
        }
        if (!rows.length) {
            lines.push('_None._');
            return;
        }
        rows.sort(function(a, b) { return b.recent - a.recent; });
        rows = rows.slice(0, 10);
        for (var j = 0; j < rows.length; j++) {
            var r = rows[j];
            lines.push('- **' + r.name + '** — ' + r.recent + ' commits / ' + RECENT_DAYS + 'd (`' + r.path + '` · ' + r.loc + ' LOC · ' + r.commits + ' in ' + riskWindowDays + 'd)');
        }
    }

    function renderRiskScatter() {
        var container = $('#risk-scatter-chart');
        if (!container) return;

        if (!hooks.getGraphData() || !hooks.getGraphData().nodes) {
            container.innerHTML = '<div class="risk-empty">No data.</div>';
            return;
        }

        var nodes = hooks.getGraphData().nodes || [];
        var points = [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var cx = n.complexity || 0;
            var ch = getChurn(n.id) || getChurn(n.path);
            if (cx === 0 && ch === 0) continue; // skip untouched simple files
            points.push({ node: n, cx: cx, ch: ch });
        }

        if (!points.length) {
            container.innerHTML = '<div class="risk-empty">No churn or complexity data available.</div>';
            return;
        }

        var maxCx = 0, maxCh = 1;
        for (var i = 0; i < points.length; i++) {
            if (points[i].cx > maxCx) maxCx = points[i].cx;
            if (points[i].ch > maxCh) maxCh = points[i].ch;
        }
        var axisChurn = Math.max(CHURN_CAP, maxCh);

        var W = 800, H = 220;
        var margin = { top: 16, right: 16, bottom: 30, left: 44 };
        var plotW = W - margin.left - margin.right;
        var plotH = H - margin.top - margin.bottom;

        // Log scale (log1p) so the low-complexity / low-churn crowd is spread
        // out instead of piling up in the bottom-left corner.
        function logPos(v, max) {
            if (max <= 0) return 0;
            return Math.log1p(v) / Math.log1p(max);
        }
        function expm1(x) { return Math.exp(x) - 1; }
        function sx(cx) { return margin.left + logPos(cx, maxCx) * plotW; }
        function sy(ch) { return margin.top + plotH - logPos(ch, axisChurn) * plotH; }
        // Deterministic jitter to de-stack points sharing the same coordinates.
        function jit(seed) {
            var x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return (x - Math.floor(x)) * 8 - 4; // [-4, 4] px
        }

        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', H);

        for (var t = 0; t <= 4; t++) {
            var gx = margin.left + plotW * (t / 4);
            var gl = document.createElementNS(ns, 'line');
            gl.setAttribute('x1', gx); gl.setAttribute('x2', gx);
            gl.setAttribute('y1', margin.top); gl.setAttribute('y2', margin.top + plotH);
            gl.setAttribute('stroke', 'rgba(255,255,255,0.05)');
            svg.appendChild(gl);
            var gxt = document.createElementNS(ns, 'text');
            gxt.setAttribute('x', gx); gxt.setAttribute('y', margin.top + plotH + 14);
            gxt.setAttribute('text-anchor', 'middle'); gxt.setAttribute('font-size', '9');
            gxt.setAttribute('fill', 'rgba(255,255,255,0.4)');
            gxt.textContent = Math.round(expm1((t / 4) * Math.log1p(maxCx)));
            svg.appendChild(gxt);

            var gy = margin.top + plotH * (t / 4);
            var glh = document.createElementNS(ns, 'line');
            glh.setAttribute('x1', margin.left); glh.setAttribute('x2', margin.left + plotW);
            glh.setAttribute('y1', gy); glh.setAttribute('y2', gy);
            glh.setAttribute('stroke', 'rgba(255,255,255,0.05)');
            svg.appendChild(glh);
            var gyt = document.createElementNS(ns, 'text');
            gyt.setAttribute('x', margin.left - 6); gyt.setAttribute('y', gy + 3);
            gyt.setAttribute('text-anchor', 'end'); gyt.setAttribute('font-size', '9');
            gyt.setAttribute('fill', 'rgba(255,255,255,0.4)');
            gyt.textContent = Math.round(expm1((1 - t / 4) * Math.log1p(axisChurn)));
            svg.appendChild(gyt);
        }

        var xl = document.createElementNS(ns, 'text');
        xl.setAttribute('x', margin.left + plotW / 2); xl.setAttribute('y', H - 4);
        xl.setAttribute('text-anchor', 'middle'); xl.setAttribute('font-size', '9');
        xl.setAttribute('fill', 'rgba(255,255,255,0.5)');
        xl.textContent = 'Complexity → (log)';
        svg.appendChild(xl);

        var yl = document.createElementNS(ns, 'text');
        yl.setAttribute('transform', 'translate(12,' + (margin.top + plotH / 2) + ') rotate(-90)');
        yl.setAttribute('text-anchor', 'middle'); yl.setAttribute('font-size', '9');
        yl.setAttribute('fill', 'rgba(255,255,255,0.5)');
        yl.textContent = 'Churn (commits) → (log)';
        svg.appendChild(yl);

        for (var i = 0; i < points.length; i++) {
            var pt = points[i];
            var hot = (logPos(pt.ch, axisChurn) > 0.5) && (logPos(pt.cx, maxCx) > 0.5);
            var r = 2 + Math.min(3.5, Math.sqrt(pt.cx + pt.ch) * 0.45);
            var circle = document.createElementNS(ns, 'circle');
            circle.setAttribute('cx', sx(pt.cx) + jit(i));
            circle.setAttribute('cy', sy(pt.ch) + jit(i + 1000));
            circle.setAttribute('r', r);
            circle.setAttribute('fill', hot ? '#f85149' : '#4fc3f7');
            circle.setAttribute('fill-opacity', '0.35');
            circle.setAttribute('stroke', hot ? '#ff8a80' : '#81d4fa');
            circle.setAttribute('stroke-opacity', '0.6');
            circle.setAttribute('stroke-width', '0.7');
            circle.style.cursor = 'pointer';
            (function(id, name, pcx, pch) {
                circle.addEventListener('click', function() { focusRiskFile(id); });
                var title = document.createElementNS(ns, 'title');
                title.textContent = name + ' — complexity ' + pcx + ', churn ' + pch;
                circle.appendChild(title);
            })(pt.node.id, pt.node.name, pt.cx, pt.ch);
            svg.appendChild(circle);
        }

        container.innerHTML = '';
        container.appendChild(svg);
    }

    function renderBusFactor() {
        var container = $('#risk-list-bus');
        if (!container) return;
        container.innerHTML = '';
        var badge = $('#risk-bus-badge');
        if (badge) badge.textContent = 0;

        if (!hooks.getGraphData() || timelineCommitsList().length === 0) {
            container.innerHTML = '<div class="risk-empty">No git history available.</div>';
            return;
        }

        var rows = [];
        var nodes = hooks.getGraphData().nodes || [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var c = churnByFile[n.id] || churnByFile[n.path];
            if (!c) continue;
            var authors = c.authors ? Object.keys(c.authors) : [];
            if (authors.length === 1 && c.commits >= 3) {
                rows.push({ node: n, commits: c.commits, author: authors[0] });
            }
        }
        if (!rows.length) {
            container.innerHTML = '<div class="risk-empty">No single-author files (≥ 3 commits in the last ' + riskWindowDays + ' days).</div>';
            return;
        }
        rows.sort(function(a, b) { return b.commits - a.commits; });
        if (badge) badge.textContent = rows.length;
        rows = rows.slice(0, 15);

        for (var j = 0; j < rows.length; j++) {
            var r = rows[j];
            var n = r.node;
            var row = document.createElement('div');
            row.className = 'risk-file-row';
            row.setAttribute('data-bucket', r.commits >= 20 ? 'high' : (r.commits >= 8 ? 'medium' : 'low'));
            row.innerHTML =
                '<span class="risk-file-score">' + r.commits + '</span>' +
                '<span class="risk-file-info">' +
                    '<span class="risk-file-name">' + escapeHtml(n.name) + '</span>' +
                    '<span class="risk-file-path">' + escapeHtml(n.path || n.id) + '</span>' +
                    '<span class="risk-file-breakdown">👤 ' + escapeHtml(r.author) + ' · ' + r.commits + ' commits in ' + riskWindowDays + 'd</span>' +
                '</span>' +
                '<span class="risk-file-loc">' + (n.linesOfCode || 0) + ' LOC</span>' +
                '<span class="risk-file-open">➤</span>';
            (function(id) {
                row.addEventListener('click', function() { focusRiskFile(id); });
            })(n.id);
            container.appendChild(row);
        }
    }

    function appendBusFactor(lines) {
        lines.push('');
        lines.push('## 👤 BUS FACTOR RISK (single author, ≥3 commits)');
        lines.push('');
        if (!hooks.getGraphData() || timelineCommitsList().length === 0) {
            lines.push('_No git history available._');
            return;
        }
        var rows = [];
        var nodes = hooks.getGraphData().nodes || [];
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var c = churnByFile[n.id] || churnByFile[n.path];
            if (!c) continue;
            var authors = c.authors ? Object.keys(c.authors) : [];
            if (authors.length === 1 && c.commits >= 3) {
                rows.push({ name: n.name, path: n.path || n.id, commits: c.commits, author: authors[0] });
            }
        }
        if (!rows.length) {
            lines.push('_None._');
            return;
        }
        rows.sort(function(a, b) { return b.commits - a.commits; });
        rows = rows.slice(0, 15);
        for (var j = 0; j < rows.length; j++) {
            var r = rows[j];
            lines.push('- **' + r.name + '** — ' + r.author + ' · ' + r.commits + ' commits in ' + riskWindowDays + 'd (`' + r.path + '`)');
        }
    }

    function setupRisk() {
        var askAuraBtn = $('#risk-ask-aura');
        if (askAuraBtn) {
            askAuraBtn.addEventListener('click', function() {
                hooks.postMessage({
                    type: 'askAura',
                    payload: {
                        prompt: 'Analyze the Risk dashboard (history window ' + riskWindowDays + ' days). Use at most 3 Aura tools, then give the top 3 concrete actions to reduce codebase risk, with file citations.',
                        context: { tab: 'risk', filters: { riskWindow: riskWindowDays } }
                    }
                });
            });
        }
        var exportBtn = $('#risk-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                if (!riskReportData) return;
                hooks.postMessage({ type: 'exportRiskReport', payload: { markdown: generateRiskReportMarkdown(riskReportData) } });
            });
        }
        var windowSelect = $('#risk-window');
        if (windowSelect) {
            windowSelect.value = String(riskWindowDays);
            windowSelect.addEventListener('change', function() {
                var v = parseInt(this.value, 10);
                if (!v || RISK_WINDOWS.indexOf(v) === -1) return;
                riskWindowDays = v;
                computeChurnIndex();
                hooks.computeMetricRanges();
                renderRiskDashboard();
                if (hooks.getHeatmapMode() === 'churn') hooks.refreshGraphColors();
                // Persist as a workspace setting — the host echoes it back via graphConfig
                hooks.postMessage({ type: 'updateSetting', payload: { key: 'riskWindow', value: v } });
            });
        }
        var kinds = ['high', 'medium', 'low', 'rising', 'bus', 'symbol-cycles', 'complexity-trends'];
        for (var i = 0; i < kinds.length; i++) {
            (function(kind) {
                var btn = $('#risk-toggle-' + kind);
                var list = $('#risk-list-' + kind);
                if (btn && list) {
                    btn.addEventListener('click', function() {
                        list.classList.toggle('risk-collapsed');
                        btn.classList.toggle('risk-collapsed');
                    });
                }
            })(kinds[i]);
        }
    }

    // ============================================================
    // Public API
    // ============================================================
    window.AuraRiskMap = {
        init: function (h) { hooks = h || {}; },
        setup: setupRisk,
        getChurn: getChurn,
        computeChurnIndex: computeChurnIndex,
        renderRiskDashboard: renderRiskDashboard,
        revealFile: revealRiskFile,
        getWindow: function () { return riskWindowDays; },
        normalizeWindow: function (v) { return riskCore.normalizeRiskWindow(v); },
        /** Set the git-history window (days), re-derive churn and refresh the dashboard. */
        setWindow: function (v) {
            riskWindowDays = riskCore.normalizeRiskWindow(v);
            computeChurnIndex();
            renderRiskDashboard();
        }
    };
})();
