"use client";

import {
  ContactShadows,
  OrbitControls,
  RoundedBox,
  Sparkles,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

// ─── Constants ──────────────────────────────────────────────────
const BOX_W = 3.6;
const BOX_H = 0.6;
const BOX_D = 2.6;
const LID_THICKNESS = 0.09;
const WALL_THICKNESS = 0.06;
const OPEN_ANGLE = (-115 * Math.PI) / 180;
const LERP_SPEED = 3;

const COLORS = {
  boxOuter: "#4a1a1a",
  boxInner: "#2a0e0e",
  lidTop: "#3d1515",
  gold: "#e8c16a",
  goldBright: "#fbbf24",
  crimson: "#ef4444",
  crimsonDeep: "#b91c1c",
};

// ─── Font Loading ───────────────────────────────────────────────
const FONT_TITLE = "Cinzel";
const FONT_SUBTITLE = "Crimson Text";
const FONT_TITLE_STACK = `"${FONT_TITLE}", "Palatino Linotype", "Book Antiqua", Palatino, serif`;
const FONT_SUBTITLE_STACK = `"${FONT_SUBTITLE}", "Palatino Linotype", Georgia, serif`;

function useFontsLoaded() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Crimson+Text:ital,wght@1,600&display=swap";
    link.rel = "stylesheet";

    link.onload = () => {
      Promise.all([
        document.fonts.load(`900 48px "${FONT_TITLE}"`),
        document.fonts.load(`italic 600 24px "${FONT_SUBTITLE}"`),
      ])
        .then(() => setLoaded(true))
        .catch(() => setLoaded(true));
    };
    link.onerror = () => setLoaded(true);

    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return loaded;
}

// ─── SVG Icon Components ────────────────────────────────────────
function MagnifyingGlassIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function MicroscopeIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 18h8" />
      <path d="M3 22h18" />
      <path d="M14 22a7 7 0 1 0 0-14h-1" />
      <path d="M9 14h2" />
      <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
      <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
    </svg>
  );
}

function KnifeIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 2l10 10" />
      <path d="M16.2 3.8a2.83 2.83 0 0 0-4 0L3.8 12.2a2.83 2.83 0 0 0 0 4l4 4a2.83 2.83 0 0 0 4 0l8.4-8.4a2.83 2.83 0 0 0 0-4z" />
      <path d="m19 5 2-2" />
    </svg>
  );
}

function DetectiveIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
      <path d="M12 3v1" />
      <path d="M6.5 5L8 6.5" />
      <path d="M17.5 5L16 6.5" />
    </svg>
  );
}

function HandshakeIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-2" />
      <path d="M3 3 2 14h2" />
      <path d="m3 4 2.71.71a2 2 0 0 0 1.42-.25l.47-.28a5.79 5.79 0 0 1 4.4-.78" />
    </svg>
  );
}

function EyeIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevronRightIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ─── SVG Drawing for Canvas Textures ────────────────────────────
function drawMagnifyingGlass(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.08;
  ctx.lineCap = "round";

  const r = size * 0.33;
  ctx.beginPath();
  ctx.arc(cx - size * 0.08, cy - size * 0.08, r, 0, Math.PI * 2);
  ctx.stroke();

  const offset = r * 0.707;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.08 + offset, cy - size * 0.08 + offset);
  ctx.lineTo(cx + size * 0.38, cy + size * 0.38);
  ctx.stroke();

  ctx.restore();
}

