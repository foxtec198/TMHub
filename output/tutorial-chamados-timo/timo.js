import * as THREE from '/node_modules/three/build/three.module.js';
import {GLTFLoader} from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(440,650);renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xdffff0,0x315547,2.5));
for(const [x,y,z,p] of [[-3,5,5,5],[4,2,2,3],[0,4,-3,4]]){const l=new THREE.DirectionalLight(0xffffff,p);l.position.set(x,y,z);scene.add(l);}
const gltf=await new GLTFLoader().loadAsync('/timo.glb');scene.add(gltf.scene);
const box=new THREE.Box3().setFromObject(gltf.scene),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
const camera=new THREE.PerspectiveCamera(32,440/650,.01,1000);const distance=Math.max(size.y/(2*Math.tan(THREE.MathUtils.degToRad(16))),size.x/(2*Math.tan(THREE.MathUtils.degToRad(16))*(440/650)))*1.18;
camera.position.set(center.x,center.y+size.y*.13,center.z+distance);camera.lookAt(center);
const mixer=new THREE.AnimationMixer(gltf.scene);let action;
window.renderTimo=(name,time)=>{if(action)action.stop();const clip=THREE.AnimationClip.findByName(gltf.animations,name)||gltf.animations[0];action=mixer.clipAction(clip);action.reset().play();mixer.setTime(time);renderer.render(scene,camera);};
window.renderTimo('speaking',0);window.timoInfo={size:size.toArray(),center:center.toArray(),clips:gltf.animations.map(a=>({name:a.name,duration:a.duration}))};window.timoReady=true;
