"use client";

import { useRef, useEffect, Suspense, Component, ReactNode, MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

/**
 * Emote animation system using motion-captured GLB clips from the
 * Ready Player Me Animation Library (CC-BY-4.0).
 * Each gesture detection maps to a full-body emote animation loaded via
 * THREE.AnimationMixer, giving natural motion-captured body movement.
 */
const EMOTE_ANIMATIONS: Record<string, string> = {
  Open_Palm:   "/animations/M_Standing_Expressions_013.glb", // wave / greeting
  Thumb_Up:    "/animations/M_Standing_Expressions_012.glb", // thumbs up
  Thumb_Down:  "/animations/M_Standing_Expressions_014.glb", // head shake / disagree
  Victory:     "/animations/M_Standing_Expressions_005.glb", // celebration / expressive
  ILoveYou:    "/animations/M_Standing_Expressions_007.glb", // heartfelt / appreciative
  Closed_Fist: "/animations/M_Standing_Expressions_008.glb", // fist pump / strong
  Pointing_Up: "/animations/M_Standing_Expressions_010.glb", // pointing / presenting
};

// How long to keep gesture active after last MediaPipe detection (seconds)
const GESTURE_HOLD_TIME = 1.5;
// Blend duration for crossfading into and out of emotes (seconds)
const EMOTE_BLEND_IN = 0.3;
const EMOTE_BLEND_OUT = 0.5;

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
  // Store original rest quaternions (arms-down corrected)
  const restQuats = useRef<Record<string, THREE.Quaternion>>({});

  // ── Emote animation system ──
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const emoteActions = useRef<Record<string, THREE.AnimationAction>>({});
  const currentEmoteAction = useRef<THREE.AnimationAction | null>(null);
  // Smoothed emote blend (0 = rest pose, 1 = full animation)
  const emoteBlend = useRef(0);
  const activeGesture = useRef<GestureName>(null);
  // Gesture hold: keep gesture active for GESTURE_HOLD_TIME after last detection
  const gestureHoldName = useRef<GestureName>(null);
  const gestureLastSeen = useRef(0);
  // Smoothed gesture expression blend for face
  const gestureExprBlend = useRef(0);
  // Manual delta time tracking (clock.getDelta() is unreliable with getElapsedTime())
  const lastFrameTime = useRef(0);
  // All bones (not just arm bones) for animation blending
  const allBones = useRef<Record<string, THREE.Bone>>({});

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
      // Collect arm bones for rest pose correction
      if (obj.name in bones.current) {
        (bones.current as Record<string, THREE.Object3D | null>)[obj.name] = obj;
        restQuats.current[obj.name] = obj.quaternion.clone();
      }
      // Collect ALL bones for animation blending
      if ((obj as THREE.Bone).isBone) {
        allBones.current[obj.name] = obj as THREE.Bone;
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

      const worldQ = new THREE.Quaternion();
      bone.getWorldQuaternion(worldQ);
      const currentY = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQ).normalize();
      const desiredDir = new THREE.Vector3(target[0], target[1], target[2]).normalize();
      const deltaWorld = new THREE.Quaternion().setFromUnitVectors(currentY, desiredDir);

      const parentWorldQ = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(parentWorldQ);
      const parentInv = parentWorldQ.clone().invert();
      const deltaLocal = parentInv.multiply(deltaWorld).multiply(parentWorldQ);

      bone.quaternion.premultiply(deltaLocal);
      bone.updateWorldMatrix(false, true);

      restQuats.current[boneName] = bone.quaternion.clone();
    }

    // ── Create AnimationMixer and load emote clips ──
    mixer.current = new THREE.AnimationMixer(scene);

    // Listen for animation end to clean up
    mixer.current.addEventListener("finished", () => {
      // Animation completed its play-through; we'll blend out via emoteBlend
    });

    const loader = new GLTFLoader();
    const loadPromises = Object.entries(EMOTE_ANIMATIONS).map(
      ([gestureName, url]) =>
        new Promise<void>((resolve) => {
          loader.load(
            url,
            (gltf) => {
              if (gltf.animations.length > 0 && mixer.current) {
                const clip = gltf.animations[0];
                clip.name = gestureName; // rename for clarity
                const action = mixer.current.clipAction(clip);
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
                action.setEffectiveWeight(0);
                emoteActions.current[gestureName] = action;
              }
              resolve();
            },
            undefined,
            () => resolve(), // silently skip failed loads
          );
        }),
    );
    Promise.all(loadPromises);

    return () => {
      mixer.current?.stopAllAction();
      mixer.current = null;
    };
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

    // ── Emote animation system ──
    const curGesture = gestureRef.current;
    // Manual delta: clock.getDelta() is unreliable when getElapsedTime() is also used
    const now = t;
    const dt = lastFrameTime.current > 0 ? Math.min(now - lastFrameTime.current, 0.05) : 0.016;
    lastFrameTime.current = now;

    // Sticky gesture: hold detected gesture active for GESTURE_HOLD_TIME
    if (curGesture && emoteActions.current[curGesture]) {
      gestureHoldName.current = curGesture;
      gestureLastSeen.current = now;
    }
    const heldGesture = gestureHoldName.current;
    const gestureFresh = heldGesture && (now - gestureLastSeen.current) < GESTURE_HOLD_TIME;

    if (gestureFresh && heldGesture) {
      // Start or continue emote
      if (activeGesture.current !== heldGesture) {
        // Switch to new emote
        if (currentEmoteAction.current) {
          currentEmoteAction.current.fadeOut(EMOTE_BLEND_IN);
        }
        const action = emoteActions.current[heldGesture];
        if (action) {
          action.reset();
          action.setEffectiveWeight(1);
          action.fadeIn(EMOTE_BLEND_IN);
          action.play();
          currentEmoteAction.current = action;
        }
        activeGesture.current = heldGesture;
      }
      emoteBlend.current = Math.min(1, emoteBlend.current + dt / EMOTE_BLEND_IN);
      gestureExprBlend.current = Math.min(1, gestureExprBlend.current + dt / (EMOTE_BLEND_IN * 1.2));
    } else {
      // Blend out
      emoteBlend.current = Math.max(0, emoteBlend.current - dt / EMOTE_BLEND_OUT);
      gestureExprBlend.current = Math.max(0, gestureExprBlend.current - dt / (EMOTE_BLEND_OUT * 1.5));
      if (emoteBlend.current <= 0) {
        if (currentEmoteAction.current) {
          currentEmoteAction.current.fadeOut(0.1);
          currentEmoteAction.current = null;
        }
        activeGesture.current = null;
        gestureHoldName.current = null;
      }
    }

    const blend = emoteBlend.current;
    const gesture = activeGesture.current;
    const exprBlend = gestureExprBlend.current;

    // ── Gesture-triggered facial expressions ──
    if (exprBlend > 0.001) {
      morphMeshes.current.forEach((mesh) => {
        const d = mesh.morphTargetDictionary!;
        const inf = mesh.morphTargetInfluences!;

        const smileAmount = exprBlend * 0.35;
        if (d.mouthSmileLeft !== undefined)
          inf[d.mouthSmileLeft] = Math.max(inf[d.mouthSmileLeft], smileAmount);
        if (d.mouthSmileRight !== undefined)
          inf[d.mouthSmileRight] = Math.max(inf[d.mouthSmileRight], smileAmount);
        if (d.cheekSquintLeft !== undefined)
          inf[d.cheekSquintLeft] = Math.max(inf[d.cheekSquintLeft], exprBlend * 0.2);
        if (d.cheekSquintRight !== undefined)
          inf[d.cheekSquintRight] = Math.max(inf[d.cheekSquintRight], exprBlend * 0.2);

        if (gesture === "Thumb_Up") {
          if (d.mouthSmileLeft !== undefined) inf[d.mouthSmileLeft] = exprBlend * 0.5;
          if (d.mouthSmileRight !== undefined) inf[d.mouthSmileRight] = exprBlend * 0.5;
          if (d.browInnerUp !== undefined) inf[d.browInnerUp] = exprBlend * 0.15;
          if (d.browOuterUpLeft !== undefined) inf[d.browOuterUpLeft] = exprBlend * 0.12;
          if (d.browOuterUpRight !== undefined) inf[d.browOuterUpRight] = exprBlend * 0.12;
        } else if (gesture === "Open_Palm") {
          if (d.mouthSmileLeft !== undefined) inf[d.mouthSmileLeft] = exprBlend * 0.4;
          if (d.mouthSmileRight !== undefined) inf[d.mouthSmileRight] = exprBlend * 0.4;
          if (d.browOuterUpLeft !== undefined) inf[d.browOuterUpLeft] = exprBlend * 0.1;
          if (d.browOuterUpRight !== undefined) inf[d.browOuterUpRight] = exprBlend * 0.1;
        } else if (gesture === "Victory" || gesture === "ILoveYou") {
          if (d.mouthSmileLeft !== undefined) inf[d.mouthSmileLeft] = exprBlend * 0.45;
          if (d.mouthSmileRight !== undefined) inf[d.mouthSmileRight] = exprBlend * 0.45;
          if (d.browInnerUp !== undefined) inf[d.browInnerUp] = exprBlend * 0.1;
        } else if (gesture === "Thumb_Down") {
          if (d.mouthSmileLeft !== undefined) inf[d.mouthSmileLeft] = 0;
          if (d.mouthSmileRight !== undefined) inf[d.mouthSmileRight] = 0;
          if (d.browInnerUp !== undefined) inf[d.browInnerUp] = exprBlend * 0.2;
          if (d.mouthFrownLeft !== undefined) inf[d.mouthFrownLeft] = exprBlend * 0.15;
          if (d.mouthFrownRight !== undefined) inf[d.mouthFrownRight] = exprBlend * 0.15;
        }
      });
    }

    // ── Bone pose: blend between manual rest pose and animation ──
    // 1. Set all arm bones to rest (arms-down) pose
    for (const name of Object.keys(bones.current)) {
      const bone = bones.current[name];
      const rest = restQuats.current[name];
      if (bone && rest) bone.quaternion.copy(rest);
    }

    if (blend > 0.001 && mixer.current) {
      // Save rest quaternions for all bones so we can slerp after mixer update
      const savedQuats: Record<string, THREE.Quaternion> = {};
      for (const [name, bone] of Object.entries(allBones.current)) {
        savedQuats[name] = bone.quaternion.clone();
      }

      // Let AnimationMixer apply the emote animation
      mixer.current.update(dt);

      // Slerp each bone between rest pose and animation-applied pose
      for (const [name, bone] of Object.entries(allBones.current)) {
        const savedQ = savedQuats[name];
        if (savedQ) {
          // bone.quaternion now has the animation-set value
          const animQ = bone.quaternion.clone();
          bone.quaternion.slerpQuaternions(savedQ, animQ, blend);
        }
      }
    } else {
      // No emote — just update mixer time (keeps it in sync) but weight is 0
      if (mixer.current) mixer.current.update(dt);

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

  // On desktop (landscape), push model down so head isn't clipped at top
  const { size } = useThree();
  const modelY = size.width > size.height ? -1.55 : -1.4;

  return <primitive object={scene} position={[0, modelY, 0]} rotation={[-0.04, 0, 0]} />;
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

