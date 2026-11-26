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
  var s = document.createElement("script");
  s.src = "https://telegram.org/js/telegram-web-app.js";
  s.async = true;
  s.onload = function () {
    try { window.Telegram && Telegram.WebApp && Telegram.WebApp.ready(); } catch (e) {}
    done(true);
  };
  s.onerror = function () { done(false); };
  setTimeout(function () { done(false); }, 4000);
  document.head.appendChild(s);
})();
