/* Shared by index.html and index.staging.html.
   Load telegram-web-app.js only inside Telegram. A normal browser resolves
   window.__tgReady immediately and never touches telegram.org. */
(function () {
  var done, p = new Promise(function (r) { done = r; });
  window.__tgReady = p;
  function insideTelegram() {
    try {
      var q = String(location.search || "") + String(location.hash || "");
      if (/tgWebAppData|tgWebAppPlatform/i.test(q)) return true;
      if (window.TelegramWebviewProxy) return true;
      var ext = window.external;
      if (ext && typeof ext.notify === "function") return true;
    } catch (e) {}
    return false;
  }
  if (!insideTelegram()) { done(false); return; }
  var opened = false;
  /* ready/expand before the SDK onload races an undefined WebApp. If initData is
     still empty on first onload, retry — otherwise expand/disableVerticalSwipes never run
     and the Mini App stays a short sheet with a pullable bottom bar. */
  function openMiniApp() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return false;
    var data = typeof tg.initData === "string" ? tg.initData : "";
    var platform = typeof tg.platform === "string" ? tg.platform : "";
    if (!data && (!platform || platform === "unknown")) return false;
    opened = true;
    try { tg.ready(); } catch (e) {}
    try { tg.expand(); } catch (e) {}
    /* disableVerticalSwipes: Telegram's swipe-to-collapse only (Bot API 7.7+).
       The in-game upward swipe for the hero ability is handled by the game and is left alone. */
    try {
      var atLeast = function (v) {
        try { return !(tg.isVersionAtLeast) || tg.isVersionAtLeast(v); } catch (e) { return true; }
      };
      if (atLeast("7.7") && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if ((platform === "ios" || platform === "android") && atLeast("8.0") && tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e2) {}
      }
    } catch (e) {}
    try {
      if (tg.onEvent) tg.onEvent("viewportChanged", function () { try { tg.expand(); } catch (e3) {} });
    } catch (e4) {}
    return true;
  }
  var tries = 0;
  function tryOpen() {
    try { if (openMiniApp()) return; } catch (e) {}
    if (++tries < 20) setTimeout(tryOpen, 200);
  }
  var s = document.createElement("script");
  s.src = "https://telegram.org/js/telegram-web-app.js";
  s.async = true;
  s.onload = function () {
    try { tryOpen(); } catch (e) {}
    done(true);
  };
  s.onerror = function () { done(false); };
  setTimeout(function () { done(false); }, 4000);
  document.head.appendChild(s);
})();
