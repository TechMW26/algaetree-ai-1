"use client";

import { useRef, useEffect, Suspense, Component, ReactNode, MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const AVATAR_URL = "/avatar.glb";

/* ── Error boundary ── */
class AvatarErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/*
 * ── Audio-reactive pose-cycling lip sync ──
 *
 * Production lip sync without phoneme data works by:
 * 1. Cycling through complete mouth POSES (not individual morph targets)
 * 2. Timing transitions to audio transients (syllable onsets)
 * 3. Modulating pose intensity by volume (loud = pronounced, quiet = subtle)
 * 4. Between syllables, blending toward a closed-mouth rest pose
 *
 * This mirrors how Synthesia / D-ID / Ready Player Me handle
 * real-time lip sync when no phoneme stream is available.
 */

// All viseme channel names we drive
const VISEME_KEYS = [
  "jawOpen", "viseme_aa", "viseme_E", "viseme_O", "viseme_U",
  "viseme_SS", "viseme_FF", "viseme_PP", "viseme_TH", "viseme_DD",
  "viseme_kk", "viseme_RR", "viseme_nn", "viseme_CH",
] as const;

type VisemeKey = (typeof VISEME_KEYS)[number];

// Complete mouth poses — each a distinct, recognizable mouth shape
const POSES: Partial<Record<VisemeKey, number>>[] = [
  // 0: Open vowel "ah" — wide open
  { jawOpen: 0.30, viseme_aa: 0.28 },
  // 1: Mid vowel "eh" — slightly open, spread
  { jawOpen: 0.14, viseme_E: 0.24 },
  // 2: Rounded "oh" — medium open, lips rounded
  { jawOpen: 0.20, viseme_O: 0.26 },
  // 3: Tight "oo" — nearly closed, lips pursed
  { jawOpen: 0.06, viseme_U: 0.20 },
  // 4: Bilabial "mm/pp" — lips pressed shut
  { jawOpen: 0.01, viseme_PP: 0.18 },
  // 5: Fricative "ff/vv" — lower lip to teeth
  { jawOpen: 0.04, viseme_FF: 0.20 },
  // 6: Sibilant "ss/sh" — teeth close, spread
  { jawOpen: 0.04, viseme_SS: 0.20, viseme_E: 0.06 },
  // 7: Dental/tap "th/d/t" — tongue forward
  { jawOpen: 0.10, viseme_TH: 0.16, viseme_DD: 0.08 },
  // 8: Open variant "ah" + liquid
  { jawOpen: 0.24, viseme_aa: 0.18, viseme_RR: 0.12 },
  // 9: Velar "k/g" — back tongue, mid open
  { jawOpen: 0.12, viseme_kk: 0.16, viseme_nn: 0.06 },
];

// Pre-built pose sequences that feel like natural syllable patterns
const POSE_SEQUENCES = [
  [0, 7, 1, 4, 2, 6, 0, 5],
  [1, 0, 9, 4, 8, 6, 3],
  [2, 5, 0, 1, 7, 3, 6, 0],
  [0, 6, 8, 4, 1, 0, 7, 5],
  [3, 0, 7, 2, 4, 1, 9, 0],
  [8, 1, 5, 0, 3, 7, 2, 4],
];

class AudioLipSync {
  private current: Record<VisemeKey, number>;

  // Audio envelope
  private volumeFast = 0;   // smoothed follower
  private volumeSlow = 0;   // slower follower for blend
  private prevRms = 0;

  // Pose cycling
  private seqIdx = 0;
  private poseIdx = 0;
  private poseTimer = 0;
  private rng = 42;

  constructor() {
    this.current = {} as Record<VisemeKey, number>;
    for (const k of VISEME_KEYS) this.current[k] = 0;
  }

  private rand() {
    this.rng = (this.rng * 16807 + 7) % 2147483647;
    return (this.rng % 1000) / 1000;
  }

  /** Compute speech-band RMS from FFT data, or fall back to volume */
  private getRms(freqData: Uint8Array | undefined | null, fallbackVol: number): number {
    if (freqData && freqData.length > 16) {
      const lo = Math.max(1, Math.floor(freqData.length * 0.005));
      const hi = Math.min(freqData.length - 1, Math.floor(freqData.length * 0.18));
      let sumSq = 0;
      for (let i = lo; i <= hi; i++) {
        const v = freqData[i] / 255;
        sumSq += v * v;
      }
      return Math.sqrt(sumSq / (hi - lo + 1));
    }
    return fallbackVol;
  }

  update(
    freqData: Uint8Array | undefined | null,
    volume: number,
    speaking: boolean,
  ): Record<string, number> {
    const result: Record<string, number> = {};

    // ── Not speaking: gentle decay ──
    if (!speaking) {
      for (const k of VISEME_KEYS) {
        this.current[k] *= 0.55;          // softer falloff so mouth closes smoothly
        if (this.current[k] < 0.002) this.current[k] = 0;
        result[k] = this.current[k];
      }
      this.volumeFast = 0;
      this.volumeSlow = 0;
      this.prevRms = 0;
      return result;
    }

    // ── 1. Get audio level ──
    const rms = this.getRms(freqData, volume);

    // ── 2. Smoothed envelope followers ──
    this.volumeFast += (rms - this.volumeFast) * 0.25;
    this.volumeSlow += (rms - this.volumeSlow) * 0.12;

    // ── 3. Amplitude from blended volume ──
    // Blend fast + slow followers for smooth but responsive amplitude.
    const blendedVol = this.volumeFast * 0.6 + this.volumeSlow * 0.4;
    const gated = Math.max(0, blendedVol - 0.02);
    const amplitude = gated > 0 ? Math.sqrt(Math.min(1, gated * 3.5)) : 0;

    // ── 4. Transient detection (for pose advancement speed) ──
    const transient = Math.max(0, rms - this.prevRms);
    this.prevRms = rms;

    // ── 5. Advance pose sequence ──
    // Base rate keeps poses moving during any speech; transients speed it up (gentler)
    const rate = amplitude > 0.1 ? (0.06 + amplitude * 0.04 + transient * 0.8) : 0;
    this.poseTimer += rate;

    if (this.poseTimer >= 1.0) {
      this.poseTimer = 0;
      const seq = POSE_SEQUENCES[this.seqIdx];
      this.poseIdx = (this.poseIdx + 1) % seq.length;
      if (this.poseIdx === 0) {
        this.seqIdx = Math.floor(this.rand() * POSE_SEQUENCES.length);
      }
    }

    // ── 6. Build targets from current pose × amplitude ──
    const seq = POSE_SEQUENCES[this.seqIdx];
    const pose = POSES[seq[this.poseIdx]];

    for (const k of VISEME_KEYS) {
      const poseWeight = pose[k] || 0;
      const target = poseWeight * amplitude;
      const prev = this.current[k];
      // Gentle lerp: rise slower (0.18) so lips don't snap open,
      // fall even softer (0.10) so they glide shut
      if (target > prev) {
        this.current[k] = prev + (target - prev) * 0.18;
      } else {
        this.current[k] = prev + (target - prev) * 0.10;
      }
      if (this.current[k] < 0.002) this.current[k] = 0;
      result[k] = this.current[k];
    }

    return result;
  }
}

/* ── Gesture animation types ── */
type GestureName =
  | "Open_Palm"
  | "Thumb_Up"
  | "Thumb_Down"
  | "Victory"
  | "ILoveYou"
  | "Closed_Fist"
  | "Pointing_Up"
  | null;

/**
 * Defines target rotations (Euler XYZ in radians) for the right arm bones
 * to perform each gesture. Left-side bones mirror automatically.
 * Values are offsets ADDED to the idle rest pose.
 */
interface GesturePose {
  rightArm: [number, number, number];
  rightForeArm: [number, number, number];
  rightHand: [number, number, number];
}

// Desired world-space directions for each arm bone in the idle arms-down pose.
// Computed at runtime using Three.js's own world transforms for reliability.
const ARM_DOWN_TARGETS: Record<string, [number, number, number]> = {
  RightArm:     [0.18, -0.95, 0.12],
  RightForeArm: [0.06, -0.92, 0.30],
  RightHand:    [0.03, -0.92, 0.32],
  LeftArm:      [-0.18, -0.95, 0.12],
  LeftForeArm:  [-0.06, -0.92, 0.30],
  LeftHand:     [-0.03, -0.92, 0.32],
};

// Gesture target poses (right arm — left is mirrored for wave)
const GESTURE_POSES: Record<string, GesturePose> = {
  // Wave: arm up, forearm up & out, hand upright
  Open_Palm: {
    rightArm: [-0.5, -0.3, -0.8],
    rightForeArm: [-1.2, 0.4, -0.3],
    rightHand: [0, 0.2, -0.3],
  },
  // Thumbs up: arm slightly forward & up, forearm bent up, hand fist rotated
  Thumb_Up: {
    rightArm: [-0.3, -0.2, -0.5],
    rightForeArm: [-1.5, 0.2, 0],
    rightHand: [0.1, 0, -0.2],
  },
  // Thumbs down: similar but hand flipped
  Thumb_Down: {
    rightArm: [-0.1, -0.2, -0.3],
    rightForeArm: [-0.8, 0.1, 0],
    rightHand: [3.14, 0, 0],
  },
  // Peace sign: arm up, forearm up, fingers up
  Victory: {
    rightArm: [-0.4, -0.3, -0.7],
    rightForeArm: [-1.3, 0.3, -0.2],
    rightHand: [0, 0.1, -0.2],
  },
  // I Love You: same as peace but slightly different angle
  ILoveYou: {
    rightArm: [-0.45, -0.25, -0.75],
    rightForeArm: [-1.35, 0.35, -0.15],
    rightHand: [0.05, 0.15, -0.25],
  },
  // Fist bump: arm forward, fist out
  Closed_Fist: {
    rightArm: [-0.5, -0.4, -0.5],
    rightForeArm: [-1.0, 0.2, 0],
    rightHand: [0.1, 0, 0],
  },
  // Pointing up: arm up, index out
  Pointing_Up: {
    rightArm: [-0.4, -0.2, -0.6],
    rightForeArm: [-1.4, 0.3, -0.1],
    rightHand: [0, 0, -0.15],
  },
};

/* ── 3D Model ── */
function AvatarModel({
  isSpeaking,
  audioDataRef,
  volumeRef,
  gestureRef,
}: {
  isSpeaking: boolean;
  audioDataRef: MutableRefObject<(() => Uint8Array | undefined) | undefined>;
  volumeRef: MutableRefObject<(() => number) | undefined>;
  gestureRef: MutableRefObject<GestureName>;
}) {
  const { scene } = useGLTF(AVATAR_URL);
  const morphMeshes = useRef<THREE.Mesh[]>([]);
  const headBone = useRef<THREE.Object3D | null>(null);
  const lipSync = useRef(new AudioLipSync());

  // Arm/hand bone refs
  const bones = useRef<Record<string, THREE.Object3D | null>>({
    RightArm: null, RightForeArm: null, RightHand: null,
    LeftArm: null, LeftForeArm: null, LeftHand: null,
  });
  // Store original rest quaternions
  const restQuats = useRef<Record<string, THREE.Quaternion>>({});
  // Smoothed gesture blend (0 = rest, 1 = full gesture pose)
  const gestureBlend = useRef(0);
  const activeGesture = useRef<GestureName>(null);
  // Smoothed gesture expression blend for face
  const gestureExprBlend = useRef(0);
  // Wave oscillator phase
  const wavePhase = useRef(0);

  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        // Enhance skin textures
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            const m = mat as THREE.MeshStandardMaterial;
            if (m.map) {
              m.map.anisotropy = 16;
              m.map.minFilter = THREE.LinearMipmapLinearFilter;
              m.map.magFilter = THREE.LinearFilter;
              m.map.needsUpdate = true;
            }
            if (m.normalMap) {
              m.normalScale = new THREE.Vector2(1.2, 1.2);
              m.normalMap.anisotropy = 16;
              m.normalMap.needsUpdate = true;
            }
            // Skin-like roughness
            m.roughness = Math.max(m.roughness ?? 0.5, 0.45);
            m.envMapIntensity = 0.4;
            m.needsUpdate = true;
          });
        }
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          meshes.push(mesh);
        }
      }
      if (obj.name === "Head") headBone.current = obj;
      // Collect arm bones
      if (obj.name in bones.current) {
        (bones.current as Record<string, THREE.Object3D | null>)[obj.name] = obj;
        // Store the original rest quaternion
        restQuats.current[obj.name] = obj.quaternion.clone();
      }
    });
    morphMeshes.current = meshes;

    // Compute arm-down rest pose at runtime using Three.js world transforms.
    // Process bones in hierarchy order (parent first) so child bones
    // pick up the corrected parent transform.
    scene.updateMatrixWorld(true);

    const boneOrder = [
      "RightArm", "RightForeArm", "RightHand",
      "LeftArm", "LeftForeArm", "LeftHand",
    ];

    for (const boneName of boneOrder) {
      const bone = bones.current[boneName];
      const target = ARM_DOWN_TARGETS[boneName];
      if (!bone || !bone.parent || !target) continue;

      // Current bone +Y direction in world space
      const worldQ = new THREE.Quaternion();
      bone.getWorldQuaternion(worldQ);
      const currentY = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQ).normalize();

      // Desired direction in world space
      const desiredDir = new THREE.Vector3(target[0], target[1], target[2]).normalize();

      // World-space delta rotation from current to desired
      const deltaWorld = new THREE.Quaternion().setFromUnitVectors(currentY, desiredDir);

      // Convert world delta to local delta:
      // delta_local = parentWorldQ^-1 * delta_world * parentWorldQ
      const parentWorldQ = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(parentWorldQ);
      const parentInv = parentWorldQ.clone().invert();
      const deltaLocal = parentInv.multiply(deltaWorld).multiply(parentWorldQ);

      // Apply: new_local = delta_local * old_local
      bone.quaternion.premultiply(deltaLocal);

      // Update world matrices so child bones see the corrected parent
      bone.updateWorldMatrix(false, true);

      // Store as the new rest quaternion
      restQuats.current[boneName] = bone.quaternion.clone();
    }
  }, [scene]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Subtle idle head sway
    if (headBone.current) {
      headBone.current.rotation.y = Math.sin(t * 0.3) * 0.04;
      headBone.current.rotation.x = -0.08 + Math.sin(t * 0.4 + 1) * 0.02;
      // Slight nod when speaking
      if (isSpeaking) {
        headBone.current.rotation.x += Math.sin(t * 1.8) * 0.012;
        headBone.current.rotation.y += Math.sin(t * 1.2 + 0.5) * 0.015;
      }
    }

    // Get real-time audio data from ElevenLabs
    const freqData = audioDataRef.current?.() ?? undefined;
    const vol = volumeRef.current?.() ?? 0;

    // Audio-driven lip sync
    const lsTargets = lipSync.current.update(freqData, vol, isSpeaking);

    morphMeshes.current.forEach((mesh) => {
      const d = mesh.morphTargetDictionary!;
      const inf = mesh.morphTargetInfluences!;

      // Blinking (~every 3-4s with slight variation)
      const blinkCycle = 3.2 + Math.sin(t * 0.13) * 0.8;
      const blinkPhase = (t % blinkCycle) / blinkCycle;
      const blinkVal =
        blinkPhase > 0.96 ? 1 : blinkPhase > 0.94 ? (blinkPhase - 0.94) * 50 : 0;
      if (d.eyeBlinkLeft !== undefined) inf[d.eyeBlinkLeft] = blinkVal;
      if (d.eyeBlinkRight !== undefined) inf[d.eyeBlinkRight] = blinkVal;

      // Apply lip-sync morph targets
      for (const [name, weight] of Object.entries(lsTargets)) {
        if (d[name] !== undefined) {
          inf[d[name]] = weight;
        }
      }

      if (isSpeaking) {
        // Micro-expressions that accompany speech
        if (d.mouthSmileLeft !== undefined)
          inf[d.mouthSmileLeft] = 0.04 + Math.sin(t * 0.9) * 0.03;
        if (d.mouthSmileRight !== undefined)
          inf[d.mouthSmileRight] = 0.04 + Math.sin(t * 0.9 + 0.3) * 0.03;
        if (d.browInnerUp !== undefined)
          inf[d.browInnerUp] = Math.max(0, Math.sin(t * 1.5) * 0.08);
        if (d.browOuterUpLeft !== undefined)
          inf[d.browOuterUpLeft] = Math.max(0, Math.sin(t * 1.1 + 1.0) * 0.04);
        if (d.browOuterUpRight !== undefined)
          inf[d.browOuterUpRight] = Math.max(0, Math.sin(t * 1.1 + 1.2) * 0.04);
        if (d.cheekSquintLeft !== undefined)
          inf[d.cheekSquintLeft] = Math.max(0, Math.sin(t * 1.3) * 0.04);
        if (d.cheekSquintRight !== undefined)
          inf[d.cheekSquintRight] = Math.max(0, Math.sin(t * 1.3 + 0.15) * 0.04);
        if (d.noseSneerLeft !== undefined)
          inf[d.noseSneerLeft] = Math.max(0, Math.sin(t * 2.3) * 0.02);
        if (d.noseSneerRight !== undefined)
          inf[d.noseSneerRight] = Math.max(0, Math.sin(t * 2.3 + 0.1) * 0.02);
      } else {
        // Idle — gentle resting expression
        const idleTargets = [
          "mouthSmileLeft", "mouthSmileRight", "browInnerUp",
          "browOuterUpLeft", "browOuterUpRight",
          "cheekSquintLeft", "cheekSquintRight",
          "noseSneerLeft", "noseSneerRight",
        ];
        idleTargets.forEach((name) => {
          if (d[name] !== undefined && inf[d[name]] > 0.001) {
            inf[d[name]] *= 0.9;
          }
        });
      }
    });

    // ── Gesture arm animation ──
    const curGesture = gestureRef.current;
    const BLEND_SPEED = 4.0; // blend in/out per second (~0.25s)
    const dt = Math.min(clock.getDelta(), 0.05); // cap to avoid jumps

    if (curGesture && GESTURE_POSES[curGesture]) {
      activeGesture.current = curGesture;
      gestureBlend.current = Math.min(1, gestureBlend.current + BLEND_SPEED * dt);
      gestureExprBlend.current = Math.min(1, gestureExprBlend.current + BLEND_SPEED * 0.8 * dt);
    } else {
      gestureBlend.current = Math.max(0, gestureBlend.current - BLEND_SPEED * dt);
      gestureExprBlend.current = Math.max(0, gestureExprBlend.current - BLEND_SPEED * 0.5 * dt);
      if (gestureBlend.current <= 0) activeGesture.current = null;
    }

    const blend = gestureBlend.current;
    const gesture = activeGesture.current;
    const exprBlend = gestureExprBlend.current;

    // ── Gesture-triggered facial expressions ──
    if (exprBlend > 0.001) {
      morphMeshes.current.forEach((mesh) => {
        const d = mesh.morphTargetDictionary!;
        const inf = mesh.morphTargetInfluences!;

        // Smile — all gestures get a warm smile
        const smileAmount = exprBlend * 0.35;
        if (d.mouthSmileLeft !== undefined)
          inf[d.mouthSmileLeft] = Math.max(inf[d.mouthSmileLeft], smileAmount);
        if (d.mouthSmileRight !== undefined)
          inf[d.mouthSmileRight] = Math.max(inf[d.mouthSmileRight], smileAmount);

        // Cheek squint accompanies smile
        if (d.cheekSquintLeft !== undefined)
          inf[d.cheekSquintLeft] = Math.max(inf[d.cheekSquintLeft], exprBlend * 0.2);
        if (d.cheekSquintRight !== undefined)
          inf[d.cheekSquintRight] = Math.max(inf[d.cheekSquintRight], exprBlend * 0.2);

        // Gesture-specific expressions
        if (gesture === "Thumb_Up") {
          // Big happy smile + raised brows
          if (d.mouthSmileLeft !== undefined) inf[d.mouthSmileLeft] = exprBlend * 0.5;
          if (d.mouthSmileRight !== undefined) inf[d.mouthSmileRight] = exprBlend * 0.5;
          if (d.browInnerUp !== undefined) inf[d.browInnerUp] = exprBlend * 0.15;
          if (d.browOuterUpLeft !== undefined) inf[d.browOuterUpLeft] = exprBlend * 0.12;
          if (d.browOuterUpRight !== undefined) inf[d.browOuterUpRight] = exprBlend * 0.12;
        } else if (gesture === "Open_Palm") {
          // Friendly smile + slightly raised brows
          if (d.mouthSmileLeft !== undefined) inf[d.mouthSmileLeft] = exprBlend * 0.4;
          if (d.mouthSmileRight !== undefined) inf[d.mouthSmileRight] = exprBlend * 0.4;
          if (d.browOuterUpLeft !== undefined) inf[d.browOuterUpLeft] = exprBlend * 0.1;
          if (d.browOuterUpRight !== undefined) inf[d.browOuterUpRight] = exprBlend * 0.1;
        } else if (gesture === "Victory" || gesture === "ILoveYou") {
          // Playful expression
          if (d.mouthSmileLeft !== undefined) inf[d.mouthSmileLeft] = exprBlend * 0.45;
          if (d.mouthSmileRight !== undefined) inf[d.mouthSmileRight] = exprBlend * 0.45;
          if (d.browInnerUp !== undefined) inf[d.browInnerUp] = exprBlend * 0.1;
        } else if (gesture === "Thumb_Down") {
          // Empathetic slight frown
          if (d.mouthSmileLeft !== undefined) inf[d.mouthSmileLeft] = 0;
          if (d.mouthSmileRight !== undefined) inf[d.mouthSmileRight] = 0;
          if (d.browInnerUp !== undefined) inf[d.browInnerUp] = exprBlend * 0.2;
          if (d.mouthFrownLeft !== undefined) inf[d.mouthFrownLeft] = exprBlend * 0.15;
          if (d.mouthFrownRight !== undefined) inf[d.mouthFrownRight] = exprBlend * 0.15;
        }
      });
    }

    // ── Always enforce rest quaternions first, then layer animation on top ──
    for (const name of Object.keys(bones.current)) {
      const bone = bones.current[name];
      const rest = restQuats.current[name];
      if (bone && rest) bone.quaternion.copy(rest);
    }

    if (blend > 0.001 && gesture) {
      const pose = GESTURE_POSES[gesture];
      const tmpQ = new THREE.Quaternion();
      const targetQ = new THREE.Quaternion();

      // Wave oscillation (only for Open_Palm)
      if (gesture === "Open_Palm") {
        wavePhase.current += dt * 5.0;
      }

      const applyGestureBone = (boneName: string, euler: [number, number, number]) => {
        const bone = bones.current[boneName];
        const rest = restQuats.current[boneName];
        if (!bone || !rest) return;

        const [rx, ry, rz] = euler;
        // For wave gesture, oscillate the hand rotation
        const waveOffset =
          gesture === "Open_Palm" && boneName === "RightHand"
            ? Math.sin(wavePhase.current) * 0.4
            : 0;

        tmpQ.setFromEuler(new THREE.Euler(rx, ry + waveOffset, rz));
        targetQ.copy(rest).multiply(tmpQ);
        bone.quaternion.slerpQuaternions(rest, targetQ, blend);
      };

      // Right arm poses
      applyGestureBone("RightArm", pose.rightArm);
      applyGestureBone("RightForeArm", pose.rightForeArm);
      applyGestureBone("RightHand", pose.rightHand);
    } else if (blend <= 0.001) {
      // Subtle idle sway — very small so hands look consistent
      for (const name of Object.keys(bones.current)) {
        const bone = bones.current[name];
        const rest = restQuats.current[name];
        if (!bone || !rest) continue;
        const isArm = name.includes("Arm") && !name.includes("Fore");
        const sign = name.startsWith("Right") ? 1 : -1;
        if (isArm) {
          const swayQ = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              Math.sin(t * 0.5 + sign) * 0.008,
              0,
              Math.sin(t * 0.35) * 0.005 * sign,
            ),
          );
          bone.quaternion.multiply(swayQ);
        }
      }
    }
  });

  return <primitive object={scene} position={[0, -1.4, 0]} rotation={[-0.04, 0, 0]} />;
}

