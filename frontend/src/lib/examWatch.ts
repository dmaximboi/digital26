export type ExamWarning = "NOISE" | "SECOND_VOICE" | "FACE_LEFT" | "MOUTH";

export type ExamFace = { x: number; y: number; w: number; h: number };

export type ExamPulse = { level: number; bars: number[]; face: ExamFace | null };

type Landmark = { x: number; y: number };
type FaceRunner = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
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
  onFaceReady?: (supported: boolean) => void;
}): { stop: () => void; faceSupported: boolean } {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(opts.stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const time = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  const binHz = audioCtx.sampleRate / analyser.fftSize;

  let landmarker: FaceRunner | null = null;
  let lastVideoTs = 0;
  const mouthSamples: number[] = [];

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
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      if (stopped) {
        created.close();
        return;
      }
      landmarker = created;
      opts.onFaceReady?.(true);
    })
    .catch(() => {
      if (!stopped) opts.onFaceReady?.(false);
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

    if (landmarker && opts.video.readyState >= 2 && opts.video.videoWidth > 0) {
      const stamp = Math.max(lastVideoTs + 1, Math.round(performance.now()));
      lastVideoTs = stamp;
      try {
        const found = landmarker.detectForVideo(opts.video, stamp);
        const marks = found.faceLandmarks[0];
        if (!marks || marks.length < 300) {
          faceSince = faceSince ?? now;
          mouthSince = null;
          mouthSamples.length = 0;
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
          const jaw = found.faceBlendshapes[0]?.categories.find((item) => item.categoryName === "jawOpen")?.score;
          const open = jaw ?? lipOpen(marks);
          mouthSamples.push(open);
          if (mouthSamples.length > 8) mouthSamples.shift();
          const swing = Math.max(...mouthSamples) - Math.min(...mouthSamples);
          if (mouthSamples.length >= 5 && swing > 0.18) mouthSince = mouthSince ?? now;
          else mouthSince = null;
          if (mouthSince && now - mouthSince > 2000) emit("MOUTH", now);
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
  }, 700);
  if (opts.onPulse) {
    pulseTimer = window.setInterval(pulse, 90);
  }

  return {
    faceSupported: false,
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
