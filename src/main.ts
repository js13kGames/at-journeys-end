import { getTransform, distance, XYDistance, XYMinusXY, Config, XYZ, XY, LWH, LW, XYZPlusXYZ, RA, RAToXYZ } from './geometry'
import { cubes, planes, cylinders, noTreeZones, fuelCans, fences, lights, enemies, sounds } from './map'
import { initSound, toggleSound, moveListener, flameOfUdun, lake, playOrgan, stepSound, thunder, wind } from './sound';
import { Primitive, Cube, Cylinder, Plane, FuelCan, RailFence, IronFence, TreeFence, Road, Light, Rain, Player, Enemy, createTiles, Tile, drawRain } from './primitives'
import { initMovement, moveWithDeflection } from './movement'

const TIME_UNITS_PER_STEP = 30

function main() {
	const body = document.body.style
	body.backgroundColor = "#000"
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
		worldViewRadius: 37,
		time: 0,
		playerXY: XY(0, -9),
		//playerXY: XY(72, -238),
		playerAngle: upAngle,
		fuel: 100,
		lanternIntensity: 1,
		cameraXYZ: XYZ(0, 0, 25),
		cameraAngle: upAngle,
		transform: undefined,
		now: new Date().getTime(),
		frameMS: 0
	}

	// TODO: assign locations based on 'sounds' array from 'map' module
	const audioState = initSound(config.playerXY,
		XY(32.75, -22.5),
		sounds.filter(([x, y, t]) => t === 5).map(([x, y, _]) => XY(x, y)));
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
	let showGrid = false

	function keyDown(key: Number) {
		switch (key) {
			case 65: turnSpeed = -0.025; break;			// A left
			case 68: turnSpeed = 0.025; break;			// D right
			case 87: walkSpeed = 0.07; break;			// W up
			case 83: walkSpeed = -0.07; break;			// S down

			case 73: config.worldViewRadius++; break;	// I increase viewable area
			case 75: config.worldViewRadius--; break;	// K decrease viewable area
			case 81: toggleSound(audioState); break;	// T toggle sound
			case 79: playOrgan(audioState); break;		// O organ
			case 89: config.cameraXYZ.z++; break;		// Y camera up
			case 72: config.cameraXYZ.z--; break;		// H camera down
			case 70: flameOfUdun(audioState); break;    // F flame
			case 84: thunder(audioState); break;        // T thunder
			case 48: showGrid = false; break;			// 0
			case 49: showGrid = true; break;			// 1
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

	// primitives
	const player = Player()
	const lantern = Light(XYZ(0,0), config.worldViewRadius, 1, true)
	const otherLights = lights.map(a=>Light(XYZ(a[0], -a[1]), a[2], a[3]))
	const treelessPlanes = noTreeZones.map(a=>Plane(XYZ(a[0], -a[1], 0), LW(a[2]/2, a[3]/2), a[4],
		null, null, false, true))
	const basicPlanes = planes.filter(a=>a[5] != 2).map(a=>Plane(XYZ(a[0], -a[1], 0), LW(a[2] * 5, a[3] * 5), a[4],
		planeColors[a[5]], operations[a[5]], a[6]>1, a[6]!=2))
	const roadPlanes = planes.filter(a=>a[5] == 2).map(a=>Road(XYZ(a[0], -a[1], 0), LW(a[2]*5, a[3]*5), a[4]))
	const cans = fuelCans.map(a=>FuelCan(XYZ(a[0], -a[1], 0), a[2]))
	const demons = enemies.map(a=>Enemy(XYZ(a[0], a[1])))
	demons.push(Enemy(XYZ(-10, -10)))
	const basicCylinders = cylinders.map(a=>Cylinder(XYZ(a[0], -a[1], a[2]), a[3]/2, a[4], null))
	const basicBlocks = cubes.map(a=>Cube(XYZ(a[0], -a[1], a[2]), LWH(a[3]/2, a[4]/2, a[5]), a[6]))
	const fenceBlocks = fences.filter(a=>a[0] == 1 || a[0] == 3).reduce((parts: Primitive[], a: number[])=>{
		parts.push(...(a[0] == 1 ? RailFence(a.slice(1)) : IronFence(a.slice(1)))); return parts }, [] as Primitive[])

	// tree fences need to know where trees can't be placed
	const avoid: Primitive[] = [
		...treelessPlanes,
		...basicPlanes,
		...roadPlanes,
		...cans,
		...demons,
		...basicCylinders,
		...basicBlocks,
		...fenceBlocks
	]
	const treeFences = fences.filter(a=>a[0] == 2).reduce((trees: Primitive[], a: number[])=>{
		trees.push(...TreeFence(a.slice(1), avoid))
		return trees
	}, [] as Primitive[])

	// generate trees by dividing the map into zones and putting one tree in each zone
	const randomTrees = []
	const zoneSize = 5
	const rand = (n: number, r: number)=>n + Math.random() * (zoneSize - r * 2) + r
	for (let x = -420; x < 180; x += zoneSize) {
		for (let y = -400; y < 0; y += zoneSize) {
			const r = Math.random() / 2 + 0.3
			const xyz = XYZ(rand(x, r), rand(y, r), 0)
			if (!avoid.some(p=>p.preventsTreeAt(xyz, r))) randomTrees.push(Cylinder(xyz, r, 30, null))
		}
	}

	const tiles = createTiles([
		...basicCylinders,
		...basicBlocks,
		...fenceBlocks,
		...treeFences,
		...randomTrees
	])

	const primitives: Primitive[] = [
		lantern,
		...otherLights,
		player,
		...treelessPlanes,
		...basicPlanes,
		...roadPlanes,
		...cans,
		...demons,
		...tiles,
	]

/*
	const rains: XYZ[] = []
	for (let i = 0; i < 100; i++) rains.push(Rain(config))
*/

	function draw() {

		// update time
		const now = new Date().getTime()
		config.frameMS = now - config.now
		config.now = now
		config.time += 0.1

		// update player and lantern
		config.playerAngle += turnSpeed
		const pi2 = Math.PI * 2
		if (config.playerAngle > pi2) config.playerAngle -= pi2
		if (config.playerAngle < -pi2) config.playerAngle += pi2
		config.playerXY = moveWithDeflection(config.playerXY, config.playerAngle, walkSpeed, 0.3, primitives)
		config.fuel = Math.max(config.fuel - (config.frameMS / 1000) * .7, 0)
		config.lanternIntensity = Math.max((Math.pow(config.fuel, 0.5) + Math.pow(config.fuel, 1/3)) * .07, 0.1)
		lantern.center.x = config.playerXY.x
		lantern.center.y = config.playerXY.y
		lantern.setIntensity(config.lanternIntensity)

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

		// draw primitives
		showGrid && tiles.forEach(t=>t.outline(config))
		config.lib.fillStyle = "black"
		primitives.forEach(p=>p.draw(config))

		// draw rain
		//rains.forEach(rain=>drawRain(rain, config))

		// check for refueling
		cans.forEach(c=>{
			if (c.contains(config.playerXY, 0.5)) {
				c.consume()
				setTimeout(()=>config.fuel = Math.min(config.fuel + 50, 100), 400)
				flameOfUdun(audioState)
			}
		})

		// update enemies
		demons.forEach(e=>e.update(config, primitives))

		const p1 = config.cameraXYZ
		const p2 = XYZ(p1.x + config.worldViewRadius, p1.y)
		const cps = config.transform.xyzs([p1, p2])
		const r = distance(cps[0].x - cps[1].x, cps[0].y - cps[1].y)
		config.lib.beginPath()
		config.lib.arc(cps[0].x, cps[0].y, r, 0, Math.PI*2)
		config.lib.strokeStyle = "green"
		config.lib.stroke()

		// frame rate in upper left corner
		const frameRate = Math.round(1000 / config.frameMS)
		config.lib.fillStyle = "yellow"
		config.lib.font = "12px Arial"
		config.lib.fillText("(" + Math.round(config.playerXY.x) + ", " +
			Math.round(config.playerXY.y) + ") " + frameRate + " fps" +
			", fuel: " + config.fuel.toFixed(2), 5, 15)

		window.requestAnimationFrame(draw)
	}

	// start it up
	setTimeout(()=>{
		resize()
		draw()
	}, 10)
}

main()
