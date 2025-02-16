import gsap from 'gsap'
import * as THREE from 'three'

const IDLE_ROTATE_SPEED = 0.005
const DRAG_ROTATE_SPEED = 0.04
const SCALE = 0.4

/**
 * An object representing a 3d renderer for a grid of dice
 */
export class DiceGrid {
	private dices: DiceCrystal[] = []
	public scene: THREE.Scene
	public camera: THREE.OrthographicCamera
	private renderer: THREE.WebGLRenderer
	public canvas: HTMLCanvasElement

	constructor(canvas: HTMLCanvasElement, diceGrid: HTMLElement) {
		this.scene = new THREE.Scene()
		this.camera = new THREE.OrthographicCamera(0, 0, 0, 0)
		this.camera.position.z = 500
		this.canvas = canvas
		this.renderer = new THREE.WebGLRenderer(
			{ canvas: this.canvas, alpha: true, antialias: true }
		)

		new ResizeObserver(() => {
			const width = diceGrid.clientWidth
			const height = diceGrid.clientHeight
			this.renderer.setSize(width, height)
			this.camera.left = -width / 2
			this.camera.right = width / 2
			this.camera.top = height / 2
			this.camera.bottom = -height / 2
			this.camera.updateProjectionMatrix()

			// Update all dice when grid changes
			this.dices.forEach(dice => dice.updateTransform())
			this.renderLoop(true)
		}).observe(diceGrid)

		const ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
		this.scene.add(ambientLight)

		const directionalLight = new THREE.DirectionalLight(0xffffff)
		directionalLight.position.set(1, 1, 4)
		this.scene.add(directionalLight)

		this.renderLoop(false)
	}

	private renderLoop = (once: boolean) => {
		if (!once)
			requestAnimationFrame(() => this.renderLoop(false))
		this.renderer.render(this.scene, this.camera)
		this.dices.forEach(dice => dice.tick())
	}

	public addDice(parent: HTMLDivElement, geometry: THREE.BufferGeometry): DiceCrystal {
		const newDice = new DiceCrystal(this, parent, geometry)
		this.dices.push(newDice)
		return newDice
	}

	public static readonly DICES: Record<string, THREE.BufferGeometry> = {
		"d4": new THREE.TetrahedronGeometry(1.15),
		"d6": new THREE.BoxGeometry(1.35, 1.35, 1.35),
		"d8": new THREE.OctahedronGeometry(1),
		"d12": new THREE.DodecahedronGeometry(1),
		"d20": new THREE.IcosahedronGeometry(1),
	}
}

export class DiceCrystal {
	private parentGrid: DiceGrid
	private diceDiv: HTMLDivElement
	private state: DiceState = DiceStates.IdleState
	public isHovered = false
	public isDragged = false
	public mesh: THREE.Mesh
	public position = new THREE.Vector3
	private _position = new THREE.Vector3
	public scale = new THREE.Vector3
	private _scale = new THREE.Vector3

	public constructor(parentGrid: DiceGrid, diceDiv: HTMLDivElement, geometry: THREE.BufferGeometry) {
		this.parentGrid = parentGrid
		this.diceDiv = diceDiv
		this.mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(
			{ color: 0x00ffcc, transparent: true, opacity: 1.0 }
		))
		this.mesh.rotation.reorder("ZXY")
		this.parentGrid.scene.add(this.mesh)
		this.mesh.rotation.set(0.1, 0, 0.3)
		this.setState(DiceStates.IdleState)

		// Observe size & position changes for only this dice
		new MutationObserver(() => this.updateTransform())
			.observe(this.diceDiv, { attributes: true })

		// Initial position update
		this.updateTransform()
	}

	// Convert div position to accurate Three.js world coordinates
	public updateTransform() {
		const rect = this.diceDiv.getBoundingClientRect()
		const gridRect = this.parentGrid.canvas.getBoundingClientRect()

		// Convert div position to NDC (-1 to 1 range)
		const xNDC = ((rect.left + rect.width / 2) - gridRect.left) / gridRect.width * 2 - 1
		const yNDC = -(((rect.top + rect.height / 2) - gridRect.top) / gridRect.height * 2 - 1)

		// Convert to world space for the orthographic camera
		const worldPosition = new THREE.Vector3(xNDC, yNDC, 0)
		worldPosition.unproject(this.parentGrid.camera)

		// Scale the dice to match the div size
		const scaleFactor = (rect.width) * SCALE
		this._scale.set(scaleFactor, scaleFactor, scaleFactor)

		// Move the dice mesh to the corresponding world position
		this._position.set(worldPosition.x, worldPosition.y, this._position.z)
	}

	public tick() {
		this.state.update(this)
		this.mesh.scale.multiplyVectors(this._scale, this.scale)
		this.mesh.position.addVectors(this._position, this.position)
		// Prevent clipping by moving selected dice forward
		this._position.z = this.isHovered || this.isDragged ? 400 : 0
	}

	public setState(newState: DiceState) {
		this.state.exit(this)
		this.state = newState
		this.state.enter(this)
	}
}

interface DiceState {
	enter(dice: DiceCrystal): void;
	update(dice: DiceCrystal): void;
	exit(dice: DiceCrystal): void;
}

class IdleState implements DiceState {
	enter(dice: DiceCrystal): void {
		gsap.to(dice.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: "power2.out" })
	}
	update(dice: DiceCrystal): void {
		dice.mesh.rotation.y = (dice.mesh.rotation.y + IDLE_ROTATE_SPEED) % (Math.PI * 2)
		if (dice.isDragged) {
			dice.setState(DiceStates.DragState)
		} else if (dice.isHovered) {
			dice.setState(DiceStates.HoverState)
		}
	}
	exit(): void {
	}
}

class HoverState implements DiceState {
	enter(dice: DiceCrystal): void {
		gsap.to(dice.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.4, ease: "power2.out" })
	}
	update(dice: DiceCrystal): void {
		if (dice.isDragged) {
			dice.setState(DiceStates.DragState)
		} else if (!dice.isHovered) {
			dice.setState(DiceStates.IdleState)
		}
	}
	exit(dice: DiceCrystal): void {
		gsap.to(dice.position, { y: 0, duration: 0.2, ease: "power2.out" })
	}
}

class DragState implements DiceState {
	enter(dice: DiceCrystal): void {
		gsap.killTweensOf(dice.mesh.rotation)
		gsap.killTweensOf(dice.scale)
		gsap.to(dice.scale, { x: 0.9, y: 0.9, z: 0.9, duration: 0.2, ease: "power2.out" })
	}
	update(dice: DiceCrystal): void {
		dice.mesh.rotation.y = (dice.mesh.rotation.y + DRAG_ROTATE_SPEED) % (Math.PI * 2)
		if (!dice.isDragged) {
			dice.setState(DiceStates.IdleState)
		}
	}
	exit(dice: DiceCrystal): void {
		gsap.killTweensOf(dice.mesh.rotation)
		gsap.killTweensOf(dice.scale)
		gsap.to(dice.mesh.rotation, { y: "+=" + Math.PI * 2, duration: 0.8, ease: "power2.out" })
	}
}

class DiceStates {
	public static readonly IdleState = new IdleState()
	public static readonly HoverState = new HoverState()
	public static readonly DragState = new DragState()
}
