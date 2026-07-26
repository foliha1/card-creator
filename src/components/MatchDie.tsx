// ============================================================================
// MatchDie — a CSS 3D cube representing the match die. Six faces on a
// preserve-3d wrapper with perspective. No Three.js, no physics. This prompt
// renders statically at the correct landed rotation; animation lands later.
//
// Face pairing (opposite faces share an attribute so each attribute has
// exactly two clean landing rotations):
//   SHAPE   → front (faceIndex 0) / back (faceIndex 1)
//   NUMBER  → right (faceIndex 0) / left (faceIndex 1)
//   COLOR   → top   (faceIndex 0) / bottom (faceIndex 1)
//
// Rotation math: each face is placed with translateZ(size/2) and its own
// orientation. The cube's overall transform is the INVERSE of the target
// face's placement, so that face ends up parallel to the screen (landed).
// ============================================================================

import { CSSProperties } from "react";
import { COLORS, FONT_FAMILY } from "@/lib/tokens";
import type { RollAttribute } from "@/lib/multiplayer";

export interface MatchDieProps {
  size: number;
  attribute: RollAttribute;
  faceIndex: 0 | 1;
  // Optional override for the cube transform. When provided, replaces the
  // derived landed rotation — used by the roll-hero overlay to drive tumble.
  rotation?: string;
  // Optional CSS transition applied to the cube. Only used by the overlay;
  // for static renders leave undefined to keep the die inert.
  transition?: string;
}

type FaceKey = "front" | "back" | "right" | "left" | "top" | "bottom";

// Face placement — where each face sits on the cube. translateZ(size/2) pushes
// the face out to the cube surface; the rotate before it orients the face.
function facePlacement(key: FaceKey, size: number): string {
  const half = size / 2;
  switch (key) {
    case "front":  return `rotateY(0deg) translateZ(${half}px)`;
    case "back":   return `rotateY(180deg) translateZ(${half}px)`;
    case "right":  return `rotateY(90deg) translateZ(${half}px)`;
    case "left":   return `rotateY(-90deg) translateZ(${half}px)`;
    case "top":    return `rotateX(90deg) translateZ(${half}px)`;
    case "bottom": return `rotateX(-90deg) translateZ(${half}px)`;
  }
}

// Landed cube rotation as (x,y) degrees — decomposed so callers can add full
// spin turns without CSS matrix decomposition collapsing them.
export function landedComponentsFor(
  attribute: RollAttribute,
  faceIndex: 0 | 1,
): { x: number; y: number } {
  if (attribute === "SHAPE")  return { x: 0,   y: faceIndex === 0 ? 0   : -180 };
  if (attribute === "NUMBER") return { x: 0,   y: faceIndex === 0 ? -90 :   90 };
  /* COLOR */                 return { x: faceIndex === 0 ? -90 : 90, y: 0 };
}

// Landed cube rotation — chosen so the target face ends up facing the camera.
export function landedRotationFor(attribute: RollAttribute, faceIndex: 0 | 1): string {
  const { x, y } = landedComponentsFor(attribute, faceIndex);
  return `rotateX(${x}deg) rotateY(${y}deg)`;
}

// What each face reads. Opposite faces share an attribute; the label is the
// attribute name in the game's typographic voice.
const FACE_LABEL: Record<FaceKey, RollAttribute> = {
  front: "SHAPE",  back:   "SHAPE",
  right: "NUMBER", left:   "NUMBER",
  top:   "COLOR",  bottom: "COLOR",
};

const FACES: FaceKey[] = ["front", "back", "right", "left", "top", "bottom"];

export function MatchDie({ size, attribute, faceIndex, rotation, transition }: MatchDieProps) {
  const sceneStyle: CSSProperties = {
    width: size,
    height: size,
    perspective: 420,
    perspectiveOrigin: "50% 50%",
  };

  const cubeStyle: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    transformStyle: "preserve-3d",
    transform: rotation ?? landedRotationFor(attribute, faceIndex),
    transition,
    willChange: transition ? "transform" : undefined,
  };

  const faceBaseStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: size,
    height: size,
    backgroundColor: COLORS.surface,   // #F8F2E9
    border: `2px solid ${COLORS.ink}`, // #231F20
    borderRadius: 8,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.ink,
    fontFamily: FONT_FAMILY,
    fontWeight: 400,
    fontStyle: "italic",
    // Text scales with face size so the die reads at any size.
    fontSize: Math.round(size * 0.18),
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    userSelect: "none",
  };

  return (
    <div style={sceneStyle} aria-label={`Match die showing ${attribute}`}>
      <div style={cubeStyle}>
        {FACES.map((key) => (
          <div
            key={key}
            style={{
              ...faceBaseStyle,
              transform: facePlacement(key, size),
            }}
          >
            {FACE_LABEL[key]}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MatchDie;
