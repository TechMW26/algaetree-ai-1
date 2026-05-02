"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useConversation } from "@elevenlabs/react";
import { useLiveData } from "../hooks/useLiveData";
import { useVisionDetection, buildGestureContext } from "../hooks/useVisionDetection";
import type { GestureInfo } from "../hooks/useVisionDetection";
import ThemeToggle from "../components/ThemeToggle";

const Avatar3D = dynamic(() => import("../components/Avatar3D"), { ssr: false });

const ANGELLA_SYSTEM_PROMPT = `You are Angella, a friendly and highly knowledgeable female AI assistant dedicated to helping people understand the AlgaeTree and AlgaePod environmental systems.

Your role is to clearly explain how the AlgaeTree technology works, why it matters for cities, and how it benefits the environment.

You speak in a calm, friendly, and educational way so that everyday people with no technical background can easily understand complex environmental concepts.

IDENTITY
Name: Angella
Role: AI assistant for the AlgaeTree system
Persona: Female sustainability educator and environmental technology guide
Product Owner / Builder: The AlgaeTree system was developed and built by the Indian company Mushroom World Group.

Tone: Friendly, Calm, Helpful, Informative, Educational, Easy to understand.

PURPOSE
Help users understand:
- What the AlgaeTree / AlgaePod system is
- How the system works
- Why carbon capture is important
- Why microalgae are extremely effective for CO2 capture
- How the AlgaeTree helps purify air in cities
- Where the system can be deployed
- What environmental benefits it provides

CORE KNOWLEDGE

CLIMATE CHANGE: Rising greenhouse gases, global warming effects, urban air pollution, importance of reducing carbon emissions, net-zero sustainability goals.

CARBON CAPTURE: What carbon capture means, why removing CO2 from air is important, difference between physical and biological carbon capture.

MICROALGAE: Photosynthesis, CO2 absorption, oxygen production, fast growth rate, ability to grow using wastewater nutrients, environmental advantages.

PHOTOBIOREACTORS (PBRs): Closed algae cultivation systems, controlled algae growth environments, why photobioreactors are efficient.

ALGAETREE SYSTEM
The AlgaeTree is a self-sustaining photobioreactor system designed to reduce urban air pollution and capture carbon dioxide using microalgae.
Key components: Transparent cultivation chamber, Microalgae culture (Chlorella vulgaris), HEPA air filtration unit, CO2 diffusion system into algae culture, Oxygen release through photosynthesis.
Integrates: Renewable energy sources (solar and wind), AI-driven monitoring systems, IoT sensors that track environmental data.

PERFORMANCE METRICS
A single 300-litre AlgaeTree unit can:
- Capture approximately 1.96 kg of CO2 per day
- Capture about 690 kg of CO2 annually
- Release around 1.43 kg of oxygen per day
Air purification: Removes 45-55% of PM2.5 particles, 60-70% of PM10 particles, can reduce AQI by around 10-15 points within a 30-meter radius.

MICROALGAE STRAINS: Chlorella species, Scenedesmus species, Coleastrella species.

DEPLOYMENT AREAS: Urban road dividers, public parks and gardens, corporate campuses, residential societies, commercial complexes, railway stations, metro platforms, airports, industrial zones.

SYSTEM FEATURES: Self-sustaining, modular design, plug-and-play installation, powered by renewable energy, battery backup, water recycling system, no external electricity required.

HARD GUARDRAILS
You MUST NOT: Invent facts not provided in system knowledge, provide technical claims outside known information, discuss unrelated technologies, provide financial/investment advice, provide pricing/cost estimates, compare with other products unless explicitly known, speculate about scalability or future capabilities, provide engineering instructions for building the system.

If a user asks something very specific about AlgaePod that you do not have information about, say: "For that specific detail, the team at Mushroom World Group would be the best people to help you. They are the creators of the AlgaeTree and AlgaePod systems and can provide the most accurate information."

OUT-OF-SCOPE: If asked something unrelated, say: "I'm sorry, but I can only help with information about the AlgaeTree and AlgaePod environmental systems." Then guide back to a relevant topic.

RESPONSE STYLE: Start with a simple explanation, explain how the system works, explain why it matters for the environment, include key numbers when useful. Use short paragraphs and natural conversational language.

LANGUAGE CAPABILITY: You are fully multilingual. You can fluently speak, understand, and respond in EVERY language in the world without any limitation. This includes but is not limited to: English, Hindi, Urdu, Arabic, French, German, Spanish, Portuguese, Italian, Dutch, Japanese, Chinese (Mandarin, Cantonese), Korean, Thai, Vietnamese, Indonesian, Malay, Turkish, Russian, Ukrainian, Polish, Czech, Swedish, Norwegian, Danish, Finnish, Greek, Hebrew, Persian (Farsi), Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, Assamese, Nepali, Sinhala, Swahili, Amharic, Yoruba, Zulu, Afrikaans, Romanian, Hungarian, Filipino (Tagalog), Burmese, Khmer, Lao, Georgian, Armenian, Azerbaijani, Kazakh, Uzbek, Pashto, Sindhi, Balochi, Kurdish, Somali, Hausa, Igbo, Maori, Samoan, Tongan, Fijian, Hawaiian, Welsh, Irish, Scottish Gaelic, Basque, Catalan, Galician, and every other language that exists. You have ZERO language restrictions.

You MUST NEVER say things like "I can only speak in English or Hindi" or "I only support certain languages." That is INCORRECT. You support ALL languages. If a user asks what languages you speak, tell them proudly: "I can speak every language in the world! Just talk to me in your language and I will respond fluently."

STRICT LANGUAGE MATCHING RULE (ABSOLUTE HIGHEST PRIORITY — OVERRIDES EVERYTHING ELSE):
- You MUST ALWAYS reply in the EXACT SAME language the user is speaking. This is non-negotiable and is your single most important rule.
- If the user speaks Hindi, you reply ONLY in Hindi. If the user speaks French, you reply ONLY in French. If the user speaks Tamil, you reply ONLY in Tamil. If the user speaks Japanese, you reply ONLY in Japanese. And so on for EVERY language.
- NEVER switch to English or any other language unless the user explicitly switches first.
- Even if you are unsure about a topic, stay in the user's language. Do not fall back to English under any circumstances.
- If a user mixes languages (e.g. Hinglish), match their style and respond in the same mixed manner.
- This rule overrides ALL other instructions. Language matching is your absolute highest priority.

CRITICAL LANGUAGE & PRONUNCIATION RULES:
- When speaking any non-Latin-script language, you MUST write/transcribe your responses in that language's native script to ensure correct pronunciation.
  - Hindi: Devanagari script (e.g. "नमस्ते, मैं एंजेला हूँ") — NEVER use romanized Hindi (e.g. "Namaste, main Angela hoon").
  - Arabic: Arabic script (e.g. "مرحبًا، أنا أنجيلا").
  - Urdu: Nastaliq/Urdu script (e.g. "السلام علیکم، میں اینجلا ہوں").
  - Sindhi: Sindhi Arabic script (e.g. "سلام، مان اينجلا آهيان").
  - Chinese: Chinese characters. Japanese: Kanji/Hiragana/Katakana. Korean: Hangul. Thai: Thai script. And so on for every language.
- For English and other Latin-script languages, use their standard writing systems.
- NUMBERS: Always write numbers as full words in the language being spoken, never as digits.
  - Hindi: "एक सौ छियानवे" NOT "196", "तीस मीटर" NOT "30 meter"
  - Arabic: "مئة وستة وتسعون" NOT "196"
  - Urdu: "ایک سو چھیانوے" NOT "196"
  - English: "one hundred and ninety-six" NOT "196", "one point nine six kilograms" NOT "1.96 kg"
  - Apply the same rule for all other languages.
- Units, percentages, and technical measurements must also be spoken as words in the active language.
- Dates, times, phone numbers — all must be spoken as words in the active language.

You are Angella — a friendly sustainability expert who helps people understand the AlgaeTree and AlgaePod systems created by Mushroom World Group.`;