/* ── Loading placeholder ── */
function Loader() {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ width: "100%", height: "100%", gap: 12 }}
    >
      <div
        className="pulse-dot rounded-full"
        style={{ width: 14, height: 14, background: "#4ade80" }}
      />
      <span style={{ fontSize: 13, color: "var(--text-3)" }}>Loading avatar…</span>
    </div>
  );
}

/* ── Fallback orb if GLB fails ── */
function FallbackOrb({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div
      className={`rounded-full flex items-center justify-center ${
        isSpeaking ? "orb-speaking" : "orb-idle"
      }`}
      style={{
        width: 200,
        height: 200,
        background: "radial-gradient(circle at 30% 30%, #1a3a2a, #0d1f17, #081210)",
        border: "2px solid rgba(34,197,94,0.25)",
        boxShadow: isSpeaking
          ? "0 0 80px rgba(34,197,94,0.2)"
          : "0 0 40px rgba(34,197,94,0.08)",
      }}
    >
      <span style={{ fontSize: 64 }}>🌿</span>
    </div>
  );
}

/* ── Public component ── */
export interface Avatar3DProps {
  isSpeaking: boolean;
  getAudioData?: () => Uint8Array | undefined;
  getVolume?: () => number;
  gesture?: string | null;
}

export default function Avatar3D({ isSpeaking, getAudioData, getVolume, gesture }: Avatar3DProps) {
  // Stable refs so we don't re-render the Canvas when callbacks change
  const audioDataRef = useRef(getAudioData);
  const volumeRef = useRef(getVolume);
  const gestureRef = useRef<GestureName>(null);
  audioDataRef.current = getAudioData;
  volumeRef.current = getVolume;
  gestureRef.current = (gesture as GestureName) ?? null;

  return (
    <AvatarErrorBoundary fallback={<FallbackOrb isSpeaking={isSpeaking} />}>
      <Suspense fallback={<Loader />}>
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          <Canvas
            camera={{ position: [0, 0.3, 1.8], fov: 28 }}
            gl={{ alpha: true, antialias: true }}
            dpr={[1, 2]}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.15;
              gl.outputColorSpace = THREE.SRGBColorSpace;
            }}
            style={{ background: "transparent", width: "100%", height: "100%" }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 3, 3]} intensity={1.0} />
            <directionalLight position={[-1.5, 2, 1]} intensity={0.35} color="#ffeedd" />
            <directionalLight position={[-2, 1, -1]} intensity={0.15} color="#4ade80" />
            <pointLight position={[0, 0.3, 0.9]} intensity={0.3} color="#ffe4c9" />
            <AvatarModel isSpeaking={isSpeaking} audioDataRef={audioDataRef} volumeRef={volumeRef} gestureRef={gestureRef} />
          </Canvas>
        </div>
      </Suspense>
    </AvatarErrorBoundary>
  );
}

