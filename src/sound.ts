import { XY } from './geometry';

const GAME_VOLUME = 0.5;
const ORGAN_VOLUME = 0.2;
const WIND_VOLUME = 0.3;
const FLAME_OF_UDUN_VOLUME = 0.3;
const THUNDER_VOLUME = 0.5;
const LAKE_VOLUME = 0.3;

const openOrganR = new Float32Array([0, 1.0, 0.8, 0.6, 0.4, 0.2]);
const openOrganI = new Float32Array(openOrganR.length);
let organTable = (context: AudioContext) => context.createPeriodicWave(openOrganR, openOrganI);

export interface AudioState {
	context: AudioContext;
	totalGain: GainNode;
	organWave: PeriodicWave;
	listener: AudioListener;
	organPanner: PannerNode;
	lakePanners: PannerNode[];
}

export function initSound(playerPosition: XY, organPosition: XY, lakePositions: XY[]): AudioState {
	let context = new AudioContext();
	let totalGain = context.createGain();
	totalGain.gain.value = GAME_VOLUME;
	totalGain.connect(context.destination);
	let organWave = organTable(context);

	let listener = context.listener;
	listener.setPosition(playerPosition.x, playerPosition.y, 0);

	let organPanner = context.createPanner();
	organPanner.setPosition(organPosition.x, organPosition.y, 0);

	let lakePanners = lakePositions.map(pos => {
		let p = context.createPanner();
		p.setPosition(pos.x, pos.y, 0);
		p.distanceModel = 'linear';
		return p
	});

	return { context, totalGain, organWave, listener, organPanner, lakePanners };
}

export function toggleSound(audio: AudioState) {
	audio.totalGain.gain.value = GAME_VOLUME * (audio.totalGain.gain.value ? 0 : 1);
}

export function moveListener(audio: AudioState, playerPosition: XY, playerDirection: XY) {
	audio.listener.setPosition(playerPosition.x, playerPosition.y, 0);
	audio.listener.setOrientation(playerDirection.x, playerDirection.y, 0, 0, 1, 0);
}

// The basic random noise generator was lifted from this helpful post:
// https://noisehack.com/generate-noise-web-audio-api/
export function wind(audio: AudioState) {
	const bufferSize = 4096;

	let gain = audio.context.createGain();
	gain.connect(audio.totalGain);
	var filter = audio.context.createBiquadFilter();
	filter.connect(gain);
	filter.type = 'highpass';
	filter.frequency.value = 4000

	let windModulation = new Float32Array(10);
	function modulateWind() {
		let last = windModulation[9];
		windModulation = windModulation.map(_ => WIND_VOLUME * ((Math.random() + Math.random()) - 0.75));
		windModulation[0] = last || windModulation[0];
		gain.gain.setValueCurveAtTime(windModulation, audio.context.currentTime, 30);
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
		}
	}

	node.connect(filter);
}

export function flameOfUdun(audio: AudioState) {
	const bufferSize = 4096;

	let gain = audio.context.createGain();
	gain.connect(audio.totalGain);
	gain.gain.setValueAtTime(0.01, audio.context.currentTime);
	gain.gain.exponentialRampToValueAtTime(FLAME_OF_UDUN_VOLUME, audio.context.currentTime + 0.4);
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

export function thunder(audio: AudioState) {
	const bufferSize = 4096;

	let gain = audio.context.createGain();
	gain.connect(audio.totalGain);
	gain.gain.setValueAtTime(0.5, audio.context.currentTime);

	var filter = audio.context.createBiquadFilter();
	filter.connect(gain);
	filter.type = 'lowpass';
	filter.frequency.value = 180;

	function modulate() {
		let t = audio.context.currentTime;
		gain.gain.setValueAtTime(0.7 + Math.random() * 0.2, t);
		t += 0.2;
		for (let i = 0; i < Math.random() * 6 + 2; i++) {
			let a = Math.random();
			gain.gain.linearRampToValueAtTime(a * THUNDER_VOLUME, t);
			filter.frequency.value += (Math.random() * 200 - 50);
			t += 0.2;
		}
		gain.gain.linearRampToValueAtTime(0.8 * THUNDER_VOLUME, t);
		gain.gain.linearRampToValueAtTime(0.001, t + 5);
		setTimeout(modulate, (Math.random() * 10 + 6) * 1000);
	};
	modulate();

	let lastOut = 0.0;
	let node = audio.context.createScriptProcessor(bufferSize, 1, 1);
	node.onaudioprocess = function(e) {
		let output = e.outputBuffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			let white = Math.random() * 2 - 1;
			output[i] = (lastOut + (0.02 * white)) / 1.02;
			lastOut = output[i];
		}
	}

	node.connect(filter);
}

