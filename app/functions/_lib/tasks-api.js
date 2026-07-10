// Shared Google Tasks API helpers used by both /api/tasks/[list] and
// /api/tasks/[list]/strike.

const BASE = 'https://tasks.googleapis.com/tasks/v1';

// Map URL list name → CF env var holding the Google Tasks list ID.
const LIST_ENV = {
  todos: 'GOOGLE_TASKS_LIST_TODOS_ID',
  groceries: 'GOOGLE_TASKS_LIST_GROCERIES_ID',
};

export function listIdFor(env, listName) {
  const envKey = LIST_ENV[listName];
  if (!envKey) return null;
  return env[envKey] || null;
}

export async function listTasks(accessToken, listId) {
  const url = new URL(`${BASE}/lists/${encodeURIComponent(listId)}/tasks`);
  url.searchParams.set('showCompleted', 'true');
  url.searchParams.set('showDeleted', 'false');
  url.searchParams.set('showHidden', 'false');
  url.searchParams.set('maxResults', '100');
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`tasks list ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json();
  return data.items || [];
}

export async function insertTask(accessToken, listId, title) {
  const res = await fetch(`${BASE}/lists/${encodeURIComponent(listId)}/tasks`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`tasks insert ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

// Move a task to a new position in the list. `previousId` (optional) is the ID
// of the task it should go after — omit to move to the top.
export async function moveTask(accessToken, listId, taskId, previousId) {
  const url = new URL(`${BASE}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}/move`);
  if (previousId) url.searchParams.set('previous', previousId);
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`tasks move ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

export async function completeTask(accessToken, listId, taskId) {
  return setTaskCompleted(accessToken, listId, taskId, true);
}

export async function setTaskCompleted(accessToken, listId, taskId, done) {
  return patchTask(accessToken, listId, taskId, done
    ? { status: 'completed' }
    : { status: 'needsAction', completed: null });
}

// Rename a task in place (inline edit on the dashboard).
export async function updateTaskTitle(accessToken, listId, taskId, title) {
  return patchTask(accessToken, listId, taskId, { title });
}

async function patchTask(accessToken, listId, taskId, fields) {
  const res = await fetch(`${BASE}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = new Error(`tasks patch ${res.status}: ${await res.text().catch(() => '')}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Normalize the Google task shape into the dashboard's { text, done } contract.
// Sort: incomplete first (by position), then completed (by completion time desc).
export function normalize(items) {
  const todo = items
    .filter(i => i.status !== 'completed')
    .sort((a, b) => (a.position || '').localeCompare(b.position || ''));
  const done = items
    .filter(i => i.status === 'completed')
    .sort((a, b) => (b.completed || '').localeCompare(a.completed || ''));
  return [...todo, ...done].map(i => ({
    id: i.id,
    text: i.title || '',
    done: i.status === 'completed',
  }));
}

// Case-insensitive substring match against incomplete items only. Returns
// 'zero', 'multi' (with details), or 'one' (with the matching id).
export function findStrikeTarget(items, text) {
  const needle = text.toLowerCase();
  const matches = items.filter(i => i.status !== 'completed' && (i.title || '').toLowerCase().includes(needle));
  if (matches.length === 0) return { kind: 'zero' };
  if (matches.length > 1) return { kind: 'multi', candidates: matches.map(m => m.title) };
  return { kind: 'one', id: matches[0].id, title: matches[0].title };
}
