/**
 * export-menu.js — one Export entry per view.
 *
 * Each view registers what it can produce; the menu renders whatever the active
 * view registered, under the button that opens it. What we had before was the
 * opposite: a button per format, in whichever bar happened to be free — three
 * styles, and six tabs with no way to get anything out.
 *
 * The menu is a plain DOM popover positioned from the button's rect: no library,
 * no state beyond "is it open", and Esc / outside-click close it.
 */
(function () {
    'use strict';

    /** tab → [{ label, hint, run }] */
    var registry = {};
    var menu = null;
    var anchor = null;

    function register(tab, entries) {
        if (!tab || !entries || entries.length === 0) return;
        registry[tab] = entries;
    }

    function entriesFor(tab) {
        return registry[tab] || [];
    }

    function close() {
        if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
        menu = null;
        anchor = null;
        document.removeEventListener('mousedown', onDocMouseDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
    }

    function onDocMouseDown(event) {
        if (menu && !menu.contains(event.target) && event.target !== anchor) close();
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') close();
    }

    function open(btn, tab) {
        // The same button closes what it opened.
        if (anchor === btn) { close(); return; }
        close();
        var entries = entriesFor(tab);
        if (entries.length === 0) return;

        anchor = btn;
        menu = document.createElement('div');
        menu.className = 'view-export-menu';
        menu.setAttribute('role', 'menu');
        var html = '';
        for (var i = 0; i < entries.length; i++) {
            html += '<button type="button" class="view-export-item" role="menuitem"'
                + ' data-export-entry="' + i + '">'
                + '<span class="view-export-label">' + entries[i].label + '</span>'
                + (entries[i].hint
                    ? '<span class="view-export-hint">' + entries[i].hint + '</span>'
                    : '')
                + '</button>';
        }
        menu.innerHTML = html;
        menu.addEventListener('click', function (event) {
            var item = event.target && event.target.closest
                ? event.target.closest('[data-export-entry]')
                : null;
            if (!item) return;
            var entry = entries[Number(item.getAttribute('data-export-entry'))];
            close();
            if (entry && typeof entry.run === 'function') entry.run();
        });

        // Under the button, right-aligned to it: these live at the right edge of
        // their bar, and the window is the only stable frame of reference.
        var rect = btn.getBoundingClientRect();
        menu.style.top = Math.round(rect.bottom + 6) + 'px';
        menu.style.right = Math.round(Math.max(8, window.innerWidth - rect.right)) + 'px';
        document.body.appendChild(menu);

        // Defer the listeners: the click that opened the menu is still bubbling.
        setTimeout(function () {
            document.addEventListener('mousedown', onDocMouseDown, true);
            document.addEventListener('keydown', onKeyDown, true);
        }, 0);
    }

    /**
     * Wire the menu buttons by delegation: the City inspector is re-rendered on
     * every selection, so a direct binding would be lost on the first click.
     */
    function wireAttribute(attribute, opener) {
        document.addEventListener('click', function (event) {
            var btn = event.target && event.target.closest
                ? event.target.closest('[' + attribute + ']')
                : null;
            if (!btn) return;
            event.stopPropagation();
            opener(btn, btn.getAttribute(attribute));
        });
    }

    function setup() {
        wireAttribute('data-export-tab', open);
    }

    window.AuraExportMenu = {
        init: setup,
        register: register,
        entriesFor: entriesFor,
        open: open,
        close: close,
        isOpen: function () { return !!menu; },
    };

    // ============================================================
    // "Open in…" — the same popover, but the entries are computed when it
    // opens: they depend on what is selected right now.
    // ============================================================
    var openInProviders = {};

    /**
     * Register a provider for one view: `register('city', function () { return
     * [{ label, hint, run }]; })`. Returning an empty list means "nothing to
     * offer" and the menu simply does not open.
     */
    function registerOpenIn(tab, provider) {
        if (!tab || typeof provider !== 'function') return;
        openInProviders[tab] = provider;
    }

    function openInEntries(tab) {
        var provider = openInProviders[tab];
        if (typeof provider !== 'function') return [];
        try { return provider() || []; } catch (_) { return []; }
    }

    function openInMenu(btn, tab) {
        var entries = openInEntries(tab);
        if (!entries.length) return;
        if (anchor === btn) { close(); return; }
        close();
        // Reuse the export renderer with an explicit list.
        anchor = btn;
        menu = document.createElement('div');
        menu.className = 'view-export-menu';
        menu.setAttribute('role', 'menu');
        var html = '';
        for (var i = 0; i < entries.length; i++) {
            html += '<button type="button" class="view-export-item" role="menuitem"'
                + ' data-export-entry="' + i + '">'
                + '<span class="view-export-label">' + entries[i].label + '</span>'
                + (entries[i].hint
                    ? '<span class="view-export-hint">' + entries[i].hint + '</span>'
                    : '')
                + '</button>';
        }
        menu.innerHTML = html;
        menu.addEventListener('click', function (event) {
            var item = event.target && event.target.closest
                ? event.target.closest('[data-export-entry]')
                : null;
            if (!item) return;
            var entry = entries[Number(item.getAttribute('data-export-entry'))];
            close();
            if (entry && typeof entry.run === 'function') entry.run();
        });
        var rect = btn.getBoundingClientRect();
        menu.style.top = Math.round(rect.bottom + 6) + 'px';
        menu.style.right = Math.round(Math.max(8, window.innerWidth - rect.right)) + 'px';
        document.body.appendChild(menu);
        setTimeout(function () {
            document.addEventListener('mousedown', onDocMouseDown, true);
            document.addEventListener('keydown', onKeyDown, true);
        }, 0);
    }

    window.AuraOpenIn = {
        init: function () { wireAttribute('data-open-in-tab', openInMenu); },
        register: registerOpenIn,
        entriesFor: openInEntries,
        open: openInMenu,
        close: close,
        isOpen: function () { return !!menu; },
    };
})();
