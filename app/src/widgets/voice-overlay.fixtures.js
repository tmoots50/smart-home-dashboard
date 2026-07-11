const transcript = 'Add paper towels to the grocery list.';
export const states = {
  recording: { kind: 'recording', level: .68, elapsed: 8 },
  transcribing: { kind: 'transcribing' },
  confirm: { kind: 'confirm', transcript, countdown: 4, paused: false },
  'confirm-paused': { kind: 'confirm', transcript, countdown: 3, paused: true },
  empty: { kind: 'confirm', transcript: '', countdown: 5, paused: true },
  sending: { kind: 'sending', transcript, elapsed: 7 },
  reply: { kind: 'reply', transcript, reply: 'Done — I added paper towels to the grocery list.' },
  sent: { kind: 'sent', transcript },
  'error-mic': { kind: 'error', errorType: 'mic' },
  'error-stt': { kind: 'error', errorType: 'stt' },
  'error-relay': { kind: 'error', errorType: 'relay', transcript },
  'error-rate': { kind: 'error', errorType: 'rate', transcript },
};

