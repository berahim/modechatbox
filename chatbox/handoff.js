/**
 * Email handoff helpers – client validation and API submit.
 * Form data stays session-only in chatbox memory.
 */
(function () {
  "use strict";

  var HANDOFF_API_URL = "/api/handoff";

  /* Short client-side cooldown after a successful send, on top of the
     authoritative server-side rate limiting. */
  var SUCCESS_COOLDOWN_MS = 30000;

  /* Guards against duplicate submissions from double-clicks, repeated
     confirmation, or rapid edit/confirm loops. */
  var submitInFlight = false;
  var cooldownUntil = 0;

  var DECLINE_MESSAGE =
    "Geen probleem. U kunt ook de informatie op deze website raadplegen of later opnieuw contact opnemen.";

  var SUCCESS_MESSAGE =
    "Bedankt. Uw vraag is doorgestuurd naar BCF Confection. Zij nemen contact met u op via het opgegeven e-mailadres.";

  var ERROR_MESSAGE =
    "Sorry, uw vraag kon momenteel niet worden doorgestuurd. U kunt BCF Confection rechtstreeks contacteren via de contactgegevens op de website.";

  function isValidEmail(email) {
    var trimmed = String(email).trim();
    if (!trimmed) {
      return false;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  function validateHandoffForm(data) {
    var errors = {};
    var name = data.name ? String(data.name).trim() : "";
    var email = data.email ? String(data.email).trim() : "";
    var question = data.question ? String(data.question).trim() : "";

    if (!name) {
      errors.name = "Naam is verplicht.";
    }
    if (!email) {
      errors.email = "E-mailadres is verplicht.";
    } else if (!isValidEmail(email)) {
      errors.email = "Voer een geldig e-mailadres in.";
    }
    if (!question) {
      errors.question = "Vraag is verplicht.";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
    };
  }

  function buildSubmitPayload(draft) {
    var payload = {
      name: draft.name,
      email: draft.email,
      question: draft.question,
      language: "nl",
    };

    if (draft.company) {
      payload.company = draft.company;
    }
    if (typeof window.location !== "undefined" && window.location.href) {
      payload.pageUrl = window.location.href;
    }

    return payload;
  }

  function buildRequestHeaders() {
    var headers = { "Content-Type": "application/json" };
    var sessionId =
      window.BCFChatSession && window.BCFChatSession.getSessionId
        ? window.BCFChatSession.getSessionId()
        : null;
    if (sessionId) {
      headers["X-Session-Id"] = sessionId;
    }
    return headers;
  }

  function submitHandoff(draft) {
    if (submitInFlight) {
      return Promise.reject(new Error("handoff_in_flight"));
    }
    if (Date.now() < cooldownUntil) {
      return Promise.reject(new Error("handoff_cooldown"));
    }

    submitInFlight = true;

    return fetch(HANDOFF_API_URL, {
      method: "POST",
      headers: buildRequestHeaders(),
      body: JSON.stringify(buildSubmitPayload(draft)),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("handoff_failed");
        }
        return response.json().then(function (data) {
          if (!data || data.ok !== true) {
            throw new Error("handoff_failed");
          }
          cooldownUntil = Date.now() + SUCCESS_COOLDOWN_MS;
          return data;
        });
      })
      .finally(function () {
        submitInFlight = false;
      });
  }

  window.BCFChatHandoff = {
    DECLINE_MESSAGE: DECLINE_MESSAGE,
    SUCCESS_MESSAGE: SUCCESS_MESSAGE,
    ERROR_MESSAGE: ERROR_MESSAGE,
    isValidEmail: isValidEmail,
    validateHandoffForm: validateHandoffForm,
    submitHandoff: submitHandoff,
  };
})();
