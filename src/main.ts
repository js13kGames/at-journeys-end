interface Tree {
	x: number,
	y: number,
	r: number
}
const Tree = (x: number, y: number, r: number)=>({ x: x, y: y, r: r })

interface AudioState {
    context: AudioContext;
    totalGain: GainNode;
}

function initSound(): AudioState {
    let context = new AudioContext();
    var totalGain = context.createGain();
    totalGain.connect(context.destination);
    
    return {context, totalGain}
}

function wind(audio: AudioState) {
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

function toggleSound(gain: GainNode) {
    gain.gain.value = gain.gain.value ? 0 : 1;
}

function knock(audio: AudioState) {
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

function main() {
	const body = document.body.style
	body.margin = "0px"
	body.overflow = "hidden"

	let w: number
	let h: number
	let cx: number
	let cy: number

	const mapSize = 2000
	let px = mapSize / 2
	let py = mapSize / 2
	let v = 5	// velocity

	const trees = generateTrees(mapSize, 150)

        const canvas = <HTMLCanvasElement>document.createElement("canvas");
        document.body.appendChild(canvas);
        const c = canvas.getContext('2d')

        let audio = initSound();
        wind(audio);

	function resize() {
		setTimeout(()=>{
			w = window.innerWidth
			h = window.innerHeight
			canvas.style.width = w + "px"
			canvas.style.height = h + "px"
			canvas.width = w
			canvas.height = h
			cx = Math.round(w / 2)
			cy = Math.round(h / 2)
			draw()
		}, 10)
	}

        function action(key: Number) {
                switch (key) {
			case 65:	// A
			case 72:	// H
		                px -= v; break;	// left
			case 68:	// D
			case 76:	// L
		                px += v; break;	// right
			case 87:	// W
			case 75:	// K
		                py -= v; break;	// up
			case 83:	// S
			case 74:	// J
		                py += v; break;	// down
                        case 78:        // n
                                knock(audio); break;
                        case 81:        // q
                                toggleSound(audio.totalGain); break;
			default: console.log(key)
		}
		draw()
	}

	window.addEventListener("resize", resize)
	window.addEventListener("keydown", e=>action(e.keyCode))
	resize()

	function draw() {

		// clear the canvas
		c.fillStyle = "rgba(0,0,0,1)"
		c.fillRect(0, 0, w, h)

		// draw the light
		const lr = 300
		const g = c.createRadialGradient(cx, cy, 0, cx, cy, lr)
		g.addColorStop(0, "#a0a090")
		g.addColorStop(1, "#000000")
		c.fillStyle = g
		c.fillRect(cx - lr, cy - lr, lr*2, lr*2)

		// draw the player
		const pr = 20
		c.strokeStyle = "blue"
		c.strokeRect(cx - pr, cy - pr/2, pr*2, pr)

/*
		const trees = [
			Tree(1020, 900, 10),
			Tree(1070, 1050, 15),
			Tree(900, 930, 18),
			Tree(910, 1080, 12)
		]
*/
		trees.forEach(drawTree)

		//window.requestAnimationFrame(draw)
	}

	function drawTree(t: Tree) {

		// trunk
		const tx = cx + t.x - px
		const ty = cy + t.y - py

		// shadow
		c.beginPath()
		const dx = cx - tx
		const dy = cy - ty
		const a = Math.atan2(dy, dx)

		// left edge of tree
		const a1 = a + Math.PI / 2
		const p1x = tx + Math.cos(a1) * t.r
		const p1y = ty + Math.sin(a1) * t.r

		// left limit of shadow
		const a2 = Math.atan2(p1y - cy, p1x - cx)
		const p2x = cx + Math.cos(a2) * (w + h)
		const p2y = cy + Math.sin(a2) * (w + h)

		// right edge of tree
		const a3 = a - Math.PI / 2
		const p3x = tx + Math.cos(a3) * t.r
		const p3y = ty + Math.sin(a3) * t.r

		// right limit of shadow
		const a4 = Math.atan2(p3y - cy, p3x - cx)
		const p4x = cx + Math.cos(a4) * (w + h)
		const p4y = cy + Math.sin(a4) * (w + h)

		c.beginPath()
		c.moveTo(p1x, p1y)
		c.lineTo(p2x, p2y)
		c.lineTo(p4x, p4y)
		c.lineTo(p3x, p3y)
		c.fillStyle = "black"
		c.fill()
		c.beginPath()
		c.arc(tx, ty, t.r, 0, 2*Math.PI)
		c.fill()
	}

	// divide the map into zones and put one tree in each zone
	function generateTrees(mapSize: number, zoneSize: number): Tree[] {
		const trees = [] as Tree[]
		for (let zx = 0; zx * zoneSize < mapSize; zx++) {
			for (let zy = 0; zy * zoneSize < mapSize; zy++) {
				const r = Math.random() * 20 + 8
				const tx = zx * zoneSize + Math.random() * (zoneSize - r * 2) + r
				const ty = zy * zoneSize + Math.random() * (zoneSize - r * 2) + r
				if ((tx - px) * (tx - px) + (ty - py) * (ty - py) > 3000) {
					trees.push(Tree(tx, ty, r))
				}
			}
		}
		return trees
	}
}

main();
