/**
 * Approved intent lookup – single source: chatbox-intents.nl.json
 * Session-only; no server calls for answering (JSON loaded once at init).
 */
(function () {
  "use strict";

  var cachedData = null;
  var loadPromise = null;

  function getIntentsUrl() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src && /\/intents\.js(\?.*)?$/.test(src)) {
        return src.replace(/\/chatbox\/intents\.js.*$/, "/chatbox-intents.nl.json");
      }
    }
    return "/chatbox-intents.nl.json";
  }

  function load() {
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
    if (!loadPromise) {
      loadPromise = fetch(getIntentsUrl())
        .then(function (res) {
          if (!res.ok) {
            throw new Error("Kon intent-gegevens niet laden.");
          }
          return res.json();
        })
        .then(function (data) {
          cachedData = data;
          return data;
        });
    }
    return loadPromise;
  }

  var MVP_QUICK_BUTTON_IDS = [
    "minimum_order_quantity",
    "delivery_time",
    "production_methods",
    "product_range",
    "pricing_quote",
  ];

  function getApprovedIntents(data) {
    return (data.intents || []).filter(function (intent) {
      return intent.status === "approved";
    });
  }

  function getIntentById(data, id) {
    var intent = (data.intents || []).find(function (item) {
      return item.id === id;
    });
    if (!intent || intent.status !== "approved") {
      return null;
    }
    return intent;
  }

  function getQuickButtonIntents(data) {
    return MVP_QUICK_BUTTON_IDS.map(function (id) {
      return getIntentById(data, id);
    }).filter(function (intent) {
      return intent !== null;
    });
  }

  var UNSUPPORTED_MESSAGE =
    "Helaas kan ik uw vraag niet beantwoorden op basis van de informatie op onze website.";

  function normalizeText(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/^[?!.,"'()]+|[?!.,"'()]+$/g, "")
      .trim();
  }

  function intentMatchesText(intent, normalizedInput) {
    var candidates = [intent.question].concat(intent.exampleUserQuestions || []);
    return candidates.some(function (candidate) {
      return normalizeText(candidate) === normalizedInput;
    });
  }

  function matchIntent(data, userText) {
    var normalizedInput = normalizeText(userText);
    if (!normalizedInput) {
      return null;
    }

    var matchedIntent = null;
    var matchCount = 0;

    getApprovedIntents(data).forEach(function (intent) {
      if (intentMatchesText(intent, normalizedInput)) {
        matchedIntent = intent;
        matchCount += 1;
      }
    });

    return matchCount === 1 ? matchedIntent : null;
  }

  window.BCFChatIntents = {
    load: load,
    getApprovedIntents: getApprovedIntents,
    getIntentById: getIntentById,
    getQuickButtonIntents: getQuickButtonIntents,
    matchIntent: matchIntent,
    MVP_QUICK_BUTTON_IDS: MVP_QUICK_BUTTON_IDS,
    UNSUPPORTED_MESSAGE: UNSUPPORTED_MESSAGE,
  };
})();