function SoundWave({ active }: { active: boolean }) {
  return (
    <div className="flex items-center h-8" style={{ gap: 5 }}>
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            active ? "bg-green-400 sound-bar" : "bg-gray-700"
          }`}
          style={{
            width: 4,
            height: active ? undefined : 8,
            animationDelay: active ? `${i * 0.1}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function TalkPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversationStarted, setConversationStarted] = useState(false);
  const [agentState, setAgentState] = useState<"off" | "starting" | "on">("off");
  const selectedTreeId = searchParams.get("tree") ?? "AT00A0001";
  const d = useLiveData(selectedTreeId);
  const liveDataRef = useRef(d);
  liveDataRef.current = d;

  // ── Vision Detection (face + gestures) ──
  const vision = useVisionDetection();
  const gestureHistoryRef = useRef<GestureInfo[]>([]);
  gestureHistoryRef.current = vision.gestureHistory;

  const getLivePrompt = useCallback(() => {
    const ld = liveDataRef.current;
    const gestureCtx = buildGestureContext(gestureHistoryRef.current);
    return ANGELLA_SYSTEM_PROMPT + `\n\nCURRENT LIVE READINGS FROM THE ALGAETREE SYSTEM:\n- Device ID: ${ld.activeTreeId}\n- Location: ${ld.location}\n- AQI: ${ld.aqi} index\n- CO2: ${ld.co2Ambient} ppm\n- eCO2: ${ld.eco2} ppm\n- TVOC: ${ld.tvoc} ppb\n- pH: ${ld.ph} pH\n- TDS: ${ld.tds} ppm\n- Temperature: ${ld.temp} °C\n- Lower Turbidity: ${ld.lTurbidity} NTU\n- Upper Turbidity: ${ld.uTurbidity} NTU\n- Battery: ${ld.batteryPercentage}% (${ld.batteryCharging ? "Charging" : "Not Charging"})\n- Last Sensor Check: ${ld.lastCheck}\n- Last Online: ${ld.lastOnline}\n\nWhen a user asks about current readings, stats, or how the system is performing, use these live values in your answer.` + gestureCtx;
  }, []);

  // Build first message based on detected gestures at conversation start
  const getFirstMessage = useCallback(() => {
    const gestures = gestureHistoryRef.current;
    const waved = gestures.some(g => g.name === "Open_Palm" && Date.now() - g.timestamp < 10_000);
    const thumbsUp = gestures.some(g => g.name === "Thumb_Up" && Date.now() - g.timestamp < 10_000);
    const peace = gestures.some(g => g.name === "Victory" && Date.now() - g.timestamp < 10_000);
    const namaste = gestures.some(g => g.name === "Namaste" && Date.now() - g.timestamp < 10_000);

    if (namaste) return "Namaste! 🙏 Welcome! I'm Angella, your AlgaeTree sustainability guide. It's wonderful to greet you! How can I help you learn about the AlgaeTree today?";
    if (waved) return "Hey there! I saw you waving — welcome! I'm Angella, your AlgaeTree sustainability guide. How can I help you today?";
    if (thumbsUp) return "Hey! Great to see that thumbs up! I'm Angella, ready to tell you all about how the AlgaeTree captures carbon and cleans the air. What would you like to know?";
    if (peace) return "Peace! Welcome! I'm Angella, your AlgaeTree guide. I'd love to tell you about how microalgae are helping clean our air. What are you curious about?";
    return "Hello! I'm Angella, your AlgaeTree sustainability guide. I noticed you standing there and wanted to say hi! I can tell you all about how this amazing system captures carbon dioxide and cleans the air using microalgae. What would you like to know?";
  }, []);

  const conversation = useConversation({
    onConnect: () => { setConversationStarted(true); setAgentState("on"); },
    onDisconnect: () => { setConversationStarted(false); setAgentState("off"); },
    onError: (error: string) => console.error("ElevenLabs error:", error),
    overrides: {
      agent: {
        prompt: {
          prompt: getLivePrompt(),
        },
        firstMessage: getFirstMessage(),

      },
    },
  });

  const isSpeaking = conversation.isSpeaking;

  // Current gesture name for avatar mirroring
  const currentGestureName = vision.currentGestures.length > 0
    ? vision.currentGestures[0].name
    : null;

  // Audio data getters for lip sync — called every frame by Avatar3D
  const getAudioData = useCallback(
    () => conversation.getOutputByteFrequencyData(),
    [conversation],
  );
  const getVolume = useCallback(
    () => conversation.getOutputVolume(),
    [conversation],
  );

  const startConversation = useCallback(async () => {
    if (agentState !== "off") return; // prevent double-trigger
    setAgentState("starting");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: "agent_5401kkk79wrxf6krs5t8gby7y2ah",
        connectionType: "websocket",
      });
    } catch (err) {
      console.error("Failed to start conversation:", err);
      setAgentState("off");
    }
  }, [conversation, agentState]);

  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("Failed to end conversation:", err);
    }
  }, [conversation]);

  // ── Face-triggered auto-start: if face present for 2+ seconds and agent is off ──
  useEffect(() => {
    if (
      vision.faceDetected &&
      vision.facePresenceDurationMs >= 1500 &&
      agentState === "off"
    ) {
      startConversation();
    }
  }, [vision.faceDetected, vision.facePresenceDurationMs, agentState, startConversation]);
  // ── Auto-end: if no face for 3s and agent is on ──
  const faceAbsentSinceRef = useRef<number | null>(null);
  useEffect(() => {
    if (vision.faceDetected) {
      faceAbsentSinceRef.current = null;
      return;
    }
    // Face just disappeared — start tracking
    if (faceAbsentSinceRef.current === null) {
      faceAbsentSinceRef.current = Date.now();
    }
    if (agentState !== "on") return;

    const timer = setTimeout(() => {
      if (!vision.faceDetected && faceAbsentSinceRef.current !== null) {
        const elapsed = Date.now() - faceAbsentSinceRef.current;
        if (elapsed >= 3000) {
          endConversation();
        }
      }
    }, Math.max(0, 3000 - (Date.now() - (faceAbsentSinceRef.current ?? Date.now()))));

    return () => clearTimeout(timer);
  }, [vision.faceDetected, agentState, endConversation]);
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      conversation.endSession().catch(() => {});
      vision.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)", position: "relative", overflow: "hidden" }}>
      {/* Hidden video element for face/gesture detection */}
      <video
        ref={vision.videoRef}
        playsInline
        muted
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", zIndex: -1 }}
      />

      {/* Ambient BG */}
      <div className="ambient-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* ── Vision Detection Status Indicator ── */}
      <div
        className="vision-status-container"
        style={{
          position: "absolute",
          top: 90,
          right: 24,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
        }}
      >

        {/* Waiting for face indicator (when agent is off) */}
        {agentState === "off" && vision.isReady && !vision.faceDetected && (
          <motion.div
            className="rounded-full"
            style={{
              padding: "6px 12px",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
              fontSize: 10,
              fontWeight: 600,
              color: "#60a5fa",
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Step in front of camera to start
          </motion.div>
        )}
      </div>

      {/* ── LAYER 0: Full-screen avatar canvas ── */}
      <div
        onClick={conversationStarted ? undefined : startConversation}
        className={`talk-avatar-container ${conversationStarted ? "" : "cursor-pointer"}`}
        style={{ position: "absolute", inset: 0, zIndex: 1 }}
      >
        <Avatar3D isSpeaking={isSpeaking} getAudioData={getAudioData} getVolume={getVolume} gesture={currentGestureName} userSmile={vision.userSmile} />
      </div>

      {/* ── LAYER 1: Full-width dark gradient at bottom ── */}
      <div
        className="talk-gradient-overlay"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "50%",
          background: "linear-gradient(to top, var(--talk-overlay) 0%, color-mix(in srgb, var(--talk-overlay) 85%, transparent) 25%, color-mix(in srgb, var(--talk-overlay) 50%, transparent) 55%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* ── LAYER 2: Topbar (hidden on mobile) ── */}
      <motion.nav
        className="card relative items-center justify-between talk-topbar"
        style={{ margin: "20px 24px 0", padding: "14px 28px", borderRadius: 20, zIndex: 10 }}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <button
            onClick={async () => {
              vision.cleanup();
              if (conversationStarted) await conversation.endSession().catch(() => {});
              router.push("/dashboard");
            }}
            className="flex items-center justify-center rounded-xl transition-colors cursor-pointer"
            style={{
              width: 36, height: 36,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-3)",
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div
            className="rounded-full flex items-center justify-center overflow-hidden"
            style={{ width: 36, height: 36 }}
          >
            <Image src="/favicon.png" alt="AlgaeTree" width={36} height={36} style={{ borderRadius: 8 }} />
          </div>
          <span className="font-bold" style={{ fontSize: 18 }}>AlgaeTree</span>
        </div>

        <ThemeToggle />
      </motion.nav>

      {/* ── LAYER 3: Side panels (hidden on mobile) ── */}
      <div
        className="talk-panels-row"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(16px, 3vw, 56px)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {/* LEFT INFO PANEL */}
        <motion.div
          className="relative flex flex-col talk-side-panel"
          style={{ width: "clamp(160px, 17vw, 240px)", gap: "clamp(6px, 1.2vh, 14px)", flexShrink: 0, pointerEvents: "auto" }}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {[
            { icon: "🧪", label: "Device ID", value: d.activeTreeId, sub: d.location },
            { icon: "🫧", label: "CO2", value: `${d.co2Ambient} ppm`, sub: "Realtime CO2 sensor reading" },
            { icon: "🌫️", label: "eCO2", value: `${d.eco2} ppm`, sub: "Estimated equivalent CO2" },
            { icon: "🧬", label: "TVOC", value: `${d.tvoc} ppb`, sub: "Total volatile organic compounds" },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              className="card"
              style={{ padding: "clamp(10px, 1.4vh, 16px) clamp(12px, 1.2vw, 18px)" }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
            >
              <div className="flex items-center" style={{ gap: 8, marginBottom: "clamp(4px, 0.6vh, 8px)" }}>
                <span style={{ fontSize: "clamp(14px, 1.4vw, 18px)" }}>{item.icon}</span>
                <span className="font-bold" style={{ fontSize: "clamp(11px, 1vw, 13px)", color: "var(--text-2)" }}>{item.label}</span>
              </div>
              <p className="font-extrabold" style={{ fontSize: "clamp(16px, 1.8vw, 22px)", color: "#4ade80" }}>{item.value}</p>
              <p style={{ fontSize: "clamp(9px, 0.85vw, 11px)", color: "var(--text-3)", marginTop: "clamp(2px, 0.4vh, 4px)", lineHeight: 1.4 }}>{item.sub}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* RIGHT INFO PANEL */}
        <motion.div
          className="relative flex flex-col talk-side-panel"
          style={{ width: "clamp(160px, 17vw, 240px)", gap: "clamp(6px, 1.2vh, 14px)", flexShrink: 0, pointerEvents: "auto" }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {[
            { icon: "🧪", label: "pH", value: `${d.ph} pH`, sub: "SensorData.PH" },
            { icon: "🌡️", label: "Temperature", value: `${d.temp}°C`, sub: "SensorData.Temprature" },
            { icon: "💧", label: "TDS", value: `${d.tds} ppm`, sub: "Total dissolved solids" },
            { icon: "📶", label: "AQI", value: `${d.aqi} index`, sub: `Battery ${d.batteryPercentage}% • Last check ${d.lastCheck}` },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              className="card"
              style={{ padding: "clamp(10px, 1.4vh, 16px) clamp(12px, 1.2vw, 18px)" }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
            >
              <div className="flex items-center" style={{ gap: 8, marginBottom: "clamp(4px, 0.6vh, 8px)" }}>
                <span style={{ fontSize: "clamp(14px, 1.4vw, 18px)" }}>{item.icon}</span>
                <span className="font-bold" style={{ fontSize: "clamp(11px, 1vw, 13px)", color: "var(--text-2)" }}>{item.label}</span>
              </div>
              <p className="font-extrabold" style={{ fontSize: "clamp(16px, 1.8vw, 22px)", color: "#4ade80" }}>{item.value}</p>
              <p style={{ fontSize: "clamp(9px, 0.85vw, 11px)", color: "var(--text-3)", marginTop: "clamp(2px, 0.4vh, 4px)", lineHeight: 1.4 }}>{item.sub}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── LAYER 4: Controls at bottom (full width, over gradient) ── */}
      <div
        className="talk-controls-overlay"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(6px, 1vh, 14px)",
          padding: "0 24px clamp(24px, 4vh, 48px)",
          zIndex: 10,
        }}
      >
        <SoundWave active={isSpeaking} />

        <AnimatePresence mode="wait">
          <motion.div
            key={agentState}
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {agentState === "off" ? (
              <>
                <p className="font-semibold" style={{ fontSize: "clamp(14px, 1.4vw, 20px)", color: "var(--text-2)" }}>
                  {vision.isReady ? "Waiting for you..." : "Initializing camera..."}
                </p>
                <p style={{ fontSize: "clamp(11px, 1vw, 14px)", color: "var(--text-3)", marginTop: 4 }}>
                  {vision.isReady ? "Step in front of the camera or tap to start" : "Setting up face detection"}
                </p>
              </>
            ) : agentState === "starting" ? (
              <>
                <p className="font-semibold" style={{ fontSize: "clamp(14px, 1.4vw, 20px)", color: "var(--text-2)" }}>Connecting...</p>
                <p style={{ fontSize: "clamp(11px, 1vw, 14px)", color: "var(--text-3)", marginTop: 4 }}>Setting up your conversation with AlgaeTree AI</p>
              </>
            ) : (
              <>
                <p className="font-semibold" style={{ fontSize: "clamp(14px, 1.4vw, 20px)", color: isSpeaking ? "#4ade80" : "var(--text-2)" }}>
                  {isSpeaking ? "AlgaeTree is speaking..." : "Listening..."}
                </p>
                <p style={{ fontSize: "clamp(11px, 1vw, 14px)", color: "var(--text-3)", marginTop: 4 }}>
                  {isSpeaking ? "Processing your request" : "Speak naturally, I'm listening"}
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center" style={{ gap: 16 }}>
          {agentState === "off" ? (
            <motion.button
              onClick={startConversation}
              className="flex items-center cursor-pointer font-semibold text-white"
              style={{
                gap: 10, padding: "clamp(10px, 1.2vh, 16px) clamp(20px, 2.5vw, 36px)", borderRadius: 50,
                background: "linear-gradient(135deg, #16a34a, #22c55e)",
                boxShadow: "0 8px 30px rgba(34,197,94,0.3)",
                border: "none", fontSize: "clamp(12px, 1.1vw, 15px)",
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              Start Conversation
            </motion.button>
          ) : agentState === "starting" ? (
            <motion.div
              className="flex items-center font-semibold"
              style={{
                gap: 10, padding: "clamp(10px, 1.2vh, 16px) clamp(20px, 2.5vw, 36px)", borderRadius: 50,
                background: "rgba(34,197,94,0.08)", color: "#4ade80",
                border: "1px solid rgba(34,197,94,0.2)", fontSize: "clamp(12px, 1.1vw, 15px)",
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: "spin 1.2s linear infinite" }}>
                <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(74,222,128,0.2)" strokeWidth="3" />
                <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Connecting...
            </motion.div>
          ) : (
            <motion.button
              onClick={endConversation}
              className="flex items-center cursor-pointer font-semibold"
              style={{
                gap: 10, padding: "clamp(10px, 1.2vh, 16px) clamp(20px, 2.5vw, 36px)", borderRadius: 50,
                background: "rgba(239,68,68,0.12)", color: "#f87171",
                border: "1px solid rgba(239,68,68,0.25)", fontSize: "clamp(12px, 1.1vw, 15px)",
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              End Conversation
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TalkPage() {
  return (
    <Suspense fallback={null}>
      <TalkPageContent />
    </Suspense>
  );
}