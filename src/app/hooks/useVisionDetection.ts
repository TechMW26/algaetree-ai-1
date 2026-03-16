"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FaceDetector,
  GestureRecognizer,
  FilesetResolver,
  type FaceDetectorResult,
  type GestureRecognizerResult,
} from "@mediapipe/tasks-vision";

/* ── Gesture name mapping for natural language ── */
const GESTURE_LABELS: Record<string, string> = {
  Open_Palm: "waving hello",
  Closed_Fist: "making a fist",
  Pointing_Up: "pointing up",
  Thumb_Up: "giving a thumbs up",
  Thumb_Down: "giving a thumbs down",
  Victory: "making a peace sign",
  ILoveYou: "making an I-love-you sign",
};

export interface GestureInfo {
  name: string;
  label: string;
  confidence: number;
  timestamp: number;
}

export interface VisionState {
  /** Whether at least one face is currently detected */
  faceDetected: boolean;
  /** How long a face has been continuously present (ms) */
  facePresenceDurationMs: number;
  /** Number of faces currently visible */
  faceCount: number;
  /** Currently detected gestures (this frame) */
  currentGestures: GestureInfo[];
  /** Recent gesture history (last 30 seconds, deduplicated) */
  gestureHistory: GestureInfo[];
  /** Ref to attach to a <video> element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whether MediaPipe models are loaded and camera is ready */
  isReady: boolean;
  /** Any error that occurred during setup */
  error: string | null;
  /** Imperatively stop camera, detection, and release all resources */
  cleanup: () => void;
}

const VISION_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const GESTURE_HISTORY_TTL = 30_000; // keep gestures for 30s
const GESTURE_DEDUP_MS = 2_000; // don't re-add same gesture within 2s
const DETECTION_INTERVAL_MS = 100; // run detection every 100ms (~10fps detection)

export function useVisionDetection(): VisionState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);

  // Face tracking
  const faceStartRef = useRef<number | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [facePresenceDurationMs, setFacePresenceDurationMs] = useState(0);
  const [faceCount, setFaceCount] = useState(0);

  // Gesture tracking
  const [currentGestures, setCurrentGestures] = useState<GestureInfo[]>([]);
  const gestureHistoryRef = useRef<GestureInfo[]>([]);
  const [gestureHistory, setGestureHistory] = useState<GestureInfo[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize MediaPipe models and camera
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Load MediaPipe WASM runtime
        const vision = await FilesetResolver.forVisionTasks(VISION_CDN);

        if (cancelled) return;

        // 2. Create Face Detector — GPU-accelerated, fast
        const faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });

        if (cancelled) {
          faceDetector.close();
          return;
        }

        // 3. Create Gesture Recognizer — detects hand gestures
        const gestureRecognizer = await GestureRecognizer.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }
        );

        if (cancelled) {
          faceDetector.close();
          gestureRecognizer.close();
          return;
        }

        faceDetectorRef.current = faceDetector;
        gestureRecognizerRef.current = gestureRecognizer;

        // 4. Start camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          faceDetector.close();
          gestureRecognizer.close();
          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }

        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          console.error("Vision detection init error:", err);
          setError(
            err instanceof Error ? err.message : "Failed to initialize vision"
          );
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      // Cleanup
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      faceDetectorRef.current?.close();
      gestureRecognizerRef.current?.close();
    };
  }, []);

  // Detection loop — runs at DETECTION_INTERVAL_MS via rAF
  const detect = useCallback(() => {
    const video = videoRef.current;
    const faceDetector = faceDetectorRef.current;
    const gestureRecognizer = gestureRecognizerRef.current;

    if (
      !video ||
      !faceDetector ||
      !gestureRecognizer ||
      video.readyState < 2
    ) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    const now = performance.now();

    // Throttle detection to ~10fps for performance
    if (now - lastDetectionTimeRef.current < DETECTION_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }
    lastDetectionTimeRef.current = now;

    // ── Face Detection ──
    let faceResult: FaceDetectorResult | null = null;
    try {
      faceResult = faceDetector.detectForVideo(video, now);
    } catch {
      // MediaPipe can throw on timestamp issues; skip frame
    }

    const faces = faceResult?.detections?.length ?? 0;
    const hasFace = faces > 0;

    setFaceCount(faces);
    setFaceDetected(hasFace);

    if (hasFace) {
      if (faceStartRef.current === null) {
        faceStartRef.current = now;
      }
      setFacePresenceDurationMs(now - faceStartRef.current);
    } else {
      faceStartRef.current = null;
      setFacePresenceDurationMs(0);
    }

    // ── Gesture Recognition ──
    let gestureResult: GestureRecognizerResult | null = null;
    try {
      gestureResult = gestureRecognizer.recognizeForVideo(video, now);
    } catch {
      // skip frame
    }

    const frameGestures: GestureInfo[] = [];
    if (gestureResult?.gestures) {
      for (let i = 0; i < gestureResult.gestures.length; i++) {
        const gesture = gestureResult.gestures[i];
        if (gesture.length > 0) {
          const top = gesture[0];
          if (top.categoryName !== "None" && top.score > 0.6) {
            const info: GestureInfo = {
              name: top.categoryName,
              label:
                GESTURE_LABELS[top.categoryName] || top.categoryName,
              confidence: top.score,
              timestamp: Date.now(),
            };
            frameGestures.push(info);

            // Add to history if not duplicate
            const history = gestureHistoryRef.current;
            const isDuplicate = history.some(
              (g) =>
                g.name === info.name &&
                info.timestamp - g.timestamp < GESTURE_DEDUP_MS
            );
            if (!isDuplicate) {
              gestureHistoryRef.current = [
                ...history.filter(
                  (g) => Date.now() - g.timestamp < GESTURE_HISTORY_TTL
                ),
                info,
              ];
              setGestureHistory([...gestureHistoryRef.current]);
            }
          }
        }
      }
    }
    setCurrentGestures(frameGestures);

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  // Start detection loop once ready
  useEffect(() => {
    if (isReady) {
      rafRef.current = requestAnimationFrame(detect);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [isReady, detect]);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    faceDetectorRef.current?.close();
    faceDetectorRef.current = null;
    gestureRecognizerRef.current?.close();
    gestureRecognizerRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
    setFaceDetected(false);
    setFacePresenceDurationMs(0);
    setFaceCount(0);
    setCurrentGestures([]);
  }, []);

  return {
    faceDetected,
    facePresenceDurationMs,
    faceCount,
    currentGestures,
    gestureHistory,
    videoRef,
    isReady,
    error,
    cleanup,
  };
}

/** Build a context string from gesture history for the AI prompt */
export function buildGestureContext(gestures: GestureInfo[]): string {
  if (gestures.length === 0) return "";

  const recent = gestures
    .filter((g) => Date.now() - g.timestamp < 15_000) // last 15 seconds
    .map((g) => g.label);

  if (recent.length === 0) return "";

  const unique = [...new Set(recent)];
  return `\n\nUSER GESTURE DETECTION:\nThe camera has detected the user ${unique.join(", ")}. Respond naturally to these gestures — for example, if they waved, greet them warmly. If they gave a thumbs up, acknowledge it positively.`;
}
