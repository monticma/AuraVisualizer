/**
 * timeline.js — Time Travel: commit timeline (sliders, tooltips, progress),
 * history deltas, compare mode and the impact cascade overlay.
 *
 * Extracted from app.js (Lot 2a). Same pattern as views/warps/panels/chat:
 * IIFE + window.AuraTimeline + init(hooks). The diff sets are stable references
 * exposed through state(); the app.js render accessors read them via ttState().
 */
(function () {
    'use strict';

    var hooks = {};
    var $ = function (sel) { return document.querySelector(sel); };

    // ---- State (moved from app.js) ----
    var timelineCommits = [];       // all commits, newest first
    var timelineDeltas = {};        // hash → CommitDelta
    var timelinePosition = -1;     // -1 = HEAD (current), 0 = newest commit, N = older
    var timelineScannedCount = 0;
    var timelineTotalCount = 0;
    var timelineActive = false;     // true when navigating history
    var timelineChangedNodes = new Set(); // union of add/remove/modify (for impact mode compat)
    var timelineAddedNodes = new Set();   // files added at current commit (green)
    var timelineRemovedNodes = new Set(); // files removed at current commit (red)
    var timelineModifiedNodes = new Set(); // files modified at current commit (yellow)
    var timelineAddedLinks = new Set();   // link keys added at current commit
    var timelineRemovedLinks = new Set(); // link keys removed at current commit
    var impactMode = false; // true when showing impact cascade from timeline changed nodes
    var timelineCompareMode = false;  // dual-slider compare
    var timelineFromPos = 0;          // "from" slider position in compare mode
    var timelineSavedToPos = -1;      // saved "to" slider position when leaving compare mode
    var timelineSavedFromPos = -1;    // saved "from" slider position when leaving compare mode

    // ---- DOM ----
    var timelineBar = $('#timeline-bar');
    var timelineSlider = $('#timeline-slider');
    var timelinePrevBtn = $('#timeline-prev');
    var timelineNextBtn = $('#timeline-next');
    var timelineImpactBtn = $('#timeline-impact');
    var timelineCompareBtn = $('#timeline-compare');
    var timelineFromSlider = $('#timeline-from-slider');
    var timelineFromPrevBtn = $('#timeline-from-prev');
    var timelineFromNextBtn = $('#timeline-from-next');
    var timelineFromControls = $('#timeline-from-controls');

    // Shared snapshot for the app.js render accessors. The sets are stable
    // references (mutated in place); the flags are refreshed by syncState().
    var timelineState = {
        active: false,
        compareMode: false,
        impactMode: false,
        changed: timelineChangedNodes,
        addedNodes: timelineAddedNodes,
        removedNodes: timelineRemovedNodes,
        modifiedNodes: timelineModifiedNodes,
        addedLinks: timelineAddedLinks,
        removedLinks: timelineRemovedLinks
    };
    function syncState() {
        timelineState.active = timelineActive;
        timelineState.compareMode = timelineCompareMode;
        timelineState.impactMode = impactMode;
    }

    // ============================================================
    // Timeline navigation
    // ============================================================
    function setupTimeline() {
        if (!timelineSlider || !timelinePrevBtn || !timelineNextBtn) return;

        // Update tooltip while dragging, navigate only on release
        timelineSlider.addEventListener('input', function() {
            // In compare mode, clamp blue (to) slider to not go before orange (from)
            if (timelineCompareMode && timelineFromSlider) {
                var curTo = parseInt(timelineSlider.value);
                var curFrom = parseInt(timelineFromSlider.value);
                if (curTo < curFrom) timelineSlider.value = curFrom;
            }
            updateTimelineLabel();
        });
        timelineSlider.addEventListener('change', function() {
            if (timelineCompareMode && timelineFromSlider) {
                var curTo = parseInt(timelineSlider.value);
                var curFrom = parseInt(timelineFromSlider.value);
                if (curTo < curFrom) timelineSlider.value = curFrom;
            }
            var pos = parseInt(timelineSlider.value);
            navigateToCommit(pos);
        });

        timelinePrevBtn.addEventListener('click', function() {
            var pos = parseInt(timelineSlider.value);
            var minPos = (timelineCompareMode && timelineFromSlider) ? parseInt(timelineFromSlider.value) : 0;
            if (pos > minPos) {
                timelineSlider.value = pos - 1;
                navigateToCommit(pos - 1);
            }
        });

        timelineNextBtn.addEventListener('click', function() {
            var pos = parseInt(timelineSlider.value);
            var max = parseInt(timelineSlider.max);
            if (pos < max) {
                timelineSlider.value = pos + 1;
                navigateToCommit(pos + 1);
            }
        });

        if (timelineImpactBtn) {
            timelineImpactBtn.addEventListener('click', function() {
                toggleImpactMode();
            });
        }

        // Compare mode button
        if (timelineCompareBtn) {
            timelineCompareBtn.addEventListener('click', function() {
                toggleCompareMode();
            });
        }

        // From-slider (compare mode)
        if (timelineFromSlider) {
            // Update tooltip while dragging, navigate only on release
            timelineFromSlider.addEventListener('input', function() {
                // Clamp orange (from) slider to not go after blue (to)
                var curFrom = parseInt(timelineFromSlider.value);
                var curTo = parseInt(timelineSlider.value);
                if (curFrom > curTo) timelineFromSlider.value = curTo;
                timelineFromPos = parseInt(timelineFromSlider.value);
                updateTimelineLabel();
            });
            timelineFromSlider.addEventListener('change', function() {
                var curFrom = parseInt(timelineFromSlider.value);
                var curTo = parseInt(timelineSlider.value);
                if (curFrom > curTo) timelineFromSlider.value = curTo;
                timelineFromPos = parseInt(timelineFromSlider.value);
                var toPos = parseInt(timelineSlider.value);
                navigateToCommit(toPos);
            });
        }

        // From-slider prev/next buttons (compare mode)
        if (timelineFromPrevBtn) {
            timelineFromPrevBtn.addEventListener('click', function() {
                if (!timelineFromSlider) return;
                var pos = parseInt(timelineFromSlider.value);
                if (pos > 0) {
                    timelineFromSlider.value = pos - 1;
                    timelineFromPos = pos - 1;
                    var toPos = parseInt(timelineSlider.value);
                    navigateToCommit(toPos);
                }
            });
        }
        if (timelineFromNextBtn) {
            timelineFromNextBtn.addEventListener('click', function() {
                if (!timelineFromSlider) return;
                var pos = parseInt(timelineFromSlider.value);
                var toPos = parseInt(timelineSlider.value);
                // Don't go past blue slider
                if (pos < toPos) {
                    timelineFromSlider.value = pos + 1;
                    timelineFromPos = pos + 1;
                    navigateToCommit(toPos);
                }
            });
        }

        // Timeline slider hover tooltip
        var sliderTip = document.createElement('div');
        sliderTip.id = 'timeline-slider-tip';
        sliderTip.className = 'hidden';
        document.body.appendChild(sliderTip);

        // Attach tooltip to the wrapper so it works on the full track, not just the thumb
        var sliderWrap = $('#timeline-slider-wrap') || timelineSlider.parentElement;
        function showSliderTip(e) {
            if (timelineCommits.length === 0) return;
            var rect = sliderWrap.getBoundingClientRect();
            var ratio = (e.clientX - rect.left) / rect.width;
            ratio = Math.max(0, Math.min(1, ratio));
            var maxPos = parseInt(timelineSlider.max);
            var pos = Math.round(ratio * maxPos);
            if (pos >= maxPos) {
                sliderTip.textContent = 'HEAD — Current state';
            } else {
                var commitIdx = (maxPos - 1) - pos;
                if (commitIdx >= 0 && commitIdx < timelineCommits.length) {
                    var c = timelineCommits[commitIdx];
                    var d = new Date(c.date);
                    sliderTip.textContent = d.toLocaleDateString() + ' — ' + c.message;
                } else {
                    sliderTip.textContent = '';
                }
            }
            sliderTip.classList.remove('hidden');
            var tipX = e.clientX - sliderTip.offsetWidth / 2;
            tipX = Math.max(4, Math.min(tipX, window.innerWidth - sliderTip.offsetWidth - 4));
            sliderTip.style.left = tipX + 'px';
            sliderTip.style.top = (rect.top - 32) + 'px';
        }
        sliderWrap.addEventListener('mousemove', showSliderTip);
        sliderWrap.addEventListener('mouseleave', function() {
            sliderTip.classList.add('hidden');
        });
    }

    function handleHistoryIndex(index) {
        timelineCommits = index.commits || [];
        timelineTotalCount = index.totalCommits || 0;
        timelineScannedCount = index.scannedCommits || 0;

        hooks.computeChurnIndex();
        if (hooks.getGraphData()) {
            hooks.computeMetricRanges();
            hooks.renderRiskDashboard();
            if (hooks.getHeatmapMode() === 'churn') hooks.refreshGraphColors();
        }

        if (timelineCommits.length === 0) return;

        // Show timeline bar (only if on graph tab)
        if (hooks.getActiveTab() !== 'graph') {
            timelineBar._wasVisible = true;
        } else {
            timelineBar.classList.remove('hidden');
        }
        document.body.classList.add('has-timeline');

        // Slider: 0 = oldest scanned, max = HEAD (current state)
        // We add +1 to max because the last position is HEAD (not a commit)
        var maxPos = timelineScannedCount;
        timelineSlider.min = 0;
        timelineSlider.max = maxPos;
        timelineSlider.value = maxPos; // start at HEAD
        timelinePosition = -1;

        // Sync from-slider
        if (timelineFromSlider) {
            timelineFromSlider.min = 0;
            timelineFromSlider.max = maxPos;
            timelineFromSlider.value = maxPos;
        }

        updateTimelineLabel();
        updateTimelineButtons();
        updateTimelineProgress();
    }

    function handleHistoryProgress(progress) {
        timelineScannedCount = progress.scanned;
        timelineTotalCount = progress.total;

        // Expand slider range as more commits are scanned
        var maxPos = timelineScannedCount;
        var currentVal = parseInt(timelineSlider.value);
        var wasAtHead = currentVal === parseInt(timelineSlider.max);
        timelineSlider.max = maxPos;
        if (wasAtHead) {
            timelineSlider.value = maxPos;
        }

        // Sync from-slider range
        if (timelineFromSlider) {
            var fromWasAtHead = parseInt(timelineFromSlider.value) === parseInt(timelineFromSlider.max);
            timelineFromSlider.max = maxPos;
            if (fromWasAtHead) {
                timelineFromSlider.value = maxPos;
            }
        }

        updateTimelineButtons();
        updateTimelineProgress();
    }

    function handleHistoryDelta(delta) {
        // Store the delta keyed by hash
        timelineDeltas[delta.hash] = delta;
        if (window.AuraViews) window.AuraViews.invalidateTimelineSnapshots(); // invalidate timeline chart cache
        updateTimelineButtons();
    }

    function navigateToCommit(sliderPos) {
        var maxPos = parseInt(timelineSlider.max);

        if (sliderPos >= maxPos) {
            // In compare mode, HEAD is a valid "to" target — compute diff from fromPos to HEAD
            if (timelineCompareMode && timelineFromPos < maxPos) {
                timelinePosition = -1;
                timelineActive = true;
                // First compute the diff sets (before restoring, so they survive the refresh)
                computeCompareDiff(timelineFromPos, maxPos);
                // Now restore HEAD graph visuals (but don't clear diff sets)
                if (hooks.getHeadGraphData() && hooks.getGraph()) {
                    restoreHeadGraphKeepDiff();
                }
                if (impactMode) computeTimelineImpact();
                updateTimelineLabel();
                updateTimelineButtons();
                return;
            }
            // Back to HEAD (no compare)
            timelinePosition = -1;
            timelineActive = false;
            timelineChangedNodes.clear();
            timelineAddedNodes.clear();
            timelineRemovedNodes.clear();
            timelineModifiedNodes.clear();
            timelineAddedLinks.clear();
            timelineRemovedLinks.clear();
            // Clear impact mode
            if (impactMode) {
                impactMode = false;
                if (timelineImpactBtn) timelineImpactBtn.classList.remove('active');
                hooks.clearPinnedFocus();
            }
            // Restore HEAD graph
            if (hooks.getHeadGraphData() && hooks.getGraph()) {
                restoreHeadGraph();
            }
            updateTimelineLabel();
            updateTimelineButtons();
            return;
        }

        // sliderPos: 0 = oldest scanned commit, maxPos-1 = newest commit
        // commits array is newest first, so we need to reverse the index
        var commitIdx = (maxPos - 1) - sliderPos;
        if (commitIdx < 0 || commitIdx >= timelineCommits.length) return;

        var commit = timelineCommits[commitIdx];
        if (!commit) return;

        var delta = timelineDeltas[commit.hash];
        if (!delta) {
            // Delta not yet scanned — can't navigate here
            updateTimelineLabel();
            updateTimelineButtons();
            return;
        }

        timelinePosition = commitIdx;
        timelineActive = true;

        // Apply the cumulative state up to this commit
        applyCumulativeState(commitIdx);

        // Re-compute impact cascade if impact mode is active
        if (impactMode) {
            computeTimelineImpact();
        }

        updateTimelineLabel();
        updateTimelineButtons();
    }

    function applyCumulativeState(targetCommitIdx) {
        if (!hooks.getHeadGraphData() || !hooks.getGraph()) return;

        // Start from HEAD graph and apply deltas backward
        // We need to reconstruct the graph at targetCommitIdx
        // by knowing what changed between HEAD and that commit.

        // Strategy: collect all files that were added/removed/modified
        // between HEAD and the target commit
        var removedAtTarget = new Set();   // files that don't exist at target (added after target)
        var addedAtTarget = new Set();     // files re-added at target (removed after target)
        var modifiedState = {};            // file id → DeltaNodeState at closest commit

        // Walk from newest commit (index 0) to targetCommitIdx
        // Each delta tells us what changed IN that commit (going forward in time)
        // Going backward: "added" in a commit means the file didn't exist before → remove it
        //                 "removed" in a commit means the file existed before → add it back
        //                 "modified" in a commit means the file was different before → use the delta state
        for (var i = 0; i <= targetCommitIdx; i++) {
            var commit = timelineCommits[i];
            var delta = timelineDeltas[commit.hash];
            if (!delta) continue;

            // Files added in this commit didn't exist before this commit
            // Since we're going backward, these should be removed
            for (var a = 0; a < delta.added.length; a++) {
                removedAtTarget.add(delta.added[a]);
                addedAtTarget.delete(delta.added[a]);
            }

            // Files removed in this commit existed before this commit
            // Since we're going backward, these should be present
            for (var r = 0; r < delta.removed.length; r++) {
                addedAtTarget.add(delta.removed[r]);
                removedAtTarget.delete(delta.removed[r]);
            }

            // Modified files: store their state at this commit
            // The delta contains the state AT this commit
            var modKeys = Object.keys(delta.modified);
            for (var m = 0; m < modKeys.length; m++) {
                modifiedState[modKeys[m]] = delta.modified[modKeys[m]];
            }
        }

        // Now build the new node/link set
        // Start from HEAD nodes
        var newNodes = [];
        var newLinks = [];
        var nodeIds = new Set();
        timelineChangedNodes.clear();
        timelineAddedNodes.clear();
        timelineRemovedNodes.clear();
        timelineModifiedNodes.clear();
        timelineAddedLinks.clear();
        timelineRemovedLinks.clear();

        // Keep HEAD nodes that aren't removed at target
        for (var ni = 0; ni < hooks.getHeadGraphData().nodes.length; ni++) {
            var headNode = hooks.getHeadGraphData().nodes[ni];
            if (removedAtTarget.has(headNode.id)) continue;

            // Check if this node was modified — apply the older state
            var mod = modifiedState[headNode.id];
            var graphNode = findNodeInGraph(headNode.id);
            var node;
            if (graphNode) {
                // Reuse the 3d node to preserve position
                node = graphNode;
            } else {
                node = Object.assign({}, headNode);
            }

            if (mod) {
                node.linesOfCode = mod.linesOfCode;
                node.complexity = mod.complexity;
                if (mod.symbols) node.symbols = mod.symbols;
                if (!timelineCompareMode) timelineChangedNodes.add(node.id);
            }
            nodeIds.add(node.id);
            newNodes.push(node);
        }

        // Grab the delta(s) to build colored diff sets
        // In compare mode, collect all deltas between fromIdx and targetIdx
        // In normal mode, just use the current commit's delta
        var diffStartIdx, diffEndIdx;
        if (timelineCompareMode) {
            var maxPos = parseInt(timelineSlider.max);
            var fromIdx = (maxPos - 1) - timelineFromPos;
            diffStartIdx = Math.min(fromIdx, targetCommitIdx);
            diffEndIdx = Math.max(fromIdx, targetCommitIdx);
        } else {
            diffStartIdx = targetCommitIdx;
            diffEndIdx = targetCommitIdx;
        }

        for (var di = diffStartIdx; di <= diffEndIdx; di++) {
            var diffCommit = timelineCommits[di];
            if (!diffCommit) continue;
            var diffDelta = timelineDeltas[diffCommit.hash];
            if (!diffDelta) continue;

            for (var ca = 0; ca < diffDelta.added.length; ca++) {
                var addedId = diffDelta.added[ca];
                timelineChangedNodes.add(addedId);
                timelineAddedNodes.add(addedId);
                timelineRemovedNodes.delete(addedId);
            }
            for (var cr = 0; cr < diffDelta.removed.length; cr++) {
                var removedId = diffDelta.removed[cr];
                timelineChangedNodes.add(removedId);
                timelineRemovedNodes.add(removedId);
                timelineAddedNodes.delete(removedId);
            }
            var cmk = Object.keys(diffDelta.modified);
            for (var cm = 0; cm < cmk.length; cm++) {
                var modId = cmk[cm];
                timelineChangedNodes.add(modId);
                if (!timelineAddedNodes.has(modId) && !timelineRemovedNodes.has(modId)) {
                    timelineModifiedNodes.add(modId);
                }
            }
        }

        // Build HEAD link key set for diff comparison
        var headLinkKeys = new Set();
        for (var hli = 0; hli < hooks.getHeadGraphData().links.length; hli++) {
            var hl = hooks.getHeadGraphData().links[hli];
            var hSrc = typeof hl.source === 'object' ? hl.source.id : hl.source;
            var hTgt = typeof hl.target === 'object' ? hl.target.id : hl.target;
            headLinkKeys.add(hSrc + '>' + hTgt);
        }

        // Rebuild links from HEAD links + modified state
        var newLinkKeys = new Set();
        for (var li = 0; li < hooks.getHeadGraphData().links.length; li++) {
            var headLink = hooks.getHeadGraphData().links[li];
            var srcId = typeof headLink.source === 'object' ? headLink.source.id : headLink.source;
            var tgtId = typeof headLink.target === 'object' ? headLink.target.id : headLink.target;
            if (nodeIds.has(srcId) && nodeIds.has(tgtId)) {
                // In compare mode, skip links unless both endpoints are changed
                if (timelineCompareMode && timelineChangedNodes.size > 0 &&
                    !(timelineChangedNodes.has(srcId) && timelineChangedNodes.has(tgtId))) {
                    newLinkKeys.add(srcId + '>' + tgtId);
                    continue;
                }
                newLinks.push({ source: srcId, target: tgtId, type: headLink.type, label: headLink.label || '', confidence: headLink.confidence });
                newLinkKeys.add(srcId + '>' + tgtId);
            }
        }

        // Add links from modified states (for files whose imports changed)
        for (var modFile in modifiedState) {
            if (!nodeIds.has(modFile)) continue;
            var state = modifiedState[modFile];
            if (state.linksOut) {
                for (var lo = 0; lo < state.linksOut.length; lo++) {
                    var linkOut = state.linksOut[lo];
                    if (nodeIds.has(linkOut.target)) {
                        var lKey = modFile + '>' + linkOut.target;
                        // Check if this link already exists
                        if (!newLinkKeys.has(lKey)) {
                            newLinkKeys.add(lKey);
                            // In compare mode, skip links unless both endpoints are changed
                            if (timelineCompareMode && timelineChangedNodes.size > 0 &&
                                !(timelineChangedNodes.has(modFile) && timelineChangedNodes.has(linkOut.target))) {
                                continue;
                            }
                            newLinks.push({
                                source: modFile,
                                target: linkOut.target,
                                type: linkOut.type,
                                label: '',
                                confidence: linkOut.confidence
                            });
                            // This link exists at target commit but not at HEAD → added
                            if (!headLinkKeys.has(lKey)) {
                                timelineAddedLinks.add(lKey);
                            }
                        }
                    }
                }
            }
        }

        // Links in HEAD but not in target graph → removed
        headLinkKeys.forEach(function(hk) {
            if (!newLinkKeys.has(hk)) {
                timelineRemovedLinks.add(hk);
            }
        });

        // Pin existing nodes so the layout doesn't restart
        for (var pi = 0; pi < newNodes.length; pi++) {
            var pn = newNodes[pi];
            if (pn.x !== undefined) { pn.fx = pn.x; pn.fy = pn.y; pn.fz = pn.z; }
        }

        // Update the graph — freeze simulation to prevent layout drift.
        // Feed through filterGraphData: timeline navigation must respect the
        // language/directory filters (disabled file types stay hidden).
        newLinks = filterLinksForCompare(newNodes, newLinks);
        hooks.getGraphData().nodes = newNodes;
        hooks.getGraphData().links = newLinks;
        hooks.getGraphData().meta.totalFiles = newNodes.length;
        hooks.getGraphData().meta.totalLinks = newLinks.length;

        var savedCooldown = hooks.getGraph().cooldownTicks();
        hooks.getGraph().cooldownTicks(0);
        hooks.getGraph().graphData(hooks.filterGraphData({ nodes: newNodes, links: newLinks }));
        hooks.getGraph().cooldownTicks(savedCooldown);
        hooks.refreshGraphVisuals();
    }

    // Filter links for compare mode: only keep links where both endpoints
    // are truly visible changed nodes (exist in nodes array AND are colored)
    function filterLinksForCompare(nodes, links) {
        if (!timelineCompareMode || timelineChangedNodes.size === 0) return links;
        var visibleIds = new Set();
        for (var i = 0; i < nodes.length; i++) {
            var nid = nodes[i].id;
            if (timelineAddedNodes.has(nid) || timelineRemovedNodes.has(nid) || timelineModifiedNodes.has(nid)) {
                visibleIds.add(nid);
            }
        }
        var filtered = [];
        for (var j = 0; j < links.length; j++) {
            var src = typeof links[j].source === 'object' ? links[j].source.id : links[j].source;
            var tgt = typeof links[j].target === 'object' ? links[j].target.id : links[j].target;
            if (visibleIds.has(src) && visibleIds.has(tgt)) {
                filtered.push(links[j]);
            }
        }
        return filtered;
    }

    function restoreHeadGraph() {
        if (!hooks.getHeadGraphData() || !hooks.getGraph()) return;

        // Restore nodes (preserve positions for existing nodes)
        var newNodes = [];
        for (var i = 0; i < hooks.getHeadGraphData().nodes.length; i++) {
            var headNode = hooks.getHeadGraphData().nodes[i];
            var existing = findNodeInGraph(headNode.id);
            if (existing) {
                // Restore HEAD properties but keep position
                existing.linesOfCode = headNode.linesOfCode;
                existing.complexity = headNode.complexity;
                existing.symbols = headNode.symbols;
                existing.fanIn = headNode.fanIn;
                existing.fanOut = headNode.fanOut;
                existing.deadExports = headNode.deadExports;
                existing.cycleIds = headNode.cycleIds;
                newNodes.push(existing);
            } else {
                newNodes.push(Object.assign({}, headNode));
            }
        }

        // Deep-copy links (source/target may have been mutated to objects)
        var restoredLinks = [];
        for (var rl = 0; rl < hooks.getHeadGraphData().links.length; rl++) {
            var hl = hooks.getHeadGraphData().links[rl];
            restoredLinks.push({
                source: typeof hl.source === 'object' ? hl.source.id : hl.source,
                target: typeof hl.target === 'object' ? hl.target.id : hl.target,
                type: hl.type, label: hl.label || '', confidence: hl.confidence
            });
        }

        // Pin nodes
        for (var rp = 0; rp < newNodes.length; rp++) {
            var rn = newNodes[rp];
            if (rn.x !== undefined) { rn.fx = rn.x; rn.fy = rn.y; rn.fz = rn.z; }
        }

        hooks.getGraphData().nodes = newNodes;
        hooks.getGraphData().links = restoredLinks;
        hooks.getGraphData().meta = JSON.parse(JSON.stringify(hooks.getHeadGraphData().meta));

        // Respect the active language/directory filters when restoring HEAD
        hooks.getGraph().graphData(hooks.filterGraphData({ nodes: newNodes, links: restoredLinks }));
        timelineChangedNodes.clear();
        timelineAddedNodes.clear();
        timelineRemovedNodes.clear();
        timelineModifiedNodes.clear();
        timelineAddedLinks.clear();
        timelineRemovedLinks.clear();
        hooks.refreshGraphVisuals();

        // Unpin to let simulation settle (back to normal view)
        setTimeout(function() {
            var d = hooks.getGraph().graphData();
            for (var ui = 0; ui < d.nodes.length; ui++) {
                delete d.nodes[ui].fx; delete d.nodes[ui].fy; delete d.nodes[ui].fz;
            }
        }, 200);
    }

    // Like restoreHeadGraph but preserves the timeline diff sets (for compare mode at HEAD)
    function restoreHeadGraphKeepDiff() {
        if (!hooks.getHeadGraphData() || !hooks.getGraph()) return;

        var newNodes = [];
        for (var i = 0; i < hooks.getHeadGraphData().nodes.length; i++) {
            var headNode = hooks.getHeadGraphData().nodes[i];
            var existing = findNodeInGraph(headNode.id);
            if (existing) {
                existing.linesOfCode = headNode.linesOfCode;
                existing.complexity = headNode.complexity;
                existing.symbols = headNode.symbols;
                existing.fanIn = headNode.fanIn;
                existing.fanOut = headNode.fanOut;
                existing.deadExports = headNode.deadExports;
                existing.cycleIds = headNode.cycleIds;
                newNodes.push(existing);
            } else {
                newNodes.push(Object.assign({}, headNode));
            }
        }

        var restoredLinks = [];
        for (var rl = 0; rl < hooks.getHeadGraphData().links.length; rl++) {
            var hl = hooks.getHeadGraphData().links[rl];
            var rlSrc = typeof hl.source === 'object' ? hl.source.id : hl.source;
            var rlTgt = typeof hl.target === 'object' ? hl.target.id : hl.target;
            // In compare mode, only include links where both endpoints are changed
            if (timelineCompareMode && timelineChangedNodes.size > 0 &&
                !(timelineChangedNodes.has(rlSrc) && timelineChangedNodes.has(rlTgt))) continue;
            restoredLinks.push({
                source: rlSrc, target: rlTgt,
                type: hl.type, label: hl.label || '', confidence: hl.confidence
            });
        }

        for (var rp = 0; rp < newNodes.length; rp++) {
            var rn = newNodes[rp];
            if (rn.x !== undefined) { rn.fx = rn.x; rn.fy = rn.y; rn.fz = rn.z; }
        }

        restoredLinks = filterLinksForCompare(newNodes, restoredLinks);

        hooks.getGraphData().nodes = newNodes;
        hooks.getGraphData().links = restoredLinks;
        hooks.getGraphData().meta = JSON.parse(JSON.stringify(hooks.getHeadGraphData().meta));

        var savedCooldown2 = hooks.getGraph().cooldownTicks();
        hooks.getGraph().cooldownTicks(0);
        hooks.getGraph().graphData(hooks.filterGraphData({ nodes: newNodes, links: restoredLinks }));
        hooks.getGraph().cooldownTicks(savedCooldown2);
        // Do NOT clear diff sets — they are pre-computed by computeCompareDiff
        hooks.refreshGraphVisuals();
    }

    function findNodeInGraph(id) {
        if (!hooks.getGraph()) return null;
        var data = hooks.getGraph().graphData();
        for (var i = 0; i < data.nodes.length; i++) {
            if (data.nodes[i].id === id) return data.nodes[i];
        }
        return null;
    }

    // Compute diff sets between two slider positions without rebuilding the graph
    // Used when "to" is HEAD — the graph is already at HEAD, we just color the diffs
    function computeCompareDiff(fromPos, toPos) {
        var maxPos = parseInt(timelineSlider.max);
        timelineChangedNodes.clear();
        timelineAddedNodes.clear();
        timelineRemovedNodes.clear();
        timelineModifiedNodes.clear();
        timelineAddedLinks.clear();
        timelineRemovedLinks.clear();

        // Convert slider positions to commit indexes
        // Walk deltas from the "from" commit to the "to" commit
        var startIdx = Math.min((maxPos - 1) - fromPos, (maxPos - 1) - toPos);
        var endIdx = Math.max((maxPos - 1) - fromPos, (maxPos - 1) - toPos);
        if (startIdx < 0) startIdx = 0;

        for (var di = startIdx; di <= endIdx; di++) {
            var diffCommit = timelineCommits[di];
            if (!diffCommit) continue;
            var diffDelta = timelineDeltas[diffCommit.hash];
            if (!diffDelta) continue;

            for (var ca = 0; ca < diffDelta.added.length; ca++) {
                var addedId = diffDelta.added[ca];
                timelineChangedNodes.add(addedId);
                timelineAddedNodes.add(addedId);
                timelineRemovedNodes.delete(addedId);
            }
            for (var cr = 0; cr < diffDelta.removed.length; cr++) {
                var removedId = diffDelta.removed[cr];
                timelineChangedNodes.add(removedId);
                timelineRemovedNodes.add(removedId);
                timelineAddedNodes.delete(removedId);
            }
            var cmk = Object.keys(diffDelta.modified);
            for (var cm = 0; cm < cmk.length; cm++) {
                var modId = cmk[cm];
                timelineChangedNodes.add(modId);
                if (!timelineAddedNodes.has(modId) && !timelineRemovedNodes.has(modId)) {
                    timelineModifiedNodes.add(modId);
                }
            }
        }

        hooks.refreshGraphVisuals();
    }

    function updateTimelineLabel() {
        syncState();
        var maxPos = parseInt(timelineSlider.max);
        var pos = parseInt(timelineSlider.value);

        if (timelineCompareMode) {
            // Show "from → to" in compare mode
            var fromPos = parseInt(timelineFromSlider.value);
            var fromLabel, toLabel;

            if (fromPos >= maxPos) {
                fromLabel = 'HEAD';
            } else {
                var fromIdx = (maxPos - 1) - fromPos;
                fromLabel = (fromIdx >= 0 && fromIdx < timelineCommits.length)
                    ? timelineCommits[fromIdx].hash.substring(0, 7) : '?';
            }

            if (pos >= maxPos) {
                toLabel = 'HEAD';
            } else {
                var toIdx = (maxPos - 1) - pos;
                toLabel = (toIdx >= 0 && toIdx < timelineCommits.length)
                    ? timelineCommits[toIdx].hash.substring(0, 7) : '?';
            }

            $('#timeline-hash').textContent = fromLabel + ' → ' + toLabel;
            var diffCount = timelineAddedNodes.size + timelineRemovedNodes.size + timelineModifiedNodes.size;
            $('#timeline-message').textContent = diffCount > 0
                ? '+' + timelineAddedNodes.size + ' / −' + timelineRemovedNodes.size + ' / ~' + timelineModifiedNodes.size
                : 'No changes';
            $('#timeline-date').textContent = '';
            return;
        }

        if (pos >= maxPos) {
            // HEAD
            $('#timeline-hash').textContent = 'HEAD';
            $('#timeline-message').textContent = 'Current state';
            $('#timeline-date').textContent = '';
        } else {
            var commitIdx = (maxPos - 1) - pos;
            if (commitIdx >= 0 && commitIdx < timelineCommits.length) {
                var commit = timelineCommits[commitIdx];
                $('#timeline-hash').textContent = commit.hash.substring(0, 7);
                var diffSummary = '';
                if (timelineActive && timelineChangedNodes.size > 0) {
                    diffSummary = ' (+' + timelineAddedNodes.size + ' −' + timelineRemovedNodes.size + ' ~' + timelineModifiedNodes.size + ')';
                }
                $('#timeline-message').textContent = commit.message + diffSummary;
                var d = new Date(commit.date);
                $('#timeline-date').textContent = d.toLocaleDateString();
            }
        }
    }

    function updateTimelineButtons() {
        syncState();
        var pos = parseInt(timelineSlider.value);
        var max = parseInt(timelineSlider.max);

        // Can go back (prev) if not at 0 and the target has a delta
        var canPrev = pos > 0;
        if (canPrev) {
            var prevCommitIdx = (max - 1) - (pos - 1);
            if (prevCommitIdx >= 0 && prevCommitIdx < timelineCommits.length) {
                var prevHash = timelineCommits[prevCommitIdx].hash;
                if (!timelineDeltas[prevHash]) canPrev = false;
            }
        }
        timelinePrevBtn.disabled = !canPrev;

        // Can always go forward (next) as long as not at max
        timelineNextBtn.disabled = pos >= max;
    }

    function updateTimelineProgress() {
        var progressEl = $('#timeline-progress');
        var textEl = $('#timeline-progress-text');
        if (timelineScannedCount < timelineTotalCount) {
            progressEl.classList.remove('hidden');
            textEl.textContent = '⏳ ' + timelineScannedCount + '/' + timelineTotalCount;
        } else {
            progressEl.classList.add('hidden');
        }
    }

    // ============================================================
    // Impact mode — multi-source blast radius from timeline changed nodes
    // (the blast state lives in app.js: startMultiNodeBlast seeds it)
    // ============================================================
    function computeTimelineImpact() {
        if (!timelineActive || timelineChangedNodes.size === 0 || !hooks.getGraph()) {
            var wasImpact = impactMode;
            impactMode = false;
            hooks.clearPinnedFocus();
            if (timelineImpactBtn) timelineImpactBtn.classList.remove('active');
            hooks.refreshFocusVisuals(wasImpact);
            return;
        }
        hooks.startMultiNodeBlast(Array.from(timelineChangedNodes));
    }

    function toggleImpactMode() {
        if (!timelineActive || timelineChangedNodes.size === 0) return;
        impactMode = !impactMode;
        if (timelineImpactBtn) timelineImpactBtn.classList.toggle('active', impactMode);
        syncState();
        if (impactMode) {
            computeTimelineImpact();
        } else {
            hooks.clearPinnedFocus();
            hooks.refreshFocusVisuals(true); // removing the impact glow needs a rebuild
        }
    }

    function toggleCompareMode() {
        timelineCompareMode = !timelineCompareMode;
        if (timelineCompareBtn) timelineCompareBtn.classList.toggle('active', timelineCompareMode);
        if (timelineFromSlider) {
            if (timelineCompareMode) {
                // Show the from-slider; restore saved positions if available
                timelineFromSlider.min = timelineSlider.min;
                timelineFromSlider.max = timelineSlider.max;
                if (timelineSavedFromPos >= 0 && timelineSavedToPos >= 0) {
                    timelineFromSlider.value = timelineSavedFromPos;
                    timelineFromPos = timelineSavedFromPos;
                    timelineSlider.value = timelineSavedToPos;
                } else {
                    timelineFromSlider.value = timelineSlider.value;
                    timelineFromPos = parseInt(timelineSlider.value);
                }
                timelineFromSlider.classList.remove('hidden');
                if (timelineFromControls) timelineFromControls.classList.remove('hidden');
                // Navigate to show the diff immediately
                var toPos = parseInt(timelineSlider.value);
                navigateToCommit(toPos);
            } else {
                // Save positions before hiding
                timelineSavedFromPos = parseInt(timelineFromSlider.value);
                timelineSavedToPos = parseInt(timelineSlider.value);
                timelineFromSlider.classList.add('hidden');
                if (timelineFromControls) timelineFromControls.classList.add('hidden');
                // Refresh to single-commit mode
                var pos = parseInt(timelineSlider.value);
                navigateToCommit(pos);
            }
        }
        updateTimelineLabel();
    }

    // ============================================================
    // Public API
    // ============================================================
    window.AuraTimeline = {
        init: function (h) { hooks = h || {}; },
        setup: setupTimeline,
        handleHistoryIndex: handleHistoryIndex,
        handleHistoryProgress: handleHistoryProgress,
        handleHistoryDelta: handleHistoryDelta,
        state: function () { return timelineState; },
        isActive: function () { return timelineActive; },
        getCommits: function () { return timelineCommits; },
        getDeltas: function () { return timelineDeltas; },
        getScannedCount: function () { return timelineScannedCount; },
        toggleImpact: function () { toggleImpactMode(); },
        toggleCompare: function () {
            if (!timelineBar || timelineBar.classList.contains('hidden')) return;
            toggleCompareMode();
        },
        refreshImpact: function () { if (impactMode) computeTimelineImpact(); },
        clearImpact: function () {
            if (!impactMode) return;
            impactMode = false;
            if (timelineImpactBtn) timelineImpactBtn.classList.remove('active');
            syncState();
        },
        resetToHead: function () {
            if (!timelineActive) return;
            restoreHeadGraph();
            timelineSlider.value = timelineSlider.max;
            timelinePosition = parseInt(timelineSlider.max);
            updateTimelineLabel();
            updateTimelineButtons();
        },
        stepPrev: function () {
            if (timelineCommits.length === 0 || timelinePrevBtn.disabled) return false;
            timelinePrevBtn.click();
            return true;
        },
        stepNext: function () {
            if (timelineCommits.length === 0 || timelineNextBtn.disabled) return false;
            timelineNextBtn.click();
            return true;
        }
    };
})();
