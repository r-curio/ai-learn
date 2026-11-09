/** The rate speech models expect. Higher rates only make the upload bigger. */
const SAMPLE_RATE = 16000;

/** A 16-bit mono PCM WAV file holding these samples. */
function encodeWav(samples: Float32Array): Blob {
	const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
	const text = (at: number, value: string) =>
		[...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
	text(0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	text(8, "WAVE");
	text(12, "fmt ");
	view.setUint32(16, 16, true); // format chunk size
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, SAMPLE_RATE, true);
	view.setUint32(28, SAMPLE_RATE * 2, true); // bytes per second
	view.setUint16(32, 2, true); // bytes per sample
	view.setUint16(34, 16, true); // bits per sample
	text(36, "data");
	view.setUint32(40, samples.length * 2, true);
	samples.forEach((sample, i) => {
		const clamped = Math.max(-1, Math.min(1, sample));
		view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
	});
	return new Blob([view], { type: "audio/wav" });
}

/** Decode a recording, mix it to mono at 16 kHz, and return it as WAV. */
export async function toWav(recording: Blob): Promise<Blob> {
	const decoder = new AudioContext();
	const decoded = await decoder
		.decodeAudioData(await recording.arrayBuffer())
		.finally(() => decoder.close());
	const length = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
	// One output channel, so the browser mixes the channels down as it resamples.
	const mixer = new OfflineAudioContext(1, length, SAMPLE_RATE);
	const source = mixer.createBufferSource();
	source.buffer = decoded;
	source.connect(mixer.destination);
	source.start();
	return encodeWav((await mixer.startRendering()).getChannelData(0));
}
