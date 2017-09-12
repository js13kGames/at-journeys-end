import { XY } from './geometry';

const GAME_VOLUME = 0.5;
const ORGAN_VOLUME = 0.2;
const WIND_VOLUME = 0.1;
const FLAME_OF_UDUN_VOLUME = 0.6;
const THUNDER_VOLUME = 0.5;
const THUNDER_FILTER_FREQ = 180;
const LAKE_VOLUME = 0.3;
const STEP_VOLUME = 0.2;
const BUFFER_SIZE = 4096;

const openOrganR = new Float32Array([0, 1.0, 0.8, 0.6, 0.4, 0.2]);
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

export interface AudioState {
	context: AudioContext;
	totalGain: GainNode;
	organWave: PeriodicWave;
	listener: AudioListener;
	organPanner: PannerNode;
	lakePanners: PannerNode[];
	step: AudioPipeline;
	flame: AudioPipeline;
	thunderGain: GainNode;
	thunderFilter: BiquadFilterNode;
	thunderProcessorNode: ScriptProcessorNode;
	windGain: GainNode;
	windFilter: BiquadFilterNode;
	windProcessorNode: ScriptProcessorNode;
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
	let organWave = organTable(context);

	let listener = context.listener;
	listener.setPosition(playerPosition.x, playerPosition.y, 0);

	let organPanner = context.createPanner();
	organPanner.setPosition(organPosition.x, organPosition.y, 0);

	let lakePanners = lakePositions.map(pos => {
		let p = context.createPanner();
		p.setPosition(pos.x, pos.y, 0);
		return p
	});

	// TODO: what is the correct frequency?
	let step = new AudioPipeline(context, totalGain, 'bandpass', 666)

	let flame = new AudioPipeline(context, totalGain, 'lowpass', 180);

	let thunderGain = context.createGain();
	thunderGain.connect(totalGain);
	let thunderFilter = context.createBiquadFilter();
	thunderFilter.connect(thunderGain);
	thunderFilter.type = 'lowpass';
	thunderFilter.frequency.value = 180;
	let thunderProcessorNode = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
	thunderProcessorNode.connect(thunderFilter);

	let windGain = context.createGain();
	windGain.connect(totalGain);
	let windFilter = context.createBiquadFilter();
	windFilter.connect(windGain);
	windFilter.type = 'highpass';
	windFilter.frequency.value = 4000
	let windProcessorNode = context.createScriptProcessor(BUFFER_SIZE, 1, 1);
	windProcessorNode.connect(windFilter);

	return {
		context, totalGain, organWave,
		listener, organPanner, lakePanners,
		step,
		flame,
		thunderGain, thunderFilter, thunderProcessorNode,
		windGain, windFilter, windProcessorNode
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
		audio.windGain.gain.setValueCurveAtTime(windModulation, audio.context.currentTime, 30);
		setTimeout(modulateWind, 31000);
	};
	modulateWind();

	audio.windProcessorNode.onaudioprocess = whiteNoise;
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

export function thunder(audio: AudioState) {
	function modulate() {
		let t = audio.context.currentTime;
		audio.thunderGain.gain.setValueAtTime(0.7 + Math.random() * 0.2, t);
		t += 0.2;
		for (let i = 0; i < Math.random() * 6 + 2; i++) {
			let a = Math.random();
			audio.thunderGain.gain.linearRampToValueAtTime(a * THUNDER_VOLUME, t);
			audio.thunderFilter.frequency.value = THUNDER_FILTER_FREQ + (Math.random() * 100 - 50);
			t += 0.2;
		}
		audio.thunderGain.gain.linearRampToValueAtTime(0.8 * THUNDER_VOLUME, t);
		audio.thunderGain.gain.linearRampToValueAtTime(0.001, t + 5);
		setTimeout(modulate, (Math.random() * 10 + 6) * 1000);
	};
	modulate();

	audio.thunderProcessorNode.onaudioprocess = whiteNoise;
}

export function lake(audio: AudioState) {
	let lakeGains = audio.lakePanners.map(p => {
		p.connect(audio.totalGain);

		let filter = audio.context.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = 700;
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
				dt += (1 + Math.random() * 2);
			}
		});
		setTimeout(modulate, 10000);
	};
	modulate();
}

function playOrganNote(audio: AudioState, spec: AudioSpec) {
	let [frequency, start, end] = spec;

	audio.organPanner.connect(audio.totalGain);
	let gain = audio.context.createGain();
	gain.connect(audio.organPanner);

	let filter = audio.context.createBiquadFilter();
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
