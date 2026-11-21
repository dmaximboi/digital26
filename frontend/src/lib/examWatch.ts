export type ExamWarning = "NOISE" | "SECOND_VOICE" | "FACE_LEFT" | "MOUTH" | "SECOND_FACE";

export type ExamFace = { x: number; y: number; w: number; h: number };

export type ExamPulse = { level: number; bars: number[]; face: ExamFace | null };

type Landmark = { x: number; y: number };
type FaceHit = { box: ExamFace; jaw: number };
type NativeDetector = { detect: (input: CanvasImageSource) => Promise<{ boundingBox: DOMRectReadOnly }[]> };
type MeshRunner = {
  detect: (image: HTMLCanvasElement) => {
    faceLandmarks: Landmark[][];
    faceBlendshapes: { categories: { categoryName: string; score: number }[] }[];
  };
};

let sharedLandmarker: MeshRunner | null = null;
let sharedLoad: Promise<MeshRunner | null> | null = null;
let sharedFailed = false;

function loadSharedLandmarker(): Promise<MeshRunner | null> {
  if (sharedLandmarker) return Promise.resolve(sharedLandmarker);
  if (sharedFailed) return Promise.resolve(null);
  if (sharedLoad) return sharedLoad;
  sharedLoad = import("@mediapipe/tasks-vision")
    .then(async ({ FaceLandmarker, FilesetResolver }) => {
      const files = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const created = await FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: "/mediapipe/face_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numFaces: 3,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });
      sharedLandmarker = created;
      return created;
    })
    .catch(() => {
      sharedFailed = true;
      sharedLoad = null;
      return null;
    });
  return sharedLoad;
}

