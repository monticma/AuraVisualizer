/**
 * chat.js — Aura Assistant chat panel (UI + host message stream).
 *
 * Extracted from app.js (refactor/app-split). The four `chat*` message cases
 * moved here as AuraChat.handleHostMessage(type, payload) — app.js's dispatcher
 * delegates to it. postMessage and node-focus come through hooks injected in
 * init().
 */
(function() {
    'use strict';

    var hooks = {};

    var $ = function(sel) { return document.querySelector(sel); };

    // ============================================================
    // Chat (Aura Assistant)
    // ============================================================
    var chatBusy = false;
    var chatCurrentId = null;
    var chatCurrentEl = null;
    var chatCurrentText = '';

    function chatEscapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Convert `path/to/file.ext:42` patterns into clickable citations.
    function chatRenderCitations(text) {
        var escaped = chatEscapeHtml(text);
        var re = /([\w./-]+\.[A-Za-z0-9]{1,6})(?::(\d+))?/g;
        return escaped.replace(re, function(match, file, line) {
            return '<span class="chat-cite" data-file="' + chatEscapeHtml(file) + '" data-line="' + (line || '') + '">' + match + '</span>';
        });
    }

    function chatScrollToBottom() {
        var m = $('#chat-messages');
        if (m) m.scrollTop = m.scrollHeight;
    }

    function chatOpenCitation(file, line) {
        hooks.postMessage({ type: 'openFile', payload: { path: file, line: line ? parseInt(line, 10) : undefined } });
        if (hooks.focusNode) hooks.focusNode(file);
    }

    function chatAddMessage(role, html, rawText) {
        var container = $('#chat-messages');
        if (!container) return null;
        var el = document.createElement('div');
        el.className = 'chat-msg ' + role;
        if (html) el.innerHTML = html;
        else el.textContent = rawText || '';
        container.appendChild(el);
        chatScrollToBottom();
        return el;
    }

    function chatSend() {
        if (chatBusy) return;
        var input = $('#chat-input');
        if (!input) return;
        var prompt = (input.value || '').trim();
        if (!prompt) return;

        input.value = '';
        chatAddMessage('user', null, prompt);

        chatBusy = true;
        chatCurrentId = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        chatCurrentText = '';
        chatCurrentEl = chatAddMessage('assistant', '', '');
        var sendBtn = $('#chat-send');
        if (sendBtn) sendBtn.disabled = true;

        hooks.postMessage({ type: 'chatRequest', payload: { id: chatCurrentId, prompt: prompt } });
    }

    function setupChat() {
        var toggle = $('#chat-toggle');
        var closeBtn = $('#chat-close');
        var clearBtn = $('#chat-clear');
        var sendBtn = $('#chat-send');
        var input = $('#chat-input');

        function setOpen(open) {
            var panel = $('#chat-panel');
            if (open) {
                document.body.classList.add('chat-open');
                if (toggle) toggle.classList.add('active');
                if (panel) panel.classList.remove('collapsed');
                // Focus after the slide-in transition, to avoid a horizontal scroll jump
                if (input) setTimeout(function() { input.focus(); }, 280);
            } else {
                if (panel) panel.classList.add('collapsed');
                document.body.classList.remove('chat-open');
                if (toggle) toggle.classList.remove('active');
            }
        }

        if (toggle) toggle.addEventListener('click', function(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            var panel = $('#chat-panel');
            setOpen(panel ? panel.classList.contains('collapsed') : true);
        });
        if (closeBtn) closeBtn.addEventListener('click', function(e) { if (e) e.stopPropagation(); setOpen(false); });
        if (clearBtn) clearBtn.addEventListener('click', function(e) {
            if (e) e.stopPropagation();
            var m = $('#chat-messages');
            if (m) m.innerHTML = '';
        });
        if (sendBtn) sendBtn.addEventListener('click', function(e) { if (e) e.stopPropagation(); chatSend(); });
        if (input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    chatSend();
                }
            });
        }

        var msgs = $('#chat-messages');
        if (msgs) msgs.addEventListener('click', function(e) {
            var cite = e.target && e.target.closest ? e.target.closest('.chat-cite') : null;
            if (cite) chatOpenCitation(cite.getAttribute('data-file'), cite.getAttribute('data-line'));
        });
    }

    // ============================================================
    // Host message stream (delegated from app.js's dispatcher)
    // ============================================================
    function handleHostMessage(type, payload) {
        if (!payload || payload.id !== chatCurrentId) return;
        if (type === 'chatChunk') {
            chatCurrentText += payload.text || '';
            if (chatCurrentEl) chatCurrentEl.textContent = chatCurrentText;
            chatScrollToBottom();
        } else if (type === 'chatDone') {
            chatCurrentText = payload.fullText || chatCurrentText;
            if (chatCurrentEl) chatCurrentEl.innerHTML = chatRenderCitations(chatCurrentText);
            chatBusy = false;
            var sbDone = $('#chat-send');
            if (sbDone) sbDone.disabled = false;
            chatScrollToBottom();
        } else if (type === 'chatError') {
            chatBusy = false;
            var sbErr = $('#chat-send');
            if (sbErr) sbErr.disabled = false;
            chatAddMessage('error', null, 'Error: ' + (payload.message || 'unknown'));
            chatScrollToBottom();
        } else if (type === 'chatTool') {
            chatCurrentText += '\n\n🔧 ' + (payload.name || 'tool') + '…\n';
            if (chatCurrentEl) chatCurrentEl.textContent = chatCurrentText;
            chatScrollToBottom();
        }
    }

    function init(injected) {
        hooks = injected || {};
    }

    window.AuraChat = {
        init: init,
        setup: setupChat,
        handleHostMessage: handleHostMessage
    };
})();
