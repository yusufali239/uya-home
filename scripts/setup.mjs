#!/usr/bin/env node
/**
 * UYA HOME — установка «под ключ» одной командой:
 *
 *   node scripts/setup.mjs
 *
 * В песочницах с HTTP-прокси (Node 22+) запускайте с NODE_USE_ENV_PROXY=1.
 *
 * Шаги (каждый пропускается, если для него нет ключа):
 *   1. Миграции Supabase              — SUPABASE_ACCESS_TOKEN (или SUPABASE_DB_URL + psql)
 *   2. Аккаунт директора              — SUPABASE_SERVICE_ROLE_KEY + DIRECTOR_EMAIL
 *   3. chat_id мастера в Telegram     — TELEGRAM_BOT_TOKEN (мастер заранее пишет боту /start)
 *   4. Проект Vercel, переменные, деплой — VERCEL_TOKEN
 *   5. Вебхук бота + проверочное сообщение
 *
 * Скрипт можно запускать повторно: применённые миграции и созданные
 * пользователи пропускаются, переменные Vercel перезаписываются.
 */

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─── .env.local / .env (если есть) — не перезаписывают уже заданные переменные ───
for (const file of ['.env.local', '.env']) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const env = process.env;
const GITHUB_REPO = env.GITHUB_REPO || 'yusufali239/uya-home';
const PROJECT_NAME = env.VERCEL_PROJECT_NAME || 'uya-home';

const log = (msg = '') => console.log(msg);
const step = (title) => log(`\n━━━ ${title} ━━━`);
const ok = (msg) => log(`  ✅ ${msg}`);
const skip = (msg) => log(`  ⏭  ${msg}`);
const warn = (msg) => log(`  ⚠️  ${msg}`);
const secret = () => randomBytes(24).toString('base64url');

/** fetch с понятной ошибкой */
async function http(url, { method = 'GET', headers = {}, body, allow = [] } = {}) {
  const res = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok && !allow.includes(res.status)) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`${method} ${url.replace(/bot[^/]+/, 'bot***')} → ${res.status}: ${detail.slice(0, 400)}`);
  }
  return { status: res.status, data };
}

const summary = {};
/** Вебхук чужого сервиса (бот занят) */
let foreignWebhook = null;

// ═════════════════════════════════════════════════════════════════════
// 1. Миграции Supabase
// ═════════════════════════════════════════════════════════════════════
const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const projectRef = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(supabaseUrl)?.[1];

