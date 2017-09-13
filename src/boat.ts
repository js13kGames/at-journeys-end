import { Primitive } from './primitives'
import { sourceOver, Config, XYZ } from './geometry'

export const inBoatCubes = [
	[0, 2, 0.01, 1.21, 1.21, 0.41, 5.5, 2 ],
	[0, -2, 0.01, 1.21, 1.21, 0.41, 5.5, 2 ],
	[0, 0, 0.01, 1.7, 4, 0.41, 0, 2 ],
	[0, 0.83, 0.01, 1.3, 0.42, 0.41, 0, 4 ],
	[0, -1.32, 0.01, 1.3, 0.42, 0.41, 0, 4 ]
]

export const outBoatCubes = inBoatCubes.map(a=>[a[1], a[0], a[2], a[4], a[3], a[5], a[6], a[7]])

function initText(c: Config) {
	sourceOver(c)
	c.lib.font = "18px Arial"
	c.lib.textAlign = "left"
}

function text(s: string, dy: number, elapsedSeconds: number, offset: number, c: Config) {
	const x = c.canvasLW.l / 4 - 75
	const y = c.canvasLW.w / 2 - 75

	c.lib.fillStyle = "rgba(200,200,200," + (elapsedSeconds < 10 ? elapsedSeconds - offset : 16 - elapsedSeconds) + ")"
	c.lib.fillText(s, x, y+dy)
}

function moveBoat(dx: number, dy: number, primitives: Primitive[]) {
	primitives.forEach(p=>{
		p.center.x += dx
		p.center.y += dy
	})
}

let playIntro = true
let playOutro = true
let elapsedSeconds = 0
let boatX: number
let boatY: number

export function initIntro(c: Config, boatPrimitives: Primitive[]) {
	boatX = 400
	boatY = 102.5
	moveBoat(boatX, boatY, boatPrimitives)
}

export function updateIntro(c: Config, boatPrimitives: Primitive[]) {
	if (playIntro) {

		// draw the text
		initText(c)
		text("At journey's end,", -40, elapsedSeconds, 2, c)
		text("A meager cost;", 0, elapsedSeconds, 3, c)
		text("A rite attend", 40, elapsedSeconds, 5, c)
		text("To guide the lost.", 80, elapsedSeconds, 6, c)

		// move the boat
		elapsedSeconds += 1/60
		const t = 10 - elapsedSeconds / 2.5
		const newY = Math.pow(t, 2) + t/4
		const dy = newY - boatY
		boatPrimitives.forEach(p=>p.center.y += dy)

		// move the player and light
		c.playerXY.x = boatX
		c.playerXY.y = newY - .5

		// move the camera
		c.cameraXYZ.y = newY + Math.pow(Math.max(Math.min(t - 2, 50), 0), 2)

		boatY = newY
		if (t <= 0) playIntro = false
	}
}

export function initOutro(c: Config, boatPrimitives: Primitive[]) {
	boatX = 332
	boatY = -490
	moveBoat(boatX, boatY, boatPrimitives)
}

export function updateOutro(c: Config, boatPrimitives: Primitive[]) {
	if (playOutro) {

		// draw the text
		initText(c)
		text("Look for me by moonlight;", -40, elapsedSeconds, 4, c)
		text("Watch for me by moonlight;", 0, elapsedSeconds, 6, c)
		text("I'll come to thee by moonlight,", 40, elapsedSeconds, 8, c)
		text("Though hell should bar the way.", 80, elapsedSeconds, 10, c)

		// move the boat
		elapsedSeconds += 1/60
		const t = elapsedSeconds / 2.5
		const newX = 332 - (Math.pow(t, 2) + t/4)
		const dx = newX - boatX
		boatPrimitives.forEach(p=>p.center.x += dx)

		// move the player and light
		c.playerXY.x = newX - .5
		c.playerXY.y = boatY

		// move the camera
		c.cameraXYZ.x = newX + Math.pow(Math.max(Math.min(t - 2, 50), 0), 2)

		boatX = newX
		if (t <= 0) playOutro = false
	}
}

export function hideBoat(primitives: Primitive[]) {
	moveBoat(999,0,primitives)
}
