// ===== IMPORTACIONES =====
// Importa la librería principal de Three.js
import * as THREE from "three";
// OrbitControls: permite rotar la cámara alrededor de un punto con el ratón
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
// FlyControls: permite volar libremente por la escena (como un simulador de vuelo)
import { FlyControls } from "three/examples/jsm/controls/FlyControls";
// GUI: librería para crear interfaces de usuario (paneles de control)
import GUI from 'lil-gui';

// ===== VARIABLES GLOBALES =====
let scene;        // Contenedor principal donde se añaden todos los objetos 3D
let renderer;     // Motor de renderizado que dibuja la escena en el canvas
let camera;       // Cámara virtual desde donde se observa la escena
let estrella;     // Referencia al Sol
let Planetas = []; // Array que almacena todos los planetas
let Lunas = [];    // Array que almacena todas las lunas
let Anillos = [];  // Array que almacena los anillos (Saturno, Urano)
let Cometas = [];  // Array que almacena los cometas creados por el usuario
let t0 = 0;        // Tiempo inicial (timestamp) para calcular animaciones
let accglobal = 0.0003; // Aceleración global que controla la velocidad de las órbitas
let timestamp;     // Tiempo transcurrido usado en el loop de animación
let controls;      // Referencia a los controles de cámara actuales
let selectedPlanet = null; // Planeta/objeto seleccionado por el usuario (para seguimiento)
let raycaster;     // Raycaster: herramienta para detectar intersecciones con objetos 3D
let mouse;         // Vector2 que almacena las coordenadas normalizadas del ratón (-1 a 1)
let clock;         // Clock: objeto que mide el tiempo transcurrido (usado por FlyControls)
let gui;           // Instancia del panel GUI

// TextureLoader: herramienta para cargar imágenes como texturas
// Las texturas son imágenes 2D que se aplican a la superficie de objetos 3D
const textureLoader = new THREE.TextureLoader();

// ===== DATOS REALES DE LOS PLANETAS =====
// Objeto que contiene información astronómica real para mostrar en la GUI
const planetData = {
  'Sol': { realDistance: 'Centro del Sistema Solar', realRadius: '696,340 km', orbitalPeriod: '—' },
  'Mercurio': { realDistance: '57.9M km', realRadius: '2,439 km', orbitalPeriod: '88 días' },
  'Venus': { realDistance: '108.2M km', realRadius: '6,051 km', orbitalPeriod: '225 días' },
  'Tierra': { realDistance: '149.6M km', realRadius: '6,371 km', orbitalPeriod: '365 días' },
  'Marte': { realDistance: '227.9M km', realRadius: '3,389 km', orbitalPeriod: '687 días' },
  'Júpiter': { realDistance: '778.5M km', realRadius: '69,911 km', orbitalPeriod: '12 años' },
  'Saturno': { realDistance: '1,434M km', realRadius: '58,232 km', orbitalPeriod: '29 años' },
  'Urano': { realDistance: '2,871M km', realRadius: '25,362 km', orbitalPeriod: '84 años' },
  'Neptuno': { realDistance: '4,495M km', realRadius: '24,622 km', orbitalPeriod: '165 años' }
};

// ===== PARÁMETROS DE LA GUI =====
// Objeto que contiene los valores mostrados en el panel de control
const params = {
  controlMode: 'orbit',    // Modo de control de cámara: 'orbit' o 'fly'
  resetView: () => resetView(), // Función para resetear la vista
  // Campos de información que se actualizan al seleccionar un objeto:
  planetName: '',          // Nombre del cuerpo celeste
  realDistance: '',        // Distancia real al Sol
  realRadius: '',          // Radio real del objeto
  orbitalPeriod: '',       // Período orbital real
  threeRadius: '',         // Radio en unidades de Three.js
  threeDistance: '',       // Distancia en unidades de Three.js
  threeSpeed: ''           // Velocidad de órbita en la simulación
};

// ===== INICIALIZACIÓN Y LOOP PRINCIPAL =====
init();           // Configura la escena, cámara, objetos, etc.
animationLoop();  // Inicia el bucle de animación

