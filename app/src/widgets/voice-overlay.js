import { openHermesChat } from '../lib/telegram.js';

const SVG = 'viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const CLOSE = `<svg ${SVG}><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const MIC = `<svg ${SVG}><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>`;
const SPARK = `<svg ${SVG}><path d="M12 3l1.4 4.1L17 9l-3.6 1.9L12 15l-1.4-4.1L7 9l3.6-1.9L12 3zM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15z"/></svg>`;

export function renderVoiceOverlay(state) {
  const kind = state.kind || 'recording';
  return `<section class="overlay__panel voice-overlay voice-overlay--${kind}" role="dialog" aria-modal="true" aria-label="Voice command">
    <header class="voice-overlay__header">
      <div><span class="voice-overlay__eyebrow">Hermes</span><h2 class="overlay__title">${titleFor(kind)}</h2></div>
      <button class="overlay__close" data-voice-action="cancel" aria-label="Close voice command">${CLOSE}</button>
    </header>
    <div class="voice-overlay__body">${renderBody(state)}</div>
  </section>`;
}

function renderBody(state) {
  switch (state.kind) {
    case 'recording': return `
      <button class="voice-recording" data-voice-action="stop" aria-label="Stop recording">
        <span class="voice-recording__orb"><i></i>${MIC}</span>
        <span class="voice-levels" aria-hidden="true">${Array.from({ length: 9 }, (_, index) => `<i style="--voice-level:${barHeight(state.level || .12, index)}"></i>`).join('')}</span>
        <strong>Listening…</strong><small>Tap anywhere here when you’re done</small>
        <span class="voice-recording__time">${formatTime(state.elapsed || 0)} <b>·</b> 0:30 max</span>
      </button>`;
    case 'transcribing': return renderWaiting('Turning your voice into words', 'This usually takes a moment.');
    case 'sending': return renderWaiting('Hermes is thinking', `Your request is in Telegram${'.'.repeat((state.elapsed || 0) % 4)}`);
    case 'confirm': return renderConfirm(state);
    case 'reply': return `<div class="voice-exchange"><div class="voice-exchange__you"><span>You</span>${escapeHtml(state.transcript)}</div><div class="voice-reply"><span>${SPARK} Hermes</span><p>${formatReply(state.reply)}</p></div></div><button class="voice-btn voice-btn--primary" data-voice-action="done">Done</button>`;
    case 'sent': return `<div class="voice-sent"><span>✓</span><h3>Sent to Hermes</h3><p>The reply is taking a little longer and will land in Telegram.</p></div><div class="voice-actions"><button class="voice-btn" data-voice-action="fallback">Open Telegram</button><button class="voice-btn voice-btn--primary" data-voice-action="done">Done</button></div>`;
    case 'error': return renderError(state);
    default: return '';
  }
}

function renderConfirm(state) {
  const countdown = Math.max(0, state.countdown ?? 5);
  const empty = !state.transcript?.trim();
  return `
    <button class="voice-transcript ${state.paused ? 'is-paused' : ''}" data-voice-action="pause" ${empty ? 'disabled' : ''}>
      <span>${empty ? 'Didn’t catch that' : 'I heard'}</span>
      <q>${empty ? 'Try once more, a little closer to the tablet.' : escapeHtml(state.transcript)}</q>
      ${!empty ? `<small>${state.paused ? 'Auto-send paused' : 'Tap the transcript to pause auto-send'}</small>` : ''}
    </button>
    <div class="voice-actions voice-actions--confirm">
      <button class="voice-btn" data-voice-action="cancel">Cancel</button>
      <button class="voice-btn" data-voice-action="rerecord">Re-record</button>
      <button class="voice-btn voice-btn--send" data-voice-action="send" ${empty ? 'disabled' : ''} style="--countdown:${countdown / 5}">
        <span>${state.paused ? 'Send now' : `Send · ${countdown}`}</span>
      </button>
    </div>`;
}

function renderWaiting(heading, copy) {
  return `<div class="voice-waiting"><span class="voice-waiting__mark">${SPARK}<i></i><i></i><i></i></span><h3>${heading}</h3><p>${copy}</p></div><button class="voice-btn voice-btn--quiet" data-voice-action="cancel">Cancel</button>`;
}

function renderError(state) {
  const copy = errorCopy(state.errorType);
  return `<div class="voice-error"><span>!</span><h3>${copy.title}</h3><p>${copy.body}</p></div><div class="voice-actions"><button class="voice-btn" data-voice-action="fallback">Open Telegram</button><button class="voice-btn voice-btn--primary" data-voice-action="${state.errorType === 'mic' ? 'done' : 'rerecord'}">${state.errorType === 'mic' ? 'Close' : 'Try again'}</button></div>`;
}

function errorCopy(type) {
  if (type === 'mic') return { title: 'Microphone access is off', body: 'Allow microphone access for Fully Kiosk, then open voice again. Telegram is always available as a fallback.' };
  if (type === 'stt') return { title: 'I couldn’t make that out', body: 'No message was sent. Try again a little closer to the tablet.' };
  if (type === 'rate') return { title: 'A quick breather', body: 'Too many commands arrived at once. Wait a minute, or continue in Telegram.' };
  return { title: 'Hermes is out of reach', body: 'Your command was not lost locally, but the relay could not be reached. Try Telegram instead.' };
}

