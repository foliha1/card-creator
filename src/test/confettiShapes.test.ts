import { describe, expect, it } from "vitest";
import {
  NORMALISED_BOX,
  SHAPE_SOURCES,
  normaliseMatrix,
  renderedBox,
} from "@/lib/confettiShapes";

describe("brand confetti shapes", () => {
  it("has exactly three shapes (no star)", () => {
    expect(SHAPE_SOURCES).toHaveLength(3);
  });

  it("normalises every path into one box, aspect preserved", () => {
    for (const { box } of SHAPE_SOURCES) {
      const r = renderedBox(box);
      expect(Math.max(r.w, r.h)).toBeCloseTo(NORMALISED_BOX, 3);
      expect(r.w / r.h).toBeCloseTo(box.w / box.h, 3);
    }
  });

  it("keeps rendered box areas within 20% of each other", () => {
    const areas = SHAPE_SOURCES.map(({ box }) => {
      const r = renderedBox(box);
      return r.w * r.h;
    });
    const min = Math.min(...areas);
    const max = Math.max(...areas);
    expect((max - min) / max).toBeLessThan(0.2);
  });

  it("centres each shape on its own bbox centre", () => {
    for (const { box } of SHAPE_SOURCES) {
      const [a, , , d, tx, ty] = normaliseMatrix(box);
      expect(tx).toBeCloseTo(-(box.x + box.w / 2) * a, 6);
      expect(ty).toBeCloseTo(-(box.y + box.h / 2) * d, 6);
    }
  });
});
