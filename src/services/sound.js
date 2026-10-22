let context = null;
let enabled = true;

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

/** Toca um bipe curto com a Web Audio API (sem arquivos de áudio). */
export function tone(frequency = 440, duration = 0.07, type = 'sine') {
  if (!enabled || typeof AudioContext === 'undefined') return;
  try {
    context ??= new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(now + duration + 0.02);
  } catch {
    // Áudio bloqueado pelo navegador (sem interação do usuário): o jogo segue sem som.
  }
}
