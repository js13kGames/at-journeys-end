import { Primitive } from './primitives'
import { Config, XYZ } from './geometry'

export const boatCubes = [
	[0, 2, 0.01, 1.21, 1.21, 0.41, 5.5, 2 ],
	[0, -2, 0.01, 1.21, 1.21, 0.41, 5.5, 2 ],
	[0, 0, 0.01, 1.7, 4, 0.41, 0, 2 ],
	[0, 0.83, 0.01, 1.3, 0.42, 0.41, 0, 4 ],
	[0, -1.32, 0.01, 1.3, 0.42, 0.41, 0, 4 ],
]

let playIntro = true
let elapsedSeconds = 0
let oldY = 102.5
const boatX = 400

export function initIntro(c: Config, boatPrimitives: Primitive[]) {
	boatPrimitives.forEach(p=>{
		p.center.x += boatX
		p.center.y += oldY
	})
}

export function updateIntro(c: Config, boatPrimitives: Primitive[]) {
	if (playIntro) {
		const l = 150
		const w = 150
		const x = c.canvasLW.l / 4 - l / 2
		const y = c.canvasLW.w / 2 - w / 2

		// draw the text
		c.lib.globalCompositeOperation = "source-over"
		c.lib.font = "18px Arial"
		c.lib.textAlign = "left"
		c.lib.fillStyle = "rgba(200,200,200," + (elapsedSeconds < 10 ? elapsedSeconds - 2 : 16 - elapsedSeconds) + ")"
		c.lib.fillText("At journey's end,", x, y - 40)
		c.lib.fillStyle = "rgba(200,200,200," + (elapsedSeconds < 10 ? elapsedSeconds - 4 : 16 - elapsedSeconds) + ")"
		c.lib.fillText("A meager cost;", x, y)
		c.lib.fillStyle = "rgba(200,200,200," + (elapsedSeconds < 10 ? elapsedSeconds - 6 : 16 - elapsedSeconds) + ")"
		c.lib.fillText("A rite attend", x, y + 40)
		c.lib.fillStyle = "rgba(200,200,200," + (elapsedSeconds < 10 ? elapsedSeconds - 8 : 16 - elapsedSeconds) + ")"
		c.lib.fillText("To guide the lost.", x, y + 80)

		// move the boat
		elapsedSeconds += 1/60
		const t = 10 - elapsedSeconds / 2.5
		const boatY = Math.pow(t, 2) + t/4
		const dy = boatY - oldY
		boatPrimitives.forEach(p=>p.center.y += dy)

		// move the player and light
		c.playerXY.x = boatX
		c.playerXY.y = boatY

		// move the camera
		c.cameraXYZ.y = boatY + Math.pow(Math.max(Math.min(t - 2, 50), 0), 2)

		oldY = boatY
		if (t <= 0) playIntro = false
	}
}
