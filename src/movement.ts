import { XY } from "./geometry"
import { Primitive } from "./primitives"

const deflections = [0]

// precalculate possible deflection angles
export function initMovement() {
	const increments = 3
	for (let i = 1; i < increments; i++) {
		const a = i * .5 * Math.PI / increments
		deflections.push(a)
		deflections.push(-a)
	}
}

function position(from: XY, angle: number, distance: number): XY {
	return XY(from.x + Math.cos(angle) * distance, from.y + Math.sin(angle) * distance)
}

export function moveWithDeflection(from: XY, angle: number, distance: number, pad: number, primitives: Primitive[]): XY {
	const xys = deflections.map(da=>position(from, angle + da, distance * Math.cos(da))) // slower at wider angles
	primitives.forEach(p=>{
		for (let i = xys.length - 1; i >= 0; i--) {
			if (p.contains(xys[i], pad)) xys.splice(i, 1)
		}
	})
	return xys.length ? xys[0] : from
}
