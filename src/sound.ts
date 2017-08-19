export interface AudioState {
        context: AudioContext;
        totalGain: GainNode;
}

export function initSound(): AudioState {
        let context = new AudioContext();
        var totalGain = context.createGain();
        totalGain.connect(context.destination);

        return { context, totalGain }
}

export function toggleSound(audio: AudioState) {
        audio.totalGain.gain.value = audio.totalGain.gain.value ? 0 : 1;
}

// The basic random noise generator was lifted from a web page that I
// have since lost. :(
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