/** Выполнить SQL: через Management API или psql */
function sqlRunner() {
  if (env.SUPABASE_ACCESS_TOKEN && projectRef) {
    return async (query) => {
      const { data } = await http(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
        body: { query },
      });
      return Array.isArray(data) ? data : [];
    };
  }
  if (env.SUPABASE_DB_URL) {
    return async (query) => {
      let out;
      try {
        out = execFileSync('psql', [env.SUPABASE_DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-F', '\t', '-c', query], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        // Показываем только ошибку Postgres, без текста всей миграции
        throw new Error(`psql: ${String(err.stderr || err.message).split('\n').find((l) => l.includes('ERROR')) ?? err.message}`);
      }
      // Для наших запросов нужна только первая колонка
      return out.split('\n').filter(Boolean).map((line) => ({ version: line.split('\t')[0], exists: line.split('\t')[0] }));
    };
  }
  return null;
}

async function migrate() {
  step('1. Миграции Supabase');
  const run = sqlRunner();
  if (!run) {
    skip('Нет SUPABASE_ACCESS_TOKEN (или SUPABASE_DB_URL) — миграции пропущены');
    return;
  }

  // Та же таблица учёта, что у Supabase CLI — совместимо с `supabase db push`
  await run(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text not null primary key, statements text[], name text
    );`);

  const applied = new Set((await run('select version from supabase_migrations.schema_migrations')).map((r) => r.version));
  const files = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();

  // Миграции уже применяли вручную через SQL Editor — просто отмечаем их
  if (applied.size === 0) {
    const [row] = await run("select (to_regclass('public.products') is not null)::text as exists");
    if (row?.exists === 'true') {
      warn('Таблицы уже есть (миграции применяли вручную) — отмечаю как применённые');
      for (const file of files) {
        const version = file.split('_')[0];
        await run(`insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${file}') on conflict do nothing`);
        applied.add(version);
      }
    }
  }

  for (const file of files) {
    const version = file.split('_')[0];
    if (applied.has(version)) {
      skip(`${file} — уже применена`);
      continue;
    }
    const sql = readFileSync(join(ROOT, 'supabase/migrations', file), 'utf8');
    // Миграция и отметка о ней — в одной транзакции
    await run(`begin;\n${sql}\n;insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${file}');\ncommit;`);
    ok(`${file}`);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 2. Аккаунт директора
// ═════════════════════════════════════════════════════════════════════
async function createDirector() {
  step('2. Аккаунт директора');
  if (!supabaseUrl || !env.SUPABASE_SERVICE_ROLE_KEY) {
    skip('Нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  if (!env.DIRECTOR_EMAIL) {
    skip('Не задан DIRECTOR_EMAIL — директора создадите в Supabase → Authentication → Add user');
    return;
  }

  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
  const email = env.DIRECTOR_EMAIL.trim().toLowerCase();

  const { data: list } = await http(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, { headers });
  let user = (list?.users ?? []).find((u) => u.email?.toLowerCase() === email);

  if (user) {
    skip(`Пользователь ${email} уже есть (пароль не меняю)`);
  } else {
    const password = env.DIRECTOR_PASSWORD || secret().slice(0, 14);
    const { data } = await http(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: { email, password, email_confirm: true, user_metadata: { full_name: env.DIRECTOR_NAME || 'Директор' } },
    });
    user = data;
    summary.director = { email, password };
    ok(`Создан ${email}`);
  }

  // Гарантируем роль директора (профиль создаётся триггером)
  await http(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: { role: 'director' },
  });
  ok('Роль: директор');
}

