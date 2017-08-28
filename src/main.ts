import { AudioState, initSound, toggleSound, wind, knock } from './sound';
//	The projection is Orthographic; all rays are perpendicular to the view plane.
//	World Coordinates (W) are meters in page coordinates (to match canvas):
//	- top left is (0,0) and bottom right is (MaxX, MaxY),
//	- angles are measured clockwise: 0=>right, PI/2=>down, PI=>left, 3PI/2=>up.
// The canvas is a camera of size (CW, CH) in pixels that:
//	- always looks straight down at a point in W (CX, CY),
//	- is rotated by CA in radians,
//	- views an area of diameter CD.

interface Point {
	x: number
	y: number
}
const Point = (x: number, y: number) => ({ x: x, y: y })

interface Size {
	w: number
	h: number
}
const Size = (w: number, h: number) => ({ w: w, h: h })

interface Tree {
	center: Point
	radius: number
}
const Tree = (center: Point, radius: number) => ({ center: center, radius: radius })

// map world coordinates onto canvas
interface Transform {
	point: (wp: Point) => Point
	distance: (d: number) => number
}

function getTransform(player: Point, wViewRadius: number, angle: number, canvasSize: Size): Transform {

	// precalculate canvas center, canvas radius, and scale
	const cx = canvasSize.w / 2
	const cy = canvasSize.h / 2
	const cr = Math.sqrt(cx * cx + cy * cy)
	const scale = cr / wViewRadius

	return {
		point: (p: Point) => {
			const dx = p.x - player.x
			const dy = p.y - player.y
			const a = Math.atan2(dy, dx) - angle
			const d = Math.sqrt(dx * dx + dy * dy) * scale
			return Point(cx + d * Math.cos(a), cy + d * Math.sin(a))
		},
		distance: (d: number) => d * scale
	}
}

function main() {
	const body = document.body.style
	body.margin = "0px"
	body.overflow = "hidden"

	const canvas = <HTMLCanvasElement>document.createElement("canvas");
	document.body.appendChild(canvas);
	const c = canvas.getContext('2d')

	// canvas dimensions
	let canvasSize: Size
	let canvasCenter: Point

	// view dimensions
	let worldViewRadius = 50

	let t = 0;

	let audioState = initSound();
	wind(audioState);

	// player position and rotation
	const upAngle = 3 * Math.PI / 2
	let direction = upAngle
	let playerXY = Point(100, 100)

	function resize() {
		setTimeout(() => {
			canvasSize = Size(window.innerWidth, window.innerHeight)
			canvas.style.width = canvasSize.w + "px"
			canvas.style.height = canvasSize.h + "px"
			canvas.width = canvasSize.w
			canvas.height = canvasSize.h
			canvasCenter = Point(Math.round(canvasSize.w / 2), Math.round(canvasSize.h / 2))
			draw()
		}, 10)
	}

	function action(key: Number) {
		switch (key) {
			case 65: direction -= 0.1; break;	// A left
			case 68: direction += 0.1; break;	// D right
			case 87: playerXY = move(playerXY, direction, 1); break;	// W up
			case 83: playerXY = move(playerXY, direction + Math.PI, 1); break;	// S down
			case 73: worldViewRadius--; break;	// I zoom in
			case 75: worldViewRadius++; break;	// I // zoom out
			case 78: knock(audioState); break;      // n 'knock'
			case 81: toggleSound(audioState); break; // toggle the sound on/off
			default: console.log(key)
		}
	}

	function move(from: Point, direction: number, distance: number): Point {
		return Point(from.x + Math.cos(direction) * distance, from.y + Math.sin(direction) * distance)
	}

	window.addEventListener("resize", resize)
	window.addEventListener("keydown", e => action(e.keyCode))
	resize()

	const trees = [Tree(Point(110, 120), 0.5)]

	function draw() {
		t += 0.1;

		// clear the canvas
		c.fillStyle = "rgba(0,0,0,1)"
		c.fillRect(0, 0, canvasSize.w, canvasSize.h);

		// draw the light
		const lr = 800;
		const g = c.createRadialGradient(canvasCenter.x, canvasCenter.y, 0, canvasCenter.x, canvasCenter.y, lr);

		const baseIntensity = 1, flickerAmount = 0.1;
		const intensity = baseIntensity + flickerAmount * (0.578 - (Math.sin(t) + Math.sin(2.2 * t + 5.52) + Math.sin(2.9 * t + 0.93) + Math.sin(4.6 * t + 8.94))) / 4;

		const steps = 32; // number of gradient steps
		const lightScale = 15; // controls how quickly the light falls off
		for (var i = 1; i < steps + 1; i++) {
			let x = lightScale * Math.pow(i / steps, 2) + 1;
			let alpha = intensity / (x * x);
			g.addColorStop((x - 1) / lightScale, `rgba(255,255,255,${alpha})`);
		}

		c.fillStyle = g
		c.fillRect(canvasCenter.x - lr, canvasCenter.y - lr, lr * 2, lr * 2)

		// draw the center
		c.strokeStyle = "blue"
		c.strokeRect(canvasCenter.x - 5, canvasCenter.y - 5, 10, 10)

		const transform = getTransform(playerXY, worldViewRadius, direction - upAngle, canvasSize)
		trees.forEach(tree => {
			const vCenter = transform.point(tree.center)
			const vRadius = transform.distance(tree.radius)
			c.beginPath()
			c.fillStyle = "green"
			c.arc(vCenter.x, vCenter.y, vRadius, 0, Math.PI * 2)
			c.fill()
		})

		// refactor the game loop
		window.requestAnimationFrame(draw)
	}
}

main()
