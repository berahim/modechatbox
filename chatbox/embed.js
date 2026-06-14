/**
 * Non-blocking loader for the BCF Confection chatbox.
 * Add to any page:
 *   <div id="bcf-chat-root" class="bcf-chat-root"></div>
 *   <script src="/chatbox/embed.js" defer></script>
 */
(function () {
  "use strict";

  var base =
    (document.currentScript && document.currentScript.src.replace(/\/embed\.js.*$/, "")) ||
    "/chatbox";

  function loadCss(href) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src, onload) {
    var script = document.createElement("script");
    script.src = src;
    if (onload) {
      script.onload = onload;
    }
    document.body.appendChild(script);
  }

  function ensureRoot() {
    if (!document.getElementById("bcf-chat-root")) {
      var root = document.createElement("div");
      root.id = "bcf-chat-root";
      root.className = "bcf-chat-root";
      document.body.appendChild(root);
    }
  }

  function init() {
    ensureRoot();
    loadCss(base + "/chatbox.css");
    loadScript(base + "/intents.js", function () {
      loadScript(base + "/session-store.js", function () {
        loadScript(base + "/handoff.js", function () {
          loadScript(base + "/chatbox.js");
        });
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
