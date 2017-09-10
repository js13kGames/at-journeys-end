import { getTransform, distance, Config, XYZ, XY, LWH, LW, XYZPlusXYZ, RA, RAToXYZ } from './geometry'
import { cubes, planes, cylinders, noTreeZones, fuelCans, fences } from './map'
import { initSound, toggleSound, moveListener, flameOfUdun, lake, playOrgan, stepSound, thunder, wind } from './sound';
import { Primitive, Box, Can, Rug, Fence, TreeFence, Road, Rain, drawRain } from './primitives'
import { initMovement, moveWithDeflection } from './movement'

const TIME_UNITS_PER_STEP = 30

function main() {
	const body = document.body.style
	body.margin = "0px"
	body.overflow = "hidden"

	const canvas = <HTMLCanvasElement>document.createElement("canvas")
	document.body.appendChild(canvas)

	initMovement()

	const upAngle = 1.5 * Math.PI

	const config: Config = {
		lib: canvas.getContext('2d'),
		canvasLW: undefined,
		canvasCenter: undefined,
		worldViewRadius: 25,
		time: 0,
		playerXY: XY(0, 0),
		playerAngle: upAngle,
		cameraXYZ: XYZ(0, 0, 20),
		cameraAngle: upAngle,
		transform: undefined,
		now: new Date().getTime(),
		frameMS: 0
	}

	// TODO: assign locations based on 'sounds' array from 'map' module
	const audioState = initSound(config.playerXY,
		XY(32.75, -22.5),
		[XY(-25, -5), XY(30, -9), XY(12, -10), XY(-9, -12)])
	wind(audioState)
	lake(audioState)
	playOrgan(audioState)

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
			case 87: walkSpeed = 0.35; break;			// W up
			case 83: walkSpeed = -0.35; break;			// S down

			case 73: config.worldViewRadius--; break;	// I zoom in
			case 75: config.worldViewRadius++; break;	// K zoom out
			case 81: toggleSound(audioState); break;	// T toggle sound
			case 79: playOrgan(audioState); break;		// O organ
			case 89: config.cameraXYZ.z++; break;		// Y camera up
			case 72: config.cameraXYZ.z--; break;		// H camera down
			case 70: flameOfUdun(audioState); break;        // F flame
			case 84: thunder(audioState); break;            // T thunder
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

	const planeColors = [
		"yellow",	// not supported
		"black",
		"#888",
		"red"
	]
	const operations = [
		"",
		"source-over",
		"multiply",
		"multiply"
	]

	const primitives: Primitive[] = [
		...noTreeZones.map(a=>Rug(XYZ(a[0], -a[1], 0), LW(a[2]/2, a[3]/2), a[4], null, null, false, true)),
		...planes.filter(a=>a[5] != 2).map(a=>Rug(XYZ(a[0], -a[1], 0), LW(a[2] * 5, a[3] * 5), a[4],
				planeColors[a[5]], operations[a[5]], a[6]>1, a[6]!=2)),
		...planes.filter(a=>a[5] == 2).map(a=>Road(XYZ(a[0], -a[1], 0), LW(a[3]*5, a[2]*5), a[4]+Math.PI/2)),
		//...lights.map(a=>Light(
		...fuelCans.map(a=>Box(XYZ(a[0], -a[1], 0), LWH(0.27, 0.41, 0.9), 0, "red")),
		...cylinders.map(a=>Can(XYZ(a[0], -a[1], a[2]), a[3]/2, a[4], null)),
		...cubes.map(a=>Box(XYZ(a[0], -a[1], a[2]), LWH(a[3]/2, a[4]/2, a[5]), a[6], null)),
		...fences.filter(a=>a[0] == 1).map((a: number[])=>Fence(a.slice(1))),
		...fences.filter(a=>a[0] == 2).map((a: number[])=>TreeFence(a.slice(1)))
	]

	// generate trees by dividing the map into zones and putting one tree in each zone
	const trees = []
	const zoneSize = 5
	const rand = (n: number, r: number)=>n + Math.random() * (zoneSize - r * 2) + r
	for (let x = -420; x < 180; x += zoneSize) {
		for (let y = -400; y < 0; y += zoneSize) {
			const r = Math.random() / 2 + 0.3
			const xyz = XYZ(rand(x, r), rand(y, r), 0)
			if (!primitives.some(p=>p.isTreeless && p.contains(xyz, r))) trees.push(Can(xyz, r, 30, null))
		}
	}
	primitives.push(...trees)

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
		config.playerXY = moveWithDeflection(config.playerXY, config.playerAngle, walkSpeed, 0.3, primitives)

		let playerDirection = RAToXYZ(RA(1, config.playerAngle))
		moveListener(audioState, config.playerXY, playerDirection)
		if (walkSpeed && Math.round(config.time * 10) % TIME_UNITS_PER_STEP === 0) {
			stepSound(audioState)
		}

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
		config.lib.fillStyle = "#000"
		config.lib.globalCompositeOperation = "source-over"
		config.lib.fillRect(0, 0, config.canvasLW.l, config.canvasLW.w)

		config.transform = getTransform(config)

		// draw the light
		const lr = distance(config.canvasLW.l/2, config.canvasLW.w/2)
		const lightXY = config.transform.xyz(XYZ(config.playerXY.x, config.playerXY.y, 0))
		const g = config.lib.createRadialGradient(lightXY.x, lightXY.y, 0, lightXY.x, lightXY.y, lr)
		const baseIntensity = 1.2, flickerAmount = 0.1
		const intensity = baseIntensity + flickerAmount * (0.578 - (Math.sin(config.time) +
			Math.sin(2.2 * config.time + 5.52) + Math.sin(2.9 * config.time + 0.93) +
			Math.sin(4.6 * config.time + 8.94))) / 4
		const steps = 20; // number of gradient steps
		const lightScale = 15; // controls how quickly the light falls off
		for (var i = 1; i < steps + 1; i++) {
			let x = lightScale * Math.pow(i / steps, 2) + 1
			let alpha = intensity / (x * x)
			if (alpha < 0.01) alpha = 0
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
		drawPlayer()

		// frame rate in upper left corner
		const frameRate = Math.round(1000 / config.frameMS)
		config.lib.fillStyle = "yellow"
		config.lib.font = "12px Arial"
		config.lib.fillText(frameRate + " fps", 5, 15)

		window.requestAnimationFrame(draw)
	}

	const playerWPs = [
		XY(-0.113, 0.106),
		XY(-0.113, 0.106), XY(-0.097, 0.038), XY(0.002, 0.04),
		XY(0.103, 0.041), XY(0.098, 0.113), XY(0.116, 0.131),
		XY(0.141, 0.158), XY(0.226, 0.129), XY(0.227, 0.25),
		XY(0.228, 0.316), XY(0.087, 0.361), XY(-0.022, 0.354),
		XY(-0.116, 0.354), XY(-0.269, 0.319), XY(-0.269, 0.183),
		XY(-0.271, 0.013), XY(-0.2, -0.082), XY(-0.15, -0.08),
		XY(-0.097, -0.081), XY(-0.085, -0.033), XY(-0.097, -0.003),
		XY(-0.156, 0.146), XY(-0.111, 0.106), XY(-0.111, 0.106)
	]

	function drawPlayer() {
		const playerXYZ = XYZ(config.playerXY.x, config.playerXY.y)
		const wps = playerWPs.map(wp=>XYZPlusXYZ(playerXYZ,
			RAToXYZ(RA(distance(wp.x, wp.y)*2, Math.atan2(wp.y, wp.x) + config.playerAngle - upAngle))))
		const cps = config.transform.xyzs(wps)
		config.lib.beginPath()
		config.lib.moveTo(cps[0].x, cps[0].y)
		for (let i = 1; i < cps.length; i += 3) {
			config.lib.bezierCurveTo(cps[i].x, cps[i].y, cps[i+1].x, cps[i+1].y, cps[i+2].x, cps[i+2].y)
		}

		config.lib.fillStyle = "black"
		config.lib.fill()
	}

	// start it up
	setTimeout(()=>{
		resize()
		draw()
	}, 10)
}

main()
