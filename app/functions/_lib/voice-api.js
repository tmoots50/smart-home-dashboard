export const VOICE_MODELS = [
  '@cf/openai/whisper-large-v3-turbo',
  '@cf/openai/whisper',
  '@cf/openai/whisper-tiny-en',
];
export const MAX_AUDIO_BYTES = 1_000_000;

export function validateAudio(bytes) {
  if (!bytes?.byteLength) return { ok: false, status: 400, error: 'empty audio' };
  if (bytes.byteLength > MAX_AUDIO_BYTES) return { ok: false, status: 413, error: 'audio exceeds 1MB' };
  return { ok: true };
}

// Avoid spreading a ~1MB Uint8Array into one function call; WebKit and Workers
// both have argument-count limits. 8KB chunks stay comfortably below them.
export function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

export async function transcribeAudio(ai, bytes, models = VOICE_MODELS) {
  const audio = bytesToBase64(bytes);
  let lastError;
  for (const model of models) {
    try {
      const result = await ai.run(model, { audio });
      return { transcript: String(result?.text ?? result?.transcription ?? '').trim(), model };
    } catch (error) {
      lastError = error;
      console.warn(`voice transcription model failed: ${model}: ${error.message}`);
    }
  }
  throw lastError || new Error('No transcription model available');
}

