const MB = 1024 * 1024;

export const MAX_VIDEO_SOURCE_BYTES = 500 * MB;
export const MAX_VIDEO_UPLOAD_BYTES = 80 * MB;
const COMPRESSION_THRESHOLD_BYTES = 32 * MB;
const TARGET_BYTES = 44 * MB;

type Progress = (value: number) => void;

function waitFor(target: EventTarget, event: string) {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("The selected video could not be read.")); };
    const cleanup = () => { target.removeEventListener(event, done); target.removeEventListener("error", failed); };
    target.addEventListener(event, done, { once: true });
    target.addEventListener("error", failed, { once: true });
  });
}

function recorderType() {
  const types = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export async function optimizeVideo(file: File, onProgress: Progress): Promise<File> {
  if (file.size > MAX_VIDEO_SOURCE_BYTES) throw new Error("Videos can be up to 500 MB.");
  if (file.size <= COMPRESSION_THRESHOLD_BYTES) return file;
  if (typeof MediaRecorder === "undefined") throw new Error("This device cannot optimize large videos. Choose a video below 32 MB.");

  const mimeType = recorderType();
  if (!mimeType) throw new Error("This device cannot optimize this video format. Choose an MP4 below 32 MB.");

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = objectUrl;
  video.preload = "auto";
  video.playsInline = true;
  video.muted = true;
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;bottom:0";
  document.body.appendChild(video);

  let audioContext: AudioContext | null = null;
  let drawing = false;
  try {
    if (video.readyState < 1) await waitFor(video, "loadedmetadata");
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("The selected video has no readable duration.");

    const maxWidth = 1280;
    const maxHeight = 720;
    const scale = Math.min(1, maxWidth / Math.max(1, video.videoWidth), maxHeight / Math.max(1, video.videoHeight));
    const width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    const height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Video optimization is unavailable on this device.");
    const stream = canvas.captureStream(30);

    try {
      audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      await audioContext.resume();
    } catch {
      await audioContext?.close().catch(() => undefined);
      audioContext = null;
    }

    const audioBits = stream.getAudioTracks().length ? 96_000 : 0;
    const targetBitsPerSecond = Math.floor(TARGET_BYTES * 8 / video.duration);
    const videoBitsPerSecond = Math.max(550_000, Math.min(3_200_000, targetBitsPerSecond - audioBits));
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond: audioBits || undefined });
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    const stopped = waitFor(recorder, "stop");
    const recordError = new Promise<never>((_, reject) => recorder.addEventListener("error", () => reject(new Error("Video optimization failed.")), { once: true }));
    drawing = true;
    const draw = () => {
      if (!drawing) return;
      context.drawImage(video, 0, 0, width, height);
      onProgress(Math.min(99, Math.round(video.currentTime / video.duration * 100)));
      requestAnimationFrame(draw);
    };
    video.addEventListener("ended", () => { drawing = false; if (recorder.state !== "inactive") recorder.stop(); }, { once: true });
    recorder.start(1000);
    draw();
    await video.play();
    await Promise.race([stopped, recordError]);
    stream.getTracks().forEach((track) => track.stop());
    onProgress(100);

    const outputType = recorder.mimeType || mimeType;
    const extension = outputType.includes("webm") ? "webm" : "mp4";
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-") || "event-video";
    const optimized = new File(chunks, `${baseName}-optimized.${extension}`, { type: outputType.split(";")[0], lastModified: Date.now() });
    if (!optimized.size) throw new Error("Video optimization produced an empty file.");
    if (optimized.size > MAX_VIDEO_UPLOAD_BYTES) throw new Error("The optimized video is still too large. Please shorten it and try again.");
    return optimized;
  } finally {
    drawing = false;
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(objectUrl);
    await audioContext?.close().catch(() => undefined);
  }
}
