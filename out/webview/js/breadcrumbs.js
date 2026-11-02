/**
 * breadcrumbs.js — Navigation trail overlay (V3-12).
 *
 * Owns the DOM of the trail and the current pile; the pile itself (cap, dedupe,
 * back/truncate) lives in the pure `breadcrumb-core` bundle
 * (`window.AuraBreadcrumbCore`). Restoring a place is the host app's job: it is
 * passed in through `setup({ onRestore })`.
 *
 * The bar stays hidden until there are at least two places, so it never costs
 * screen space during a straight-line session.
 */
(function () {
    'use strict';

    var hooks = {};
    var stack = [];

    function core() {
        return window.AuraBreadcrumbCore || null;
    }

    function ui() {
        return {
            bar: document.getElementById('breadcrumb-bar'),
            trail: document.getElementById('breadcrumb-trail'),
            back: document.getElementById('breadcrumb-back'),
            clear: document.getElementById('breadcrumb-clear')
        };
    }

    function chip(entry, index, isCurrent) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'breadcrumb-chip' + (isCurrent ? ' current' : '');
        button.setAttribute('data-index', String(index));
        var c = core();
        button.title = c ? c.entryTooltip(entry) : String(entry.label || '');
        if (entry.icon) {
            var icon = document.createElement('span');
            icon.className = 'breadcrumb-icon';
            icon.textContent = entry.icon;
            button.appendChild(icon);
        }
        var label = document.createElement('span');
        label.className = 'breadcrumb-label';
        label.textContent = String(entry.label || '');
        button.appendChild(label);
        button.addEventListener('click', function () {
            goTo(index);
        });
        return button;
    }

    function render() {
        var el = ui();
        if (!el.trail) return;
        el.trail.innerHTML = '';
        for (var i = 0; i < stack.length; i++) {
            el.trail.appendChild(chip(stack[i], i, i === stack.length - 1));
        }
        if (el.bar) el.bar.classList.toggle('hidden', stack.length < 2);
        if (el.back) el.back.disabled = stack.length < 2;
        if (el.clear) el.clear.disabled = stack.length === 0;
    }

    /** Restore the place at `index` and forget everything after it. */
    function goTo(index) {
        var c = core();
        if (!c) return false;
        if (!Number.isInteger(index) || index < 0 || index >= stack.length) return false;
        if (index === stack.length - 1) return false;   // already there
        stack = c.truncateTo(stack, index);
        render();
        var entry = stack[stack.length - 1];
        if (entry && typeof hooks.onRestore === 'function') hooks.onRestore(entry);
        return true;
    }

    /** Push a place (the core handles the cap and the duplicate filter). */
    function push(entry) {
        var c = core();
        if (!c || !entry) return stack.length;
        stack = c.pushEntry(stack, entry);
        render();
        return stack.length;
    }

    /** Step back to the previous place. */
    function back() {
        var c = core();
        if (!c) return false;
        var result = c.back(stack);
        if (!result.entry) return false;
        stack = result.stack;
        render();
        if (typeof hooks.onRestore === 'function') hooks.onRestore(result.entry);
        return true;
    }

    function clear() {
        stack = [];
        render();
    }

    function setup(h) {
        hooks = h || {};
        var el = ui();
        if (el.back) {
            el.back.addEventListener('click', function () {
                back();
                el.back.blur();
            });
        }
        if (el.clear) {
            el.clear.addEventListener('click', function () {
                clear();
                el.clear.blur();
            });
        }
        render();
    }

    window.AuraBreadcrumbs = {
        setup: setup,
        push: push,
        back: back,
        clear: clear,
        goTo: goTo,
        render: render,
        stack: function () { return stack.slice(); },
        size: function () { return stack.length; }
    };
})();
