/* ============================================================================
 * 登录 / 注册页（由 middleware 直接返回，不经过 React 应用）
 * 视觉与工作台一致：黑白灰、玻璃卡片、超椭圆圆角；跟随系统深浅色
 * ========================================================================== */

export function loginPage(): string {
  return `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<meta name="color-scheme" content="light dark" />
<title>简历工作台 · 登录</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%230b0b0c'/%3E%3C/svg%3E" />
<style>
  :root {
    --bg: #e6e6e8; --fg: #0b0b0c; --fg3: #6c6c73; --fg4: #a2a2a9;
    --glass-top: rgb(255 255 255 / .74); --glass-bottom: rgb(255 255 255 / .52);
    --rim: rgb(255 255 255 / 1); --edge: rgb(0 0 0 / .06); --field: rgb(255 255 255 / .72); --hair: rgb(0 0 0 / .13);
    --solid: #0b0b0c; --on-solid: #fafafa; --danger: #b4231a;
    --shadow: 0 1px 1px rgb(0 0 0 / .03), 0 10px 28px -10px rgb(0 0 0 / .14), 0 34px 70px -28px rgb(0 0 0 / .16);
    --light: rgb(255 255 255 / .9); --shade: rgb(0 0 0 / .09);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0c0c0e; --fg: #f3f3f5; --fg3: #8d8d95; --fg4: #5c5c63;
      --glass-top: rgb(38 38 42 / .62); --glass-bottom: rgb(24 24 27 / .5);
      --rim: rgb(255 255 255 / .2); --edge: rgb(255 255 255 / .05); --field: rgb(255 255 255 / .04); --hair: rgb(255 255 255 / .14);
      --solid: #f3f3f5; --on-solid: #0b0b0c; --danger: #ff7a6e;
      --shadow: 0 1px 1px rgb(0 0 0 / .4), 0 14px 34px -10px rgb(0 0 0 / .55), 0 40px 90px -30px rgb(0 0 0 / .7);
      --light: rgb(255 255 255 / .07); --shade: rgb(0 0 0 / .5);
    }
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: "Inter", "PingFang SC", "Hiragino Sans GB", system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased; color: var(--fg); background: var(--bg);
    background-image:
      radial-gradient(1100px 760px at 12% -12%, var(--light), transparent 62%),
      radial-gradient(900px 640px at 92% 4%, var(--light), transparent 60%),
      radial-gradient(1200px 900px at 105% 115%, var(--shade), transparent 62%);
    display: grid; place-items: center; padding: 24px;
  }
  .card {
    position: relative; width: 100%; max-width: 380px; padding: 36px 32px 30px; border-radius: 30px;
    background: linear-gradient(180deg, var(--glass-top), var(--glass-bottom));
    -webkit-backdrop-filter: blur(26px) saturate(1.7); backdrop-filter: blur(26px) saturate(1.7);
    box-shadow: var(--shadow), inset 0 0 0 1px var(--edge), inset 0 1px 0 var(--rim);
    animation: rise 560ms cubic-bezier(.22, 1, .36, 1) both;
  }
  @supports (corner-shape: squircle) { .card, .mark, input, .submit, .send { corner-shape: squircle; } .card { border-radius: 52px; } }
  @keyframes rise { from { opacity: 0; transform: translateY(10px) scale(.985); } }
  .mark { width: 44px; height: 44px; border-radius: 14px; background: var(--solid); color: var(--on-solid);
    display: grid; place-items: center; margin-bottom: 26px; }
  h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -.03em; }
  p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.65; color: var(--fg3); }
  .tabs { position: relative; display: flex; margin-top: 24px; padding: 3px; border-radius: 999px;
    background: var(--field); box-shadow: inset 0 0 0 1px var(--hair); }
  .tabs button { position: relative; z-index: 1; flex: 1; margin: 0; height: 32px; border-radius: 999px;
    background: transparent; color: var(--fg3); box-shadow: none; font-size: 13px; font-weight: 500; }
  .tabs button[aria-selected="true"] { color: var(--fg); }
  .thumb { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc(50% - 3px); border-radius: 999px;
    background: var(--glass-top); box-shadow: 0 1px 2px rgb(0 0 0 / .08), inset 0 0 0 1px var(--edge), inset 0 1px 0 var(--rim);
    transition: transform .32s cubic-bezier(.22, 1, .36, 1); }
  .tabs[data-mode="register"] .thumb { transform: translateX(100%); }
  form { margin-top: 14px; display: grid; gap: 10px; }
  input {
    width: 100%; height: 46px; padding: 0 16px; border: 0; border-radius: 16px; outline: none;
    background: var(--field); color: var(--fg); font-family: inherit; font-size: 15px; font-weight: 500;
    box-shadow: inset 0 0 0 1px var(--hair); transition: box-shadow .24s;
  }
  input::placeholder { color: var(--fg4); font-weight: 400; font-size: 14px; }
  input:focus { box-shadow: inset 0 0 0 1px var(--fg3), 0 0 0 4px rgb(127 127 127 / .12); }
  [hidden] { display: none !important; }
  .code-row { display: flex; gap: 8px; }
  .code-row input { flex: 1; min-width: 0; letter-spacing: .18em; }
  .code-row input::placeholder { letter-spacing: normal; }
  .send { flex: none; height: 46px; padding: 0 16px; border-radius: 16px; font-size: 13px; font-weight: 600;
    background: var(--field); color: var(--fg); box-shadow: inset 0 0 0 1px var(--hair); white-space: nowrap;
    transition: transform .16s cubic-bezier(.22, 1, .36, 1), opacity .2s; }
  .send:disabled { color: var(--fg3); opacity: 1; }
  .err.ok { color: var(--fg3); }
  .submit {
    margin-top: 4px; width: 100%; height: 46px; border: 0; border-radius: 999px; cursor: pointer;
    background: var(--solid); color: var(--on-solid); font-family: inherit; font-size: 14px; font-weight: 600;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / .16), 0 6px 16px -6px rgb(0 0 0 / .35);
    transition: transform .16s cubic-bezier(.22, 1, .36, 1), opacity .2s;
  }
  button { font-family: inherit; cursor: pointer; border: 0; }
  button:active { transform: scale(.97); }
  button:disabled { opacity: .45; }
  .err { min-height: 20px; margin-top: 2px; font-size: 13px; color: var(--danger); }
  .foot { margin-top: 18px; font-size: 12px; color: var(--fg4); }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
</head>
<body>
  <main class="card">
    <div class="mark" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10.6 16.5H5.6a.8.8 0 0 1-.8-.8V4.3a.8.8 0 0 1 .8-.8h5.2l3.4 3.4v2.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M7.6 9.2h3.6M7.6 11.8h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M14.6 10.8c.28 1.9 1 3.08 3.1 3.7-2.1.62-2.82 1.8-3.1 3.7-.28-1.9-1-3.08-3.1-3.7 2.1-.62 2.82-1.8 3.1-3.7z" fill="currentColor"/>
      </svg>
    </div>
    <h1>简历工作台</h1>
    <p id="lead">登录后 30 天内不用再输。</p>
    <div class="tabs" id="tabs" data-mode="login" role="tablist">
      <span class="thumb" aria-hidden="true"></span>
      <button type="button" role="tab" data-mode="login" aria-selected="true">登录</button>
      <button type="button" role="tab" data-mode="register" aria-selected="false">注册</button>
    </div>
    <form id="f" autocomplete="on">
      <input id="email" name="email" type="email" placeholder="邮箱" autocomplete="email" autofocus spellcheck="false" autocapitalize="off" />
      <div class="code-row" id="codeRow" hidden>
        <input id="code" name="code" inputmode="numeric" maxlength="6" placeholder="验证码" autocomplete="one-time-code" />
        <button id="send" class="send" type="button">发送验证码</button>
      </div>
      <input id="nick" name="nick" placeholder="怎么称呼你（站长靠它认出你，比如微信名）" autocomplete="nickname" hidden />
      <input id="pw" name="password" type="password" placeholder="密码" autocomplete="current-password" />
      <button id="go" class="submit" type="submit">登录</button>
      <div class="err" id="err" role="alert"></div>
    </form>
    <div class="foot" id="foot">没有账号？点上面的「注册」，注册就送一笔 AI 试用额度。</div>
  </main>
<script>
  const $ = (id) => document.getElementById(id);
  const f = $("f"), tabs = $("tabs"), email = $("email"), codeRow = $("codeRow"), code = $("code"), send = $("send"),
        nick = $("nick"), pw = $("pw"), btn = $("go"), err = $("err"), lead = $("lead"), foot = $("foot");
  let mode = "login", timer = 0;
  function say(text, ok) { err.textContent = text; err.className = ok ? "err ok" : "err"; }
  function setMode(m) {
    mode = m;
    tabs.dataset.mode = m;
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
    const reg = m === "register";
    codeRow.hidden = !reg;
    nick.hidden = !reg;
    pw.placeholder = reg ? "设一个密码（至少 6 位）" : "密码";
    pw.autocomplete = reg ? "new-password" : "current-password";
    btn.textContent = reg ? "注册并进入" : "登录";
    lead.textContent = reg ? "一个邮箱只能注册一次。称呼让站长知道你是谁。" : "登录后 30 天内不用再输。";
    foot.textContent = reg ? "AI 额度用完了，找站长加。也可以在头像菜单里填自己的模型密钥。" : "没有账号？点上面的「注册」，注册就送一笔 AI 试用额度。";
    say("");
    email.focus();
  }
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-mode]");
    if (b && b.dataset.mode !== mode) setMode(b.dataset.mode);
  });
  async function post(path, body) {
    const res = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "没成功，稍后再试");
    return data;
  }
  function countdown(sec) {
    clearInterval(timer);
    send.disabled = true;
    const tick = () => {
      send.textContent = sec > 0 ? sec + " 秒后重发" : "重新发送";
      if (sec-- <= 0) { clearInterval(timer); send.disabled = false; }
    };
    tick();
    timer = setInterval(tick, 1000);
  }
  send.addEventListener("click", async () => {
    const value = email.value.trim();
    if (!value) { say("先填邮箱"); email.focus(); return; }
    send.disabled = true; say("");
    try {
      await post("/__auth/code", { email: value });
      say("验证码已发到 " + value + "，没收到的话看看垃圾邮件", true);
      countdown(60);
      code.focus();
    } catch (x) {
      say(x.message); send.disabled = false;
    }
  });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = { email: email.value.trim(), password: pw.value, code: code.value.trim(), nick: nick.value.trim() };
    if (!body.email || !body.password) { say("邮箱和密码都要填"); return; }
    if (mode === "register" && !body.code) { say("先点「发送验证码」，填邮箱里收到的 6 位数"); code.focus(); return; }
    if (mode === "register" && !body.nick) { say("填一个称呼，站长靠它认出你"); nick.focus(); return; }
    btn.disabled = true; say("");
    try {
      const data = await post(mode === "register" ? "/__auth/register" : "/__auth/login", body);
      // 个人密钥：工作台连接本机执行器、生成安装命令都要用到它
      try { localStorage.setItem("resume-ai/invite-code", data.key || ""); } catch (_) {}
      location.replace(location.pathname + location.search);
    } catch (x) {
      say(x.message); btn.disabled = false;
    }
  });
</script>
</body>
</html>`;
}
