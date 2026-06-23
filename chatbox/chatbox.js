/**
 * BCF Confection chatbox – UI with approved quick-reply intents.
 * Session-only state in memory and sessionStorage (cleared when tab closes).
 */
(function () {
  "use strict";

  var WELCOME =
    "Hallo, waarmee kunnen we u helpen? Ik kan vragen beantwoorden op basis van de informatie op deze website. Kies een vraag of typ uw eigen vraag.";

  var storedMessages =
    window.BCFChatSession && window.BCFChatSession.loadMessages();
  var sessionMessages = storedMessages || [];

  function escapeHtml(text) {
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function createSvg(pathD) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(ns, "path");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
  }

  function scrollMessagesToBottom(container) {
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(function () {
      container.scrollTop = container.scrollHeight;
    });
  }

  function renderMessages(container) {
    container.innerHTML = "";
    sessionMessages.forEach(function (msg) {
      var el = document.createElement("div");
      el.className =
        "bcf-chat-message bcf-chat-message--" + (msg.role === "user" ? "user" : "bot");
      el.setAttribute("role", "listitem");
      el.innerHTML = escapeHtml(msg.text);
      container.appendChild(el);
    });
    scrollMessagesToBottom(container);
  }

  function persistMessages() {
    if (window.BCFChatSession) {
      window.BCFChatSession.saveMessages(sessionMessages);
    }
  }

  function addMessage(role, text) {
    sessionMessages.push({ role: role, text: text });
    persistMessages();
  }

  function isGreetingIntent(intent) {
    return intent && intent.id === "greeting";
  }

  function hasNonGreetingUserMessages(intentsData) {
    return sessionMessages.some(function (msg) {
      var matchedIntent =
        msg.role === "user" && window.BCFChatIntents
          ? window.BCFChatIntents.matchIntent(intentsData, msg.text)
          : null;
      return msg.role === "user" && !isGreetingIntent(matchedIntent);
    });
  }

  function initChatbox(root, intentsData) {
    if (root.dataset.bcfChatInit === "true") return;
    root.dataset.bcfChatInit = "true";

    var isOpen = false;
    var quickRepliesUsed = hasNonGreetingUserMessages(intentsData);
    var quickButtonIntents = window.BCFChatIntents.getQuickButtonIntents(intentsData);

    if (sessionMessages.length === 0) {
      addMessage("bot", WELCOME);
    }

    /* Trigger button */
    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "bcf-chat-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "bcf-chat-panel");
    trigger.setAttribute("aria-label", "Open chat");
    trigger.appendChild(
      createSvg(
        "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
      )
    );

    /* Panel */
    var panel = document.createElement("div");
    panel.id = "bcf-chat-panel";
    panel.className = "bcf-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "bcf-chat-title");
    panel.setAttribute("data-open", "false");
    panel.hidden = true;

    var header = document.createElement("div");
    header.className = "bcf-chat-header";

    var title = document.createElement("h2");
    title.id = "bcf-chat-title";
    title.textContent = "BCF Confection";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "bcf-chat-close";
    closeBtn.setAttribute("aria-label", "Sluit chat");
    closeBtn.appendChild(
      createSvg("M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z")
    );

    header.appendChild(title);
    header.appendChild(closeBtn);

    var messages = document.createElement("div");
    messages.className = "bcf-chat-messages";
    messages.setAttribute("role", "list");
    messages.setAttribute("aria-label", "Chatberichten");
    messages.setAttribute("tabindex", "0");

    var liveRegion = document.createElement("div");
    liveRegion.className = "bcf-chat-sr-only";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");

    var quickReplies = document.createElement("div");
    quickReplies.className = "bcf-chat-quick-replies";
    quickReplies.setAttribute("role", "group");
    quickReplies.setAttribute("aria-label", "Snelle vragen");

    quickButtonIntents.forEach(function (intent) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bcf-chat-quick-btn";
      btn.setAttribute("data-intent-id", intent.id);
      btn.textContent = intent.question;
      btn.addEventListener("click", function () {
        var intentId = btn.getAttribute("data-intent-id");
        var matchedIntent = window.BCFChatIntents.getIntentById(intentsData, intentId);
        if (matchedIntent) {
          handleQuickReply(matchedIntent);
        }
      });
      quickReplies.appendChild(btn);
    });

    var inputArea = document.createElement("div");
    inputArea.className = "bcf-chat-input-area";

    var inputLabel = document.createElement("label");
    inputLabel.setAttribute("for", "bcf-chat-input");
    inputLabel.textContent = "Uw vraag";

    var input = document.createElement("input");
    input.type = "text";
    input.id = "bcf-chat-input";
    input.className = "bcf-chat-input";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("enterkeyhint", "send");
    input.setAttribute("maxlength", "500");
    input.placeholder = "Typ uw vraag…";

    var sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "bcf-chat-send";
    sendBtn.textContent = "Verstuur";

    inputArea.appendChild(inputLabel);
    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    var handoffArea = document.createElement("div");
    handoffArea.className = "bcf-chat-handoff";
    handoffArea.hidden = true;

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(quickReplies);
    panel.appendChild(handoffArea);
    panel.appendChild(inputArea);

    root.appendChild(trigger);
    root.appendChild(panel);
    root.appendChild(liveRegion);

    if (quickRepliesUsed) {
      quickReplies.hidden = true;
    }

    var handoffDraft = null;

    function clearHandoffArea() {
      handoffArea.innerHTML = "";
      handoffArea.hidden = true;
    }

    function showHandoffArea() {
      handoffArea.hidden = false;
    }

    function showHandoffChoice(question) {
      if (!window.BCFChatHandoff) {
        return;
      }

      quickReplies.hidden = true;
      quickRepliesUsed = true;

      clearHandoffArea();
      showHandoffArea();
      handoffArea.setAttribute("role", "group");
      handoffArea.setAttribute("aria-label", "Doorsturen per e-mail");

      var prompt = document.createElement("p");
      prompt.className = "bcf-chat-handoff-prompt";
      prompt.textContent = "Wilt u uw vraag doorsturen naar BCF Confection?";
      handoffArea.appendChild(prompt);

      var yesBtn = document.createElement("button");
      yesBtn.type = "button";
      yesBtn.className = "bcf-chat-handoff-btn bcf-chat-handoff-btn--primary";
      yesBtn.textContent = "Ja, stuur mijn vraag door";
      yesBtn.addEventListener("click", function () {
        showHandoffForm(question);
      });

      var noBtn = document.createElement("button");
      noBtn.type = "button";
      noBtn.className = "bcf-chat-handoff-btn";
      noBtn.textContent = "Nee, bedankt";
      noBtn.addEventListener("click", function () {
        clearHandoffArea();
        addMessage("bot", window.BCFChatHandoff.DECLINE_MESSAGE);
        renderMessages(messages);
        liveRegion.textContent = window.BCFChatHandoff.DECLINE_MESSAGE;
        quickReplies.hidden = false;
        quickRepliesUsed = false;
        requestAnimationFrame(function () {
          scrollMessagesToBottom(messages);
        });
      });

      handoffArea.appendChild(yesBtn);
      handoffArea.appendChild(noBtn);
    }

    function setFieldError(input, errorEl, message) {
      if (message) {
        input.setAttribute("aria-invalid", "true");
        errorEl.textContent = message;
        errorEl.hidden = false;
      } else {
        input.removeAttribute("aria-invalid");
        errorEl.textContent = "";
        errorEl.hidden = true;
      }
    }

    function showHandoffConfirmation(draft) {
      if (!draft || !window.BCFChatHandoff) {
        return;
      }

      clearHandoffArea();
      showHandoffArea();
      handoffArea.setAttribute("role", "group");
      handoffArea.setAttribute("aria-label", "Bevestiging doorsturen");

      var summary = document.createElement("dl");
      summary.className = "bcf-chat-handoff-summary";

      function addSummaryItem(label, value) {
        var term = document.createElement("dt");
        term.textContent = label;
        var detail = document.createElement("dd");
        detail.textContent = value;
        summary.appendChild(term);
        summary.appendChild(detail);
      }

      addSummaryItem("Naam", draft.name);
      addSummaryItem("E-mailadres", draft.email);
      if (draft.company) {
        addSummaryItem("Bedrijf", draft.company);
      }
      addSummaryItem("Vraag", draft.question);

      var prompt = document.createElement("p");
      prompt.className = "bcf-chat-handoff-prompt";
      prompt.textContent = "Mag ik deze vraag doorsturen naar BCF Confection?";

      var confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "bcf-chat-handoff-btn bcf-chat-handoff-btn--primary";
      confirmBtn.textContent = "Ja, bevestigen";
      confirmBtn.addEventListener("click", function () {
        if (confirmBtn.disabled) {
          return;
        }

        confirmBtn.disabled = true;
        editBtn.disabled = true;
        confirmBtn.setAttribute("aria-busy", "true");
        confirmBtn.textContent = "Bezig met verzenden…";

        window.BCFChatHandoff.submitHandoff(draft)
          .then(function () {
            showHandoffOutcome(true);
          })
          .catch(function () {
            confirmBtn.disabled = false;
            editBtn.disabled = false;
            confirmBtn.removeAttribute("aria-busy");
            confirmBtn.textContent = "Ja, bevestigen";
            showHandoffOutcome(false);
          });
      });

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "bcf-chat-handoff-btn";
      editBtn.textContent = "Wijzigen";
      editBtn.addEventListener("click", function () {
        showHandoffForm(null, handoffDraft);
      });

      handoffArea.appendChild(summary);
      handoffArea.appendChild(prompt);
      handoffArea.appendChild(confirmBtn);
      handoffArea.appendChild(editBtn);
      liveRegion.textContent = prompt.textContent;
      confirmBtn.focus();
    }

    function showHandoffOutcome(success) {
      clearHandoffArea();
      showHandoffArea();

      var message = document.createElement("p");
      message.className = success
        ? "bcf-chat-handoff-success"
        : "bcf-chat-handoff-error";
      message.textContent = success
        ? window.BCFChatHandoff.SUCCESS_MESSAGE
        : window.BCFChatHandoff.ERROR_MESSAGE;
      handoffArea.appendChild(message);
      liveRegion.textContent = message.textContent;

      if (success) {
        handoffDraft = null;
      }
    }

    function showHandoffForm(question, draft) {
      if (!window.BCFChatHandoff) {
        return;
      }

      clearHandoffArea();
      showHandoffArea();

      var form = document.createElement("form");
      form.className = "bcf-chat-handoff-form";
      form.setAttribute("novalidate", "novalidate");

      function addField(id, labelText, options) {
        var field = document.createElement("div");
        field.className = "bcf-chat-handoff-field";

        var label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = labelText;

        var input = document.createElement(options.multiline ? "textarea" : "input");
        input.id = id;
        input.className = "bcf-chat-handoff-input";
        input.name = options.name;
        if (!options.multiline) {
          input.type = options.type || "text";
        }
        if (options.required) {
          input.required = true;
          input.setAttribute("aria-required", "true");
        }
        if (options.value) {
          input.value = options.value;
        }
        if (options.maxlength) {
          input.maxLength = options.maxlength;
        }
        if (options.multiline) {
          input.rows = 3;
        }

        var error = document.createElement("div");
        error.id = id + "-error";
        error.className = "bcf-chat-handoff-field-error";
        error.setAttribute("role", "alert");
        error.hidden = true;
        input.setAttribute("aria-describedby", error.id);

        field.appendChild(label);
        field.appendChild(input);
        field.appendChild(error);
        form.appendChild(field);

        return { input: input, error: error };
      }

      var nameField = addField("bcf-handoff-name", "Naam", {
        name: "name",
        required: true,
        maxlength: 100,
        value: draft ? draft.name : "",
      });
      var emailField = addField("bcf-handoff-email", "E-mailadres", {
        name: "email",
        type: "email",
        required: true,
        maxlength: 254,
        value: draft ? draft.email : "",
      });
      var companyField = addField("bcf-handoff-company", "Bedrijf (optioneel)", {
        name: "company",
        maxlength: 100,
        value: draft ? draft.company : "",
      });
      var questionField = addField("bcf-handoff-question", "Vraag", {
        name: "question",
        required: true,
        multiline: true,
        value: draft ? draft.question : question || "",
        maxlength: 1000,
      });

      var submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.className = "bcf-chat-handoff-submit";
      submitBtn.textContent = "Verstuur";
      form.appendChild(submitBtn);

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var result = window.BCFChatHandoff.validateHandoffForm({
          name: nameField.input.value,
          email: emailField.input.value,
          question: questionField.input.value,
        });

        setFieldError(nameField.input, nameField.error, result.errors.name || "");
        setFieldError(emailField.input, emailField.error, result.errors.email || "");
        setFieldError(
          questionField.input,
          questionField.error,
          result.errors.question || ""
        );

        if (!result.valid) {
          liveRegion.textContent = "Controleer de gemarkeerde velden.";
          var firstInvalid = form.querySelector("[aria-invalid='true']");
          if (firstInvalid) {
            firstInvalid.focus();
          }
          return;
        }

        handoffDraft = {
          name: nameField.input.value.trim(),
          email: emailField.input.value.trim(),
          company: companyField.input.value.trim(),
          question: questionField.input.value.trim(),
        };

        showHandoffConfirmation(handoffDraft);
      });

      handoffArea.appendChild(form);
      nameField.input.focus();
    }

    function getLastUnansweredQuestion() {
      if (!window.BCFChatIntents || !window.BCFChatHandoff) {
        return null;
      }

      for (var i = sessionMessages.length - 1; i >= 0; i--) {
        if (
          sessionMessages[i].role === "bot" &&
          sessionMessages[i].text === window.BCFChatHandoff.DECLINE_MESSAGE
        ) {
          return null;
        }
        if (
          sessionMessages[i].role === "bot" &&
          sessionMessages[i].text === window.BCFChatIntents.UNSUPPORTED_MESSAGE
        ) {
          for (var j = i - 1; j >= 0; j--) {
            if (sessionMessages[j].role === "user") {
              return sessionMessages[j].text;
            }
          }
          return "";
        }
      }
      return null;
    }

    renderMessages(messages);

    var restoredQuestion = getLastUnansweredQuestion();
    if (restoredQuestion !== null) {
      showHandoffChoice(restoredQuestion);
    }

    function updateSendState() {
      sendBtn.disabled = input.value.trim().length === 0;
    }

    function hideQuickReplies() {
      if (!quickRepliesUsed) {
        quickReplies.hidden = true;
        quickRepliesUsed = true;
      }
    }

    function handleQuickReply(intent) {
      hideQuickReplies();
      addMessage("user", intent.question);
      addMessage("bot", intent.answer);
      renderMessages(messages);
      liveRegion.textContent = "Antwoord: " + intent.answer;
      input.value = "";
      updateSendState();
      requestAnimationFrame(function () {
        scrollMessagesToBottom(messages);
        input.focus();
      });
    }

    function submitUserMessage(text) {
      var trimmed = text.trim();
      if (!trimmed) return;

      addMessage("user", trimmed);

      var matchedIntent = window.BCFChatIntents.matchIntent(intentsData, trimmed);
      if (matchedIntent) {
        clearHandoffArea();
        addMessage("bot", matchedIntent.answer);
        liveRegion.textContent = "Antwoord: " + matchedIntent.answer;
        if (isGreetingIntent(matchedIntent)) {
          quickReplies.hidden = false;
          quickRepliesUsed = false;
        } else {
          hideQuickReplies();
        }
      } else {
        quickReplies.hidden = true;
        quickRepliesUsed = true;
        addMessage("bot", window.BCFChatIntents.UNSUPPORTED_MESSAGE);
        liveRegion.textContent = window.BCFChatIntents.UNSUPPORTED_MESSAGE;
        showHandoffChoice(trimmed);
      }

      renderMessages(messages);
      input.value = "";
      updateSendState();
      requestAnimationFrame(function () {
        scrollMessagesToBottom(messages);
        input.focus();
      });
    }

    function openPanel() {
      isOpen = true;
      panel.hidden = false;
      panel.setAttribute("data-open", "true");
      trigger.setAttribute("aria-expanded", "true");
      trigger.setAttribute("aria-label", "Sluit chat");

      requestAnimationFrame(function () {
        if (!quickRepliesUsed) {
          var firstQuick = quickReplies.querySelector(".bcf-chat-quick-btn");
          if (firstQuick) {
            firstQuick.focus();
            return;
          }
        }
        input.focus();
      });
    }

    function closePanel() {
      isOpen = false;
      panel.setAttribute("data-open", "false");
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-label", "Open chat");
      trigger.focus();

      panel.addEventListener(
        "transitionend",
        function onEnd() {
          panel.removeEventListener("transitionend", onEnd);
          if (!isOpen) panel.hidden = true;
        },
        { once: true }
      );

      setTimeout(function () {
        if (!isOpen) panel.hidden = true;
      }, 250);
    }

    function togglePanel() {
      if (isOpen) closePanel();
      else openPanel();
    }

    trigger.addEventListener("click", togglePanel);
    closeBtn.addEventListener("click", closePanel);

    sendBtn.addEventListener("click", function () {
      submitUserMessage(input.value);
    });

    input.addEventListener("input", updateSendState);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) submitUserMessage(input.value);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
      }
    });

    function getFocusableElements() {
      var selector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "textarea:not([disabled])",
        "select:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(",");
      var nodes = panel.querySelectorAll(selector);
      return Array.prototype.filter.call(nodes, function (el) {
        return (
          el.offsetWidth > 0 ||
          el.offsetHeight > 0 ||
          el === document.activeElement
        );
      });
    }

    panel.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;

      var focusable = getFocusableElements();
      if (focusable.length === 0) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    });

    updateSendState();
  }

  function boot() {
    var root = document.getElementById("bcf-chat-root");
    if (!root || !window.BCFChatIntents || !window.BCFChatHandoff) return;

    window.BCFChatIntents.load().then(function (intentsData) {
      initChatbox(root, intentsData);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
