// Regression: under prefers-reduced-motion the round intro must still update
// the die to each round's own landed face. It previously bailed out of the
// rotation effect entirely, so rounds 2 and 3 kept round 1's face.

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import DailyRoundIntro from "@/components/DailyRoundIntro";
import { landedRotationFor } from "@/components/MatchDie";
import type { RollAttribute } from "@/lib/multiplayer";

vi.mock("@/lib/sounds", () => ({ playDieLand: vi.fn() }));

function setReduced(on: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: on,
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

function cubeTransform(container: HTMLElement): string | undefined {
  const el = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
    (d) => d.style.transformStyle === "preserve-3d"
  );
  return el?.style.transform;
}

const ROUNDS: { attribute: RollAttribute; faceIndex: 0 | 1 }[] = [
  { attribute: "SHAPE", faceIndex: 0 },
  { attribute: "COLOR", faceIndex: 1 },
  { attribute: "NUMBER", faceIndex: 0 },
];

describe("DailyRoundIntro die face", () => {
  it("shows each round's own face under reduced motion", () => {
    setReduced(true);
    const first = ROUNDS[0];
    const { container, rerender } = render(
      <DailyRoundIntro
        active
        roundIndex={1}
        attribute={first.attribute}
        faceIndex={first.faceIndex}
        tumbleSeed={7}
      />
    );

    ROUNDS.forEach((r, i) => {
      rerender(
        <DailyRoundIntro
          active
          roundIndex={i + 1}
          attribute={r.attribute}
          faceIndex={r.faceIndex}
          tumbleSeed={7}
        />
      );
      expect(cubeTransform(container)).toBe(
        landedRotationFor(r.attribute, r.faceIndex)
      );
    });
  });

  it("starts spun (not landed) for round 1 with motion enabled", () => {
    setReduced(false);
    const r = ROUNDS[1];
    const { container } = render(
      <DailyRoundIntro
        active
        roundIndex={1}
        attribute={r.attribute}
        faceIndex={r.faceIndex}
        tumbleSeed={7}
      />
    );
    expect(cubeTransform(container)).not.toBe(
      landedRotationFor(r.attribute, r.faceIndex)
    );
  });
});
