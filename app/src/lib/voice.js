import { createMockVoice } from './voice-mock.js';

const TOKEN = import.meta.env.VITE_DASHBOARD_TOKEN;
const FORCE_MOCK = typeof location !== 'undefined' && new URLSearchParams(location.search).get('voice') === 'mock';
const LIVE_MODE = Boolean(TOKEN && import.meta.env.VITE_VOICE_LIVE === '1' && !FORCE_MOCK);

export class VoiceError extends Error {
  constructor(code, message, status = 0) { super(message); this.name = 'VoiceError'; this.code = code; this.status = status; }
}

export function isSupported({ navigatorRef = navigator, mediaRecorderCtor = globalThis.MediaRecorder } = {}) {
  return Boolean(navigatorRef.mediaDevices?.getUserMedia && mediaRecorderCtor);
}

export function createRecorder({
  getUserMedia = constraints => navigator.mediaDevices.getUserMedia(constraints),
  mediaRecorderCtor = globalThis.MediaRecorder,
  audioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext,
  maxMs = 30_000,
  onAutoStop = () => {},
} = {}) {
  let recorder = null;
  let stream = null;
  let context = null;
  let analyser = null;
  let sampleTimer = null;
  let hardTimer = null;
  let chunks = [];
  let levelListener = () => {};
  let stopPromise = null;
  let resolveStop = null;

  async function start() {
    if (recorder?.state === 'recording') return;
    stream = await getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    try {
      const preferred = 'audio/webm;codecs=opus';
      const mimeType = mediaRecorderCtor.isTypeSupported?.(preferred) ? preferred : '';
      recorder = new mediaRecorderCtor(stream, mimeType ? { mimeType } : undefined);
      chunks = [];
      stopPromise = new Promise(resolve => { resolveStop = resolve; });
      recorder.addEventListener('dataavailable', event => { if (event.data?.size) chunks.push(event.data); });
      recorder.addEventListener('stop', finish, { once: true });
      recorder.start(250);

      if (audioContextCtor) {
        context = new audioContextCtor();
        analyser = context.createAnalyser(); analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        sampleLevel();
      }
      hardTimer = setTimeout(() => {
        if (recorder?.state === 'recording') { recorder.stop(); onAutoStop(); }
      }, maxMs);
    } catch (error) {
      if (recorder?.state === 'recording') recorder.stop();
      else stream?.getTracks().forEach(track => track.stop());
      throw error;
    }
  }

  function sampleLevel() {
    if (!analyser || recorder?.state !== 'recording') return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / data.length);
    levelListener(Math.min(1, rms * 4));
    sampleTimer = setTimeout(sampleLevel, 100);
  }

  function finish() {
    clearTimeout(hardTimer); clearTimeout(sampleTimer); levelListener(0);
    stream?.getTracks().forEach(track => track.stop());
    context?.close?.().catch?.(() => {});
    resolveStop?.(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
  }

  async function stop() {
    if (!recorder) return new Blob([], { type: 'audio/webm' });
    if (recorder.state === 'recording') recorder.stop();
    return stopPromise;
  }

  return { start, stop, onLevel(listener) { levelListener = listener; return () => { levelListener = () => {}; }; } };
}

async function request(path, init) {
  let response;
  try { response = await fetch(path, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) } }); }
  catch { throw new VoiceError('NETWORK', 'The dashboard could not reach the voice service'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = response.status === 413 ? 'TOO_LARGE' : response.status === 429 ? 'RATE_LIMIT' : response.status === 504 ? 'TIMEOUT' : response.status >= 500 ? 'SERVICE' : 'REQUEST';
    throw new VoiceError(code, data.error || 'Voice request failed', response.status);
  }
  return data;
}

export async function transcribe(blob) {
  const data = await request('/api/voice/transcribe', { method: 'POST', headers: { 'content-type': blob.type || 'audio/webm' }, body: blob });
  return data.transcript || '';
}
export async function sendCommand(text) {
  return request('/api/voice/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
}

const liveVoice = { isSupported, createRecorder, transcribe, sendCommand, isConfigured: LIVE_MODE };
export const voice = LIVE_MODE ? liveVoice : createMockVoice();
export const isConfigured = LIVE_MODE;
