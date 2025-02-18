import * as THREE from 'three'

const loader = new THREE.TextureLoader
export const EmeraldTexture = loader.load(new URL("./emerald.png", import.meta.url).href)
export const RubyTexture = loader.load(new URL("./ruby.jpg", import.meta.url).href)
EmeraldTexture.wrapT = THREE.MirroredRepeatWrapping
EmeraldTexture.wrapS = THREE.MirroredRepeatWrapping

