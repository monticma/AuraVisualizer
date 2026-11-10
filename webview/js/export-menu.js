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

    /** Wire every `<button data-export-tab="…">` in the document. */
    function setup() {
        var buttons = document.querySelectorAll('[data-export-tab]');
        for (var i = 0; i < buttons.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function (event) {
                    event.stopPropagation();
                    open(btn, btn.getAttribute('data-export-tab'));
                });
            })(buttons[i]);
        }
    }

    window.AuraExportMenu = {
        init: setup,
        register: register,
        entriesFor: entriesFor,
        open: open,
        close: close,
        isOpen: function () { return !!menu; },
    };
})();