// ===== FUNCIÓN DE INICIALIZACIÓN =====
function init() {
  // ----- CREACIÓN DE PANEL DE INFORMACIÓN EN HTML -----
  // Crea un div HTML que se superpone sobre el canvas 3D
  const info = document.createElement("div");
  info.style.position = "absolute";  // Posición absoluta para que flote sobre el canvas
  info.style.top = "30px";
  info.style.left = "30px";
  info.style.color = "#fff";
  info.style.fontWeight = "bold";
  info.style.backgroundColor = "rgba(0, 0, 0, 0.5)"; // Fondo semi-transparente
  info.style.zIndex = "1";  // z-index alto para estar por encima del canvas
  info.style.fontFamily = "Monospace";
  info.style.padding = "15px";
  info.style.borderRadius = "5px";
  info.style.fontSize = "14px";
  info.innerHTML = `
    <div style="margin-bottom: 10px; font-size: 16px;">three.js - Sistema Solar</div>
    <div style="font-weight: normal; font-size: 12px; line-height: 1.6;">
      🖱️ Click: Seleccionar planeta, anillo o luna<br/>
      🖱️ Doble click: Crear cometa<br/>
      ⌨️ ESC: Resetear vista
    </div>
  `;
  document.body.appendChild(info);

  // ----- CONFIGURACIÓN DE LA GUI (Panel de Control) -----
  gui = new GUI();
  gui.title('Controles');
  
  // Carpeta de controles de cámara
  const controlFolder = gui.addFolder('Cámara');
  // add(): añade un control a la GUI
  // Parámetros: (objeto, 'propiedad', [opciones])
  controlFolder.add(params, 'controlMode', ['orbit', 'fly'])
    .name('Modo de Control')  // Nombre visible en la GUI
    .onChange((value) => {     // Callback que se ejecuta cuando cambia el valor
      if (!selectedPlanet) {   // Solo cambia controles si no hay planeta seleccionado
        setupControls(value);
      }
    });
  
  controlFolder.add(params, 'resetView').name('Volver a Vista Normal');
  controlFolder.open(); // Abre la carpeta por defecto

  // Carpeta de información del cuerpo celeste
  const infoFolder = gui.addFolder('Información del Cuerpo Celeste');
  // disable(): hace que el campo sea de solo lectura
  // listen(): actualiza automáticamente el valor mostrado cuando cambia params
  infoFolder.add(params, 'planetName').name('Nombre').disable().listen();
  
  const realFolder = infoFolder.addFolder('Datos Reales');
  realFolder.add(params, 'realDistance').name('Distancia al Sol').disable().listen();
  realFolder.add(params, 'realRadius').name('Radio').disable().listen();
  realFolder.add(params, 'orbitalPeriod').name('Período Orbital').disable().listen();
  
  const threeFolder = infoFolder.addFolder('Datos Three.js');
  threeFolder.add(params, 'threeRadius').name('Radio').disable().listen();
  threeFolder.add(params, 'threeDistance').name('Distancia').disable().listen();
  threeFolder.add(params, 'threeSpeed').name('Velocidad').disable().listen();

  // ----- CREACIÓN DE LA ESCENA -----
  // Scene: contenedor principal donde se añaden todos los objetos 3D
  scene = new THREE.Scene();
  
  // Raycaster: lanza un rayo desde la cámara para detectar objetos 3D
  // Se usa para detectar clics sobre planetas
  raycaster = new THREE.Raycaster();
  
  // Vector2: vector de 2 dimensiones (x, y)
  // Se usa para almacenar coordenadas normalizadas del ratón
  mouse = new THREE.Vector2();
  
  // Clock: mide el tiempo transcurrido, útil para animaciones
  clock = new THREE.Clock();

  // ----- CREACIÓN DE LA CÁMARA -----
  // PerspectiveCamera: cámara con perspectiva (objetos lejanos se ven más pequeños)
  // Parámetros: (fov, aspect, near, far)
  // - fov: campo de visión vertical en grados (75° es estándar)
  // - aspect: relación de aspecto (ancho/alto de la ventana)
  // - near: plano cercano (objetos más cerca no se renderizan)
  // - far: plano lejano (objetos más lejos no se renderizan)
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    3000
  );
  // position.set(): establece la posición inicial de la cámara (x, y, z)
  camera.position.set(0, 50, 200);

  // ----- CREACIÓN DEL RENDERER -----
  // WebGLRenderer: motor que dibuja la escena usando WebGL
  // antialias: true suaviza los bordes de los objetos
  renderer = new THREE.WebGLRenderer({ antialias: true });
  // setSize(): establece el tamaño del canvas de renderizado
  renderer.setSize(window.innerWidth, window.innerHeight);
  // setPixelRatio(): ajusta la densidad de píxeles para pantallas retina
  renderer.setPixelRatio(window.devicePixelRatio);
  // Añade el canvas del renderer al DOM
  document.body.appendChild(renderer.domElement);

  // Configura los controles iniciales en modo órbita
  setupControls('orbit');

  // ----- CREACIÓN DEL FONDO (GALAXIA) -----
  // Carga una textura de estrellas
  const galaxyTexture = textureLoader.load("src/textures/stars2.jpg");
  // SphereGeometry: geometría de una esfera
  // Parámetros: (radius, widthSegments, heightSegments)
  // - widthSegments/heightSegments: mayor número = esfera más suave
  const galaxyGeometry = new THREE.SphereGeometry(1000, 64, 64);
  // MeshBasicMaterial: material que no se ve afectado por luces
  // BackSide: renderiza el interior de la esfera (estamos dentro)
  const galaxyMaterial = new THREE.MeshBasicMaterial({
    map: galaxyTexture,
    side: THREE.BackSide
  });
  // Mesh: combinación de geometría + material = objeto 3D visible
  const galaxy = new THREE.Mesh(galaxyGeometry, galaxyMaterial);
  scene.add(galaxy); // Añade la galaxia a la escena

  // ----- ILUMINACIÓN -----
  // AmbientLight: luz ambiental que ilumina todos los objetos uniformemente
  // Parámetros: (color, intensidad)
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  
  // PointLight: luz puntual que emite desde un punto en todas direcciones
  // Parámetros: (color, intensidad, distancia)
  // - distancia: hasta dónde llega la luz (0 = infinito)
  const sunLight = new THREE.PointLight(0xffffff, 2, 3000);
  sunLight.position.set(0, 0, 0); // Posiciona la luz en el centro (Sol)
  scene.add(sunLight);

  // ----- CREACIÓN DEL SOL -----
  Estrella(10, "src/textures/sun.jpg");

  // ----- CREACIÓN DE LOS PLANETAS -----
  // Parámetros: (radio, distancia, velocidad, textura, f1, f2, nombre)
  // f1 y f2 son factores para crear órbitas elípticas
  Planeta(0.4, 30.0, 4.15, "src/textures/mercury.jpg", 1.0, 0.85, 'Mercurio');
  Planeta(0.9, 50.0, 1.62, "src/textures/venus.jpg", 1.0, 0.9, 'Venus');
  // Guarda referencia a la Tierra para añadirle la Luna después
  let tierra = Planeta(1.0, 70.0, 1.0, "src/textures/earth.jpg", 1.0, 0.88, 'Tierra');
  Planeta(0.5, 90.0, 0.53, "src/textures/mars.jpg", 1.0, 0.83, 'Marte');
  Planeta(2.5, 130.0, 0.084, "src/textures/jupiter.jpg", 1.0, 0.87, 'Júpiter');
  
  // Saturno con anillos
  let saturno = Planeta(2.1, 170.0, 0.034, "src/textures/saturn.jpg", 1.0, 0.82, 'Saturno');
  crearAnillos(saturno, 2.1 * 4, 1.2, 2.0, "src/textures/saturn_ring.jpg");
  
  // Urano con anillos
  let urano = Planeta(1.8, 210.0, 0.0119, "src/textures/uranus.jpg", 1.0, 0.8, 'Urano');
  crearAnillos(urano, 1.8 * 4, 1.5, 2.2, "src/textures/uranus_ring.jpg");
  
  Planeta(1.7, 250.0, 0.006, "src/textures/neptune.jpg", 1.0, 0.78, 'Neptuno');
  
  // Crea la Luna orbitando la Tierra
  // Parámetros: (planeta, radio, distancia, velocidad, textura, ángulo)
  Luna(tierra, 0.27, 7.0, 9.0, "src/textures/moon.jpg", 0);

  // Guarda el tiempo inicial para calcular el tiempo transcurrido
  t0 = Date.now();

  // ----- REGISTRO DE EVENTOS -----
  // Detecta cuando se redimensiona la ventana
  window.addEventListener("resize", onWindowResize);
  // Detecta clics del ratón sobre el canvas
  renderer.domElement.addEventListener("click", onMouseClick);
  // Detecta doble clic para crear cometas
  window.addEventListener("dblclick", onDoubleClick);
  // Detecta cuando se presiona una tecla (ESC para resetear)
  window.addEventListener("keydown", onKeyDown);
}

