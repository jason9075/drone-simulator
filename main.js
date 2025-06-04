import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// --------------- 1. Three.js 場景、相機、渲染器 ---------------
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
)
camera.position.set(0, 3, 6)
camera.lookAt(0, 0, 0)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// 環境光與方向光
const ambient = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambient)
const dirLight = new THREE.DirectionalLight(0xffffff, 1)
dirLight.position.set(5, 10, 7.5)
scene.add(dirLight)

// 地板
const groundGeo = new THREE.PlaneGeometry(50, 50)
const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222 })
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

// --------------- 2. 載入無人機模型 ---------------
let droneGroup = new THREE.Group()
let propellers = []
const loader = new GLTFLoader()
loader.load(
  'assets/drone.glb',
  (gltf) => {
    droneGroup = gltf.scene
    // 假設你模型裡的螺旋槳節點名字包含 'propeller'
    droneGroup.traverse((child) => {
      if (child.name.toLowerCase().includes('propeller')) {
        propellers.push(child)
      }
    })
    scene.add(droneGroup)
    droneGroup.position.set(0, 1, 0)
  },
  undefined,
  (err) => {
    console.error('無人機載入失敗：', err)
  },
)

// --------------- 3. Gamepad API ---------------
let gpIndex = null
window.addEventListener('gamepadconnected', (e) => {
  gpIndex = e.gamepad.index
  document.getElementById('hud').innerText = 'Controller 已連接'
})
window.addEventListener('gamepaddisconnected', (e) => {
  if (gpIndex === e.gamepad.index) {
    gpIndex = null
    document.getElementById('hud').innerText = '請連接 PS4 Controller'
  }
})

function getInput() {
  const input = { throttle: 0, yaw: 0, pitch: 0, roll: 0 }
  if (gpIndex === null) return input
  const gp = navigator.getGamepads()[gpIndex]
  if (!gp) return input

  // 左搖桿 axes[0,1] → roll, pitch
  input.roll = gp.axes[0]
  input.pitch = gp.axes[1]

  // 右搖桿 axes[2,3] → yaw, throttle
  input.yaw = gp.axes[2]
  input.throttle = (-gp.axes[3] + 1) / 2

  return input
}

// --------------- 4. 飛行模擬（極簡物理） ---------------
let velocityY = 0
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const dt = clock.getDelta()

  // 讀取手把輸入
  const { throttle, yaw, pitch, roll } = getInput()

  // 1. 模擬簡易上下浮動
  if (droneGroup) {
    const lift = throttle * 20
    const gravity = -9.8
    velocityY += (lift + gravity) * dt * 0.1
    droneGroup.position.y += velocityY * dt
    if (droneGroup.position.y < 1) {
      droneGroup.position.y = 1
      velocityY = 0
    }

    // 2. 螺旋槳持續轉動
    propellers.forEach((p) => {
      p.rotateZ(throttle * 20 * dt)
    })

    // 3. 根據 pitch/roll 控制前後左右移動
    const forward = -pitch * dt * 2
    const right = roll * dt * 2
    droneGroup.translateZ(forward)
    droneGroup.translateX(right)

    // 4. 偏航控制（修改 yaw）
    droneGroup.rotation.y += yaw * dt * 1.5
    // 5. 若想做機身視覺傾斜，直接修改 rotation.x, rotation.z
    droneGroup.rotation.x = pitch * 0.3
    droneGroup.rotation.z = -roll * 0.3

    // 6. 更新 HUD
    const altText = droneGroup.position.y.toFixed(2)
    document.getElementById('hud').innerText = `油門：${(
      throttle * 100
    ).toFixed(0)}%   高度：${altText} m`
  }

  renderer.render(scene, camera)
}
animate()
