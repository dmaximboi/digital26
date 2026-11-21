export type ExamWarning = "NOISE" | "SECOND_VOICE" | "FACE_LEFT" | "MOUTH";

export type ExamFace = { x: number; y: number; w: number; h: number };

export type ExamPulse = { level: number; bars: number[]; face: ExamFace | null };

type Landmark = { x: number; y: number };
type FaceRunner = {
  detect: (image: HTMLCanvasElement) => {
    faceLandmarks: Landmark[][];
    faceBlendshapes: { categories: { categoryName: string; score: number }[] }[];
  };
  close: () => void;
};

export function faceCheckSupported(): boolean {
  return typeof WebAssembly === "object";
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
  onFaceReady?: (supported: boolean, reason?: string) => void;
}): { stop: () => void; faceSupported: boolean; setLive: (on: boolean) => void } {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(opts.stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.86;
  source.connect(analyser);
  void audioCtx.resume().catch(() => {});
  const time = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const binHz = audioCtx.sampleRate / analyser.fftSize;

  let landmarker: FaceRunner | null = null;
  let live = false;
  let lastOpen = 0;
  let mouthMotion = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 360;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const base = "/mediapipe";
  void import("@mediapipe/tasks-vision")
    .then(async ({ FaceLandmarker, FilesetResolver }) => {
      if (stopped) return;
      const files = await FilesetResolver.forVisionTasks(`${base}/wasm`);
      if (stopped) return;
      const created = await FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${base}/face_landmarker.task`,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });
      if (stopped) {
        created.close();
        return;
      }
      landmarker = created;
      opts.onFaceReady?.(true);
    })
    .catch((err: unknown) => {
      if (!stopped) opts.onFaceReady?.(false, err instanceof Error ? err.message : "Face check failed");
    });

  const lastSent: Partial<Record<ExamWarning, number>> = {};
  let noiseSince: number | null = null;
  let voiceSince: number | null = null;
  let faceSince: number | null = null;
  let mouthSince: number | null = null;
  let lastFace: ExamFace | null = null;
  let stopped = false;
  let timer = 0;
  let pulseTimer = 0;

  function emit(kind: ExamWarning, now: number) {
    if (!live) return;
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
    const smooth = new Float32Array(freq.length);
    for (let i = 0; i < freq.length; i++) {
      let acc = 0;
      let count = 0;
      for (let k = -4; k <= 4; k++) {
        const value = freq[i + k];
        if (value == null) continue;
        acc += value;
        count += 1;
      }
      smooth[i] = count ? acc / count : 0;
    }
    const minBin = Math.max(2, Math.floor(85 / binHz));
    const maxBin = Math.min(freq.length - 3, Math.floor(380 / binHz));
    const peaks: { index: number; hz: number; mag: number }[] = [];
    for (let i = minBin; i <= maxBin; i++) {
      const mag = smooth[i] ?? 0;
      if (mag < 70) continue;
      if (mag < (smooth[i - 1] ?? 0) || mag <= (smooth[i + 1] ?? 0)) continue;
      peaks.push({ index: i, hz: i * binHz, mag });
    }
    peaks.sort((a, b) => b.mag - a.mag);
    const top = peaks[0];
    const next = peaks[1];
    if (!top || !next) return false;
    const strong = peaks.filter((peak) => peak.mag > top.mag * 0.45).length;
    if (strong > 3) return false;
    if (next.mag < top.mag * 0.62) return false;
    const gap = Math.abs(top.hz - next.hz);
    if (gap < 50 || gap > 260) return false;
    const ratio = Math.max(top.hz, next.hz) / Math.max(1, Math.min(top.hz, next.hz));
    const harmonic = [1.5, 2, 2.5, 3, 3.5, 4].some((step) => Math.abs(ratio - step) < 0.14);
    if (harmonic) return false;
    const lo = Math.min(top.index, next.index);
    const hi = Math.max(top.index, next.index);
    let valley = top.mag;
    for (let i = lo + 1; i < hi; i++) valley = Math.min(valley, smooth[i] ?? valley);
    return valley < next.mag * 0.48;
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
    if (voiceSince && now - voiceSince > 3200) emit("SECOND_VOICE", now);

    if (landmarker && ctx && opts.video.readyState >= 2 && opts.video.videoWidth > 0) {
      try {
        ctx.drawImage(opts.video, 0, 0, canvas.width, canvas.height);
        const found = landmarker.detect(canvas);
        const marks = found.faceLandmarks[0];
        if (!marks || marks.length < 300) {
          faceSince = faceSince ?? now;
          mouthSince = null;
          mouthMotion = 0;
          lastOpen = 0;
          lastFace = null;
        } else {
          faceSince = null;
          let minX = 1;
          let minY = 1;
          let maxX = 0;
          let maxY = 0;
          for (const point of marks) {
            if (point.x < minX) minX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.x > maxX) maxX = point.x;
            if (point.y > maxY) maxY = point.y;
          }
          lastFace = { x: minX, y: minY, w: Math.max(0.02, maxX - minX), h: Math.max(0.02, maxY - minY) };
          const jaw = found.faceBlendshapes[0]?.categories.find((item) => item.categoryName === "jawOpen")?.score ?? 0;
          const open = Math.max(jaw, lipOpen(marks));
          const delta = lastOpen ? Math.abs(open - lastOpen) : 0;
          lastOpen = open;
          mouthMotion = mouthMotion * 0.72 + delta;
          if (mouthMotion > 0.08) mouthSince = mouthSince ?? now;
          else mouthSince = null;
          if (mouthSince && now - mouthSince > 1400) emit("MOUTH", now);
        }
        if (faceSince && now - faceSince > 1000) emit("FACE_LEFT", now);
      } catch {
        // A single missed frame should not turn face tracking off.
      }
    }
  }

  function lipOpen(marks: Landmark[]): number {
    const upper = marks[13];
    const lower = marks[14];
    const left = marks[61];
    const right = marks[291];
    if (!upper || !lower || !left || !right) return 0;
    const height = Math.hypot(upper.x - lower.x, upper.y - lower.y);
    const width = Math.hypot(left.x - right.x, left.y - right.y);
    return width > 0.01 ? height / width : 0;
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
  }, 400);
  if (opts.onPulse) {
    pulseTimer = window.setInterval(pulse, 90);
  }

  return {
    faceSupported: false,
    setLive(on: boolean) {
      live = on;
      if (!on) {
        faceSince = null;
        mouthSince = null;
        voiceSince = null;
        noiseSince = null;
        mouthMotion = 0;
      }
    },
    stop() {
      stopped = true;
      window.clearInterval(timer);
      window.clearInterval(pulseTimer);
      landmarker?.close();
      landmarker = null;
      source.disconnect();
      void audioCtx.close();
    },
  };
}
