// E7: microphone capture that always uploads a complete 16 kHz mono WAV file.
// MediaRecorder timeslice fragments and Safari's fragmented MP4 are rejected by
// transcription models, so we capture PCM and write our own WAV header.
import { useCallback, useRef, useState } from "react";

const TARGET_RATE = 16000;

function downsample(chunks: Float32Array[], from: number, to: number): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { merged.set(c, o); o += c.length; }
  if (to >= from) return merged;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(merged.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), merged.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += merged[j]!;
    out[i] = sum / Math.max(end - start, 1);
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

type Ctx = {
  stream: MediaStream;
  audio: AudioContext;
  source: MediaStreamAudioSourceNode;
  node: ScriptProcessorNode;
  chunks: Float32Array[];
};

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const ctxRef = useRef<Ctx | null>(null);

  const start = useCallback(async () => {
    if (ctxRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const audio = new AudioContext();
    const source = audio.createMediaStreamSource(stream);
    const node = audio.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    node.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    source.connect(node);
    node.connect(audio.destination);
    ctxRef.current = { stream, audio, source, node, chunks };
    setRecording(true);
  }, []);

  /** Stops recording and returns a complete WAV as base64, or null if empty. */
  const stop = useCallback(async (): Promise<{ base64: string; mimeType: string } | null> => {
    const ctx = ctxRef.current;
    ctxRef.current = null;
    setRecording(false);
    if (!ctx) return null;
    ctx.node.onaudioprocess = null;
    ctx.node.disconnect();
    ctx.source.disconnect();
    ctx.stream.getTracks().forEach((t) => t.stop());
    const rate = ctx.audio.sampleRate;
    await ctx.audio.close();
    const samples = downsample(ctx.chunks, rate, TARGET_RATE);
    const blob = encodeWav(samples, TARGET_RATE);
    if (blob.size < 2048) return null; // silent mic or instant stop
    return { base64: await blobToBase64(blob), mimeType: "audio/wav" };
  }, []);

  const cancel = useCallback(() => {
    const ctx = ctxRef.current;
    ctxRef.current = null;
    setRecording(false);
    if (!ctx) return;
    ctx.node.onaudioprocess = null;
    ctx.node.disconnect();
    ctx.source.disconnect();
    ctx.stream.getTracks().forEach((t) => t.stop());
    void ctx.audio.close();
  }, []);

  return { recording, start, stop, cancel };
}