// ===== CONFIGURACIÓN DE CONTROLES DE CÁMARA =====
// Cambia entre OrbitControls y FlyControls
function setupControls(mode) {
  // Si ya existen controles, elimínalos para evitar conflictos
  if (controls) controls.dispose();

  if (mode === 'orbit') {
    // OrbitControls: permite rotar alrededor de un punto objetivo
    // Parámetros: (camera, domElement)
    controls = new OrbitControls(camera, renderer.domElement);
    // enableDamping: añade inercia a los movimientos (más suave)
    controls.enableDamping = true;
    // dampingFactor: cuánta inercia (0-1, menor = más inercia)
    controls.dampingFactor = 0.05;
    // minDistance/maxDistance: límites de zoom
    controls.minDistance = 30;
    controls.maxDistance = 800;
  } else if (mode === 'fly') {
    // FlyControls: permite volar libremente por la escena
    controls = new FlyControls(camera, renderer.domElement);
    // movementSpeed: velocidad de movimiento
    controls.movementSpeed = 50;
    // rollSpeed: velocidad de rotación (en radianes/segundo)
    controls.rollSpeed = Math.PI / 6;
    // autoForward: si true, avanza automáticamente
    controls.autoForward = false;
    // dragToLook: si true, hay que arrastrar para mirar alrededor
    controls.dragToLook = true;
  }
}