// ═════════════════════════════════════════════════════════════════════
// 3. chat_id мастера
// ═════════════════════════════════════════════════════════════════════
const tg = (method, body) =>
  http(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', body: body ?? {} }).then((r) => r.data.result);

async function findMasterChats() {
  step('3. Telegram: chat_id мастера');
  if (!env.TELEGRAM_BOT_TOKEN) {
    skip('Нет TELEGRAM_BOT_TOKEN');
    return;
  }
  const me = await tg('getMe');
  ok(`Бот: @${me.username}`);
  summary.bot = me.username;

  if (env.TELEGRAM_MASTER_CHAT_ID) {
    ok(`Задан вручную: ${env.TELEGRAM_MASTER_CHAT_ID}`);
    return;
  }

  // getUpdates не работает при активном вебхуке — временно снимаем (апдейты не теряются)
  const info = await tg('getWebhookInfo');
  if (info.url && !info.url.endsWith('/api/telegram/webhook') && env.TELEGRAM_TAKEOVER !== '1') {
    // Бот уже обслуживает другой сервис — не ломаем его без явного разрешения
    foreignWebhook = info.url;
    warn(`Бот подключён к другому сервису (${new URL(info.url).host}). Вебхук не трогаю.`);
    warn('Задайте TELEGRAM_MASTER_CHAT_ID вручную, или TELEGRAM_TAKEOVER=1, чтобы забрать бота под UYA HOME');
    return;
  }
  if (info.url) {
    if (!env.VERCEL_TOKEN) {
      // Без Vercel не сможем поставить вебхук обратно — не трогаем работающего бота
      warn('Вебхук уже стоит: chat_id пришлёт сам бот в ответ на /start');
      return;
    }
    await tg('deleteWebhook', { drop_pending_updates: false });
  }

  const updates = await tg('getUpdates', { allowed_updates: ['message'] });
  const chats = new Map();
  for (const u of updates) {
    const msg = u.message;
    if (msg?.chat?.type === 'private' && /^\/start/.test(msg.text ?? '')) {
      chats.set(String(msg.chat.id), [msg.chat.first_name, msg.chat.last_name].filter(Boolean).join(' '));
    }
  }

  if (chats.size === 0) {
    warn(`Никто не писал боту /start. Мастер: откройте https://t.me/${me.username}, нажмите «Старт» и запустите скрипт снова`);
    return;
  }
  env.TELEGRAM_MASTER_CHAT_ID = [...chats.keys()].join(',');
  for (const [id, name] of chats) ok(`${name || 'без имени'} → ${id}`);
}

// ═════════════════════════════════════════════════════════════════════
// 4. Vercel: проект, переменные, деплой
// ═════════════════════════════════════════════════════════════════════
async function deployVercel() {
  step('4. Vercel');
  if (!env.VERCEL_TOKEN) {
    skip('Нет VERCEL_TOKEN — деплой пропущен');
    return null;
  }

  const team = env.VERCEL_TEAM_ID ? `teamId=${env.VERCEL_TEAM_ID}` : '';
  const api = (path) => `https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}${team}`;
  const headers = { Authorization: `Bearer ${env.VERCEL_TOKEN}` };

  // Проект: ищем или создаём (с привязкой к GitHub, если у Vercel есть доступ к репо)
  let { status, data: project } = await http(api(`/v9/projects/${PROJECT_NAME}`), { headers, allow: [404] });
  if (status === 404) {
    const base = { name: PROJECT_NAME, framework: 'nextjs' };
    const linked = await http(api('/v11/projects'), {
      method: 'POST',
      headers,
      body: { ...base, gitRepository: { type: 'github', repo: GITHUB_REPO } },
      allow: [400, 403, 404],
    });
    if (linked.status < 300) {
      project = linked.data;
      ok(`Проект создан и привязан к GitHub ${GITHUB_REPO} (пуши будут деплоиться сами)`);
    } else {
      project = (await http(api('/v11/projects'), { method: 'POST', headers, body: base })).data;
      warn('Проект создан без привязки к GitHub (у Vercel нет доступа к репо) — деплой загрузкой файлов');
    }
  } else {
    ok(`Проект ${PROJECT_NAME} уже есть`);
  }
  if (project.framework !== 'nextjs') {
    await http(api(`/v9/projects/${project.id}`), { method: 'PATCH', headers, body: { framework: 'nextjs' } });
    ok('Фреймворк проекта: Next.js');
  }

  // Адрес продакшена
  const domains = (await http(api(`/v9/projects/${project.id}/domains`), { headers })).data?.domains ?? [];
  let appUrl = env.NEXT_PUBLIC_APP_URL || `https://${domains.find((d) => d.name.endsWith('.vercel.app'))?.name || `${PROJECT_NAME}.vercel.app`}`;

  env.TELEGRAM_WEBHOOK_SECRET ||= secret();
  env.CRON_SECRET ||= secret();

  const setEnv = async () => {
    const vars = {
      NEXT_PUBLIC_SUPABASE_URL: [supabaseUrl, 'plain'],
      NEXT_PUBLIC_SUPABASE_ANON_KEY: [env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'plain'],
      NEXT_PUBLIC_APP_URL: [appUrl, 'plain'],
      SUPABASE_SERVICE_ROLE_KEY: [env.SUPABASE_SERVICE_ROLE_KEY, 'encrypted'],
      TELEGRAM_BOT_TOKEN: [env.TELEGRAM_BOT_TOKEN, 'encrypted'],
      TELEGRAM_MASTER_CHAT_ID: [env.TELEGRAM_MASTER_CHAT_ID, 'encrypted'],
      TELEGRAM_WEBHOOK_SECRET: [env.TELEGRAM_WEBHOOK_SECRET, 'encrypted'],
      CRON_SECRET: [env.CRON_SECRET, 'encrypted'],
    };
    const body = Object.entries(vars)
      .filter(([, [value]]) => value)
      .map(([key, [value, type]]) => ({ key, value, type, target: ['production', 'preview', 'development'] }));
    await http(api(`/v10/projects/${project.id}/env?upsert=true`), { method: 'POST', headers, body });
    ok(`Переменные окружения: ${body.map((v) => v.key).join(', ')}`);
  };

  const deploy = () => {
    log('  ⏳ Деплой (2–4 минуты)…');
    const url = execFileSync('npx', ['-y', 'vercel@latest', 'deploy', '--prod', '--yes', '--archive=tgz', '--token', env.VERCEL_TOKEN], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...env, VERCEL_ORG_ID: env.VERCEL_TEAM_ID || project.accountId, VERCEL_PROJECT_ID: project.id },
    });
    ok(`Задеплоено: ${/https:\/\/\S+\.vercel\.app/.exec(url)?.[0] ?? 'готово'}`);
  };

  await setEnv();
  deploy();

  // После первого деплоя Vercel мог выдать другой домен — тогда пересобираем с правильным адресом
  const finalDomains = (await http(api(`/v9/projects/${project.id}/domains`), { headers })).data?.domains ?? [];
  const actual = finalDomains.find((d) => d.name.endsWith('.vercel.app'))?.name;
  if (!env.NEXT_PUBLIC_APP_URL && actual && `https://${actual}` !== appUrl) {
    appUrl = `https://${actual}`;
    warn(`Фактический адрес ${appUrl} — обновляю переменную и пересобираю`);
    await setEnv();
    deploy();
  }

  summary.appUrl = appUrl;
  return appUrl;
}