// ─── Canvas Text Texture ────────────────────────────────────────
function createTextTexture(
  lines: {
    text: string;
    color: string;
    fontSize: number;
    fontFamily?: string;
    weight?: string;
    italic?: boolean;
    letterSpacing?: number;
    isIcon?: boolean;
    drawIcon?: (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      size: number,
      color: string,
    ) => void;
  }[],
  width: number,
  height: number,
  options?: {
    bg?: string;
    border?: { color: string; width: number; inset: number; opacity: number };
  },
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const dpr = 3;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  if (options?.bg) {
    ctx.fillStyle = options.bg;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  if (options?.border) {
    const b = options.border;
    ctx.save();
    ctx.globalAlpha = b.opacity;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.width;
    ctx.strokeRect(b.inset, b.inset, width - b.inset * 2, height - b.inset * 2);
    ctx.restore();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const totalHeight = lines.reduce((sum, l) => sum + l.fontSize * 1.6, 0);
  let y = (height - totalHeight) / 2;

  for (const line of lines) {
    y += line.fontSize * 0.8;

    if (line.isIcon && line.drawIcon) {
      line.drawIcon(ctx, width / 2, y, line.fontSize, line.color);
    } else {
      const weight = line.weight || "normal";
      const style = line.italic ? "italic" : "normal";
      const family = line.fontFamily || '"Segoe UI", system-ui, sans-serif';
      ctx.font = `${style} ${weight} ${line.fontSize}px ${family}`;
      ctx.fillStyle = line.color;

      if (line.letterSpacing && line.letterSpacing > 0) {
        const chars = line.text.split("");
        const charWidths = chars.map((c) => ctx.measureText(c).width);
        const totalW =
          charWidths.reduce((a, b) => a + b, 0) +
          (chars.length - 1) * line.letterSpacing;
        let x = (width - totalW) / 2;
        for (let i = 0; i < chars.length; i++) {
          ctx.fillText(chars[i], x + charWidths[i] / 2, y);
          x += charWidths[i] + line.letterSpacing;
        }
      } else {
        ctx.fillText(line.text, width / 2, y);
      }
    }

    y += line.fontSize * 0.8;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ─── Lid Texture ────────────────────────────────────────────────
function useLidTexture(fontsLoaded: boolean) {
  return useMemo(() => {
    return createTextTexture(
      [
        {
          text: "",
          color: COLORS.gold,
          fontSize: 36,
          isIcon: true,
          drawIcon: drawMagnifyingGlass,
        },
        { text: " ", color: "transparent", fontSize: 8 },
        {
          text: "DECEPTION",
          color: COLORS.gold,
          fontSize: 52,
          weight: "900",
          fontFamily: FONT_TITLE_STACK,
          letterSpacing: 6,
        },
        {
          text: "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
          color: COLORS.crimson,
          fontSize: 12,
        },
        {
          text: "Murder in Hong Kong",
          color: COLORS.crimson,
          fontSize: 27,
          weight: "600",
          italic: true,
          fontFamily: FONT_SUBTITLE_STACK,
        },
      ],
      512,
      400,
      {
        border: {
          color: COLORS.gold,
          width: 1.5,
          inset: 15,
          opacity: 0.25,
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);
}

// ─── Inner Card Texture ─────────────────────────────────────────
function useCardTexture(fontsLoaded: boolean) {
  return useMemo(() => {
    return createTextTexture(
      [
        {
          text: "",
          color: COLORS.gold,
          fontSize: 26,
          isIcon: true,
          drawIcon: drawMagnifyingGlass,
        },
        { text: " ", color: "transparent", fontSize: 6 },
        {
          text: "DECEPTION",
          color: COLORS.gold,
          fontSize: 36,
          weight: "900",
          fontFamily: FONT_TITLE_STACK,
          letterSpacing: 4,
        },
        {
          text: "\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501",
          color: `${COLORS.crimson}88`,
          fontSize: 10,
        },
        {
          text: "Murder in Hong Kong",
          color: COLORS.crimson,
          fontSize: 19,
          weight: "600",
          italic: true,
          fontFamily: FONT_SUBTITLE_STACK,
        },
        { text: " ", color: "transparent", fontSize: 20 },
        {
          text: "Can you uncover the truth\u2026",
          color: "#ffffff55",
          fontSize: 13,
          italic: true,
          fontFamily: FONT_SUBTITLE_STACK,
        },
        {
          text: "or get away with murder?",
          color: "#ffffff55",
          fontSize: 13,
          italic: true,
          fontFamily: FONT_SUBTITLE_STACK,
        },
      ],
      400,
      500,
      {
        bg: "#0d0405",
        border: { color: COLORS.gold, width: 1.5, inset: 10, opacity: 0.2 },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);
}

// ─── Box Lid ────────────────────────────────────────────────────
function BoxLid({
  isOpen,
  onToggle,
  fontsLoaded,
}: {
  isOpen: boolean;
  onToggle: () => void;
  fontsLoaded: boolean;
}) {
  const pivotRef = useRef<THREE.Group>(null!);
  const lidTexture = useLidTexture(fontsLoaded);

  useFrame((_, delta) => {
    if (!pivotRef.current) return;
    const target = isOpen ? OPEN_ANGLE : 0;
    pivotRef.current.rotation.x = THREE.MathUtils.lerp(
      pivotRef.current.rotation.x,
      target,
      1 - Math.exp(-LERP_SPEED * delta * 4),
    );
  });

  return (
    <group
      position={[0, BOX_H / 2, -BOX_D / 2]}
      ref={pivotRef}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <group position={[0, LID_THICKNESS / 2, BOX_D / 2]}>
        <RoundedBox
          args={[BOX_W, LID_THICKNESS, BOX_D]}
          radius={0.03}
          smoothness={4}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={COLORS.lidTop}
            roughness={0.7}
            metalness={0.1}
          />
        </RoundedBox>

        <mesh
          position={[0, LID_THICKNESS / 2 + 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[BOX_W - 0.25, BOX_D - 0.25]} />
          <meshStandardMaterial
            map={lidTexture}
            transparent
            roughness={0.35}
            metalness={0.55}
            emissive={COLORS.gold}
            emissiveIntensity={0.12}
          />
        </mesh>

        <mesh
          position={[0, -LID_THICKNESS / 2 + 0.001, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[BOX_W - 0.1, BOX_D - 0.1]} />
          <meshStandardMaterial color={COLORS.boxInner} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Inner Card (lies flat in box, rises on tap) ────────────────
function InnerCard({
  isOpen,
  cardTapped,
  fontsLoaded,
  onCardReady,
  onTapCard,
}: {
  isOpen: boolean;
  cardTapped: boolean;
  fontsLoaded: boolean;
  onCardReady: () => void;
  onTapCard: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const cardTexture = useCardTexture(fontsLoaded);
  const phaseRef = useRef<0 | 1 | 2>(0);
  const readyFiredRef = useRef(false);

  const CARD_W = BOX_W * 0.7;
  const CARD_H = BOX_D * 0.75;
  const START_Y = -BOX_H / 2 + WALL_THICKNESS + 0.025;
  const START_ROT_X = -Math.PI / 2;
  const TARGET_Y = 2.4;
  const TARGET_ROT_X = -0.05;
  const TARGET_SCALE = 1.5;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;

    // When box is closed, card rests inside
    if (!isOpen || !cardTapped) {
      phaseRef.current = 0;
      readyFiredRef.current = false;
      const t = 1 - Math.exp(-3.5 * delta);
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        START_Y,
        t,
      );
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        START_ROT_X,
        t,
      );
      meshRef.current.scale.setScalar(
        THREE.MathUtils.lerp(meshRef.current.scale.x, 1, t),
      );
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, 1, t);
      return;
    }

    // Card tapped — rise out
    if (phaseRef.current === 0) {
      phaseRef.current = 1;
    }

    if (phaseRef.current === 1) {
      const t = 1 - Math.exp(-2.2 * delta);
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        TARGET_Y,
        t,
      );
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        TARGET_ROT_X,
        t,
      );
      meshRef.current.scale.setScalar(
        THREE.MathUtils.lerp(meshRef.current.scale.x, TARGET_SCALE, t),
      );

      if (
        Math.abs(meshRef.current.position.y - TARGET_Y) < 0.5 &&
        !readyFiredRef.current
      ) {
        readyFiredRef.current = true;
        onCardReady();
        phaseRef.current = 2;
      }
    }

    // Fade out as HTML overlay appears
    if (phaseRef.current === 2) {
      const t = 1 - Math.exp(-3 * delta);
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        TARGET_Y,
        t,
      );
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        TARGET_ROT_X,
        t,
      );
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, t);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, START_Y, 0]}
      rotation={[START_ROT_X, 0, 0]}
      onClick={(e) => {
        if (isOpen) {
          e.stopPropagation();
          if (!cardTapped) onTapCard();
        }
      }}
    >
      <planeGeometry args={[CARD_W, CARD_H]} />
      <meshStandardMaterial
        map={cardTexture}
        roughness={0.6}
        metalness={0.1}
        transparent
        opacity={1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Box Body ───────────────────────────────────────────────────
function BoxBody({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const topClip = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, -1, 0), BOX_H / 2 - 0.005),
    [],
  );

  return (
    <group
      onClick={(e) => {
        if (!isOpen) {
          e.stopPropagation();
          onToggle();
        }
      }}
    >
      <RoundedBox
        args={[BOX_W, BOX_H, BOX_D]}
        radius={0.03}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={COLORS.boxOuter}
          roughness={0.7}
          metalness={0.1}
          clippingPlanes={[topClip]}
        />
      </RoundedBox>
      <mesh position={[0, WALL_THICKNESS / 2, 0]}>
        <boxGeometry
          args={[
            BOX_W - WALL_THICKNESS * 2,
            BOX_H - WALL_THICKNESS,
            BOX_D - WALL_THICKNESS * 2,
          ]}
        />
        <meshStandardMaterial
          color={COLORS.boxInner}
          roughness={0.9}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// ─── Responsive Camera ──────────────────────────────────────────
function ResponsiveCamera() {
  const { camera, size } = useThree();

  useFrame(() => {
    const aspect = size.width / size.height;
    let targetZ = 5.5;
    let targetY = 3.5;

    if (aspect < 0.7) {
      targetZ = 7.5;
      targetY = 4.8;
    } else if (aspect < 1) {
      targetZ = 6.5;
      targetY = 4.0;
    }

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.05);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ─── Scene ──────────────────────────────────────────────────────
function Scene({
  isOpen,
  cardTapped,
  toggle,
  fontsLoaded,
  onCardReady,
  onTapCard,
}: {
  isOpen: boolean;
  cardTapped: boolean;
  toggle: () => void;
  fontsLoaded: boolean;
  onCardReady: () => void;
  onTapCard: () => void;
}) {
  return (
    <>
      <ResponsiveCamera />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3}
        maxDistance={10}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.3}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
      />

      <ambientLight intensity={0.6} color="#ffeedd" />
      <directionalLight
        position={[2, 5, 4]}
        intensity={2.5}
        color="#fff8ee"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-3, 3, 1]} intensity={0.8} color="#ffe8d0" />
      <pointLight
        position={[0, 2, -3]}
        intensity={1.5}
        color={COLORS.crimson}
        distance={8}
      />
      <pointLight
        position={[3, 1, 2]}
        intensity={0.6}
        color={COLORS.goldBright}
        distance={6}
      />

      <group>
        <BoxBody isOpen={isOpen} onToggle={toggle} />
        <BoxLid isOpen={isOpen} onToggle={toggle} fontsLoaded={fontsLoaded} />
        <InnerCard
          isOpen={isOpen}
          cardTapped={cardTapped}
          fontsLoaded={fontsLoaded}
          onCardReady={onCardReady}
          onTapCard={onTapCard}
        />
      </group>

      <ContactShadows
        position={[0, -BOX_H / 2 - 0.01, 0]}
        opacity={0.5}
        scale={12}
        blur={2}
        far={4}
        color="#200a0a"
      />

      <Sparkles
        count={40}
        size={1.5}
        scale={[10, 6, 10]}
        position={[0, 2, 0]}
        speed={0.3}
        opacity={0.2}
        color={COLORS.gold}
      />
      <Sparkles
        count={20}
        size={1}
        scale={[8, 4, 8]}
        position={[0, 1, 0]}
        speed={0.2}
        opacity={0.12}
        color={COLORS.crimson}
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -BOX_H / 2 - 0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a0808" roughness={0.95} />
      </mesh>
    </>
  );
}

// ─── Game Roles ─────────────────────────────────────────────────
const ROLES: {
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  name: string;
  desc: string;
  color: string;
}[] = [
  {
    icon: MicroscopeIcon,
    name: "Forensic Scientist",
    desc: "Leads the investigation with cryptic clues",
    color: "#fbbf24",
  },
  {
    icon: KnifeIcon,
    name: "Murderer",
    desc: "Hiding in plain sight among you",
    color: "#ef4444",
  },
  {
    icon: DetectiveIcon,
    name: "Investigators",
    desc: "Piece together the evidence to find the killer",
    color: "#94a3b8",
  },
  {
    icon: HandshakeIcon,
    name: "Accomplice",
    desc: "Secretly protecting the murderer",
    color: "#b91c1c",
  },
  {
    icon: EyeIcon,
    name: "Witness",
    desc: "Knows the killer but can\u2019t reveal too much",
    color: "#a78bfa",
  },
];

// ─── HTML Card Overlay ──────────────────────────────────────────
function CardOverlay({
  show,
  onClose,
  onBeginInvestigation,
}: {
  show: boolean;
  onClose: () => void;
  onBeginInvestigation: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setVisible(true), 150);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [show]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease-out",
      }}
    >
      <div
        className={visible ? "pointer-events-auto" : "pointer-events-none"}
        style={{
          width: "100%",
          maxWidth: "24rem",
          transform: visible
            ? "scale(1) translateY(0)"
            : "scale(0.5) translateY(-15vh)",
          opacity: visible ? 1 : 0,
          transition:
            "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease-out",
        }}
      >
        <div
          className="relative overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background: "linear-gradient(145deg, #1a0a0a 0%, #0a0505 100%)",
            borderColor: "rgba(220, 38, 38, 0.3)",
            boxShadow:
              "0 0 60px rgba(220, 38, 38, 0.15), 0 20px 60px rgba(0,0,0,0.8)",
          }}
        >
          {/* Top glow */}
          <div
            className="absolute top-0 right-0 left-0 h-32 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.4), transparent 70%)",
            }}
          />

          {/* Gold engraved X close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-90"
            style={{
              background: "linear-gradient(145deg, #b8860b, #8b6914)",
              border: "1px solid rgba(251, 191, 36, 0.5)",
              boxShadow:
                "0 0 10px rgba(251, 191, 36, 0.2), inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -1px 1px rgba(0,0,0,0.3)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a0a0a"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter: "drop-shadow(0 0 1px rgba(251,191,36,0.6))",
              }}
            >
              <path d="M18 6L6 18M6 6L18 18" />
            </svg>
          </button>

          <div className="relative p-6">
            {/* Header */}
            <div className="mb-5 text-center">
              <MagnifyingGlassIcon
                className="mx-auto mb-1 h-7 w-7"
                style={{ color: COLORS.gold }}
              />
              <h2
                className="text-2xl font-bold tracking-[0.2em]"
                style={{
                  color: COLORS.gold,
                  fontFamily: FONT_TITLE_STACK,
                }}
              >
                DECEPTION
              </h2>
              <div
                className="mx-auto my-2 h-px w-40"
                style={{
                  background: `linear-gradient(90deg, transparent, ${COLORS.crimson}, transparent)`,
                }}
              />
              <p
                className="text-sm font-semibold tracking-wide"
                style={{
                  color: COLORS.crimson,
                  fontFamily: FONT_SUBTITLE_STACK,
                  fontStyle: "italic",
                }}
              >
                Murder in Hong Kong
              </p>
            </div>

            {/* Flavor */}
            <p
              className="mb-5 text-center text-sm italic leading-relaxed text-white/50"
              style={{ fontFamily: FONT_SUBTITLE_STACK }}
            >
              A game of deduction &amp; deception for 4&ndash;12 players.
              <br />
              One of you is the murderer. Can you uncover the truth&hellip;
              <br />
              or get away with murder?
            </p>

            {/* Roles */}
            <div className="space-y-2.5">
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <div
                    key={r.name}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <Icon
                      className="h-5 w-5 shrink-0"
                      style={{ color: r.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: r.color }}
                      >
                        {r.name}
                      </div>
                      <div className="text-xs text-white/35">{r.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tags */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {["~20 min", "Social Deduction", "Hidden Roles"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: "rgba(251,191,36,0.1)",
                    color: COLORS.goldBright,
                    border: "1px solid rgba(251,191,36,0.15)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Begin Investigation button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBeginInvestigation();
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #dc2626, #991b1b)",
                boxShadow: "0 0 30px rgba(220,38,38,0.25)",
              }}
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              Begin the Investigation
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tap Hints ──────────────────────────────────────────────────
function TapHint({ visible, text }: { visible: boolean; text: string }) {
  return (
    <div
      className="pointer-events-none absolute bottom-8 right-0 left-0 flex justify-center transition-opacity duration-1000"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="rounded-full border border-[#dc2626]/30 bg-[#1a0505]/80 px-5 py-2.5 backdrop-blur-sm">
        <span className="text-xs uppercase tracking-widest text-[#e8c16a]/80">
          {text}
        </span>
      </div>
    </div>
  );
}

// ─── Main Scene Component ───────────────────────────────────────
export default function DeceptionBoxScene({
  onBeginInvestigation,
}: {
  onBeginInvestigation: () => void;
}) {
  const [fadeIn, setFadeIn] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [cardTapped, setCardTapped] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCardHint, setShowCardHint] = useState(false);
  const fontsLoaded = useFontsLoaded();

  // Open/close the lid
  const toggleLid = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        // Closing — reset card state
        setCardTapped(false);
        setShowOverlay(false);
        setShowCardHint(false);
      } else {
        // Opening — show card hint after a delay
        setTimeout(() => setShowCardHint(true), 1200);
      }
      return !prev;
    });
    setShowHint(false);
  }, []);

  // User taps on the card inside the box
  const onTapCard = useCallback(() => {
    setCardTapped(true);
    setShowCardHint(false);
  }, []);

  // 3D card finished rising → show HTML overlay
  const onCardReady = useCallback(() => {
    setShowOverlay(true);
  }, []);

  // Close overlay (user tapped outside card area) → sequenced close:
  // 1. Fade out HTML overlay, 2. Card descends into box, 3. Lid closes
  const closeOverlay = useCallback(() => {
    // Step 1: Hide the static HTML card overlay
    setShowOverlay(false);
    setShowCardHint(false);

    // Step 2: After overlay fades (~500ms), put the 3D card back in the box
    setTimeout(() => {
      setCardTapped(false);

      // Step 3: After card settles back (~800ms), close the lid
      setTimeout(() => {
        setIsOpen(false);
      }, 800);
    }, 500);
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeIn(true), 100);
    const t2 = setTimeout(() => setShowHint(false), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      className="relative h-dvh w-full overflow-hidden transition-opacity duration-1000"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #2a0e0e 0%, #1a0808 50%, #0d0404 100%)",
        opacity: fadeIn ? 1 : 0,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center">
            <div className="animate-pulse text-sm uppercase tracking-widest text-[#e8c16a]/50">
              Loading scene&hellip;
            </div>
          </div>
        }
      >
        <Canvas
          shadows
          camera={{
            position: [0, 3.5, 5.5],
            fov: 45,
            near: 0.1,
            far: 50,
          }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
          }}
          style={{ touchAction: "none" }}
          onPointerDown={() => setShowHint(false)}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
          }}
        >
          <fog attach="fog" args={["#0d0404", 10, 25]} />
          <Scene
            isOpen={isOpen}
            cardTapped={cardTapped}
            toggle={toggleLid}
            fontsLoaded={fontsLoaded}
            onCardReady={onCardReady}
            onTapCard={onTapCard}
          />
        </Canvas>
      </Suspense>

      <CardOverlay
        show={showOverlay}
        onClose={closeOverlay}
        onBeginInvestigation={onBeginInvestigation}
      />

      {!isOpen && <TapHint visible={showHint} text="Tap the box to open" />}
      {isOpen && !cardTapped && (
        <TapHint visible={showCardHint} text="Tap the card to read it" />
      )}
    </div>
  );
}
