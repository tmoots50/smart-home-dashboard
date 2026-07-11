export function createMockVoice({ transcribeDelay = 800, replyDelay = 2500 } = {}) {
  return {
    isSupported: () => true,
    createRecorder() {
      let timer = null;
      let callback = () => {};
      let startedAt = 0;
      return {
        async start() {
          startedAt = Date.now();
          timer = setInterval(() => callback(.18 + Math.random() * .7), 100);
        },
        async stop() {
          clearInterval(timer); callback(0);
          return new Blob([`mock audio ${Date.now() - startedAt}ms`], { type: 'audio/webm' });
        },
        onLevel(next) { callback = next; return () => { callback = () => {}; }; },
      };
    },
    async transcribe() {
      await delay(transcribeDelay);
      return 'What’s on the family calendar today?';
    },
    async sendCommand() {
      await delay(replyDelay);
      return { status: 'replied', reply: 'You have a pediatrician appointment at 10:30, then dinner with the Parkers at 6.' };
    },
    isConfigured: false,
  };
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

