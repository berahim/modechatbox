/**
 * Session-only chat persistence via sessionStorage.
 * Cleared automatically when the browser tab/session ends.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "bcf-chat-messages";
  var SESSION_ID_KEY = "bcf-chat-session-id";

  function isAvailable() {
    try {
      var probe = "__bcf_session_probe__";
      sessionStorage.setItem(probe, "1");
      sessionStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  }

  function isValidMessage(message) {
    return (
      message &&
      (message.role === "user" || message.role === "bot") &&
      typeof message.text === "string"
    );
  }

  function loadMessages() {
    if (!isAvailable()) {
      return null;
    }

    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(isValidMessage)) {
        return null;
      }

      return parsed;
    } catch (err) {
      return null;
    }
  }

  function saveMessages(messages) {
    if (!isAvailable() || !Array.isArray(messages)) {
      return;
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      /* Ignore quota or storage errors; chat remains usable in memory. */
    }
  }

  function randomId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
      if (window.crypto && window.crypto.getRandomValues) {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.prototype.map
          .call(bytes, function (b) {
            return ("0" + b.toString(16)).slice(-2);
          })
          .join("");
      }
    } catch (err) {
      /* fall through to non-crypto fallback */
    }
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 12)
    );
  }

  /**
   * Stable per-tab identifier used as a secondary rate-limit signal on the
   * server. Not security-sensitive (client-controlled, cleared with the tab).
   */
  function getSessionId() {
    if (!isAvailable()) {
      return null;
    }

    try {
      var existing = sessionStorage.getItem(SESSION_ID_KEY);
      if (existing) {
        return existing;
      }
      var fresh = randomId();
      sessionStorage.setItem(SESSION_ID_KEY, fresh);
      return fresh;
    } catch (err) {
      return null;
    }
  }

  window.BCFChatSession = {
    loadMessages: loadMessages,
    saveMessages: saveMessages,
    getSessionId: getSessionId,
  };
})();