// ===== FUNCIÓN PARA CREAR EL SOL =====
// Parámetros: radio base y ruta de la textura
function Estrella(rad, texturePath) {
  // Crea geometría esférica (el radio se multiplica por 2)
  const geometry = new THREE.SphereGeometry(rad * 2, 64, 64);
  const texture = textureLoader.load(texturePath);
  
  // MeshBasicMaterial: no afectado por luces (el Sol emite su propia luz)
  // emissive: color que el objeto emite (amarillo brillante)
  // emissiveIntensity: intensidad de la emisión
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    emissive: 0xffff00,
    emissiveIntensity: 2.2
  });
  
  estrella = new THREE.Mesh(geometry, material);
  // userData: objeto para guardar datos personalizados del objeto
  estrella.userData = { 
    name: 'Sol', 
    radius: rad * 2, 
    dist: 0,      // Distancia al centro (0 porque ES el centro)
    speed: 0      // Velocidad orbital (0 porque no orbita)
  };
  scene.add(estrella);
}

// ===== FUNCIÓN PARA CREAR UN PLANETA =====
// Parámetros:
// - radio: radio base del planeta
// - dist: distancia al Sol
// - vel: velocidad de traslación (órbita)
// - texturePath: ruta de la textura
// - f1, f2: factores para crear órbitas elípticas
// - name: nombre del planeta
function Planeta(radio, dist, vel, texturePath, f1, f2, name) {
  // Crea la geometría esférica (radio * 4 para escalar visualmente)
  const geom = new THREE.SphereGeometry(radio * 4, 32, 32);
  const texture = textureLoader.load(texturePath);
  
  // MeshStandardMaterial: material que SÍ responde a luces
  // roughness: rugosidad (1 = muy mate, 0 = muy brillante)
  // metalness: metalicidad (1 = muy metálico, 0 = no metálico)
  const mat = new THREE.MeshStandardMaterial({
    map: texture, 
    roughness: 1, 
    metalness: 0, 
    emissive: 0x111111,        // Un poco de brillo propio
    emissiveIntensity: 0.4
  });

  const planeta = new THREE.Mesh(geom, mat);
  // Guarda datos del planeta en userData
  planeta.userData = { 
    dist,                                    // Distancia orbital
    speed: vel,                              // Velocidad de traslación
    f1,                                      // Factor horizontal de la elipse
    f2,                                      // Factor vertical de la elipse
    name,                                    // Nombre
    radius: radio * 4,                       // Radio visual
    initialAngle: Math.random() * Math.PI * 2 // Ángulo inicial aleatorio
  };
  Planetas.push(planeta); // Añade al array de planetas
  scene.add(planeta);

  // ----- CREACIÓN DE LA ÓRBITA VISUAL -----
  // EllipseCurve: crea una curva elíptica 2D
  // Parámetros: (xCenter, yCenter, xRadius, yRadius, startAngle, endAngle, clockwise)
  const curve = new THREE.EllipseCurve(0, 0, dist * f1, dist * f2);
  // getPoints(): obtiene puntos a lo largo de la curva
  const points = curve.getPoints(200); // 200 puntos = curva suave
  
  // BufferGeometry: geometría optimizada de bajo nivel
  // setFromPoints(): crea geometría a partir de un array de puntos
  const geome = new THREE.BufferGeometry().setFromPoints(points);
  
  // LineBasicMaterial: material para líneas
  const mate = new THREE.LineBasicMaterial({ 
    color: 0x3399ff,      // Color azul
    opacity: 0.35,        // Semi-transparente
    transparent: true 
  });
  
  // Line: objeto 3D que dibuja una línea
  const orbita = new THREE.Line(geome, mate);
  // Rota la órbita para que esté horizontal
  orbita.rotation.x = Math.PI / 2;
  scene.add(orbita);
  
  return planeta; // Retorna el planeta (útil para añadirle lunas o anillos)
}

