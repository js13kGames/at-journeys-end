import { XY } from './geometry';

const GAME_VOLUME = 0.5;
const ORGAN_VOLUME = 0.2;
const WIND_VOLUME = 0.1;
const FLAME_OF_UDUN_VOLUME = 0.6;
const LAKE_VOLUME = 0.3;
const STEP_VOLUME = 0.1;
const BUFFER_SIZE = 4096;
const MAX_ORGAN_VOICES = 3;

const openOrganR = new Float32Array([0, 1.0, 0.8, 0.6, 0.4]);
const openOrganI = new Float32Array(openOrganR.length);
let organTable = (context: AudioContext) => context.createPeriodicWave(openOrganR, openOrganI);

class AudioPipeline {
	constructor(context: AudioContext, masterGain: GainNode, filterType: string, frequency: number) {
		this.gain = context.createGain();
		this.gain.connect(masterGain);
		this.filter = context.createBiquadFilter();
		this.filter.connect(this.gain);
		this.filter.type = 'lowpass';
		this.filter.frequency.value = 180;
		this.processor = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
		this.processor.connect(this.filter);
	}

	gain: GainNode;
	filter: BiquadFilterNode;
	processor: ScriptProcessorNode;
}

class OrganPipeline {
	constructor(context: AudioContext, masterGain: GainNode, position: XY, voices: number, filterType: string, frequency: number) {
		this.panner = context.createPanner();
		this.panner.setPosition(position.x, position.y, 0);
		this.panner.connect(masterGain);
		this.gain = context.createGain();
		this.gain.connect(this.panner);
		this.filter = context.createBiquadFilter();
		this.filter.connect(this.gain);
		this.filter.type = 'allpass';
		this.filter.frequency.value = frequency;

		this.oscillators = [];
		for (let i = 0; i < voices; i++) {
			this.oscillators[i] = context.createOscillator();
			this.oscillators[i].frequency.value = 0;
			this.oscillators[i].setPeriodicWave(organTable(context));
			this.oscillators[i].connect(this.filter);
		}
	}

	panner: PannerNode;
	gain: GainNode;
	filter: BiquadFilterNode;
	oscillators: OscillatorNode[];
}

export interface AudioState {
	context: AudioContext;
	totalGain: GainNode;
	listener: AudioListener;
	lakePanners: PannerNode[];
	organ: OrganPipeline;
	step: AudioPipeline;
	flame: AudioPipeline;
	wind: AudioPipeline;
}

// The basic random noise generator was lifted from this helpful post:
// https://noisehack.com/generate-noise-web-audio-api/
function whiteNoise(e: AudioProcessingEvent) {
	let lastOut = 0.0;
	let output = e.outputBuffer.getChannelData(0);
	for (let i = 0; i < BUFFER_SIZE; i++) {
		let white = Math.random() * 2 - 1;
		output[i] = (lastOut + (0.02 * white)) / 1.02;
		lastOut = output[i];
	}
}

export function initSound(playerPosition: XY, organPosition: XY, lakePositions: XY[]): AudioState {
	let context = new AudioContext();
	let totalGain = context.createGain();
	totalGain.gain.value = GAME_VOLUME;
	totalGain.connect(context.destination);

	let listener = context.listener;
	listener.setPosition(playerPosition.x, playerPosition.y, 0);

	let lakePanners = lakePositions.map(pos => {
		let p = context.createPanner();
		p.setPosition(pos.x, pos.y, 0);
		return p
	});

	let organ = new OrganPipeline(context, totalGain, organPosition, MAX_ORGAN_VOICES, 'bandpass', 500);

	let step = new AudioPipeline(context, totalGain, 'bandpass', 666)
	let flame = new AudioPipeline(context, totalGain, 'lowpass', 180);
	let wind = new AudioPipeline(context, totalGain, 'highpass', 4000);

	return {
		context, totalGain, listener,
		lakePanners, organ,
		step, flame, wind
	};
}

export function toggleSound(audio: AudioState) {
	audio.totalGain.gain.value = GAME_VOLUME * (audio.totalGain.gain.value ? 0 : 1);
}

export function moveListener(audio: AudioState, playerPosition: XY, playerDirection: XY) {
	audio.listener.setPosition(playerPosition.x, playerPosition.y, 0);
	audio.listener.setOrientation(playerDirection.x, playerDirection.y, 0, 0, 1, 0);
}

export function wind(audio: AudioState) {
	let windModulation = new Float32Array(10);
	function modulateWind() {
		let last = windModulation[9];
		windModulation = windModulation.map(_ => WIND_VOLUME * Math.random())
		windModulation[0] = last || windModulation[0];
		audio.wind.gain.gain.setValueCurveAtTime(windModulation, audio.context.currentTime, 30);
		setTimeout(modulateWind, 31000);
	};
	modulateWind();

	audio.wind.processor.onaudioprocess = whiteNoise;
}

