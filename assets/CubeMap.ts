import * as THREE from 'three'

let cubeTexture: THREE.CubeTexture | null = null

export default function LoadCubemap(): THREE.CubeTexture {
	if (cubeTexture) return cubeTexture

	const loader = new THREE.CubeTextureLoader()

	const negx = new URL("./negx.jpg", import.meta.url)
	const negy = new URL("./negy.jpg", import.meta.url)
	const negz = new URL("./negz.jpg", import.meta.url)
	const posx = new URL("./posx.jpg", import.meta.url)
	const posy = new URL("./posy.jpg", import.meta.url)
	const posz = new URL("./posz.jpg", import.meta.url)

	const texture = loader.load([
		posx.href, negx.href,
		posy.href, negy.href,
		posz.href, negz.href,
	])

	texture.mapping = THREE.CubeRefractionMapping

	cubeTexture = texture
	return cubeTexture
}