// ===== FUNCIÓN PARA CREAR ANILLOS =====
// Parámetros:
// - planeta: mesh del planeta al que añadir anillos
// - radioInterior: radio base para los anillos
// - escalaInterna: escala del radio interior
// - escalaExterna: escala del radio exterior
// - texturePath: textura de los anillos
function crearAnillos(planeta, radioInterior, escalaInterna, escalaExterna, texturePath) {
  // RingGeometry: geometría de anillo (círculo con agujero)
  // Parámetros: (innerRadius, outerRadius, thetaSegments)
  const ringGeometry = new THREE.RingGeometry(
    radioInterior * escalaInterna,  // Radio interior
    radioInterior * escalaExterna,  // Radio exterior
    64                               // Número de segmentos (suavidad)
  );
  
  // ----- CORRECCIÓN DE UVs PARA TEXTURA -----
  // Los UVs son coordenadas 2D que mapean la textura sobre la geometría
  const pos = ringGeometry.attributes.position;
  const uv = [];
  
  // Recalcula UVs manualmente para que la textura se mapee correctamente
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    // Calcula la distancia desde el centro
    const len = Math.sqrt(x * x + y * y);
    const innerRadius = radioInterior * escalaInterna;
    const outerRadius = radioInterior * escalaExterna;
    // Normaliza la distancia entre 0 (interior) y 1 (exterior)
    const u = (len - innerRadius) / (outerRadius - innerRadius);
    uv.push(u, 0.5);
  }
  
  // Float32BufferAttribute: atributo de geometría con valores float32
  // Parámetros: (array, itemSize)
  ringGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  
  const texture = textureLoader.load(texturePath);
  const ringMaterial = new THREE.MeshBasicMaterial({ 
    map: texture, 
    side: THREE.DoubleSide, // Renderiza ambos lados del anillo
    transparent: true, 
    opacity: 0.8 
  });
  
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2; // Rota para que sea horizontal
  
  // add(): añade el anillo como hijo del planeta
  // Los hijos heredan transformaciones del padre (posición, rotación)
  planeta.add(ring);
  
  ring.userData = { 
    name: `Anillos de ${planeta.userData.name}`, 
    type: 'anillo',  // Tipo para identificar en clics
    parent: planeta  // Referencia al planeta padre
  };
  Anillos.push(ring);
}

// ===== FUNCIÓN PARA CREAR UNA LUNA =====
// Parámetros:
// - planeta: planeta al que orbita
// - radio: radio de la luna
// - dist: distancia al planeta
// - vel: velocidad orbital
// - texturePath: textura
// - angle: ángulo de inclinación de la órbita
function Luna(planeta, radio, dist, vel, texturePath, angle) {
  // Object3D: objeto 3D vacío que se usa como pivote/contenedor
  // Sirve para que la luna orbite alrededor del planeta
  const pivote = new THREE.Object3D();
  pivote.rotation.x = angle; // Inclina el plano orbital
  planeta.add(pivote);       // El pivote es hijo del planeta
  
  const geom = new THREE.SphereGeometry(radio * 3, 16, 16);
  const texture = textureLoader.load(texturePath);
  const mat = new THREE.MeshStandardMaterial({ 
    map: texture, 
    roughness: 1, 
    metalness: 0 
  });
  
  const luna = new THREE.Mesh(geom, mat);
  luna.userData = { 
    dist, 
    speed: vel, 
    name: `Luna de ${planeta.userData.name}`, 
    type: 'luna' 
  };
  Lunas.push(luna);
  pivote.add(luna); // La luna es hija del pivote
}

// ===== MANEJO DE CLICS DEL RATÓN =====
function onMouseClick(event) {
  // Normaliza las coordenadas del ratón a rango -1 a 1
  // clientX/Y: coordenadas del ratón en píxeles
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // setFromCamera(): configura el raycaster para lanzar un rayo desde la cámara
  // hacia la posición del ratón
  raycaster.setFromCamera(mouse, camera);
  
  // intersectObjects(): detecta intersecciones del rayo con objetos
  // Parámetros: (array de objetos, recursive)
  // - recursive: si true, también comprueba hijos de los objetos
  const intersects = raycaster.intersectObjects([...Planetas, ...Lunas, ...Anillos, estrella], true);
  
  // Si el rayo intersecta con algún objeto
  if (intersects.length > 0) {
    selectedPlanet = intersects[0].object; // Guarda el objeto más cercano
    showPlanetInfo(selectedPlanet);        // Muestra su información
  }
}

