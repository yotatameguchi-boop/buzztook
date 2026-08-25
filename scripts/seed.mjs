/**
 * デモ用のサンプルデータ投入スクリプト。
 *
 * 事前に画面から1ユーザー登録しておき、その資格情報を渡して実行する:
 *   npm run dev
 *   SEED_EMAIL=you@example.com SEED_PASSWORD=... npm run seed
 *
 * API 経由で投入するため、そのまま API の使用例にもなっている（仕様書 §16）。
 */

const BASE = process.env.BUZZTOOK_URL ?? "http://localhost:3000";
const EMAIL = process.env.SEED_EMAIL;
const PASSWORD = process.env.SEED_PASSWORD;

/** Set-Cookie を貯める簡易クッキージャー */
const jar = new Map();

function storeCookies(response) {
  for (const value of response.headers.getSetCookie?.() ?? []) {
    const [pair] = value.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

function cookieHeader() {
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie: cookieHeader() },
    redirect: "manual",
  });
  storeCookies(response);
  return response;
}

/** Auth.js の Credentials フローでログインし、セッションクッキーを取得する。 */
async function login() {
  const csrfResponse = await request("/api/auth/csrf");
  const { csrfToken } = await csrfResponse.json();

  const body = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: BASE,
  });

  const response = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  // 認証失敗時は /login?error=... へリダイレクトされる
  const location = response.headers.get("location") ?? "";
  if (location.includes("error")) {
    throw new Error("ログインに失敗しました。SEED_EMAIL / SEED_PASSWORD を確認してください。");
  }
}

async function post(path, body) {
  const response = await request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} → ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/** 意図的に弱い台本（冒頭に自己紹介、フックなし、CTAなし） */
const WEAK_SCRIPT = `どうも、こんにちは。動画編集チャンネルのタメです。いつも見てくれてありがとうございます。
今日は動画編集の書き出し設定について話していきます。
書き出しの設定っていろいろありますよね。ビットレートとかフレームレートとか、正直よくわからないという人も多いと思います。私も最初は全然わかりませんでした。
まずビットレートですが、これは画質を決める数値です。次にフレームレートですが、これは滑らかさを決めます。最後に解像度ですが、これは大きさです。
というわけで、今日は書き出し設定について解説しました。`;

/** 改善後の台本（結論先出し・数字・列挙・共感・保存/コメント/シェア導線） */
const STRONG_SCRIPT = `書き出し設定、9割の人が間違えてます。この3つを直すだけで画質が変わります。
結論から言うと、ビットレート・フレームレート・解像度の順で設定してください。
まず1つ目、ビットレートは10Mbps以上。ここを下げると、どれだけ良いカメラで撮影しても画質が潰れます。
次に2つ目、フレームレートは撮影時と同じ数値に合わせる。違う数字にするとカクつきの原因になります。これ、やりがちですよね。私も最初は60で撮影して30で書き出していました。
そして3つ目が一番重要です。解像度は1080x1920。ここを間違えると、実は勝手に圧縮されて画質が落ちます。
この3つ、覚えられないと思うので保存しておいてください。
あなたはどの設定で書き出していますか。コメントで教えてください。動画編集で悩んでいる友達にもシェアしてあげてください。`;

async function main() {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      "SEED_EMAIL と SEED_PASSWORD を指定してください（先に画面からユーザー登録しておく必要があります）",
    );
  }

  console.log(`seeding → ${BASE}`);
  await login();

  const { account } = await post("/api/accounts", {
    displayName: "buzz_studio",
    followerCount: 12000,
    category: "ガジェット解説",
  });

  const { project } = await post("/api/projects", {
    title: "知らないと損する動画編集の書き出し設定3つ",
    genre: "education",
    targetDescription:
      "動画編集を始めて3ヶ月、書き出し設定でつまずいている20代の副業クリエイター",
    expectedDuration: 45,
    accountId: account.id,
  });

  for (const [label, content] of [
    ["v1（改善前）", WEAK_SCRIPT],
    ["v2（改善後）", STRONG_SCRIPT],
  ]) {
    const { script } = await post(`/api/projects/${project.id}/scripts`, { content });
    const analysis = await post(`/api/scripts/${script.id}/analyze`, {});
    const top = Math.max(1, Math.round(100 - analysis.overall_percentile));
    console.log(`  ${label}: 上位${top}%（内部スコア ${analysis.overall_score}）`);
  }

  console.log(`done → ${BASE}/projects/${project.id}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
