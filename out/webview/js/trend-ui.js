/**
 * trend-ui.js — Shared complexity-trend helpers for the webview.
 *
 * The pure math lives in src/analysis/trend.ts and is bundled as
 * window.AuraTrend. This module adds config-aware caching and small SVG
 * sparkline / badge renderers used by the Risk dashboard and the Table.
 */
(function () {
    'use strict';

    var cache = null;
    var cacheKey = '';

    function threshold() {
        var value = Number((window.AURA_CONFIG || {}).complexityTrendThreshold);
        return isFinite(value) ? value : 0.5;
    }

    function getTrends() {
        if (!window.AuraTrend) return {};
        var commits = (window.AuraTimeline && window.AuraTimeline.getCommits()) || [];
        var deltas = (window.AuraTimeline && window.AuraTimeline.getDeltas()) || {};
        var key = commits.length + ':' + Object.keys(deltas).length + ':' + threshold();
        if (cache && cacheKey === key) return cache;
        var resolvePath = (window.AuraRisk && AuraRisk.buildRenameResolver)
            ? AuraRisk.buildRenameResolver(commits)
            : function (path) { return path; };
        cache = window.AuraTrend.buildFileTrends(commits, deltas, {
            threshold: threshold(),
            minR2: 0.3,
            maxPoints: 80,
            resolvePath: resolvePath,
        });
        cacheKey = key;
        return cache;
    }

    function signed(value, digits) {
        var rounded = Number(value).toFixed(digits == null ? 1 : digits);
        return value >= 0 ? '+' + rounded : rounded;
    }

    function color(trend) {
        if (!trend || trend.direction === 'unknown') return '#8b949e';
        if (trend.degrading) return '#f85149';
        if (trend.improving) return '#3fb950';
        return '#8b949e';
    }

    function sparklineHTML(trend, width, height) {
        width = width || 76;
        height = height || 18;
        if (!trend || !trend.points || trend.points.length < 2) {
            return '<span class="trend-spark trend-spark-empty">—</span>';
        }
        var points = window.AuraTrend.sparklinePoints(trend.points, width - 4, height - 4);
        return '<svg class="trend-spark" width="' + width + '" height="' + height +
            '" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">' +
            '<polyline points="' + points.replace(/(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/g,
                function (_, x, y) { return (Number(x) + 2) + ',' + (Number(y) + 2); }) +
            '" fill="none" stroke="' + color(trend) + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>' +
            '</svg>';
    }

    function badgeHTML(trend) {
        if (!trend || trend.samples < 2) {
            return '<span class="trend-badge trend-unknown" title="Not enough history">—</span>';
        }
        if (trend.direction === 'flat') {
            return '<span class="trend-badge trend-flat" title="Complexity is stable">— stable</span>';
        }
        var icon = trend.direction === 'up' ? '▲' : '▼';
        var label = icon + ' ' + signed(trend.slopePer30Days, 1) + '/30d';
        var cls = trend.degrading ? 'trend-degrading' : (trend.improving ? 'trend-improving' : 'trend-flat');
        return '<span class="trend-badge ' + cls + '">' + label + '</span>';
    }

    function tooltip(trend) {
        if (!trend || trend.samples < 2) return 'Complexity trend: not enough history';
        return 'Complexity ' + signed(trend.slopePer30Days, 1) + ' per 30 days' +
            ' · Δ ' + signed(trend.delta, 0) +
            ' · R² ' + trend.r2.toFixed(2) +
            ' · ' + trend.samples + ' changes' +
            (trend.degrading ? ' · degrading' : (trend.improving ? ' · improving' : ''));
    }

    window.AuraTrendUI = {
        getTrends: getTrends,
        sparklineHTML: sparklineHTML,
        badgeHTML: badgeHTML,
        tooltip: tooltip,
        color: color,
        threshold: threshold,
    };
})();