// ===== MOSTRAR INFORMACIÓN DE UN PLANETA =====
function showPlanetInfo(planet) {
  const name = planet.userData.name;
  
  // Si es una luna, usa datos específicos
  if (planet.userData.type === 'luna') {
    params.planetName = name;
    params.realDistance = '≈384,400 km (desde la Tierra)';
    params.realRadius = '1,737 km';
    params.orbitalPeriod = '27.3 días';
    params.threeRadius = planet.geometry.parameters.radius.toFixed(2) + ' unidades';
    params.threeDistance = planet.userData.dist.toFixed(1) + ' unidades';
    params.threeSpeed = planet.userData.speed.toFixed(4);
    return;
  }
  
  // Si es un anillo, muestra información limitada
  if (planet.userData.type === 'anillo') {
    params.planetName = name;
    params.realDistance = 'Sistema de anillos del planeta';
    params.realRadius = 'Variable';
    params.orbitalPeriod = '—';
    params.threeRadius = '—';
    params.threeDistance = '—';
    params.threeSpeed = '—';
    return;
  }
  
  // Para planetas y el Sol, usa los datos del objeto planetData
  const data = planetData[planet.userData.name];
  if (!data) return;
  
  params.planetName = planet.userData.name;
  params.realDistance = data.realDistance;
  params.realRadius = data.realRadius;
  params.orbitalPeriod = data.orbitalPeriod;
  params.threeRadius = planet.userData.radius.toFixed(2) + ' unidades';
  params.threeDistance = planet.userData.dist.toFixed(1) + ' unidades';
  params.threeSpeed = planet.userData.speed.toFixed(4);
}

// ===== RESETEAR VISTA =====
// Vuelve a la vista normal y limpia la información mostrada
function resetView() {
  selectedPlanet = null; // Desselecciona el planeta
  // Limpia todos los campos de información
  params.planetName = '';
  params.realDistance = '';
  params.realRadius = '';
  params.orbitalPeriod = '';
  params.threeRadius = '';
  params.threeDistance = '';
  params.threeSpeed = '';
  // Restaura los controles según el modo seleccionado
  setupControls(params.controlMode);
}