export function openVoiceOverlay(voice) {
  if (document.querySelector('.voice-overlay-host')) return () => {};
  const host = document.createElement('div');
  host.className = 'overlay voice-overlay-host';
  document.body.appendChild(host);
  document.documentElement.classList.add('has-overlay');
  let state = { kind: 'recording', level: 0, elapsed: 0 };
  let recorder = null;
  let closed = false;
  let stopping = false;
  let countdownTimer = null;
  let elapsedTimer = null;
  let dismissTimer = null;
  let stopTimer = null;
  const draw = () => { if (!closed) host.innerHTML = renderVoiceOverlay(state); };
  const set = patch => { state = { ...state, ...patch }; draw(); };
  const clearTimers = () => { clearInterval(countdownTimer); clearInterval(elapsedTimer); clearTimeout(dismissTimer); clearTimeout(stopTimer); };
  const close = () => { if (closed) return; closed = true; clearTimers(); recorder?.stop?.().catch?.(() => {}); document.removeEventListener('keydown', onKey); host.remove(); document.documentElement.classList.remove('has-overlay'); };
  const onKey = event => { if (event.key === 'Escape') close(); };

  async function beginRecording() {
    clearTimers(); stopping = false;
    set({ kind: 'recording', level: 0, elapsed: 0 });
    recorder = voice.createRecorder({ onAutoStop: finishRecording });
    recorder.onLevel(level => { state.level = level; const levels = host.querySelectorAll('.voice-levels i'); levels.forEach((bar, index) => bar.style.setProperty('--voice-level', barHeight(level, index))); });
    try {
      await recorder.start();
      const started = Date.now();
      elapsedTimer = setInterval(() => set({ elapsed: Math.floor((Date.now() - started) / 1000) }), 1000);
      stopTimer = setTimeout(finishRecording, 30_000);
    } catch { set({ kind: 'error', errorType: 'mic' }); }
  }
  async function finishRecording() {
    if (stopping || state.kind !== 'recording') return;
    stopping = true; clearTimers(); set({ kind: 'transcribing' });
    try {
      const blob = await recorder.stop();
      const transcript = await voice.transcribe(blob);
      set({ kind: 'confirm', transcript, countdown: 5, paused: !transcript.trim() });
      if (transcript.trim()) startCountdown();
    } catch (error) { set({ kind: 'error', errorType: error.code === 'TOO_LARGE' ? 'stt' : 'stt' }); }
  }
  function startCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      if (state.kind !== 'confirm' || state.paused) return;
      const countdown = state.countdown - 1;
      set({ countdown });
      if (countdown <= 0) send();
    }, 1000);
  }
  async function send() {
    if (state.kind !== 'confirm' || !state.transcript?.trim()) return;
    clearTimers(); const transcript = state.transcript; set({ kind: 'sending', transcript, elapsed: 0 });
    elapsedTimer = setInterval(() => set({ elapsed: state.elapsed + 1 }), 1000);
    try {
      const result = await voice.sendCommand(transcript); clearTimers();
      if (result.status === 'replied' && result.reply) { set({ kind: 'reply', transcript, reply: result.reply }); dismissTimer = setTimeout(close, 20_000); }
      else { set({ kind: 'sent', transcript }); dismissTimer = setTimeout(close, 6000); }
    } catch (error) {
      clearTimers();
      if (error.code === 'TIMEOUT') { set({ kind: 'sent', transcript }); dismissTimer = setTimeout(close, 6000); }
      else set({ kind: 'error', errorType: error.code === 'RATE_LIMIT' ? 'rate' : 'relay', transcript });
    }
  }

  host.addEventListener('click', event => {
    const button = event.target.closest('[data-voice-action]');
    if (!button) { if (event.target === host) close(); return; }
    const action = button.dataset.voiceAction;
    if (action === 'cancel' || action === 'done') return close();
    if (action === 'stop') return finishRecording();
    if (action === 'pause' && state.kind === 'confirm') return set({ paused: true });
    if (action === 'rerecord') return beginRecording();
    if (action === 'send') return send();
    if (action === 'fallback') { openHermesChat(); return close(); }
  });
  document.addEventListener('keydown', onKey);
  draw(); beginRecording();
  return close;
}

function titleFor(kind) {
  if (kind === 'recording') return 'What can I help with?';
  if (kind === 'confirm') return 'Before I send it';
  if (kind === 'reply') return 'Here’s what I found';
  if (kind === 'sent') return 'On its way';
  if (kind === 'error') return 'Let’s try another way';
  return 'One moment';
}
function barHeight(level, index) { return `${Math.round(16 + Math.max(.04, level) * (42 + (index % 4) * 12))}%`; }
function formatTime(seconds) { return `0:${String(seconds).padStart(2, '0')}`; }
function formatReply(value) { return escapeHtml(value || '').replace(/\n/g, '<br>'); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