// ═════════════════════════════════════════════════════════════════════
// 5. Вебхук бота
// ═════════════════════════════════════════════════════════════════════
async function setupWebhook(appUrl) {
  step('5. Telegram: вебхук');
  if (!env.TELEGRAM_BOT_TOKEN) return skip('Нет TELEGRAM_BOT_TOKEN');
  if (!appUrl) return skip('Нет адреса сайта (Vercel не настроен) — вебхук не ставлю');

  if (foreignWebhook) {
    skip(`Бот занят другим сервисом (${new URL(foreignWebhook).host}) — вебхук не ставлю.`);
    skip('Уведомления мастеру всё равно уйдут, не будут работать только команды /start и /tasks');
  } else {
    await tg('setWebhook', {
      url: `${appUrl}/api/telegram/webhook`,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message'],
    });
    await tg('setMyCommands', {
      commands: [
        { command: 'start', description: 'Подключение и chat_id' },
        { command: 'tasks', description: 'Текущие задачи мастера' },
      ],
    });
    ok(`Вебхук: ${appUrl}/api/telegram/webhook`);
  }

  for (const chatId of (env.TELEGRAM_MASTER_CHAT_ID || '').split(',').filter(Boolean)) {
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✅ UYA HOME подключён. Сюда будут приходить заказы, партии и сигналы склада.\n\nЭкран мастера: ${appUrl}/master`,
    });
    ok(`Проверочное сообщение → ${chatId}`);
  }
}

// ═════════════════════════════════════════════════════════════════════
try {
  await migrate();
  await createDirector();
  await findMasterChats();
  const appUrl = await deployVercel();
  await setupWebhook(appUrl);

  step('Готово');
  if (summary.appUrl) log(`  🌐 Сайт:         ${summary.appUrl}`);
  if (summary.appUrl) log(`  📱 Мастер:       ${summary.appUrl}/master`);
  if (summary.director) log(`  👤 Директор:     ${summary.director.email} / пароль: ${summary.director.password}  ← сохраните и смените`);
  if (summary.bot) log(`  🤖 Бот:          https://t.me/${summary.bot}`);
  if (env.TELEGRAM_MASTER_CHAT_ID) log(`  💬 chat_id:      ${env.TELEGRAM_MASTER_CHAT_ID}`);
} catch (err) {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
}
