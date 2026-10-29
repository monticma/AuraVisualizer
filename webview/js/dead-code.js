/**
 * dead-code.js — Structured editor for `.aura/dead-code.json`.
 *
 * Custom exemption rules are edited as forms (reason + selectors), then
 * serialized and validated by `AuraDeadCode` — the exact parser used by the
 * analysis. Built-in defaults are always active and shown read-only.
 *
 * window.AuraDeadCodeEditor + init(hooks). Hooks: postMessage.
 */
(function () {
    'use strict';

    var hooks = {};
    var $ = function (sel) { return document.querySelector(sel); };
    var editor = { raw: '', model: null, valid: false };

    function qsa(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function asList(value) {
        if (value === undefined || value === null) return [];
        return Array.isArray(value) ? value : [value];
    }

    function parseList(value) {
        return String(value == null ? '' : value)
            .split(/[\n,]/)
            .map(function (part) { return part.trim(); })
            .filter(function (part) { return part.length > 0; });
    }

    function defaultModel() {
        return [];
    }

    function exampleModel() {
        return AuraDeadCode.parseDeadCodeRules(JSON.stringify({
            version: 1,
            rules: [
                {
                    reason: 'Android lifecycle callbacks',
                    name: ['onCreate', 'onResume', 'onPause', 'onDestroy'],
                    language: ['kotlin', 'java']
                },
                {
                    reason: 'Generated code',
                    path: ['src/gen/**', 'src/generated/**']
                }
            ]
        }));
    }

    function serializeModel() {
        return AuraDeadCode.serializeDeadCodeRules(editor.model);
    }

    function setError(message) {
        var error = $('#dead-code-rules-error');
        if (error) error.textContent = message || '';
        var status = $('#dc-editor-status');
        if (status && message) {
            status.textContent = '✕ ' + message;
            status.className = 'dc-editor-status invalid';
        }
    }

    function setStatus(valid) {
        var status = $('#dc-editor-status');
        if (!status) return;
        status.textContent = valid ? '✓ Valid — custom rules are consistent' : '✕ Fix the issue above before saving';
        status.className = 'dc-editor-status ' + (valid ? 'valid' : 'invalid');
    }

    function setSaveEnabled(enabled) {
        var save = $('#dead-code-rules-save');
        if (save) save.disabled = !enabled;
    }

    function syncRawField() {
        var raw = $('#dead-code-rules-text');
        if (raw && document.activeElement !== raw) raw.value = editor.raw;
    }

    function validateRaw(text) {
        try {
            var parsed = AuraDeadCode.parseDeadCodeRules(text);
            if (!editor.model) editor.model = clone(parsed);
            editor.valid = true;
            setError('');
            setStatus(true);
            setSaveEnabled(true);
            return true;
        } catch (err) {
            editor.valid = false;
            setError(err && err.message ? err.message : 'Invalid rules.');
            setSaveEnabled(false);
            return false;
        }
    }

    function refreshEditor() {
        if (!editor.model) {
            validateRaw(editor.raw);
            return;
        }
        editor.raw = serializeModel();
        syncRawField();
        validateRaw(editor.raw);
    }

    function selectorSummary(rule) {
        var parts = [];
        var names = asList(rule.name);
        if (names.length) parts.push('name: ' + names.join(', '));
        if (rule.namePattern) parts.push('pattern: ' + rule.namePattern);
        var paths = asList(rule.path);
        if (paths.length) parts.push('path: ' + paths.join(', '));
        var languages = asList(rule.language);
        if (languages.length) parts.push('language: ' + languages.join(', '));
        var kinds = asList(rule.kind);
        if (kinds.length) parts.push('kind: ' + kinds.join(', '));
        return parts.join(' · ');
    }

    function buildRuleHtml(rule, index, total) {
        function field(label, attr, value, placeholder) {
            return '<label class="dc-field">' + label +
                '<input class="dc-input" data-' + attr + '="' + index + '" value="' + escapeHtml(value) +
                '" placeholder="' + escapeHtml(placeholder) + '" spellcheck="false"></label>';
        }
        return '<div class="dc-rule">' +
            '<div class="dc-rule-head">' +
                '<strong>Rule ' + (index + 1) + '</strong>' +
                '<span class="dc-rule-badge">custom</span>' +
                '<div class="dc-rule-actions">' +
                    '<button type="button" data-rule-up="' + index + '" title="Move up (first match wins)" ' + (index === 0 ? 'disabled' : '') + '>↑</button>' +
                    '<button type="button" data-rule-down="' + index + '" title="Move down" ' + (index === total - 1 ? 'disabled' : '') + '>↓</button>' +
                    '<button type="button" class="dc-remove" data-rule-remove="' + index + '" title="Remove rule">✕</button>' +
                '</div>' +
            '</div>' +
            '<label class="dc-field dc-field-full">Reason' +
                '<input class="dc-input" data-rule-reason="' + index + '" value="' + escapeHtml(rule.reason || '') +
                '" placeholder="Why is this symbol owned by a framework or generated code?" spellcheck="false"></label>' +
            '<div class="dc-rule-grid">' +
                field('Symbol names', 'rule-name', asList(rule.name).join(', '), 'onResume, onPause') +
                field('Name pattern (regex)', 'rule-pattern', rule.namePattern || '', '^init[A-Z]') +
                field('Paths / globs', 'rule-path', asList(rule.path).join(', '), 'src/android/**, **/*.ino') +
                field('Languages', 'rule-language', asList(rule.language).join(', '), 'kotlin, java') +
                field('Kinds', 'rule-kind', asList(rule.kind).join(', '), 'function, class, export') +
            '</div>' +
            '<p class="dc-hint">All filled selectors must match (AND). Values within one selector are OR. At least one of name, namePattern or path is required.</p>' +
        '</div>';
    }

    function buildFormHtml(model) {
        var html = '<section class="dc-section">' +
            '<div class="dc-section-head">' +
                '<h4>Custom rules <span class="dc-count">' + model.length + '</span></h4>' +
                '<button type="button" class="dc-add" id="dc-add-rule">＋ Add rule</button>' +
            '</div>' +
            '<p class="dc-hint">Rules are evaluated in order after the built-in defaults. The first matching rule provides the reason shown in the detail panel.</p>';
        if (model.length === 0) {
            html += '<p class="dc-empty">No custom rule yet — the built-in defaults still apply.</p>';
        } else {
            for (var i = 0; i < model.length; i++) {
                html += buildRuleHtml(model[i], i, model.length);
            }
        }
        html += '</section>';
        return html;
    }

    function renderDefaults() {
        var container = $('#dc-editor-defaults-list');
        if (!container) return;
        var rules = AuraDeadCode.DEFAULT_DEAD_CODE_RULES || [];
        var html = '';
        for (var i = 0; i < rules.length; i++) {
            html += '<div class="dc-default">' +
                '<div class="dc-default-reason">' + escapeHtml(rules[i].reason) + '</div>' +
                '<div class="dc-default-selectors">' + escapeHtml(selectorSummary(rules[i])) + '</div>' +
            '</div>';
        }
        container.innerHTML = html;
    }

    function renderEditor() {
        var form = $('#dc-editor-form');
        if (!form) return;
        if (!editor.model) {
            form.innerHTML = '<p class="dc-empty">The file is not valid JSON yet. Fix it in <strong>Raw JSON</strong> below — the form rebuilds as soon as it parses.</p>';
            var rawWrap = $('#dc-editor-raw-wrap');
            if (rawWrap) rawWrap.open = true;
            validateRaw(editor.raw);
            renderDefaults();
            return;
        }
        form.innerHTML = buildFormHtml(editor.model);
        bindForm();
        refreshEditor();
        renderDefaults();
    }

    function bindForm() {
        var model = editor.model;
        if (!model) return;

        function setList(index, field, value) {
            var list = parseList(value);
            if (list.length) model[index][field] = list;
            else delete model[index][field];
        }

        qsa('[data-rule-reason]').forEach(function (input) {
            input.addEventListener('input', function () {
                model[parseInt(this.getAttribute('data-rule-reason'), 10)].reason = this.value;
                refreshEditor();
            });
        });
        qsa('[data-rule-name]').forEach(function (input) {
            input.addEventListener('input', function () {
                setList(parseInt(this.getAttribute('data-rule-name'), 10), 'name', this.value);
                refreshEditor();
            });
        });
        qsa('[data-rule-pattern]').forEach(function (input) {
            input.addEventListener('input', function () {
                var index = parseInt(this.getAttribute('data-rule-pattern'), 10);
                var pattern = this.value.trim();
                if (pattern) model[index].namePattern = pattern;
                else delete model[index].namePattern;
                refreshEditor();
            });
        });
        qsa('[data-rule-path]').forEach(function (input) {
            input.addEventListener('input', function () {
                setList(parseInt(this.getAttribute('data-rule-path'), 10), 'path', this.value);
                refreshEditor();
            });
        });
        qsa('[data-rule-language]').forEach(function (input) {
            input.addEventListener('input', function () {
                setList(parseInt(this.getAttribute('data-rule-language'), 10), 'language', this.value);
                refreshEditor();
            });
        });
        qsa('[data-rule-kind]').forEach(function (input) {
            input.addEventListener('input', function () {
                setList(parseInt(this.getAttribute('data-rule-kind'), 10), 'kind', this.value);
                refreshEditor();
            });
        });

        qsa('[data-rule-up]').forEach(function (button) {
            button.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-rule-up'), 10);
                if (index <= 0) return;
                var moved = model.splice(index, 1)[0];
                model.splice(index - 1, 0, moved);
                renderEditor();
            });
        });
        qsa('[data-rule-down]').forEach(function (button) {
            button.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-rule-down'), 10);
                if (index >= model.length - 1) return;
                var moved = model.splice(index, 1)[0];
                model.splice(index + 1, 0, moved);
                renderEditor();
            });
        });
        qsa('[data-rule-remove]').forEach(function (button) {
            button.addEventListener('click', function () {
                model.splice(parseInt(this.getAttribute('data-rule-remove'), 10), 1);
                renderEditor();
            });
        });

        var add = $('#dc-add-rule');
        if (add) add.addEventListener('click', function () {
            model.push({ reason: '', name: [], path: [], language: [], kind: [] });
            renderEditor();
            var inputs = qsa('[data-rule-reason]');
            if (inputs.length) inputs[inputs.length - 1].focus();
        });
    }

    function openEditor() {
        var modal = $('#dead-code-rules-modal');
        if (!modal) return;
        if (!editor.model && !editor.raw) {
            editor.model = defaultModel();
            editor.raw = serializeModel();
        }
        modal.classList.remove('hidden');
        setError('');
        syncRawField();
        renderEditor();
        hooks.postMessage({ type: 'requestDeadCodeRules' });
    }

    function closeEditor() {
        var modal = $('#dead-code-rules-modal');
        if (modal) modal.classList.add('hidden');
    }

    function setup() {
        var modal = $('#dead-code-rules-modal');
        var close = $('#dead-code-rules-close');
        if (close) close.addEventListener('click', closeEditor);
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeEditor();
            });
        }
        var settingsOpen = $('#dead-code-rules-open');
        if (settingsOpen) settingsOpen.addEventListener('click', openEditor);

        var reload = $('#dead-code-rules-reload');
        if (reload) reload.addEventListener('click', function () {
            hooks.postMessage({ type: 'requestDeadCodeRules' });
        });
        var example = $('#dead-code-rules-example');
        if (example) example.addEventListener('click', function () {
            editor.model = exampleModel();
            editor.raw = serializeModel();
            syncRawField();
            renderEditor();
        });
        var openFile = $('#dead-code-rules-open-file');
        if (openFile) openFile.addEventListener('click', function () {
            hooks.postMessage({ type: 'openDeadCodeRulesFile' });
            closeEditor();
        });
        var save = $('#dead-code-rules-save');
        if (save) save.addEventListener('click', function () {
            if (!editor.valid) {
                setError('Fix the validation error before saving.');
                return;
            }
            var text = editor.model ? serializeModel() : editor.raw;
            setError('');
            hooks.postMessage({ type: 'saveDeadCodeRules', payload: { text: text } });
        });

        var raw = $('#dead-code-rules-text');
        if (raw) {
            raw.addEventListener('input', function () {
                editor.raw = this.value;
                try {
                    editor.model = clone(AuraDeadCode.parseDeadCodeRules(editor.raw));
                    editor.valid = true;
                    setError('');
                    setStatus(true);
                    setSaveEnabled(true);
                } catch (err) {
                    editor.model = null;
                    editor.valid = false;
                    setError(err && err.message ? err.message : 'Invalid JSON.');
                    setSaveEnabled(false);
                }
            });
            raw.addEventListener('change', function () {
                if (editor.model) renderEditor();
            });
        }
        renderDefaults();
    }

    function onRulesLoaded(text) {
        editor.raw = (typeof text === 'string' && text.trim())
            ? text
            : AuraDeadCode.serializeDeadCodeRules([]);
        try {
            editor.model = clone(AuraDeadCode.parseDeadCodeRules(editor.raw));
        } catch (e) {
            editor.model = null;
        }
        syncRawField();
        var modal = $('#dead-code-rules-modal');
        if (modal) modal.classList.remove('hidden');
        renderEditor();
    }

    function onRulesSaved(text) {
        if (typeof text === 'string' && text.trim()) {
            editor.raw = text;
            try {
                editor.model = clone(AuraDeadCode.parseDeadCodeRules(text));
            } catch (e) {
                editor.model = null;
            }
        }
        closeEditor();
    }

    function onRulesError(message) {
        editor.valid = false;
        setError(message || 'Invalid rules.');
        setSaveEnabled(false);
    }

    window.AuraDeadCodeEditor = {
        init: function (h) { hooks = h || {}; },
        setup: setup,
        open: openEditor,
        onRulesLoaded: onRulesLoaded,
        onRulesSaved: onRulesSaved,
        onRulesError: onRulesError,
        render: renderEditor
    };
})();