export function lake(audio: AudioState) {
	const bufferSize = 4096;

	function noise(e: AudioProcessingEvent) {
		let lastOut = 0.0;
		let output = e.outputBuffer.getChannelData(0);
		for (let i = 0; i < bufferSize; i++) {
			let white = Math.random() * 2 - 1;
			output[i] = (lastOut + (0.02 * white)) / 1.02;
			lastOut = output[i];
		}
	}

	let lakeGains = audio.lakePanners.map(p => {
		p.connect(audio.totalGain);

		let filter = audio.context.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = 2500 + Math.random() * 1000;
		filter.connect(p);

		let gain = audio.context.createGain();
		gain.connect(filter);

		let node = audio.context.createScriptProcessor(bufferSize, 1, 1);
		node.onaudioprocess = noise;
		node.connect(gain);

		return gain;
	});

	function modulate() {
		lakeGains.forEach(g => {
			let t = audio.context.currentTime;
			let peak = t + 2 * Math.random();
			let end = peak + 4;
			g.gain.linearRampToValueAtTime(Math.random() * LAKE_VOLUME + 0.1, peak);
			g.gain.exponentialRampToValueAtTime(0.001, end);
		});
		setTimeout(modulate, (Math.random() * 2 + 9) * 1000);
	};
	modulate();
}

function playOrganNote(audio: AudioState, spec: AudioSpec) {
	let [frequency, start, end] = spec;

	audio.organPanner.connect(audio.totalGain);
	let gain = audio.context.createGain();
	gain.connect(audio.organPanner);

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
	gain.gain.linearRampToValueAtTime(ORGAN_VOLUME, absStart + 0.01);
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

function audioSpec(t: number, noteDuration: number, n: any, d: number): AudioSpec[] {
	return n.split(',').map((e: string) => [NOTE_FREQS[e], t, t + d * noteDuration]);
}

function playScore(audio: AudioState, score: NoteSpec[], bpm: number, bpb: number, nv: number) {
	let noteDuration = 60 / bpm;
	let t = 0;
	let spec: AudioSpec[] = [];
	score.forEach((v, i, a) => {
		let [n, d] = v;
		let s: AudioSpec[] = audioSpec(t, noteDuration, n, nv / d);
		spec = spec.concat(s);
		t += (nv / d) * noteDuration;
	});
	spec.forEach(s => playOrganNote(audio, s));
}

export function playOrgan(audio: AudioState) {
	let fugue: NoteSpec[] = [['D3,D2,D4', 2], ['A3,A2,A4', 2], ['F3,F2,F4', 2], ['D3,D2,D4', 2], ['C#3,C#2,C#4', 2],
	['D3,D2,D4', 4], ['E3,E2,E4', 4], ['F3,F2,F4', 2], ['F3,F2,F4', 4], ['G3,G2,G4', 4],
	['F3,F2,F4', 4], ['E3,E2,E4', 4], ['D3,D2,D4', 4], ['D0', 4],
	['A3,A4', 1], ['A#3,A#4', 1],
	['G3,G4', 1], ['A3,A4', 1],
	['F3,F4', 1], ['G3,G4', 1],
	['F1,F2,F3,F4', 2], ['E1,E2,E3,E4', 2], ['D1,D2,D3,D4', 1]];

	let church: NoteSpec[] = [['C#1,C#2,C#3', 1], ['C#1,C#2,C#3', 4], ['C1,C2,C3', 1],
	['C#1,C#2,C#3', 1], ['C#1,C#2,C#3', 4], ['C1,C2,C3', 1],
	['C#1,C#2,C#3', 1], ['C#1,C#2,C#3', 4], ['D#1,D#2,D#3', 1],
	['C#1,C#2,C#3', 4], ['D#1,D#2,D#3', 4],
	['C1,C2,C3', 4], ['C#1,C#2,C#3', 4],
	['A#0,A#1,A#2', 1]];

	// HACK: play church a few times
	// TODO: repeat ad infinitum
	church = church.concat(church, church, church, church);

	playScore(audio, church, 120, 4, 4);
}
