/**
 * flow.js — Function flowchart viewer (2D SVG modal).
 *
 * Renders the control-flow tree produced by src/flow/flow-core.ts (built
 * on-demand in the analyzer worker) with a structure-aware layout — no graph
 * layout engine needed: a sequence stacks vertically, an `if` forks into two
 * labelled columns that re-join, loops get a frame + back edge, switch cases
 * become labelled columns, try/catch/finally stack as framed blocks.
 *
 * Interactions: click a step → open the file at its line; click a call chip →
 * drill into the callee (resolved against the graph symbols) with a
 * breadcrumb; export the current view as a standalone SVG file.
 *
 * Hooks are injected by app.js (init) so this module owns no VS Code API.
 */
(function () {
    'use strict';

    var hooks = { request: null, openFile: null, findFunction: null };
    var modal = null, bodyEl = null, crumbsEl = null, badgeEl = null;
    var current = null;      // displayed flow request { fileId, line, language, name }
    var pending = null;      // request in flight
    var crumbs = [];         // drill-down history
    var lastFlow = null;     // last rendered FunctionFlow

    var NS = 'http://www.w3.org/2000/svg';
    var PAD = 18, VGAP = 26, HGAP = 26, FRAME_PAD = 14;
    var W_STEP = 230, W_COND = 200, W_JUMP = 210;
    var LINE_H = 15, CHAR_W = 6.1, MAX_LINES = 6, PAD_V = 9;

    var COLORS = {
        step:   { fill: '#1c2128', stroke: '#3d444d' },
        cond:   { fill: '#122c44', stroke: '#1f6feb' },
        loop:   { fill: '#241a38', stroke: '#a371f7' },
        sw:     { fill: '#123035', stroke: '#39c5cf' },
        jump:   { fill: '#2d1a22', stroke: '#f778ba' },
        try:    { fill: '#0e2a1e', stroke: '#3fb950' },
        catch:  { fill: '#2d2412', stroke: '#d29922' },
        finally:{ fill: '#12233f', stroke: '#58a6ff' },
        pass:   { fill: 'none', stroke: '#3d444d' },
        dead:   { fill: '#1c1214', stroke: '#f85149' },
        text:   '#c9d1d9',
        edge:   '#8b949e',
        chip:   '#58a6ff'
    };

    // ============================================================
    // Text wrapping (plain SVG tspans — no foreignObject, so the
    // exported file renders everywhere)
    // ============================================================

    function wrapText(text, widthPx, maxLines) {
        var maxChars = Math.max(10, Math.floor((widthPx - 20) / CHAR_W));
        var words = String(text || '').split(' ');
        var lines = [];
        var cur = '';
        for (var i = 0; i < words.length; i++) {
            var w = words[i];
            while (w.length > maxChars) { // hard-split long tokens
                if (cur) { lines.push(cur); cur = ''; }
                lines.push(w.slice(0, maxChars));
                w = w.slice(maxChars);
            }
            if (cur && (cur.length + 1 + w.length) > maxChars) {
                lines.push(cur);
                cur = w;
            } else {
                cur = cur ? cur + ' ' + w : w;
            }
        }
        if (cur) lines.push(cur);
        if (!lines.length) lines.push('');
        if (lines.length > maxLines) {
            lines = lines.slice(0, maxLines);
            lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + '…';
        }
        return lines;
    }

    function textHeight(lines) {
        return lines.length * LINE_H + PAD_V * 2;
    }

    // ============================================================
    // Layout — every layout() returns a block:
    // { w, h, items[], edges[], entrance{x,y}, exit{x,y} }
    // items: boxes to draw; edges: { points:[{x,y}…], dashed, label }
    // ============================================================

    function shift(block, dx, dy) {
        for (var i = 0; i < block.items.length; i++) {
            block.items[i].x += dx;
            block.items[i].y += dy;
            if (block.items[i].chips) {
                for (var c = 0; c < block.items[i].chips.length; c++) {
                    block.items[i].chips[c].x += dx;
                    block.items[i].chips[c].y += dy;
                }
            }
        }
        for (var e = 0; e < block.edges.length; e++) {
            var pts = block.edges[e].points;
            for (var p = 0; p < pts.length; p++) { pts[p].x += dx; pts[p].y += dy; }
        }
        block.entrance.x += dx; block.entrance.y += dy;
        block.exit.x += dx; block.exit.y += dy;
        return block;
    }

    function edge(a, b, opts) {
        var e = { points: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] };
        if (opts) { e.dashed = opts.dashed; e.label = opts.label; }
        return e;
    }

    function ghostBlock(label) {
        var w = 64, h = 22;
        return {
            w: w, h: h,
            items: [{ kind: 'pass', x: 0, y: 0, w: w, h: h, lines: [label || '∅'] }],
            edges: [],
            entrance: { x: w / 2, y: 0 },
            exit: { x: w / 2, y: h }
        };
    }

    function box(kind, x, y, w, lines, node) {
        var h = textHeight(lines);
        var item = { kind: kind, x: x, y: y, w: w, h: h, lines: lines, node: node };
        return item;
    }

    function layoutSequence(nodes) {
        nodes = nodes || [];
        if (!nodes.length) return ghostBlock('—');
        var blocks = [];
        for (var i = 0; i < nodes.length; i++) blocks.push(layoutNode(nodes[i]));

        var w = 0;
        for (var b = 0; b < blocks.length; b++) w = Math.max(w, blocks[b].w);

        var items = [], edges = [];
        var y = 0, prev = null;
        for (var k = 0; k < blocks.length; k++) {
            var block = blocks[k];
            shift(block, (w - block.w) / 2, y);
            if (prev) edges.push(edge(prev, block.entrance));
            items = items.concat(block.items);
            edges = edges.concat(block.edges);
            prev = block.exit;
            y += block.h + VGAP;
        }
        var first = blocks[0], last = blocks[blocks.length - 1];
        return {
            w: w, h: y - VGAP, items: items, edges: edges,
            entrance: { x: first.entrance.x, y: 0 },
            exit: { x: last.exit.x, y: y - VGAP }
        };
    }

    function layoutNode(n) {
        switch (n.kind) {
            case 'step': return layoutSimple(n, n.text, W_STEP, 'step');
            case 'jump': return layoutSimple(n, n.text, W_JUMP, 'jump');
            case 'if': return layoutIf(n);
            case 'loop': return layoutLoop(n);
            case 'switch': return layoutSwitch(n);
            case 'try': return layoutTry(n);
            default: return layoutSimple(n, n.text || n.kind, W_STEP, 'step');
        }
    }

    function layoutSimple(n, text, width, kind) {
        var lines = wrapText(text, width);
        var item = box(n.dead ? 'dead' : kind, 0, 0, width, lines, n);
        var h = item.h;
        var chips = [];
        if (n.calls && n.calls.length) {
            var cx = 0;
            for (var i = 0; i < n.calls.length && i < 4; i++) {
                var label = n.calls[i] + '()';
                var cw = label.length * CHAR_W;
                chips.push({ name: n.calls[i], label: label, x: cx, y: 0, w: cw });
                cx += cw + 14;
            }
            if (cx > width - 16) chips = chips.slice(0, Math.max(1, chips.length - 1));
            h += 18;
        }
        item.h = h;
        if (chips.length) {
            var total = chips[chips.length - 1].x + chips[chips.length - 1].w;
            var startX = (width - total) / 2;
            for (var c = 0; c < chips.length; c++) {
                chips[c].x += startX;
                chips[c].y = h - 8;
            }
            item.chips = chips;
        }
        return { w: width, h: h, items: [item], edges: [], entrance: { x: width / 2, y: 0 }, exit: { x: width / 2, y: h } };
    }

    function layoutIf(n) {
        var condLines = wrapText('? ' + n.cond, W_COND);
        var cond = box(n.dead ? 'dead' : 'cond', 0, 0, W_COND, condLines, n);
        var thenB = layoutSequence(n.then);
        var elseB = n.else && n.else.length ? layoutSequence(n.else) : ghostBlock('no');
        var branchW = Math.max(thenB.w, elseB.w);
        var totalW = Math.max(W_COND, branchW * 2 + HGAP);
        var condX = (totalW - W_COND) / 2;
        cond.x = condX;

        var branchY = cond.h + VGAP;
        var col0 = (totalW - (branchW * 2 + HGAP)) / 2;
        shift(thenB, col0 + (branchW - thenB.w) / 2, branchY);
        shift(elseB, col0 + branchW + HGAP + (branchW - elseB.w) / 2, branchY);
        var branchH = Math.max(thenB.h, elseB.h);
        var joinY = branchY + branchH + VGAP;
        var cx = totalW / 2;

        var edges = [
            edge({ x: condX + W_COND / 2, y: cond.h }, thenB.entrance, { label: 'T' }),
            edge({ x: condX + W_COND / 2, y: cond.h }, elseB.entrance, { label: 'F', dashed: !(n.else && n.else.length) }),
            edge(thenB.exit, { x: cx, y: joinY }),
            edge(elseB.exit, { x: cx, y: joinY })
        ];
        return {
            w: totalW, h: joinY,
            items: [cond].concat(thenB.items, elseB.items),
            edges: edges.concat(thenB.edges, elseB.edges),
            entrance: { x: cx, y: 0 },
            exit: { x: cx, y: joinY }
        };
    }

    function layoutLoop(n) {
        var headerLines = wrapText(n.loopType + ' ' + (n.header || ''), W_COND);
        var header = box(n.dead ? 'dead' : 'loop', 0, 0, W_COND, headerLines, n);
        var bodyB = layoutSequence(n.body);

        var frameW = bodyB.w + FRAME_PAD * 2;
        var totalW = Math.max(header.w, frameW);
        header.x = (totalW - header.w) / 2;
        var frameY = header.h + VGAP;
        var frameH = bodyB.h + FRAME_PAD * 2;
        shift(bodyB, (totalW - frameW) / 2 + FRAME_PAD, frameY + FRAME_PAD);

        var frameItem = { kind: 'frame', x: (totalW - frameW) / 2, y: frameY, w: frameW, h: frameH, lines: [] };

        // Back edge: frame bottom-left → out left → up → into the header's left side
        var backX = frameItem.x - 14;
        var backEdge = {
            points: [
                { x: frameItem.x + 8, y: frameY + frameH },
                { x: backX, y: frameY + frameH },
                { x: backX, y: header.h / 2 },
                { x: header.x, y: header.h / 2 }
            ],
            dashed: false,
            label: 'loop'
        };

        var exitX = totalW / 2;
        return {
            w: totalW, h: frameY + frameH,
            items: [frameItem, header].concat(bodyB.items),
            edges: [
                edge({ x: header.x + header.w / 2, y: header.h }, bodyB.entrance),
                edge(bodyB.exit, { x: exitX, y: frameY + frameH })
            ].concat(bodyB.edges, [backEdge]),
            entrance: { x: header.x + header.w / 2, y: 0 },
            exit: { x: exitX, y: frameY + frameH }
        };
    }

    function layoutSwitch(n) {
        var exprLines = wrapText('switch ' + n.expr, W_COND);
        var expr = box(n.dead ? 'dead' : 'sw', 0, 0, W_COND, exprLines, n);

        var columns = [];
        var cases = n.cases || [];
        for (var i = 0; i < cases.length; i++) {
            var c = cases[i];
            var labelLines = wrapText((c.label === 'default' ? 'default:' : 'case ' + c.label + ':'), 160);
            var labelBox = box('sw', 0, 0, 160, labelLines, { kind: 'step', line: c.line, text: 'case ' + c.label });
            var bodyB = c.body && c.body.length ? layoutSequence(c.body) : ghostBlock('—');
            var colW = Math.max(labelBox.w, bodyB.w);
            labelBox.x = (colW - labelBox.w) / 2;
            shift(bodyB, (colW - bodyB.w) / 2, labelBox.h + VGAP);
            columns.push({ w: colW, labelBox: labelBox, bodyB: bodyB, caseNode: c });
        }
        if (!columns.length) columns.push({ w: 80, labelBox: box('sw', 0, 0, 80, ['—'], null), bodyB: ghostBlock('—'), caseNode: null });

        var totalColsW = 0;
        for (var k = 0; k < columns.length; k++) totalColsW += columns[k].w;
        totalColsW += HGAP * (columns.length - 1);
        var totalW = Math.max(W_COND, totalColsW + 40);
        var colsX = (totalW - totalColsW) / 2;
        expr.x = (totalW - W_COND) / 2;

        var items = [expr], edges = [];
        var branchY = expr.h + VGAP;
        var maxColH = 0;
        var cursorX = colsX;
        var colData = [];
        for (var q = 0; q < columns.length; q++) {
            var column = columns[q];
            var bodyY = branchY + column.labelBox.h + VGAP;
            // centre the block (entrance = top centre) inside its column
            shift(column.bodyB, cursorX + column.w / 2 - column.bodyB.entrance.x, bodyY - column.bodyB.entrance.y);
            column.labelBox.x = cursorX + (column.w - column.labelBox.w) / 2;
            column.labelBox.y = branchY;
            colData.push({
                labelBox: column.labelBox,
                bodyB: column.bodyB,
                cursorX: cursorX + column.w / 2
            });
            maxColH = Math.max(maxColH, column.labelBox.h + VGAP + column.bodyB.h);
            cursorX += column.w + HGAP;
        }

        var joinY = branchY + maxColH + VGAP;
        var cx = totalW / 2;
        for (var d = 0; d < colData.length; d++) {
            var data = colData[d];
            edges.push(edge({ x: expr.x + W_COND / 2, y: expr.h }, { x: data.cursorX, y: branchY }));
            edges.push(edge({ x: data.labelBox.x + data.labelBox.w / 2, y: branchY + data.labelBox.h }, data.bodyB.entrance));
            edges.push(edge(data.bodyB.exit, { x: cx, y: joinY }));
            items.push(data.labelBox);
            for (var it = 0; it < data.bodyB.items.length; it++) items.push(data.bodyB.items[it]);
            for (var ed = 0; ed < data.bodyB.edges.length; ed++) edges.push(data.bodyB.edges[ed]);
        }

        return {
            w: totalW, h: joinY, items: items, edges: edges,
            entrance: { x: cx, y: 0 },
            exit: { x: cx, y: joinY }
        };
    }

    function layoutTry(n) {
        var sections = [];
        sections.push({ kind: 'try', label: 'try', block: layoutSequence(n.body) });
        var catches = n.catches || [];
        for (var i = 0; i < catches.length; i++) {
            var label = catches[i].param ? 'catch (' + catches[i].param + ')' : 'catch';
            sections.push({ kind: 'catch', label: label, block: layoutSequence(catches[i].body), line: catches[i].line });
        }
        if (n.finally && n.finally.length) {
            sections.push({ kind: 'finally', label: 'finally', block: layoutSequence(n.finally) });
        }

        var width = 0;
        for (var s = 0; s < sections.length; s++) {
            width = Math.max(width, sections[s].block.w + FRAME_PAD * 2 + 8, 200);
        }

        var items = [], edges = [];
        var y = 0, prevExit = null, prevKind = null;
        for (var k = 0; k < sections.length; k++) {
            var sec = sections[k];
            var labelLines = wrapText(sec.label, 160);
            var labelBox = box(sec.kind, 0, 0, 160, labelLines, sec.line ? { kind: 'step', line: sec.line, text: sec.label } : null);
            var frameX = (width - (sec.block.w + FRAME_PAD * 2)) / 2;
            var frameY = y;
            labelBox.x = frameX + 6;
            labelBox.y = y - 10; // label floats on the frame's top edge
            var bodyY = frameY + 12;
            shift(sec.block, frameX + FRAME_PAD, bodyY);
            var frameH = bodyY - frameY + sec.block.h + FRAME_PAD;
            items.push({ kind: 'frame-' + sec.kind, x: frameX, y: frameY, w: sec.block.w + FRAME_PAD * 2, h: frameH, lines: [] });
            items.push(labelBox);
            items = items.concat(sec.block.items);
            edges = edges.concat(sec.block.edges);

            if (prevExit) {
                edges.push(edge(prevExit, { x: sec.block.entrance.x, y: frameY }, { dashed: sec.kind === 'catch', label: sec.kind === 'catch' ? 'throw' : undefined }));
            }
            prevExit = { x: sec.block.exit.x, y: frameY + frameH };
            prevKind = sec.kind;
            y = frameY + frameH + VGAP;
        }

        var totalH = y - VGAP;
        return {
            w: width, h: totalH, items: items, edges: edges,
            entrance: { x: sections[0].block.entrance.x, y: 0 },
            exit: { x: width / 2, y: totalH }
        };
    }

    // ============================================================
    // SVG rendering (presentation attributes only — the exported
    // file must render standalone)
    // ============================================================

    function el(name, attrs) {
        var node = document.createElementNS(NS, name);
        if (attrs) {
            for (var k in attrs) {
                if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
            }
        }
        return node;
    }

    function colorsFor(kind) {
        if (kind === 'dead') return COLORS.dead;
        if (kind.indexOf('frame') === 0) {
            var frameKind = kind === 'frame-try' ? 'try' : (kind === 'frame-catch' ? 'catch' : (kind === 'frame-finally' ? 'finally' : 'step'));
            return COLORS[frameKind];
        }
        return COLORS[kind] || COLORS.step;
    }

    function render(flow, req) {
        bodyEl.innerHTML = '';
        if (!flow) {
            var msg = document.createElement('div');
            msg.className = 'flow-empty';
            msg.textContent = 'No flowchart available for this function (unsupported language, or the function could not be located).';
            bodyEl.appendChild(msg);
            if (badgeEl) badgeEl.textContent = '—';
            return;
        }
        lastFlow = flow;

        var block = layoutSequence(flow.nodes);
        if (!block.items.length) block = ghostBlock('(empty)');
        var svgW = Math.max(block.w + PAD * 2, 440);
        var svgH = Math.max(block.h + PAD * 2, 180);
        shift(block, PAD, PAD);

        var svg = el('svg', { width: svgW, height: svgH, viewBox: '0 0 ' + svgW + ' ' + svgH, 'font-family': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' });
        var defs = el('defs');
        var marker = el('marker', { id: 'flow-arrow', viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
        marker.appendChild(el('path', { d: 'M0,0 L8,4 L0,8 z', fill: COLORS.edge }));
        defs.appendChild(marker);
        svg.appendChild(defs);

        // Frames first (background), then edges, then boxes
        var i, item;
        for (i = 0; i < block.items.length; i++) {
            item = block.items[i];
            if (item.kind.indexOf('frame') !== 0) continue;
            var fc = colorsFor(item.kind);
            svg.appendChild(el('rect', {
                x: item.x, y: item.y, width: item.w, height: item.h, rx: 10,
                fill: 'none', stroke: fc.stroke, 'stroke-dasharray': '5 3', 'stroke-opacity': '0.65'
            }));
        }

        for (i = 0; i < block.edges.length; i++) {
            var e = block.edges[i];
            var ptStr = e.points.map(function (p) { return p.x + ',' + p.y; }).join(' ');
            svg.appendChild(el('polyline', {
                points: ptStr, fill: 'none', stroke: COLORS.edge, 'stroke-width': '1.4',
                'marker-end': 'url(#flow-arrow)',
                'stroke-dasharray': e.dashed ? '4 3' : undefined
            }));
            if (e.label) {
                var mid = e.points[Math.floor(e.points.length / 2)];
                var prev = e.points[Math.max(0, Math.floor(e.points.length / 2) - 1)];
                var lx = (mid.x + prev.x) / 2 + 6;
                var ly = (mid.y + prev.y) / 2 - 4;
                svg.appendChild(el('text', { x: lx, y: ly, fill: COLORS.edge, 'font-size': '10' })).textContent = e.label;
            }
        }

        for (i = 0; i < block.items.length; i++) {
            item = block.items[i];
            if (item.kind.indexOf('frame') === 0) continue;
            var c = colorsFor(item.kind);
            var hasLine = item.node && typeof item.node.line === 'number';
            var g = el('g', hasLine ? { cursor: 'pointer' } : undefined);

            var rect = el('rect', {
                x: item.x, y: item.y, width: item.w, height: item.h,
                rx: item.kind === 'jump' ? item.h / 2 : (item.kind === 'cond' ? 12 : 7),
                fill: c.fill, stroke: c.stroke, 'stroke-width': '1.3',
                'stroke-dasharray': item.kind === 'dead' ? '4 3' : undefined
            });
            g.appendChild(rect);

            var tx = item.x + item.w / 2;
            var ty = item.y + PAD_V + 11;
            var text = el('text', {
                x: tx, y: ty, 'text-anchor': 'middle', 'font-size': '11.5',
                fill: COLORS.text, 'fill-opacity': item.kind === 'dead' ? '0.55' : '1'
            });
            for (var l = 0; l < item.lines.length; l++) {
                var tspan = el('tspan', { x: tx, dy: l === 0 ? 0 : LINE_H });
                tspan.textContent = item.lines[l];
                text.appendChild(tspan);
            }
            g.appendChild(text);

            if (item.chips) {
                for (var ch = 0; ch < item.chips.length; ch++) {
                    var chip = item.chips[ch];
                    var chipText = el('text', {
                        x: chip.x, y: chip.y, 'font-size': '10.5', fill: COLORS.chip,
                        'text-decoration': 'underline', cursor: 'pointer'
                    });
                    chipText.textContent = '↳ ' + chip.label;
                    (function (name) {
                        chipText.addEventListener('click', function (ev) {
                            ev.stopPropagation();
                            drill(name);
                        });
                    })(chip.name);
                    g.appendChild(chipText);
                }
            }

            if (item.node && item.node.text) {
                var title = el('title');
                title.textContent = (item.node.line ? 'L' + item.node.line + ' — ' : '') + item.node.text;
                g.appendChild(title);
            }
            if (hasLine) {
                (function (line) {
                    g.addEventListener('click', function () {
                        if (hooks.openFile && current) hooks.openFile(current.fileId, line);
                    });
                })(item.node.line);
            }
            svg.appendChild(g);
        }

        bodyEl.appendChild(svg);
        if (badgeEl) {
            var badge = 'complexity ' + flow.decisions;
            if (flow.metrics) {
                badge = 'cognitive ' + flow.metrics.cognitive +
                    ' · MI ' + Math.round(flow.metrics.maintainability) +
                    ' · decisions ' + flow.decisions;
            }
            var cycle = symbolCycleFor(req && req.fileId, req && req.name);
            if (cycle) {
                badge += cycle.kind === 'recursive' ? ' · 🔁 recursive' : ' · 🔁 mutual recursion';
                if (cycle.ambiguous) badge += ' (ambiguous)';
                badgeEl.title = symbolCycleChain(cycle);
            } else {
                badgeEl.title = '';
            }
            if (flow.truncated) badge += ' · truncated';
            badgeEl.textContent = badge;
        }
    }

    function symbolCycleFor(fileId, name) {
        if (!fileId || !name || !hooks.getSymbolCycles) return null;
        var cycles = hooks.getSymbolCycles() || [];
        for (var i = 0; i < cycles.length; i++) {
            var nodes = cycles[i].nodes || [];
            for (var j = 0; j < nodes.length; j++) {
                if (nodes[j].file === fileId && nodes[j].name === name) return cycles[i];
            }
        }
        return null;
    }

    function symbolCycleChain(cycle) {
        var nodes = (cycle && cycle.nodes) || [];
        if (!nodes.length) return '';
        var names = nodes.map(function (n) { return n.name + '()'; });
        names.push(names[0]);
        return (cycle.kind === 'recursive' ? 'Recursive: ' : 'Mutual recursion: ') + names.join(' → ');
    }

    // ============================================================
    // Modal plumbing
    // ============================================================

    function setup() {
        modal = document.getElementById('flow-modal');
        bodyEl = document.getElementById('flow-body');
        crumbsEl = document.getElementById('flow-crumbs');
        badgeEl = document.getElementById('flow-badge');
        if (!modal || !bodyEl) return;

        var closeBtn = document.getElementById('flow-modal-close');
        closeBtn && closeBtn.addEventListener('click', close);
        var exportBtn = document.getElementById('flow-export');
        exportBtn && exportBtn.addEventListener('click', exportSvg);

        // Drag by header
        var header = modal.querySelector('.flow-modal-header');
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
                modal.classList.add('dragging');
                e.preventDefault();
            });
            document.addEventListener('mousemove', function (e) {
                if (!dragging) return;
                var x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - 80));
                var y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - 50));
                modal.style.left = x + 'px';
                modal.style.top = y + 'px';
            });
            document.addEventListener('mouseup', function () {
                if (!dragging) return;
                dragging = false;
                modal.classList.remove('dragging');
            });
        }

        // Resize handles — edges (n/s/e/w) + bottom corners (se/sw)
        var RESIZE_DIRS = ['n', 's', 'e', 'w', 'se', 'sw'];
        var MIN_W = 340, MIN_H = 220, MARGIN = 8;
        RESIZE_DIRS.forEach(function (dir) {
            var handle = document.createElement('div');
            handle.className = 'flow-resize-handle ' + dir;
            handle.title = 'Resize';
            handle.addEventListener('mousedown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var rect = modal.getBoundingClientRect();
                // Normalize placement: drop the translate centering, lock to px.
                modal.style.left = rect.left + 'px';
                modal.style.top = rect.top + 'px';
                modal.style.transform = 'none';
                modal.style.width = rect.width + 'px';
                modal.style.height = rect.height + 'px';
                modal.classList.add('dragging');
                var startLeft = rect.left, startTop = rect.top;
                var right = rect.left + rect.width, bottom = rect.top + rect.height;
                document.body.style.cursor = getComputedStyle(handle).cursor;
                var rafId = 0, lastEv = null;

                function apply() {
                    rafId = 0;
                    var ev = lastEv;
                    if (!ev) return;
                    var w = rect.width, h = rect.height, left = startLeft, top = startTop;
                    if (dir.indexOf('e') >= 0) w = Math.max(MIN_W, Math.min(ev.clientX - left, window.innerWidth - left - MARGIN));
                    if (dir.indexOf('s') >= 0) h = Math.max(MIN_H, Math.min(ev.clientY - top, window.innerHeight - top - MARGIN));
                    if (dir.indexOf('w') >= 0) { left = Math.max(MARGIN, Math.min(ev.clientX, right - MIN_W)); w = right - left; }
                    if (dir.indexOf('n') >= 0) { top = Math.max(MARGIN, Math.min(ev.clientY, bottom - MIN_H)); h = bottom - top; }
                    modal.style.width = w + 'px';
                    modal.style.height = h + 'px';
                    if (dir.indexOf('w') >= 0) modal.style.left = left + 'px';
                    if (dir.indexOf('n') >= 0) modal.style.top = top + 'px';
                }
                function onMove(ev) {
                    lastEv = ev;
                    if (!rafId) rafId = requestAnimationFrame(apply);
                }
                function onUp() {
                    if (rafId) { cancelAnimationFrame(rafId); apply(); }
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    document.body.style.cursor = '';
                    modal.classList.remove('dragging');
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            modal.appendChild(handle);
        });

        // Keep the modal on screen when the panel is resized (only once the
        // user has pinned it — before that, CSS centering does the job).
        window.addEventListener('resize', function () {
            if (!modal || modal.classList.contains('hidden') || !modal.style.left) return;
            var rect = modal.getBoundingClientRect();
            var w = Math.min(rect.width, window.innerWidth - MARGIN * 2);
            var h = Math.min(rect.height, window.innerHeight - MARGIN * 2);
            var left = Math.min(Math.max(MARGIN, rect.left), Math.max(MARGIN, window.innerWidth - w - MARGIN));
            var top = Math.min(Math.max(MARGIN, rect.top), Math.max(MARGIN, window.innerHeight - h - MARGIN));
            modal.style.transform = 'none';
            modal.style.left = left + 'px';
            modal.style.top = top + 'px';
            if (modal.style.width) modal.style.width = Math.max(MIN_W, w) + 'px';
            if (modal.style.height) modal.style.height = Math.max(MIN_H, h) + 'px';
        });

        // Esc closes the flowchart first (capture so Aura's global reset doesn't fire)
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                e.preventDefault();
                e.stopPropagation();
                close();
            }
        }, true);
    }

    function show() {
        if (modal) modal.classList.remove('hidden');
    }

    function close() {
        if (modal) modal.classList.add('hidden');
        pending = null;
        current = null;
        crumbs = [];
        lastFlow = null;
    }

    function updateCrumbs() {
        if (!crumbsEl || !current) return;
        var trail = crumbs.map(function (c) { return c.name; });
        trail.push(current.name);
        crumbsEl.textContent = '⑂ ' + trail.join(' › ');
        crumbsEl.title = current.fileId + ' (L' + current.line + ')';
    }

    /**
     * Open the flowchart of a function.
     * @param {string} fileId   workspace-relative file id (node id)
     * @param {number} line     1-based line of the function
     * @param {string} language node language ('c-source', 'typescript', …)
     * @param {string} name     display name (breadcrumb)
     */
    function open(fileId, line, language, name) {
        crumbs = [];
        request({ fileId: fileId, line: line, language: language, name: name });
    }

    function drill(name) {
        if (!hooks.findFunction || !current) return;
        var target = hooks.findFunction(name);
        if (!target) return; // callee not found in the project — ignore
        crumbs.push({ fileId: current.fileId, line: current.line, language: current.language, name: current.name });
        request({ fileId: target.fileId, line: target.line, language: target.language, name: name });
    }

    function request(req) {
        pending = req;
        current = req;
        show();
        updateCrumbs();
        if (badgeEl) badgeEl.textContent = '…';
        bodyEl.innerHTML = '<div class="flow-empty">Loading flowchart…</div>';
        if (hooks.request) hooks.request({ fileId: req.fileId, line: req.line, language: req.language });
    }

    /** Response from the host (app.js forwards the flowData message). */
    function receive(payload) {
        if (!payload || !pending) return;
        if (payload.fileId !== pending.fileId || payload.line !== pending.line) return; // stale
        pending = null;
        render(payload.flow || null, current);
    }

    function exportSvg() {
        var svg = bodyEl && bodyEl.querySelector('svg');
        if (!svg || !current) return;
        var clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', NS);
        var data = new XMLSerializer().serializeToString(clone);
        var blob = new Blob([data], { type: 'image/svg+xml' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (current.name || 'flow') + '.svg';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            URL.revokeObjectURL(url);
            a.remove();
        }, 800);
    }

    function init(injectedHooks) {
        hooks = injectedHooks || hooks;
        setup();
    }

    window.AuraFlowView = {
        init: init,
        open: open,
        receive: receive,
        close: close
    };
})();
