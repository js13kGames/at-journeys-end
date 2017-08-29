const GAME_VOLUME = 0.8;

const organR = new Float32Array([0, 1.0, 0.5, 0.25, 0.125, 0.06, 0.03, 0.015, 0.0075, 0.00375]);
const organI = new Float32Array(organR.length);
let organTable = (context: AudioContext) => context.createPeriodicWave(organR, organI);

export interface AudioState {
	context: AudioContext;
	totalGain: GainNode;
	organWave: PeriodicWave;
}

export function initSound(): AudioState {
	let context = new AudioContext();
	let totalGain = context.createGain();
	totalGain.gain.value = GAME_VOLUME;
	totalGain.connect(context.destination);
	let organWave = organTable(context);

	return { context, totalGain, organWave };
}

export function toggleSound(audio: AudioState) {
	audio.totalGain.gain.value = GAME_VOLUME * (audio.totalGain.gain.value ? 0 : 1);
}

// The basic random noise generator was lifted from this helpful post:
// https://noisehack.com/generate-noise-web-audio-api/
export function wind(audio: AudioState) {
	const bufferSize = 4096;

	let gain = audio.context.createGain();
	gain.connect(audio.totalGain);
	gain.gain.setValueAtTime(0.08, audio.context.currentTime);

	let lastOut = 0.0;
	let node = audio.context.createScriptProcessor(bufferSize, 1, 1);
	node.onaudioprocess = function(e) {
		let output = e.outputBuffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			let white = Math.random() * 2 - 1;
			output[i] = (lastOut + (0.02 * white)) / 1.02;
			lastOut = output[i];
			output[i] *= 3.5; // (roughly) compensate for gain
		}
	}

	node.connect(gain);
}

export function knock(audio: AudioState) {
	var gain = audio.context.createGain();
	gain.connect(audio.totalGain);
	let now = audio.context.currentTime
	gain.gain.setValueAtTime(1, now);
	gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

	let oscillator = audio.context.createOscillator();
	oscillator.type = "triangle";
	oscillator.frequency.value = 80;
	oscillator.connect(gain);

	oscillator.start(now);
	oscillator.stop(now + 0.1);
}

// TODO: Refactor so we don't care about start / end (see playOrgan).
function playOrganNote(audio: AudioState, frequency: number, start: number, end: number) {
	var gain = audio.context.createGain();
	gain.connect(audio.totalGain);

	let o = audio.context.createOscillator();
	o.setPeriodicWave(audio.organWave);
	o.frequency.value = frequency;
	o.connect(gain);

	// TODO: How do we get smoother approach / falloff?
	let absStart: number = audio.context.currentTime + start;
	let absEnd: number = audio.context.currentTime + end;
	gain.gain.setValueAtTime(0.01, absStart)
	gain.gain.exponentialRampToValueAtTime(1, absStart + 0.01);
	gain.gain.exponentialRampToValueAtTime(0.1, absEnd + 0.025);
	o.start(absStart);
	o.stop(absEnd);
}

// TODO: Why?
interface Map<T> {
	[key: string]: T;
};

// TODO: Expand this to include a full range of notes
const NOTE_FREQS: Map<number> = {
	"C3": 130.81,
	"D3": 146.83,
	"E3": 164.81,
	"F3": 174.61,
	"G3": 196.00,
	"A3": 220.00,
	"B3": 246.94
};

// TODO: Fix the types
function playScore(audio: AudioState, score: any) {
	score.forEach((n: any) => playOrganNote(audio, NOTE_FREQS[n[0]], n[1], n[2]));
}

export function playOrgan(audio: AudioState) {
	// TODO: We shouldn't have to specify absolute times just to get a chord.
	// Refactor this to be able to just play a note or chord, and a duration.
	let score = [["D3", 0, 0.6], ["F3", 0, 0.6], ["A3", 0, 0.6],
	             ["E3", 0.6, 0.9],
	             ["F3", 0.9, 1.2],
	             ["G3", 1.2, 1.5],
	             ["D3", 1.5, 2.1], ["F3", 1.5, 2.1], ["A3", 1.5, 2.1],
	             ["D3", 2.4, 3.6], ["F3", 2.4, 3.6], ["A3", 2.4, 3.6]];
	playScore(audio, score);
}
