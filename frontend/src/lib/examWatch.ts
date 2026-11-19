export type ExamWarning = "NOISE" | "SECOND_VOICE" | "FACE_LEFT" | "MOUTH";

export type ExamFace = { x: number; y: number; w: number; h: number };

export type ExamPulse = { level: number; bars: number[]; face: ExamFace | null };

type FaceBox = { boundingBox: DOMRectReadOnly };
type FaceDetectorLike = { detect: (input: CanvasImageSource) => Promise<FaceBox[]> };

export function faceCheckSupported(): boolean {
  return typeof (window as unknown as { FaceDetector?: unknown }).FaceDetector === "function";
}

export async function openExamMedia(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot use the camera");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: false },
    video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } },
  });
}

export function watchExam(opts: {
  stream: MediaStream;
  video: HTMLVideoElement;
  onWarning: (kind: ExamWarning) => void;
  onPulse?: (pulse: ExamPulse) => void;
}): { stop: () => void; faceSupported: boolean } {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(opts.stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const time = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const binHz = audioCtx.sampleRate / analyser.fftSize;

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  let detector: FaceDetectorLike | null = null;
  const FaceCtor = (window as unknown as {
    FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }).FaceDetector;
  if (FaceCtor) {
    try {
      detector = new FaceCtor({ fastMode: false, maxDetectedFaces: 3 });
    } catch {
      detector = null;
    }
  }

  const lastSent: Partial<Record<ExamWarning, number>> = {};
  let noiseSince: number | null = null;
  let voiceSince: number | null = null;
  let faceSince: number | null = null;
  let mouthSince: number | null = null;
  let prevMouth: Uint8ClampedArray | null = null;
  let lastFace: ExamFace | null = null;
  let stopped = false;
  let timer = 0;
  let pulseTimer = 0;

  function emit(kind: ExamWarning, now: number) {
    const prev = lastSent[kind] ?? 0;
    const wait = kind === "FACE_LEFT" ? 8_000 : 20_000;
    if (now - prev < wait) return;
    lastSent[kind] = now;
    opts.onWarning(kind);
  }

  function rms(): number {
    analyser.getByteTimeDomainData(time);
    let sum = 0;
    for (let i = 0; i < time.length; i++) {
      const sample = time[i] ?? 128;
      const x = (sample - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / time.length);
  }

  function twoVoices(): boolean {
    analyser.getByteFrequencyData(freq);
    const peaks: { hz: number; mag: number }[] = [];
    const minBin = Math.max(1, Math.floor(85 / binHz));
    const maxBin = Math.min(freq.length - 2, Math.floor(450 / binHz));
    for (let i = minBin; i <= maxBin; i++) {
      const mag = freq[i] ?? 0;
      const left = freq[i - 1] ?? 0;
      const right = freq[i + 1] ?? 0;
      if (mag > 145 && mag >= left && mag >= right) {
        peaks.push({ hz: i * binHz, mag });
      }
    }
    peaks.sort((a, b) => b.mag - a.mag);
    const chosen: { hz: number; mag: number }[] = [];
    for (const peak of peaks) {
      const near = chosen.some((item) => Math.abs(item.hz - peak.hz) < 30);
      const harmonic = chosen.some((item) => {
        const ratio = peak.hz / item.hz;
        return (ratio > 1.85 && ratio < 2.2) || (ratio > 2.8 && ratio < 3.25);
      });
      if (near || harmonic) continue;
      chosen.push(peak);
      if (chosen.length === 2) break;
    }
    return chosen.length >= 2 && (chosen[1]?.mag ?? 0) > 140;
  }

  async function tick() {
    if (stopped) return;
    const now = Date.now();
    const level = rms();
    if (level > 0.18) noiseSince = noiseSince ?? now;
    else noiseSince = null;
    if (noiseSince && now - noiseSince > 2000) emit("NOISE", now);

    if (twoVoices()) voiceSince = voiceSince ?? now;
    else voiceSince = null;
    if (voiceSince && now - voiceSince > 1500) emit("SECOND_VOICE", now);

    if (detector && ctx && opts.video.readyState >= 2) {
      ctx.drawImage(opts.video, 0, 0, canvas.width, canvas.height);
      try {
        const faces = await detector.detect(canvas);
        if (faces.length === 0) {
          faceSince = faceSince ?? now;
          mouthSince = null;
          prevMouth = null;
          lastFace = null;
        } else {
          faceSince = null;
          const box = faces[0]?.boundingBox;
          if (!box) {
            lastFace = null;
          } else {
          lastFace = {
            x: box.x / canvas.width,
            y: box.y / canvas.height,
            w: box.width / canvas.width,
            h: box.height / canvas.height,
          };
          const x = Math.max(0, Math.floor(box.x));
          const y = Math.max(0, Math.floor(box.y + box.height * 0.55));
          const w = Math.min(canvas.width - x, Math.floor(box.width));
          const h = Math.min(canvas.height - y, Math.floor(box.height * 0.4));
          if (w > 8 && h > 8) {
            const data = ctx.getImageData(x, y, w, h).data;
            if (prevMouth && prevMouth.length === data.length) {
              let diff = 0;
              let samples = 0;
              for (let i = 0; i < data.length; i += 16) {
                diff += Math.abs((data[i] ?? 0) - (prevMouth[i] ?? 0));
                samples += 1;
              }
              const avg = samples ? diff / samples : 0;
              if (avg > 22) mouthSince = mouthSince ?? now;
              else mouthSince = null;
              if (mouthSince && now - mouthSince > 2500) emit("MOUTH", now);
            }
            prevMouth = new Uint8ClampedArray(data);
          }
          }
        }
        if (faceSince && now - faceSince > 1000) emit("FACE_LEFT", now);
      } catch {
        // A single missed frame should not turn face tracking off.
      }
    }
  }

  function pulse() {
    if (!opts.onPulse) return;
    analyser.getByteTimeDomainData(time);
    const bars: number[] = [];
    const count = 24;
    const step = Math.max(1, Math.floor(time.length / count));
    let energy = 0;
    for (let i = 0; i < count; i++) {
      let peak = 0;
      for (let j = 0; j < step; j++) {
        const sample = time[i * step + j] ?? 128;
        const amp = Math.abs(sample - 128) / 128;
        if (amp > peak) peak = amp;
      }
      bars.push(peak);
      energy += peak;
    }
    opts.onPulse({ level: energy / count, bars, face: lastFace });
  }

  timer = window.setInterval(() => {
    void tick();
  }, 700);
  if (opts.onPulse) {
    pulseTimer = window.setInterval(pulse, 90);
  }

  return {
    faceSupported: Boolean(detector),
    stop() {
      stopped = true;
      window.clearInterval(timer);
      window.clearInterval(pulseTimer);
      source.disconnect();
      void audioCtx.close();
    },
  };
}
