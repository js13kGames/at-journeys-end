import { getTransform, distance, XYDistance, XYMinusXY, Config, XYZ, XY, LWH, LW, XYZPlusXYZ, RA, RAToXYZ, copyXYZ } from './geometry'
import { cubes, planes, cylinders, noTreeZones, fuelCans, fences, lights, enemies, pews, sounds } from './map'
import { initIntro, updateIntro, initOutro, updateOutro, hideBoat, inBoatCubes, outBoatCubes } from './boat'
import { initSound, toggleSound, moveListener, flameOfUdun, lake, playOrgan, stepSound, thunder, wind } from './sound';
import { Primitive, Cube, Cylinder, Plane, FuelCan, RailFence, IronFence, TreeFence, Pew, Corpse, Road, Light, Player, Enemy, Spirit, createTiles, Tile } from './primitives'
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

	const cameraHeight = 25
	//let respawnXYZ = XYZ(40, -300, cameraHeight)
	//let respawnXYZ = XYZ(340, -490, cameraHeight)
	let respawnXYZ = XYZ(400, -2, cameraHeight)
	//let respawnXYZ = XYZ(420, -390, cameraHeight)
	let respawnAngle = -Math.PI/2

	const c: Config = {
		lib: canvas.getContext('2d'),
		canvasLW: undefined,
		canvasCenter: undefined,
		worldViewRadius: 37,
		time: 0,
		//playerXY: XY(400, -1),
		playerXY: copyXYZ(respawnXYZ),
		playerAngle: respawnAngle,
		fuel: 100,
		lanternIntensity: 1,
		cameraXYZ: copyXYZ(respawnXYZ),
		cameraAngle: respawnAngle,
		transform: undefined,
		now: new Date().getTime(),
		frameMS: 0,
		health: 3,
		pain: 0,
		safeTime: 0 // time after which player can be hurt again
	}

	// TODO: assign locations based on 'sounds' array from 'map' module
	const audioState = initSound(c.playerXY,
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

		c.canvasLW = LW(w, h)
		c.canvasCenter = XY(Math.round(w / 2), Math.round(h / 2))
	}

	let walkSpeed = 0
	let turnSpeed = 0
	//let showGrid = false
	let inBoatHidden = false

	function keyDown(key: Number) {
		switch (key) {
			case 65: turnSpeed = -0.032; break;			// A left
			case 68: turnSpeed = 0.032; break;			// D right
			case 87: walkSpeed = 0.07; break;			// W up
			case 83: walkSpeed = -0.05; break;			// S down
			//case 16: walkSpeed = 0.3; break;			// shift fast

			//case 73: c.worldViewRadius++; break;	// I increase viewable area
			//case 75: c.worldViewRadius--; break;	// K decrease viewable area
			//case 81: toggleSound(audioState); break;	// T toggle sound
			//case 79: playOrgan(audioState); break;		// O organ
			//case 89: c.cameraXYZ.z++; break;		// Y camera up
			//case 72: c.cameraXYZ.z--; break;		// H camera down
			//case 70: c.health -= 1; break;
			//case 70: flameOfUdun(audioState); break;    // F flame
			//case 84: thunder(audioState); break;        // T thunder
			//case 48: showGrid = false; break;			// 0
			//case 49: showGrid = true; break;			// 1
			//default: console.log(key)
		}
	}

	function keyUp(key: Number) {
		switch (key) {
			case 65: turnSpeed = 0; break;	// A left
			case 68: turnSpeed = 0; break;	// D right
			case 87: walkSpeed = 0; break;	// W up
			case 83: walkSpeed = 0; break;	// S down
			//case 16: walkSpeed = 0; break;	// shift fast
		}
	}

	window.addEventListener("resize", resize)
	window.addEventListener("keydown", e => keyDown(e.keyCode))
	window.addEventListener("keyup", e => keyUp(e.keyCode))

	const cubeColors = [
		"black",
		"#303030",
		"",
		"#383838"
	]
	const planeColors = [
		"black",
		"#888",
		"#ff8d8d"
	]
	const operations = [
		"",
		"source-over",
		"multiply",
		"multiply"
	]

	function boat(data: number[][]): Primitive[] {
		return data.map(a=>Cube(XYZ(a[0], -a[1], a[2]), LWH(a[3]/2, a[4]/2, a[5]), a[6], false, cubeColors[a[7]-1],
			"source-over"))
	}

	// primitives
	const player = Player()
	const lantern = Light(XYZ(0,0), c.worldViewRadius, 1, 0, [255, 214, 176], true)
	const otherLights = lights.map(a=>Light(XYZ(a[0], -a[1]), a[2], a[3], a[4]))
	const treelessPlanes = noTreeZones.map(a=>Plane(XYZ(a[0], -a[1], 0), LW(a[2]/2, a[3]/2), a[4],
		null, null, false, true))
	const basicPlanes = planes.filter(a=>a[5] != 5).map(a=>Plane(XYZ(a[0], -a[1], 0), LW(a[2] * 5, a[3] * 5), a[4],
		planeColors[a[5]-1], operations[a[5]], a[6]>1, a[6]!=2))
	const roadPlanes = planes.filter(a=>a[5] == 5).map(a=>Road(XYZ(a[0], -a[1], 0), LW(a[2]*5, a[3]*5), a[4]))
	const cans = fuelCans.map(a=>FuelCan(XYZ(a[0], -a[1], 0), a[2]))
	const spirit = Spirit(XYZ(490, -208))
	const NPCs = [spirit, ...enemies.map(a=>Enemy(XYZ(a[0], -a[1])))]
	const basicCylinders = cylinders.map(a=>Cylinder(XYZ(a[0], -a[1], a[2]), a[3]/2, a[4], null))
	const basicBlocks = cubes.map(a=>Cube(XYZ(a[0], -a[1], a[2]), LWH(a[3]/2, a[4]/2, a[5]), a[6], true,
		cubeColors[a[7]-1]))
	const pewBlocks = pews.reduce((parts: Primitive[], a: number[])=>{
		parts.push(...Pew(a)); return parts }, [] as Primitive[])
	const fenceBlocks = fences.filter(a=>a[0] == 1 || a[0] == 3).reduce((parts: Primitive[], a: number[])=>{
		parts.push(...(a[0] == 1 ? RailFence(a.slice(1)) : IronFence(a.slice(1)))); return parts }, [] as Primitive[])
	const inBoat = boat(inBoatCubes)
	const outBoat = boat(outBoatCubes)
	const corpseParts = [...Corpse([467,390]), ...Corpse([467, 490])]

	// tree fences need to know where trees can't be placed
	const avoid: Primitive[] = [
		...treelessPlanes,
		...basicPlanes,
		...roadPlanes,
		...cans,
		...NPCs,
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
	for (let x = -20; x < 580; x += zoneSize) {
		for (let y = -400; y < 0; y += zoneSize) {
			const r = Math.random() / 2 + 0.3
			const xyz = XYZ(rand(x, r), rand(y, r), 0)
			if (!avoid.some(p=>p.preventsTreeAt(xyz, r))) randomTrees.push(Cylinder(xyz, r, 30, null))
		}
	}

	const oversize: Primitive[] = []
	const tiles = createTiles([
		...basicCylinders,
		...basicBlocks,
		...corpseParts,
		...pewBlocks,
		...fenceBlocks,
		...treeFences,
		...randomTrees
	], oversize)

	const primitives: Primitive[] = [
		lantern,
		...otherLights,
		...treelessPlanes,
		...basicPlanes,
		...roadPlanes,
		...inBoat,
		...outBoat,
		...cans,
		player,
		...NPCs,
		...tiles,
		...oversize,
	]

	//initIntro(c, inBoat)
	initOutro(c, outBoat)

/*
	const rains: XYZ[] = []
	for (let i = 0; i < 100; i++) rains.push(Rain(c))
*/

	function draw() {

		// update time
		const now = new Date().getTime()
		c.frameMS = now - c.now
		c.now = now
		c.time += 0.1

		// update player and lantern
		if (c.playerXY.y < 1) c.playerAngle += turnSpeed
		c.playerXY = moveWithDeflection(c.playerXY, c.playerAngle, walkSpeed, 0.3, true, false, primitives, c)
		c.fuel = Math.max(c.fuel - (c.frameMS / 1000) * .7, 0)
		c.lanternIntensity = Math.max((Math.pow(c.fuel, 0.5) + Math.pow(c.fuel, 1/3)) * .07, 0.1)
		lantern.center.x = c.playerXY.x
		lantern.center.y = c.playerXY.y
		lantern.setIntensity(c.lanternIntensity)

		let playerDirection = RAToXYZ(RA(1, c.playerAngle))
		moveListener(audioState, c.playerXY, playerDirection)
		if (walkSpeed && Math.round(c.time * 10) % TIME_UNITS_PER_STEP === 0) {
			stepSound(audioState)
		}

		// update camera
		c.cameraXYZ.x += (c.playerXY.x - c.cameraXYZ.x) * 0.02
		c.cameraXYZ.y += (c.playerXY.y - c.cameraXYZ.y) * 0.02
		c.cameraAngle += (c.playerAngle - c.cameraAngle) * 0.02

		// clear the canvas
		c.lib.fillStyle = "#000"
		c.lib.globalCompositeOperation = "source-over"
		c.lib.fillRect(0, 0, c.canvasLW.l, c.canvasLW.w)

		c.transform = getTransform(c)

		// draw primitives
		//showGrid && tiles.forEach(t=>t.outline(c))
		c.lib.fillStyle = "black"
		primitives.forEach(p=>p.draw(c))

		// draw rain
		//rains.forEach(rain=>drawRain(rain, c))

		// check for refueling
		cans.forEach(can=>{
			if (can.contains(c.playerXY, 0.5)) {
				can.consume()
				setTimeout(()=>c.fuel = Math.min(c.fuel + 50, 100), 400)
				flameOfUdun(audioState)
				respawnXYZ = copyXYZ(c.playerXY)
				respawnXYZ.z = cameraHeight
				respawnAngle = c.playerAngle
			}
		})

		// update NPCs
		NPCs.forEach(e=>e.update(c, primitives))

		// pain overlay and respawn
		if (c.health > 0) {
			if (c.pain > 0) {
				c.pain -= 1/120
				if (c.pain <= 0) c.pain = 0
				c.lib.globalCompositeOperation = "source-over"
				c.lib.fillStyle = "rgba(25,0,0," + c.pain + ")"
				c.lib.fillRect(0, 0, c.canvasLW.l, c.canvasLW.w)
			}
		} else {
			c.pain -= 1/120
			c.lib.globalCompositeOperation = "source-over"
			const red = Math.round(c.pain / 4)
			const green = Math.round(c.pain / 8)
			const blue = green
			c.lib.fillStyle = "rgba(" + red + "," + green + "," + blue + ",1)",
			c.lib.fillRect(0, 0, c.canvasLW.l, c.canvasLW.w)

			// respawn
			c.playerXY = copyXYZ(respawnXYZ)
			c.playerAngle = respawnAngle
			c.cameraXYZ = copyXYZ(respawnXYZ)
			spirit.center.x = respawnXYZ.x
			spirit.center.y = respawnXYZ.y
			c.fuel = 100

			// wait for overlay to fade, then reset health
			if (c.pain < -1) {
				flameOfUdun(audioState)
				c.pain = 1
				c.health = 3
			}
		}

		//updateIntro(c, inBoat)
		updateOutro(c, outBoat)

		// positional triggers
		if (!inBoatHidden && c.playerXY.y < -21) {
			hideBoat(inBoat)
			inBoatHidden = true
		}

		// frame rate in upper left corner
		const frameRate = Math.round(1000 / c.frameMS)
		c.lib.globalCompositeOperation = "source-over"
		c.lib.fillStyle = "yellow"
		c.lib.font = "12px Arial"
		c.lib.fillText("(" + Math.round(c.playerXY.x) + ", " +
			Math.round(c.playerXY.y) + ") " + frameRate + " fps" +
			", fuel: " + c.fuel.toFixed(2) + ", health: " + c.health +
			", respawn: " + respawnXYZ.x + ", " + respawnXYZ.y, 5, 15)

		window.requestAnimationFrame(draw)
	}

	// start it up
	setTimeout(()=>{
		resize()
		draw()
	}, 10)
}

main()
