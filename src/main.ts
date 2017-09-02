import { getTransform, Config, Point, Size } from './geometry';
import { cubes, planes } from './map';
import { drawBlock, drawPlate, drawTree, Block, Plate, Tree } from './primitives';
import { initSound, toggleSound, wind, playOrgan } from './sound';

function main() {
	const body = document.body.style
	body.margin = "0px"
	body.overflow = "hidden"

	const canvas = <HTMLCanvasElement>document.createElement("canvas")
	document.body.appendChild(canvas)

	let audioState = initSound()
	wind(audioState)

	const upAngle = 3 * Math.PI / 2

	const config: Config = {
		context2d: canvas.getContext('2d'),
		canvasSize: undefined,
		canvasCenter: undefined,
		worldViewRadius: 50,
		time: 0,
		direction: upAngle,
		playerXY: Point(0, 0),
		cameraXY: Point(0, 0),
		cameraAngle: upAngle,
		lightHeight: 1,
		transform: undefined,
		now: new Date().getTime(),
		frameMS: 0
	}

	function resize() {
		setTimeout(() => {
			const w = window.innerWidth
			const h = window.innerHeight

			// update canvas size and drawing area
			canvas.style.width = w + "px"
			canvas.style.height = h + "px"
			canvas.width = w
			canvas.height = h

			config.canvasSize = Size(w, h)
			config.canvasCenter = Point(Math.round(w / 2), Math.round(h / 2))
			draw()
		}, 10)
	}

	let walkSpeed = 0
	let turnSpeed = 0

	function keyDown(key: Number) {
		switch (key) {
			case 65: turnSpeed = -0.025; break;			// A left
			case 68: turnSpeed = 0.025; break;			// D right
			case 87: walkSpeed = 0.05; break;			// W up
			case 83: walkSpeed = -0.05; break;			// S down
			case 73: config.worldViewRadius--; break;	// I zoom in
			case 75: config.worldViewRadius++; break;	// K zoom out
			case 81: toggleSound(audioState); break;	// T toggle sound
			case 79: playOrgan(audioState); break;		// O organ
			case 89: config.lightHeight += 0.1; break;	// Y light higher
			case 72: config.lightHeight -= 0.1; break;	// H light lower
			default: console.log(key)
		}
	}

	function keyUp(key: Number) {
		switch (key) {
			case 65: turnSpeed = 0; break;	// A left
			case 68: turnSpeed = 0; break;	// D right
			case 87: walkSpeed = 0; break;	// W up
			case 83: walkSpeed = 0; break;	// S down
		}
	}

	function move(from: Point, direction: number, distance: number): Point {
		return Point(from.x + Math.cos(direction) * distance, from.y + Math.sin(direction) * distance)
	}

	window.addEventListener("resize", resize)
	window.addEventListener("keydown", e => keyDown(e.keyCode))
	window.addEventListener("keyup", e => keyUp(e.keyCode))
	resize()

	//const trees = generateTrees(1000, 6)
        const trees: Tree[] = []

/*
	const blocks = [
		Block(Point(120, 110), Size(2, 0.4), 0, 1),
		Block(Point(140, 120), Size(10, 0.4), 0, 10),
		Block(Point(144.8, 123.3), Size(0.4, 7), 0, 10),
		Block(Point(142, 127), Size(6, 0.4), 0, 10),
		Block(Point(136.5, 127), Size(3, 0.4), 0, 10),
		Block(Point(135.2, 123.3), Size(0.4, 7), 0, 10)
	]
	*/

	const blocks = cubes.map(data=>Block(Point(data[0], -data[1]), Size(data[3], data[4]), data[6], data[5], data[2]))

	const degToRad = Math.PI / 180
	const plates = planes.map(data=>Plate(Point(data[0], -data[1]), Size(data[2] * 10, data[3] * 10), data[4] * degToRad))

	// divide the map into zones and put one tree in each zone
	function generateTrees(mapSize: number, zoneSize: number): Tree[] {
		const trees = [] as Tree[]
		for (let zx = 0; zx * zoneSize < mapSize; zx++) {
			for (let zy = 0; zy * zoneSize < mapSize; zy++) {
				const r = Math.random() / 2 + 0.3
				const tx = zx * zoneSize + Math.random() * (zoneSize - r * 2) + r
				const ty = zy * zoneSize + Math.random() * (zoneSize - r * 2) + r
				trees.push(Tree(Point(tx, ty), r))
			}
		}
		return trees
	}

	function draw() {

		// update time
		const now = new Date().getTime()
		config.frameMS = now - config.now
		config.now = now
		config.time += 0.1

		// update player
		config.playerXY = move(config.playerXY, config.direction, walkSpeed)
		config.direction += turnSpeed

		// update camera
		config.cameraXY.x += (config.playerXY.x - config.cameraXY.x) * 0.02
		config.cameraXY.y += (config.playerXY.y - config.cameraXY.y) * 0.02
		config.cameraAngle += (config.direction - config.cameraAngle) * 0.02

		// clear the canvas
		config.context2d.fillStyle = "rgba(128,128,128,1)"
		config.context2d.fillRect(0, 0, config.canvasSize.w, config.canvasSize.h)

		config.transform = getTransform(config)

		// draw the light
		const lr = 800
		const lightXY = config.transform.point(config.playerXY)
		const g = config.context2d.createRadialGradient(lightXY.x, lightXY.y, 0, lightXY.x, lightXY.y, lr)

/*
		const baseIntensity = 1, flickerAmount = 0.1
		const intensity = baseIntensity + flickerAmount * (0.578 - (Math.sin(config.time) +
			Math.sin(2.2 * config.time + 5.52) + Math.sin(2.9 * config.time + 0.93) +
			Math.sin(4.6 * config.time + 8.94))) / 4

		const steps = 32; // number of gradient steps
		const lightScale = 15; // controls how quickly the light falls off
		for (var i = 1; i < steps + 1; i++) {
			let x = lightScale * Math.pow(i / steps, 2) + 1
			let alpha = intensity / (x * x)
			g.addColorStop((x - 1) / lightScale, `rgba(255,255,255,${alpha})`)
		}

		config.context2d.fillStyle = g
		config.context2d.fillRect(lightXY.x - lr, lightXY.y - lr, lr * 2, lr * 2)
*/

		// draw all plates
		plates.forEach(plate=>{
			drawPlate(plate, config)
		})

		// draw all trees
		config.context2d.beginPath()
		trees.forEach(tree=>{
			drawTree(tree, config)
		})
		config.context2d.fillStyle = "black"
		config.context2d.fill()

		// draw all blocks
		blocks.forEach(block=>{
			drawBlock(block, config)
		})

		// draw the center
		config.context2d.strokeStyle = "blue"
		config.context2d.strokeRect(lightXY.x - 5, lightXY.y - 5, 10, 10)

		const frameRate = Math.round(1000 / config.frameMS)
		config.context2d.fillStyle = "yellow"
		config.context2d.font = "12px Arial"
		config.context2d.fillText(frameRate + " fps", 5, 15)

		window.requestAnimationFrame(draw)
	}
}

main();
