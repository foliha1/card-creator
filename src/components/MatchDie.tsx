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

// Landed cube rotation — chosen so the target face ends up facing the camera.
function landedRotation(attribute: RollAttribute, faceIndex: 0 | 1): string {
  if (attribute === "SHAPE")  return faceIndex === 0 ? "rotateY(0deg)"     : "rotateY(-180deg)";
  if (attribute === "NUMBER") return faceIndex === 0 ? "rotateY(-90deg)"   : "rotateY(90deg)";
  /* COLOR */                 return faceIndex === 0 ? "rotateX(-90deg)"   : "rotateX(90deg)";
}

// What each face reads. Opposite faces share an attribute; the label is the
// attribute name in the game's typographic voice.
const FACE_LABEL: Record<FaceKey, RollAttribute> = {
  front: "SHAPE",  back:   "SHAPE",
  right: "NUMBER", left:   "NUMBER",
  top:   "COLOR",  bottom: "COLOR",
};

const FACES: FaceKey[] = ["front", "back", "right", "left", "top", "bottom"];

export function MatchDie({ size, attribute, faceIndex }: MatchDieProps) {
  const sceneStyle: CSSProperties = {
    width: size,
    height: size,
    perspective: 420,
    // Slight tilt off-axis makes the 3D form legible even when landed square-
    // on. Applied on the scene (not the cube) so the "landed" rotation stays
    // clean and predictable.
    perspectiveOrigin: "50% 50%",
  };

  const cubeStyle: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    transformStyle: "preserve-3d",
    transform: `${landedRotation(attribute, faceIndex)}`,
    // No transition here — animation is a later prompt.
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
