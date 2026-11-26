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
  /* One call, only from the SDK script's onload. ready/expand/fullscreen
     before that races an undefined WebApp. */
  function openMiniApp() {
    if (opened) return;
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    var data = typeof tg.initData === "string" ? tg.initData : "";
    var platform = typeof tg.platform === "string" ? tg.platform : "";
    if (!data && (!platform || platform === "unknown")) return;
    opened = true;
    try { tg.ready(); } catch (e) {}
    try { tg.expand(); } catch (e) {}
    var atLeast = function (v) {
      try { return !!(tg.isVersionAtLeast && tg.isVersionAtLeast(v)); } catch (e) { return false; }
    };
    if (atLeast("8.0")) {
      try { if (tg.requestFullscreen) tg.requestFullscreen(); } catch (e) {}
    }
    if (atLeast("7.7")) {
      try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) {}
    }
  }
  var s = document.createElement("script");
  s.src = "https://telegram.org/js/telegram-web-app.js";
  s.async = true;
  s.onload = function () {
    try { openMiniApp(); } catch (e) {}
    done(true);
  };
  s.onerror = function () { done(false); };
  setTimeout(function () { done(false); }, 4000);
  document.head.appendChild(s);
})();
