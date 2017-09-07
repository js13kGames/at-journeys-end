import { getTransform, Config, XYZ, XY, LWH, LW } from './geometry'
import { cubes, planes, cylinders } from './map'
import { Box, Can, Rug, Rain, drawRain } from './primitives'
import { initSound, toggleSound, wind, knock, organNote } from './sound'
import { initMovement, moveWithDeflection } from './movement'

function main() {
	const body = document.body.style
	body.margin = "0px"
	body.overflow = "hidden"

	const canvas = <HTMLCanvasElement>document.createElement("canvas")
	document.body.appendChild(canvas)

	const audioState = initSound()
	wind(audioState)

	initMovement()

	const upAngle = 1.5 * Math.PI

	const config: Config = {
		lib: canvas.getContext('2d'),
		canvasLW: undefined,
		canvasCenter: undefined,
		worldViewRadius: 50,
		time: 0,
		playerXY: XY(0, 0),
		playerAngle: upAngle,
		cameraXYZ: XYZ(0, 0, 30),
		cameraAngle: upAngle,
		transform: undefined,
		now: new Date().getTime(),
		frameMS: 0
	}

	function resize() {
		const w = window.innerWidth
		const h = window.innerHeight

		// update canvas size and drawing area
		canvas.style.width = w + "px"
		canvas.style.height = h + "px"
		canvas.width = w
		canvas.height = h

		config.canvasLW = LW(w, h)
		config.canvasCenter = XY(Math.round(w / 2), Math.round(h / 2))
	}

	let walkSpeed = 0
	let turnSpeed = 0

	function keyDown(key: Number) {
		switch (key) {
			case 65: turnSpeed = -0.025; break;			// A left
			case 68: turnSpeed = 0.025; break;			// D right
			case 87: walkSpeed = 0.04; break;			// W up
			case 83: walkSpeed = -0.04; break;			// S down
			case 73: config.worldViewRadius--; break;	// I zoom in
			case 75: config.worldViewRadius++; break;	// K zoom out
			case 78: knock(audioState); break;     		// N 'knock'
			case 81: toggleSound(audioState); break;	// T toggle sound
			case 79: organNote(audioState); break;		// O organ
			case 89: config.cameraXYZ.z++; break;		// Y camera up
			case 72: config.cameraXYZ.z--; break;		// H camera down
			//default: console.log(key)
		}
		//draw()
	}

	function keyUp(key: Number) {
		switch (key) {
			case 65: turnSpeed = 0; break;	// A left
			case 68: turnSpeed = 0; break;	// D right
			case 87: walkSpeed = 0; break;	// W up
			case 83: walkSpeed = 0; break;	// S down
		}
	}

	function move(from: XY, angle: number, distance: number): XY {
		return XY(from.x + Math.cos(angle) * distance, from.y + Math.sin(angle) * distance)
	}

	window.addEventListener("resize", resize)
	window.addEventListener("keydown", e => keyDown(e.keyCode))
	window.addEventListener("keyup", e => keyUp(e.keyCode))

	const primitives = [
		Can(XYZ(0, -5, 0), 0.5, 1),
		...planes.map(a=>Rug(XYZ(a[0], -a[1], 0), LW(a[2] * 5, a[3] * 5), a[4])),
		...cylinders.map(a=>Can(XYZ(a[0], -a[1], a[2]), a[3]/2, a[4])),
		...cubes.map(a=>Box(XYZ(a[0], -a[1], a[2]), LWH(a[3]/2, a[4]/2, a[5]), a[6]))
	]

	const rains: XYZ[] = []
	for (let i = 0; i < 100; i++) rains.push(Rain(config))

	function draw() {

		// update time
		const now = new Date().getTime()
		config.frameMS = now - config.now
		config.now = now
		config.time += 0.1

		// update player
		config.playerAngle += turnSpeed
		config.playerXY = moveWithDeflection(config.playerXY, config.playerAngle, walkSpeed, 0, primitives)

		// update camera
		/*
		config.cameraXYZ.x += (config.playerXY.x - config.cameraXYZ.x) * 0.02
		config.cameraXYZ.y += (config.playerXY.y - config.cameraXYZ.y) * 0.02
		config.cameraAngle += (config.playerAngle - config.cameraAngle) * 0.02
		*/
		config.cameraXYZ.x = config.playerXY.x
		config.cameraXYZ.y = config.playerXY.y
		config.cameraAngle = config.playerAngle

		// clear the canvas
		config.lib.fillStyle = "#444"
		config.lib.fillRect(0, 0, config.canvasLW.l, config.canvasLW.w)

		config.transform = getTransform(config)

		// draw the light
		const lr = 800
		const lightXY = config.transform.xyz(XYZ(config.playerXY.x, config.playerXY.y, 0))
		const g = config.lib.createRadialGradient(lightXY.x, lightXY.y, 0, lightXY.x, lightXY.y, lr)
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
		config.lib.fillStyle = g
		config.lib.fillRect(lightXY.x - lr, lightXY.y - lr, lr * 2, lr * 2)

		// draw primitives
		config.lib.fillStyle = "black"
		primitives.forEach(p=>p.draw(config))

		// draw rain
		//rains.forEach(rain=>drawRain(rain, config))

		// draw the player
		config.lib.strokeStyle = "blue"
		config.lib.beginPath()
		config.lib.arc(lightXY.x, lightXY.y, 3, 0, 2*Math.PI)
		config.lib.stroke()

		// frame rate in upper left corner
		const frameRate = Math.round(1000 / config.frameMS)
		config.lib.fillStyle = "yellow"
		config.lib.font = "12px Arial"
		config.lib.fillText(frameRate + " fps", 5, 15)

		window.requestAnimationFrame(draw)
	}

	// start it up
	setTimeout(()=>{
		resize()
		draw()
	}, 10)
}

main()
