import { useEffect, useRef } from "react";
import * as THREE from "three";

// The landing hero's 3D scene: a softly morphing "mind" orb with product
// tiles orbiting it. Loaded lazily (three.js is its own chunk), pauses when
// off screen or in a hidden tab, and holds still for reduced-motion users.

const NOISE_GLSL = /* glsl */ `
// 3D simplex noise (Ashima Arts, MIT).
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const ORB_VERTEX = /* glsl */ `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
${NOISE_GLSL}
void main(){
  float n = snoise(normal * 1.1 + uTime * 0.22);
  vNoise = n;
  vec3 pos = position + normal * n * 0.11;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const ORB_FRAGMENT = /* glsl */ `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying float vNoise;
void main(){
  float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);
  vec3 blue = vec3(0.15, 0.39, 0.92);
  vec3 violet = vec3(0.55, 0.30, 0.95);
  vec3 cyan = vec3(0.30, 0.85, 0.98);
  float t = 0.5 + 0.5 * sin(vNoise * 2.5 + uTime * 0.4);
  vec3 base = mix(blue, violet, t);
  vec3 col = mix(base * 0.55, cyan, fresnel);
  col += fresnel * 0.35;
  gl_FragColor = vec4(col, 0.92);
}`;

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

type Props = { onError?: () => void; className?: string };

export default function HeroScene({ onError, className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      onError?.();
      return;
    }
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const small = window.innerWidth < 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const world = new THREE.Group();
    scene.add(world);

    // The orb.
    const orbMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: ORB_VERTEX,
      fragmentShader: ORB_FRAGMENT,
      transparent: true,
    });
    const orbGeometry = new THREE.IcosahedronGeometry(1.25, small ? 24 : 48);
    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    world.add(orb);

    // A faint halo shell around it.
    const haloGeometry = new THREE.SphereGeometry(1.75, 48, 48);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    });
    world.add(new THREE.Mesh(haloGeometry, haloMaterial));

    // Orbiting product tiles: rounded glassy cards with a bright "image" area.
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.PointLight(0x60a5fa, 30, 20);
    keyLight.position.set(3, 3, 4);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xa855f7, 25, 20);
    rimLight.position.set(-4, -2, 3);
    scene.add(rimLight);

    const tileShape = roundedRect(0.62, 0.8, 0.09);
    const tileGeometry = new THREE.ExtrudeGeometry(tileShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 3,
      curveSegments: 8,
    });
    tileGeometry.center();
    const imageGeometry = new THREE.ShapeGeometry(roundedRect(0.5, 0.42, 0.06), 8);
    const lineGeometry = new THREE.PlaneGeometry(0.34, 0.045);
    const priceGeometry = new THREE.PlaneGeometry(0.2, 0.045);

    const tileMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.3,
      roughness: 0.35,
      transparent: true,
      opacity: 0.9,
    });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 });
    const priceMaterial = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
    const imageColors = [0x3b82f6, 0x8b5cf6, 0x06b6d4, 0x6366f1, 0xec4899, 0x22c55e];
    const imageMaterials = imageColors.map(
      (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }),
    );

    const TILE_COUNT = small ? 5 : 6;
    const tiles: Array<{ group: THREE.Group; angle: number; radius: number; height: number; speed: number }> = [];
    for (let i = 0; i < TILE_COUNT; i++) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(tileGeometry, tileMaterial));
      const image = new THREE.Mesh(imageGeometry, imageMaterials[i % imageMaterials.length]);
      image.position.set(0, 0.1, 0.04);
      group.add(image);
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.position.set(-0.06, -0.2, 0.04);
      group.add(line);
      const price = new THREE.Mesh(priceGeometry, priceMaterial);
      price.position.set(-0.13, -0.29, 0.04);
      group.add(price);
      world.add(group);
      tiles.push({
        group,
        angle: (i / TILE_COUNT) * Math.PI * 2,
        radius: 2.35 + (i % 2) * 0.25,
        height: (i % 3 - 1) * 0.55,
        speed: 0.16 + (i % 3) * 0.02,
      });
    }

    // Particle dust.
    const PARTICLES = small ? 160 : 320;
    const positions = new Float32Array(PARTICLES * 3);
    for (let i = 0; i < PARTICLES; i++) {
      const r = 2 + Math.random() * 2.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.025,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    world.add(dust);

    world.rotation.x = 0.18;

    // Size to the container.
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      // Keep the whole orbit in view on tall, narrow screens.
      camera.position.z = w / h < 0.9 ? 9 : 7.2;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // Pointer parallax.
    const target = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 0.5;
      target.y = (e.clientY / window.innerHeight - 0.5) * 0.35;
    };
    if (!reduceMotion) window.addEventListener("pointermove", onPointer, { passive: true });

    const clock = new THREE.Clock();
    let elapsed = 0;
    const place = (t: number) => {
      orbMaterial.uniforms.uTime.value = t;
      orb.rotation.y = t * 0.15;
      for (const tile of tiles) {
        const a = tile.angle + t * tile.speed;
        tile.group.position.set(
          Math.cos(a) * tile.radius,
          tile.height + Math.sin(t * 0.8 + tile.angle) * 0.12,
          Math.sin(a) * tile.radius * 0.6,
        );
        tile.group.lookAt(camera.position.x, tile.group.position.y, camera.position.z);
        tile.group.rotateZ(Math.sin(t * 0.5 + tile.angle) * 0.08);
      }
      dust.rotation.y = t * 0.03;
    };

    let frame = 0;
    let visible = true;
    let running = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      elapsed += Math.min(clock.getDelta(), 0.05);
      place(elapsed);
      world.rotation.y += (target.x - world.rotation.y) * 0.04;
      world.rotation.x += (0.18 + target.y - world.rotation.x) * 0.04;
      renderer.render(scene, camera);
    };
    const start = () => {
      if (running || reduceMotion || !visible || document.hidden) return;
      running = true;
      clock.getDelta();
      tick();
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    if (reduceMotion) {
      place(4);
      renderer.render(scene, camera);
    } else {
      start();
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(mount);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
      onError?.();
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      [orbGeometry, haloGeometry, tileGeometry, imageGeometry, lineGeometry, priceGeometry, dustGeometry].forEach((g) =>
        g.dispose()
      );
      [orbMaterial, haloMaterial, tileMaterial, lineMaterial, priceMaterial, dustMaterial, ...imageMaterials].forEach((m) =>
        m.dispose()
      );
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onError]);

  return <div ref={mountRef} className={className} />;
}
