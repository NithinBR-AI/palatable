import { describe, it, expect } from "vitest";
import { buildTasteProfile } from "@/lib/extract/anchors";
import type { ExtractedAnchor } from "@/lib/extract/anchors";

function named(anchorText: string, participantId = "p-a"): ExtractedAnchor {
  return {
    participantId,
    participantName: participantId,
    anchorText,
    entityId: "qloo-123",
    entityType: "urn:entity:artist",
    vibeContext: "",
    confidence: 0.8,
  };
}

function vibe(anchorText: string, vibeContext: string, participantId = "p-a"): ExtractedAnchor {
  return {
    participantId,
    participantName: participantId,
    anchorText,
    entityId: "",
    entityType: "vibe",
    vibeContext,
    confidence: 0.6,
  };
}

describe("buildTasteProfile", () => {
  it("returns empty string for empty anchor list", () => {
    expect(buildTasteProfile([])).toBe("");
  });

  it("returns named entities only when no vibes", () => {
    const result = buildTasteProfile([named("Daft Punk"), named("Thundercat")]);
    expect(result).toBe("Daft Punk, Thundercat");
  });

  it("returns vibeContext when vibe anchor has one", () => {
    const result = buildTasteProfile([vibe("ramen spot", "craft ramen, intimate")]);
    expect(result).toBe("craft ramen, intimate");
  });

  it("falls back to anchorText when vibeContext is empty", () => {
    const anchor = vibe("rooftop bars", "");
    anchor.vibeContext = "";
    const result = buildTasteProfile([anchor]);
    expect(result).toBe("rooftop bars");
  });

  it("puts named entities before vibes", () => {
    const result = buildTasteProfile([
      vibe("rooftop bars", "rooftop bars"),
      named("Solange"),
    ]);
    // named first, then vibes
    expect(result.split(", ")[0]).toBe("Solange");
  });

  it("caps output at 5 items", () => {
    const anchors = [
      named("A"), named("B"), named("C"),
      vibe("D", "D"), vibe("E", "E"), vibe("F", "F"),
    ];
    const result = buildTasteProfile(anchors);
    expect(result.split(", ")).toHaveLength(5);
  });

  it("returns all items when exactly 5", () => {
    const anchors = [named("A"), named("B"), named("C"), named("D"), named("E")];
    const result = buildTasteProfile(anchors);
    expect(result.split(", ")).toHaveLength(5);
  });

  it("handles a single vibe anchor", () => {
    const result = buildTasteProfile([vibe("jazz bar", "low-light jazz listening room")]);
    expect(result).toBe("low-light jazz listening room");
  });

  it("handles a mix of multiple participants' anchors", () => {
    const anchors = [
      named("Fela Kuti", "p-aisha"),
      named("Nick Cave", "p-lena"),
      vibe("bookshop", "independent bookshops", "p-lena"),
    ];
    const result = buildTasteProfile(anchors);
    expect(result).toContain("Fela Kuti");
    expect(result).toContain("Nick Cave");
    expect(result).toContain("independent bookshops");
  });
});
