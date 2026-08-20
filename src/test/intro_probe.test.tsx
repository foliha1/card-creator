import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import DailyRoundIntro from "@/components/DailyRoundIntro";
import { landedRotationFor } from "@/components/MatchDie";

vi.mock("@/lib/sounds", () => ({ playDieLand: vi.fn() }));

function setReduced(on: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({ matches: on, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }),
  });
}

const cube = (c: HTMLElement) => {
  const els = Array.from(c.querySelectorAll<HTMLElement>("div")).filter((d) => d.style.transformStyle === "preserve-3d");
  return els[0];
};

describe("probe", () => {
  it("reduced motion: die face per round", () => {
    setReduced(true);
    const rounds = [
      { attribute: "shape" as const, faceIndex: 0 as const },
      { attribute: "color" as const, faceIndex: 1 as const },
      { attribute: "number" as const, faceIndex: 0 as const },
    ];
    const { container, rerender } = render(
      <DailyRoundIntro active roundIndex={1} attribute={rounds[0].attribute} faceIndex={rounds[0].faceIndex} tumbleSeed={7} />
    );
    rounds.forEach((r, i) => {
      rerender(<DailyRoundIntro active roundIndex={i + 1} attribute={r.attribute} faceIndex={r.faceIndex} tumbleSeed={7} />);
      const applied = cube(container)?.style.transform;
      console.log("round", i + 1, r.attribute, "applied:", applied, "expected:", landedRotationFor(r.attribute, r.faceIndex));
    });
    expect(true).toBe(true);
  });
});
