const GAME_VOLUME = 0.8;

const openOrganR = new Float32Array([0, 1.0, 0.95, 0.9025, 0.857375, 0.8145]);
const openOrganI = new Float32Array(openOrganR.length);
let openOrganTable = (context: AudioContext) => context.createPeriodicWave(openOrganR, openOrganI);
let organTable = openOrganTable;

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
	var filter = audio.context.createBiquadFilter();
	filter.connect(gain);
	filter.type = 'lowpass';

	let filterFreqWave = new Float32Array(10);
	function modulateWind() {
		let last = filterFreqWave[9];
		filterFreqWave = filterFreqWave.map(_ => Math.random() * 1200 + 400);
		filterFreqWave[0] = last || filterFreqWave[0];
		filter.frequency.setValueCurveAtTime(filterFreqWave, audio.context.currentTime, 30);
		setTimeout(modulateWind, 31000);
	};
	modulateWind();

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

	node.connect(filter);
}

export function flameOfUdun(audio: AudioState) {
	const bufferSize = 4096;

	let gain = audio.context.createGain();
	gain.connect(audio.totalGain);
	gain.gain.setValueAtTime(0.01, audio.context.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.2, audio.context.currentTime + 0.4);
	gain.gain.exponentialRampToValueAtTime(0.01, audio.context.currentTime + 0.6);
	gain.gain.setValueAtTime(0, audio.context.currentTime + 0.6);

	var filter = audio.context.createBiquadFilter();
	filter.connect(gain);
	filter.type = 'lowpass';
	filter.frequency.value = 180;

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

	node.connect(filter);
}

function playOrganNote(audio: AudioState, spec: AudioSpec) {
	let [frequency, start, end] = spec;

	let gain = audio.context.createGain();
	gain.connect(audio.totalGain);

	var filter = audio.context.createBiquadFilter();
	filter.connect(gain);
	filter.frequency.value = 500;
	filter.type = 'allpass';

	let o = audio.context.createOscillator();
	o.setPeriodicWave(audio.organWave);
	o.frequency.value = frequency;
	o.connect(filter);

	let absStart: number = audio.context.currentTime + start;
	let absEnd: number = audio.context.currentTime + end;
	gain.gain.setValueAtTime(0, absStart)
	gain.gain.linearRampToValueAtTime(1, absStart + 0.01);
	gain.gain.linearRampToValueAtTime(0.001, absEnd + 0.25);
	o.start(absStart);
	o.stop(absEnd);
}

// TODO: Why?
interface Map<T> {
	[key: string]: T;
};

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const octaves = [0, 1, 2, 3, 4, 5, 6, 7, 8];
let NOTE_FREQS: Map<number> = {};
octaves.forEach(o => {
	for (let n of NOTES) {
		let od = o - 4;
		let hs = od * 12 + (NOTES.indexOf(n) - NOTES.indexOf('A'));
		NOTE_FREQS[n + o] = 440.0 * Math.pow(1.059463094359, hs);
	}
});

type AudioSpec = [number, number, number];
type NoteSpec = [string, number];

function audioSpec(bpm: number, t: number, n: any, d: number): AudioSpec[] {
	return n.split(',').map((e: string) => [NOTE_FREQS[e], t, t + 1 / (d * bpm)]);
}

function playScore(audio: AudioState, score: NoteSpec[], bpm: number) {
	let t = 0;
	let spec: AudioSpec[] = [];
	score.forEach((v, i, a) => {
		let [n, d] = v;
		let s: AudioSpec[] = audioSpec(bpm, t, n, d);
		spec = spec.concat(s);
		t += 1 / (d * bpm);
	});
	spec.forEach(s => playOrganNote(audio, s));
}

export function playOrgan(audio: AudioState) {
	let scales: NoteSpec[] = [['C3', 1], ['D3', 1], ['E3', 1], ['F3', 1], ['G3', 1], ['A3', 1], ['B3', 1], ['C4', 1],
	['C3', 2], ['D3', 2], ['E3', 2], ['F3', 2], ['G3', 2], ['A3', 2], ['B3', 2], ['C4', 2],
	['C3', 4], ['D3', 4], ['E3', 4], ['F3', 4], ['G3', 4], ['A3', 4], ['B3', 4], ['C4', 4],
	['C3', 8], ['D3', 8], ['E3', 8], ['F3', 8], ['G3', 8], ['A3', 8], ['B3', 8], ['C4', 8],
	['C4', 8], ['D4', 8], ['E4', 8], ['F4', 8], ['G4', 8], ['A4', 8], ['B4', 8], ['C5', 8],
	['C4', 4], ['D4', 4], ['E4', 4], ['F4', 4], ['G4', 4], ['A4', 4], ['B4', 4], ['C5', 4],
	['C4', 2], ['D4', 2], ['E4', 2], ['F4', 2], ['G4', 2], ['A4', 2], ['B4', 2], ['C5', 2],
	['C4', 1], ['D4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['A4', 1], ['B4', 1], ['C5', 1]];

	let hb: NoteSpec[] = [['G2', 4], ['G2', 8], ['A2', 4], ['G2', 4], ['C3', 4], ['B2', 3 / 2],
	['G2', 4], ['G2', 8], ['A2', 4], ['G2', 4], ['D3', 4], ['C3', 3 / 2],
	['G2', 4], ['G2', 8], ['G3', 4], ['E3', 4], ['C3', 4], ['B2', 4], ['A2', 3 / 2],
	['F3', 4], ['F3', 8], ['E3', 4], ['C3', 4], ['D3', 4], ['C3', 3 / 2]];

	let fugue: NoteSpec[] = [['D3,D2,D4', 2], ['A3,A2,A4', 2], ['F3,F2,F4', 2], ['D3,D2,D4', 2], ['C#3,C#2,C#4', 2],
	['D3,D2,D4', 4], ['E3,E2,E4', 4], ['F3,F2,F4', 2], ['F3,F2,F4', 4], ['G3,G2,G4', 4],
	['F3,F2,F4', 4], ['E3,E2,E4', 4], ['D3,D2,D4', 4], ['D0', 4],
	['A3,A4', 1], ['A#3,A#4', 1],
	['G3,G4', 1], ['A3,A4', 1],
	['F3,F4', 1], ['G3,G4', 1],
	['F1,F2,F3,F4', 2], ['E1,E2,E3,E4', 2], ['D1,D2,D3,D4', 1]];

	playScore(audio, fugue, 1);
}