export function stepSound(audio: AudioState) {
	audio.step.filter.frequency.value = 1500 + Math.random() * 1000;

	let t0 = audio.context.currentTime + 0.05;
	let t1 = t0 + 0.05 + 0.1 * Math.random();
	let t2 = t1 + 0.05 + 0.1 * Math.random();
	audio.step.gain.gain.linearRampToValueAtTime(STEP_VOLUME + Math.random() * STEP_VOLUME, t0);
	audio.step.gain.gain.linearRampToValueAtTime(0.001, t1);
	audio.step.gain.gain.setValueAtTime(0, t2);

	audio.step.processor.onaudioprocess = whiteNoise;
}

export function flameOfUdun(audio: AudioState) {
	audio.flame.gain.gain.setValueAtTime(0.01, audio.context.currentTime);
	audio.flame.gain.gain.exponentialRampToValueAtTime(FLAME_OF_UDUN_VOLUME, audio.context.currentTime + 0.4);
	audio.flame.gain.gain.exponentialRampToValueAtTime(0.01, audio.context.currentTime + 0.6);
	audio.flame.gain.gain.setValueAtTime(0, audio.context.currentTime + 0.6);

	audio.flame.processor.onaudioprocess = whiteNoise;
}

export function lake(audio: AudioState) {
	let lakeGains = audio.lakePanners.map(p => {
		p.connect(audio.totalGain);

		let filter = audio.context.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = 900;
		filter.connect(p);

		let gain = audio.context.createGain();
		gain.connect(filter);

		let node = audio.context.createScriptProcessor(BUFFER_SIZE, 1, 1);
		node.onaudioprocess = whiteNoise;
		node.connect(gain);

		return gain;
	});

	function modulate() {
		lakeGains.forEach(g => {
			let t = audio.context.currentTime;
			let dt = 0.2 + Math.random() * 0.2;
			g.gain.linearRampToValueAtTime(LAKE_VOLUME, t);
			while (dt < 9.5) {
				g.gain.linearRampToValueAtTime(LAKE_VOLUME + (Math.random() * 0.1 - 0.05), t + dt);
				dt += (0.2 + Math.random() * 0.2);
			}
		});
		setTimeout(modulate, 10000);
	};
	modulate();
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
		NOTE_FREQS[n + o] = 440.0 * Math.pow(1.059, hs);
	}
});

type AudioSpec = [number, number, number, number];
type NoteSpec = [string, number];

function playOrganNote(audio: AudioState, spec: AudioSpec) {
	let [frequency, voice, start, end] = spec;
	let o = audio.organ.oscillators[voice];

	let absStart: number = audio.context.currentTime + start;
	let absEnd: number = audio.context.currentTime + end;
	o.frequency.setValueAtTime(frequency, absStart);
	audio.organ.gain.gain.setValueAtTime(0, absStart);
	audio.organ.gain.gain.linearRampToValueAtTime(ORGAN_VOLUME, absStart + 0.01);
	// TODO: WAT!?!?
	audio.organ.gain.gain.linearRampToValueAtTime(0.001, absEnd + 1);
}

function audioSpec(t: number, noteDuration: number, n: any, d: number): AudioSpec[] {
	return n.split(',').map((e: string, i: number) => [NOTE_FREQS[e], i, t, t + d * noteDuration]);
}

function playScore(audio: AudioState, score: NoteSpec[], bpm: number, bpb: number, nv: number) {
	let noteDuration = 60 / bpm;
	let t0 = audio.context.currentTime, t = 0;
	let spec: AudioSpec[] = [];
	score.forEach(v => {
		let [n, d] = v;
		let s: AudioSpec[] = audioSpec(t, noteDuration, n, nv / d);
		spec = spec.concat(s);
		t += (nv / d) * noteDuration;
	});
	spec.forEach(s => playOrganNote(audio, s));
	audio.organ.oscillators.forEach(o => { o.start(t0); o.stop(t0 + t) });
}

export function playOrgan(audio: AudioState) {
	let church: NoteSpec[] = [['C#1,C#2,C#3', 1], ['C#1,C#2,C#3', 4], ['C1,C2,C3', 1],
	['C#1,C#2,C#3', 1], ['C#1,C#2,C#3', 4], ['C1,C2,C3', 1],
	['C#1,C#2,C#3', 1], ['C#1,C#2,C#3', 4], ['D#1,D#2,D#3', 1],
	['C#1,C#2,C#3', 4], ['D#1,D#2,D#3', 4],
	['C1,C2,C3', 4], ['C#1,C#2,C#3', 4],
	['A#0,A#1,A#2', 1]];

	playScore(audio, church, 120, 4, 4);
}
