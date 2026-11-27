/* Built-in dictionaries are inserted here by build.sh. */
type GameLanguage = "ru" | "en";
type GameMessage = string | Record<string, string>;
type GameDictionary = Record<string, GameMessage>;
declare const GAME_I18N_BUILTIN: Record<GameLanguage, GameDictionary>;
declare const HOP_I18N_DEV: boolean;

var gameLanguageKey = "hoppak.language";
var gameLanguageChoice: GameLanguage | undefined;
try {
  var storedGameLanguage = localStorage.getItem(gameLanguageKey);
  if (storedGameLanguage === "ru" || storedGameLanguage === "en") gameLanguageChoice = storedGameLanguage;
} catch (_e) {}
var gameTranslations: Partial<Record<GameLanguage, GameDictionary>> = {};
var gamePluralRules = { ru: new Intl.PluralRules("ru"), en: new Intl.PluralRules("en") };
var gameMissingTranslations = new Set<string>();

function gameLanguage(): GameLanguage {
  if (gameLanguageChoice) return gameLanguageChoice;
  var tg = (window as any).Telegram?.WebApp;
  var raw = tg?.initDataUnsafe?.user?.language_code || navigator.language || "";
  var base = String(raw).toLowerCase().split(/[-_]/)[0];
  return base === "ru" || base === "uk" || base === "be" || base === "kk" ? "ru" : "en";
}

function gameLanguageLabel() {
  return gameLanguage() === "ru" ? t('settings.ru') : t('settings.en');
}

function toggleGameLanguage() {
  gameLanguageChoice = gameLanguage() === "ru" ? "en" : "ru";
  try { localStorage.setItem(gameLanguageKey, gameLanguageChoice); } catch (_e) {}
}

function t(key: string, params: Record<string, string | number> = {}) {
  var lang = gameLanguage();
  function resolve(locale: GameLanguage) {
    var message = gameTranslations[locale]?.[key] ?? GAME_I18N_BUILTIN[locale][key];
    if (typeof message === "string") return message;
    return message?.[gamePluralRules[locale].select(Number(params.n))] ?? message?.other;
  }
  var text = resolve(lang);
  if (text === undefined) {
    if (typeof HOP_I18N_DEV !== "undefined" && HOP_I18N_DEV && !gameMissingTranslations.has(lang + ":" + key)) {
      gameMissingTranslations.add(lang + ":" + key);
      console.warn("Missing game translation", lang, key);
    }
    text = resolve("ru") ?? key;
  }
  return text.replace(/\{([a-z][a-z0-9_]*)\}/gi, function (match, name) {
    return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
  });
}

function loadGameTranslations(origin: string, onLoaded: () => void) {
  if (!origin) return;
  fetch(origin + "/api/translations", {
    cache: "no-store",
    credentials: "omit",
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(5000) : undefined
  }).then(function (response) {
    if (!response.ok) throw new Error("Translation request failed");
    return response.json();
  }).then(function (catalog) {
    gameTranslations = catalog;
    onLoaded();
  }).catch(function () { /* Built-in translations are available offline. */ });
}