function nativeDetector(): NativeDetector | null {
  const FaceCtor = (window as unknown as {
    FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeDetector;
  }).FaceDetector;
  if (!FaceCtor) return null;
  try {
    return new FaceCtor({ fastMode: true, maxDetectedFaces: 3 });
  } catch {
    return null;
  }
}

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
  onWarning: (kind: ExamWarning, still?: string) => void;
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

  let stopped = false;
  let landmarker = sharedLandmarker;
  const fallback = nativeDetector();
  let live = false;
  let jawHigh = false;
  let jawCycles = 0;
  let cycleStart = 0;
  let voiceHits = 0;
  let missingSince: number | null = null;
  let missFrames = 0;
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 360;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (fallback) opts.onFaceReady?.(true);
  void loadSharedLandmarker().then((ready) => {
    if (stopped) return;
    if (ready) {
      landmarker = ready;
      opts.onFaceReady?.(true);
      return;
    }
    if (!fallback) opts.onFaceReady?.(false, "Face check failed");
  });

  const lastSent: Partial<Record<ExamWarning, number>> = {};
  let noiseSince: number | null = null;
  let faceSince: number | null = null;
  let lastFace: ExamFace | null = null;
  let timer = 0;
  let pulseTimer = 0;

  function emit(kind: ExamWarning, now: number, still?: string) {
    if (!live) return;
    const prev = lastSent[kind] ?? 0;
    const wait = kind === "SECOND_FACE" ? 12_000 : kind === "NOISE" ? 8_000 : kind === "MOUTH" ? 10_000 : kind === "FACE_LEFT" ? 8_000 : 20_000;
    if (now - prev < wait) return;
    lastSent[kind] = now;
    opts.onWarning(kind, still);
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
      if (mag < 46) continue;
      if (mag < (smooth[i - 1] ?? 0) || mag <= (smooth[i + 1] ?? 0)) continue;
      peaks.push({ index: i, hz: i * binHz, mag });
    }
    peaks.sort((a, b) => b.mag - a.mag);
    const top = peaks[0];
    const next = peaks[1];
    if (!top || !next) return false;
    const strong = peaks.filter((peak) => peak.mag > top.mag * 0.45).length;
    if (strong > 4) return false;
    if (next.mag < top.mag * 0.55) return false;
    const gap = Math.abs(top.hz - next.hz);
    if (gap < 55 || gap > 280) return false;
    const ratio = Math.max(top.hz, next.hz) / Math.max(1, Math.min(top.hz, next.hz));
    const harmonic = [2, 3, 4].some((step) => Math.abs(ratio - step) < 0.08);
    if (harmonic) return false;
    const lo = Math.min(top.index, next.index);
    const hi = Math.max(top.index, next.index);
    let valley = top.mag;
    for (let i = lo + 1; i < hi; i++) valley = Math.min(valley, smooth[i] ?? valley);
    return valley < next.mag * 0.5;
  }

  async function tick() {
    if (stopped) return;
    const now = Date.now();
    const level = rms();
    if (level > 0.09) noiseSince = noiseSince ?? now;
    else noiseSince = null;
    if (noiseSince && now - noiseSince > 900) emit("NOISE", now);

    if (twoVoices()) voiceHits = Math.min(10, voiceHits + 1);
    else voiceHits = Math.max(0, voiceHits - 2);
    if (voiceHits >= 5) {
      emit("SECOND_VOICE", now);
      voiceHits = 0;
    }

    if ((landmarker || fallback) && ctx && opts.video.readyState >= 2 && opts.video.videoWidth > 0) {
      ctx.drawImage(opts.video, 0, 0, canvas.width, canvas.height);
      try {
        const hits = landmarker ? meshHits() : await nativeHits();
        applyHits(hits, now);
      } catch {
        missFrames += 1;
        if (missFrames > 12) {
          lastFace = null;
          landmarker = null;
        }
      }
    }
  }

  function meshHits(): FaceHit[] {
    if (!landmarker) return [];
    const found = landmarker.detect(canvas);
    return found.faceLandmarks
      .map((marks, index) => {
        if (marks.length < 100) return null;
        return {
          box: boxOf(marks),
          jaw: found.faceBlendshapes[index]?.categories.find((item) => item.categoryName === "jawOpen")?.score ?? 0,
        };
      })
      .filter((hit): hit is FaceHit => Boolean(hit));
  }

  async function nativeHits(): Promise<FaceHit[]> {
    if (!fallback) return [];
    const faces = await fallback.detect(canvas);
    return faces.map((face) => ({
      box: {
        x: face.boundingBox.x / canvas.width,
        y: face.boundingBox.y / canvas.height,
        w: face.boundingBox.width / canvas.width,
        h: face.boundingBox.height / canvas.height,
      },
      jaw: 0,
    }));
  }

  function applyHits(hits: FaceHit[], now: number) {
    missFrames = 0;
    if (hits.length >= 2) {
      missingSince = null;
      faceSince = null;
      lastFace = hits[0]?.box ?? null;
      emit("SECOND_FACE", now, stillFrom(opts.video));
    } else if (hits.length === 0) {
      missingSince = missingSince ?? now;
      jawHigh = false;
      if (now - missingSince > 5000) {
        faceSince = missingSince;
        lastFace = null;
      }
    } else {
      missingSince = null;
      faceSince = null;
      const hit = hits[0];
      if (!hit) return;
      lastFace = hit.box;
      const turned = hit.box.x < 0.08 || hit.box.x + hit.box.w > 0.92;
      if (turned || hit.jaw === 0) {
        jawHigh = false;
      } else if (hit.jaw > 0.28) jawHigh = true;
      else if (hit.jaw < 0.14 && jawHigh) {
        jawHigh = false;
        jawCycles += 1;
        cycleStart = cycleStart || now;
      }
      if (cycleStart && now - cycleStart > 8000) {
        jawCycles = 0;
        cycleStart = 0;
      }
      if (jawCycles >= 2) {
        emit("MOUTH", now);
        jawCycles = 0;
        cycleStart = 0;
      }
    }
    if (faceSince && now - faceSince > 5000) emit("FACE_LEFT", now);
  }

  function boxOf(marks: Landmark[]): ExamFace {
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
    return { x: minX, y: minY, w: Math.max(0.02, maxX - minX), h: Math.max(0.02, maxY - minY) };
  }

  function stillFrom(video: HTMLVideoElement): string | undefined {
    const shot = document.createElement("canvas");
    shot.width = 480;
    shot.height = 270;
    const draw = shot.getContext("2d");
    if (!draw) return undefined;
    draw.drawImage(video, 0, 0, shot.width, shot.height);
    try {
      return shot.toDataURL("image/jpeg", 0.55);
    } catch {
      return undefined;
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
        noiseSince = null;
        jawCycles = 0;
        jawHigh = false;
        cycleStart = 0;
        voiceHits = 0;
        missingSince = null;
      }
    },
    stop() {
      stopped = true;
      window.clearInterval(timer);
      window.clearInterval(pulseTimer);
      landmarker = null;
      source.disconnect();
      void audioCtx.close();
    },
  };
}
