/**
 * Alerta sonoro de novo agendamento online (vitrine / portal do cliente).
 *
 * O navegador só libera áudio depois de uma interação do usuário, então o som
 * é "destravado" no primeiro toque/tecla/clique e fica pronto para os próximos
 * agendamentos. Se o play falhar, a reprodução fica pendente e é repetida na
 * próxima interação.
 */

const SOUND_URL = '/sounds/whistle.mp3';
const VOLUME = 0.75;

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let pendingPlayback = false;
let initialized = false;

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof window.Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(SOUND_URL);
    // Sem download antecipado: o áudio só é baixado na primeira interação/uso.
    audio.preload = 'none';
    audio.volume = VOLUME;
  }
  return audio;
}

function attemptPlayback(): void {
  const element = ensureAudio();
  if (!element) return;
  try {
    element.currentTime = 0;
  } catch {
    /* mídia ainda não carregada */
  }
  const result = element.play();
  if (result && typeof result.catch === 'function') {
    result.catch(() => {
      pendingPlayback = true;
    });
  }
}

function handleFirstInteraction(): void {
  const element = ensureAudio();
  if (element && !unlocked) {
    element.muted = true;
    const result = element.play();
    if (result && typeof result.then === 'function') {
      result
        .then(() => {
          element.pause();
          element.muted = false;
          try {
            element.currentTime = 0;
          } catch {
            /* ignore */
          }
          unlocked = true;
          if (pendingPlayback) {
            pendingPlayback = false;
            attemptPlayback();
          }
        })
        .catch(() => {
          element.muted = false;
        });
      return;
    }
    element.muted = false;
  }
  unlocked = true;
  if (pendingPlayback) {
    pendingPlayback = false;
    attemptPlayback();
  }
}

export function initOnlineBookingSound(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  ensureAudio();
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
  events.forEach(eventName => {
    window.addEventListener(eventName, handleFirstInteraction, { passive: true });
  });
}

export function playOnlineBookingAlert(): void {
  if (typeof window === 'undefined') return;
  attemptPlayback();
}
