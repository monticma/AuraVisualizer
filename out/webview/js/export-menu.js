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

    /**
     * Build the popover DOM for `entries` and assign it to `menu`. Every caller
     * (Export, Open in…, right-click) renders the same list, so they share this
     * one body — three copies of the markup was already two too many.
     */
    function buildMenu(entries) {
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
        return menu;
    }

    /** Mount the menu and arm the dismissal listeners (one tick later). */
    function mountMenu() {
        document.body.appendChild(menu);
        // Defer the listeners: the click that opened the menu is still bubbling.
        setTimeout(function () {
            document.addEventListener('mousedown', onDocMouseDown, true);
            document.addEventListener('keydown', onKeyDown, true);
        }, 0);
    }

    function open(btn, tab) {
        // The same button closes what it opened.
        if (anchor === btn) { close(); return; }
        close();
        var entries = entriesFor(tab);
        if (entries.length === 0) return;

        anchor = btn;
        var el = buildMenu(entries);

        // Under the button, right-aligned to it: these live at the right edge of
        // their bar, and the window is the only stable frame of reference.
        var rect = btn.getBoundingClientRect();
        el.style.top = Math.round(rect.bottom + 6) + 'px';
        el.style.right = Math.round(Math.max(8, window.innerWidth - rect.right)) + 'px';
        mountMenu();
    }

    /**
     * Open the same popover at the cursor. That is what a right-click on a file
     * needs: there is no button to hang from, and the pointer is the anchor.
     * Flips above the cursor and clamps to the window when it would overflow.
     */
    function openAt(x, y, entries, className) {
        if (!entries || entries.length === 0) return false;
        close();
        var el = buildMenu(entries);
        if (className) el.classList.add(className);
        // Measure off-screen so the clamping uses the real size, not a guess.
        el.style.visibility = 'hidden';
        document.body.appendChild(el);
        var width = el.offsetWidth || 230;
        var height = el.offsetHeight || 0;
        var left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
        var top = (y + height > window.innerHeight - 8) ? y - height : y;
        top = Math.max(8, Math.min(top, Math.max(8, window.innerHeight - height - 8)));
        el.style.left = Math.round(left) + 'px';
        el.style.top = Math.round(top) + 'px';
        el.style.visibility = '';
        anchor = null;
        mountMenu();
        return true;
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
        var el = buildMenu(entries);
        var rect = btn.getBoundingClientRect();
        el.style.top = Math.round(rect.bottom + 6) + 'px';
        el.style.right = Math.round(Math.max(8, window.innerWidth - rect.right)) + 'px';
        mountMenu();
    }

    /**
     * Where a file can be shown besides the view you are looking at. Declared
     * once: the file right-click menu and the City's "Open in…" both read it.
     */
    var FILE_DESTINATIONS = {
        graph: { label: '✦ 3D Graph', hint: 'switch tab and select its node' },
        city: { label: '🏙️ City', hint: 'switch tab and select its building' },
        treemap: { label: '🗺️ Treemap', hint: 'reveal it in its folder' },
    };

    /**
     * The entries every view that lists files offers on right-click: open the
     * editor, then "show me this file there". Kept here, and pure, so the six
     * views cannot drift apart: opening the editor is the only entry that
     * leaves the webview, the others switch tab and select the file there.
     *
     * @param {string} id file id
     * @param {{openSource?: (id: string) => void,
     *          selectIn?: (tab: string, id: string) => void,
     *          destinations?: string[]}} [handlers]
     *   `destinations` replaces the "show it there" entries — the City asks for
     *   `['graph', 'treemap']`, because the City is where you already are.
     */
    function fileEntries(id, handlers) {
        var h = handlers || {};
        var destinations = h.destinations || ['graph', 'city'];
        var entries = [
            {
                label: '📄 Open source',
                hint: 'open the file in the editor',
                run: function () { if (h.openSource) h.openSource(id); },
            },
        ];
        for (var i = 0; i < destinations.length; i++) {
            var target = destinations[i];
            var known = FILE_DESTINATIONS[target];
            if (!known) continue;
            entries.push({
                label: known.label,
                hint: known.hint,
                run: (function (tab) {
                    return function () { if (h.selectIn) h.selectIn(tab, id); };
                })(target),
            });
        }
        return entries;
    }

    window.AuraOpenIn = {
        init: function () { wireAttribute('data-open-in-tab', openInMenu); },
        register: registerOpenIn,
        entriesFor: openInEntries,
        open: openInMenu,
        openAt: openAt,
        fileEntries: fileEntries,
        close: close,
        isOpen: function () { return !!menu; },
    };
})();
