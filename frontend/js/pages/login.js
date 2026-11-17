/* Sign-in page. Talks only to POST /auth/login and /auth/register through the API service layer; the token is kept in sessionStorage. */
(function () {
  const $ = (s) => document.querySelector(s), say = (t, ok) => ($("#msg").innerHTML = t ? `<div class="${ok ? "banner live" : "errorbox"}" style="margin:0">${WW.esc(t)}</div>` : "");
  $("#logo").innerHTML = WW.icon("zap", 26);
  async function submit(register) {
    const e = WW.validate.email($("#em").value), p = WW.validate.password($("#pw").value);
    if (!e.ok) return say(e.message); if (!p.ok) return say(p.message);
    $("#go").disabled = $("#reg").disabled = true; say("");
    try {
      if (register) { await WW.api.services.auth.register(e.value, p.value); say("Account created. You can sign in now.", true); }
      else { await WW.api.services.auth.login(e.value, p.value); WW.mode.set("live"); const next = new URLSearchParams(location.search).get("next"); location.href = /^[a-z0-9-]+\.html$/i.test(next || "") ? next : "dashboard.html"; }
    } catch (err) { say(err.code === "network" || err.code === "timeout" ? err.message : err.code === "unauthorized" ? "Wrong email or password." : err.message); }
    $("#go").disabled = $("#reg").disabled = false;
  }
  $("#go").onclick = () => submit(false); $("#reg").onclick = () => submit(true);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Enter") submit(false); });
})();