// ===== BUCLE DE ANIMACIÓN =====
// Esta función se ejecuta en cada frame (≈60 veces por segundo)
function animationLoop() {
  // Calcula el tiempo transcurrido desde el inicio
  timestamp = (Date.now() - t0) * accglobal;
  
  // requestAnimationFrame(): solicita al navegador ejecutar esta función
  // en el próximo frame (crea el bucle infinito de animación)
  requestAnimationFrame(animationLoop);

  // ----- ACTUALIZACIÓN DE PLANETAS -----
  for (let o of Planetas) {
    // Calcula el ángulo actual basado en tiempo y velocidad
    // Se suma initialAngle para que cada planeta comience en posición aleatoria
    const angle = timestamp * o.userData.speed + o.userData.initialAngle;
    
    // Calcula posición en órbita elíptica usando funciones trigonométricas
    // Math.cos() y Math.sin() crean movimiento circular
    // f1 y f2 convierten el círculo en elipse
    o.position.x = Math.cos(angle) * o.userData.f1 * o.userData.dist;
    o.position.z = Math.sin(angle) * o.userData.f2 * o.userData.dist;
    
    // Rotación sobre su propio eje (movimiento de rotación)
    o.rotation.y += 0.01;
  }

  // ----- ACTUALIZACIÓN DE LUNAS -----
  for (let o of Lunas) {
    // Las lunas orbitan su planeta (posición relativa al padre)
    o.position.x = Math.cos(timestamp * o.userData.speed) * o.userData.dist;
    o.position.z = Math.sin(timestamp * o.userData.speed) * o.userData.dist;
    o.rotation.y += 0.02; // Rotación propia
  }

  // ----- ROTACIÓN DEL SOL -----
  if (estrella) estrella.rotation.y += 0.002;

  // ===== ACTUALIZACIÓN DE COMETAS =====
  // Recorre el array de atrás hacia adelante para poder eliminar elementos
  for (let i = Cometas.length - 1; i >= 0; i--) {
    const cometa = Cometas[i];
    
    // Si el cometa tiene velocidad, actualiza su posición
    if (cometa.userData.velocity) {
      // add(): suma un vector a la posición actual
      cometa.position.add(cometa.userData.velocity);
    }

    // ----- MANEJO DE TIEMPO DE VIDA -----
    // Incrementa el contador de frames vividos
    cometa.userData.lifetime = (cometa.userData.lifetime || 0) + 1;
    if (!cometa.userData.maxLifetime) cometa.userData.maxLifetime = 1000;
    
    // length(): calcula la distancia desde el origen (0,0,0)
    const distFromCenter = cometa.position.length();
    
    // Si el cometa ha vivido demasiado o está muy lejos, elimínalo
    if (cometa.userData.lifetime > cometa.userData.maxLifetime || distFromCenter > 2000) {
      // Elimina el cometa de la escena
      scene.remove(cometa);
      // splice(): elimina elementos de un array
      // Parámetros: (índice, cantidad)
      Cometas.splice(i, 1);
      continue; // Salta al siguiente cometa
    }

    // ----- ACTUALIZACIÓN DE LA COLA DEL COMETA -----
    if (cometa.userData.tail) {
      // unshift(): añade un elemento al inicio del array
      // clone(): crea una copia del vector (importante para no modificar el original)
      cometa.userData.tailPositions.unshift(cometa.position.clone());
      
      // Limita el largo de la cola
      if (cometa.userData.tailPositions.length > (cometa.userData.tailMax || 50)) {
        cometa.userData.tailPositions.pop(); // Elimina el último elemento
      }

      // Convierte el array de vectores a un array plano de números
      const tailPosArray = [];
      for (let j = 0; j < cometa.userData.tailPositions.length; j++) {
        const p = cometa.userData.tailPositions[j];
        tailPosArray.push(p.x, p.y, p.z);
      }
      
      // Rellena con la última posición si hace falta (mantiene tamaño fijo)
      const requiredLen = (cometa.userData.tailMax || 50) * 3;
      while (tailPosArray.length < requiredLen) {
        const last = cometa.userData.tailPositions[cometa.userData.tailPositions.length - 1] || cometa.position;
        tailPosArray.push(last.x, last.y, last.z);
      }
      
      // Actualiza la geometría de la cola con las nuevas posiciones
      cometa.userData.tail.geometry.setAttribute('position', new THREE.Float32BufferAttribute(tailPosArray, 3));
      // needsUpdate: marca el atributo como modificado para que se re-renderice
      cometa.userData.tail.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ----- ACTUALIZACIÓN DE CÁMARA -----
  if (selectedPlanet) {
    // Si hay un planeta seleccionado, la cámara lo sigue
    
    // Vector3: vector de 3 dimensiones (x, y, z)
    const planetPos = new THREE.Vector3();
    // getWorldPosition(): obtiene la posición global del objeto
    // (importante si el objeto es hijo de otro)
    selectedPlanet.getWorldPosition(planetPos);
    
    // Offset para que la cámara no esté justo en el planeta
    const offset = new THREE.Vector3(0, 15, 30);
    
    // clone(): crea copia del vector para no modificar planetPos
    const cameraPos = planetPos.clone().add(offset);
    
    // lerp(): interpolación lineal suave entre dos vectores
    // Parámetros: (vectorDestino, factor)
    // factor = 0.05 significa que la cámara se mueve 5% hacia el destino cada frame
    // Esto crea un movimiento suave de seguimiento
    camera.position.lerp(cameraPos, 0.05);
    
    // lookAt(): hace que la cámara mire hacia un punto específico
    camera.lookAt(planetPos);
  } else {
    // Si no hay planeta seleccionado, usa los controles normales
    if (params.controlMode === 'orbit') {
      controls.update(); // OrbitControls solo necesita update()
    } else {
      // FlyControls necesita el delta time (tiempo entre frames)
      // getDelta(): devuelve el tiempo transcurrido desde la última llamada
      controls.update(clock.getDelta());
    }
  }

  // ----- RENDERIZADO FINAL -----
  // render(): dibuja la escena desde la perspectiva de la cámara
  renderer.render(scene, camera);
}

// ===== MANEJO DE REDIMENSIONAMIENTO DE VENTANA =====
function onWindowResize() {
  // Actualiza el aspect ratio de la cámara
  camera.aspect = window.innerWidth / window.innerHeight;
  // updateProjectionMatrix(): recalcula la matriz de proyección de la cámara
  // Necesario después de cambiar aspect, fov, near o far
  camera.updateProjectionMatrix();
  // Redimensiona el renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ===== MANEJO DE TECLAS =====
function onKeyDown(event) {
  // event.key: contiene el nombre de la tecla presionada
  if (event.key === "Escape") resetView();
}

// ===== MANEJO DE DOBLE CLIC =====
// Crea un cometa en la posición donde se hace doble clic
function onDoubleClick(event) {
  // Si estamos siguiendo un cuerpo celeste, no crear cometa
  if (selectedPlanet) return;

  // Normalizar coordenadas del ratón
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Si el doble clic cae sobre un objeto, no crear cometa
  const intersects = raycaster.intersectObjects([...Planetas, ...Lunas, ...Anillos, estrella], true);
  if (intersects.length > 0) return;

  // ----- CALCULAR POSICIÓN EN EL ESPACIO 3D -----
  const distance = 200; // Distancia desde la cámara
  
  // Crear vector en coordenadas de pantalla normalizada
  const direction = new THREE.Vector3(mouse.x, mouse.y, 0.5);
  
  // unproject(): convierte coordenadas de pantalla a coordenadas 3D del mundo
  // Parámetros: (camera) - necesita la cámara para la transformación inversa
  direction.unproject(camera);
  
  // sub(): resta vectores (direction - camera.position)
  direction.sub(camera.position).normalize();
  
  // multiplyScalar(): multiplica el vector por un escalar
  // normalize() hace que el vector tenga longitud 1
  // multiplyScalar(distance) lo alarga a la distancia deseada
  const startPos = camera.position.clone().add(direction.multiplyScalar(distance));

  crearCometa(startPos);
}

// ===== FUNCIÓN PARA CREAR UN COMETA =====
// Parámetros: posición inicial en el espacio 3D
function crearCometa(posicion) {
  // ----- NÚCLEO DEL COMETA -----
  const cometGeom = new THREE.SphereGeometry(0.5, 16, 16);
  const texture = textureLoader.load("src/textures/comet.jpg");
  const cometMat = new THREE.MeshStandardMaterial({ 
    map: texture, 
    emissive: 0x444444,        // Brillo propio grisáceo
    emissiveIntensity: 0.5 
  });
  const cometa = new THREE.Mesh(cometGeom, cometMat);
  
  // copy(): copia los valores de un vector a otro
  cometa.position.copy(posicion);
  
  // ----- CÁLCULO DE DIRECCIÓN -----
  // El cometa se mueve hacia el centro (0,0,0) con algo de aleatoriedad
  const dirToCenter = new THREE.Vector3(0, 0, 0).sub(posicion).normalize();
  
  // Añade un offset aleatorio para que no vaya exactamente al centro
  const randomOffset = new THREE.Vector3(
    (Math.random() - 0.5) * 0.5, 
    (Math.random() - 0.5) * 0.5, 
    (Math.random() - 0.5) * 0.5
  );
  
  const direction = dirToCenter.add(randomOffset).normalize();
  
  // Velocidad aleatoria entre 0.5 y 1.5 unidades por frame
  cometa.userData.velocity = direction.multiplyScalar(0.5 + Math.random());

  // ----- CREACIÓN DE LA COLA (TRAIL) -----
  // BufferGeometry vacía que se llenará dinámicamente
  const tailGeometry = new THREE.BufferGeometry();
  const tailCount = 50; // Número de partículas en la cola
  
  // Float32Array: array tipado de números de 32 bits (más eficiente)
  // Cada partícula necesita 3 valores (x, y, z)
  const tailPositions = new Float32Array(tailCount * 3);
  tailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tailPositions, 3));
  
  // PointsMaterial: material para renderizar puntos/partículas
  // size: tamaño de cada punto en píxeles
  // blending: AdditiveBlending hace que los colores se sumen (efecto brillante)
  const tailMaterial = new THREE.PointsMaterial({ 
    size: 2, 
    transparent: true, 
    opacity: 0.6, 
    blending: THREE.AdditiveBlending 
  });
  
  // Points: objeto 3D que renderiza puntos
  // Se usa para efectos de partículas
  const tail = new THREE.Points(tailGeometry, tailMaterial);
  
  // Añade la cola como hija del cometa
  cometa.add(tail);
  
  // Guarda referencias en userData
  cometa.userData.tail = tail;
  cometa.userData.tailPositions = []; // Historial de posiciones
  cometa.userData.tailMax = tailCount;

  // Tiempo de vida aleatorio del cometa
  cometa.userData.lifetime = 0;
  cometa.userData.maxLifetime = 800 + Math.floor(Math.random() * 400);

  scene.add(cometa);
  Cometas.push(cometa);
}