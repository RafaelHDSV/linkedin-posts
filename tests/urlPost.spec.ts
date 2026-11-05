import { describe, it, expect } from "vitest";
import { ehUrlPostUtilizavel } from "../src/scraper/urlPost.js";

describe("ehUrlPostUtilizavel", () => {
  it("aceita feed/update canonico", () => {
    expect(
      ehUrlPostUtilizavel(
        "https://www.linkedin.com/feed/update/urn:li:activity:7511455502107709440/",
      ),
    ).toBe(true);
  });

  it("aceita short link lnkd.in", () => {
    expect(ehUrlPostUtilizavel("https://lnkd.in/p/dQjvjxPg")).toBe(true);
  });

  it("rejeita vazio, relativo e esquemas invalidos", () => {
    expect(ehUrlPostUtilizavel("")).toBe(false);
    expect(ehUrlPostUtilizavel("   ")).toBe(false);
    expect(ehUrlPostUtilizavel("/feed/update/urn:li:activity:1")).toBe(false);
    expect(ehUrlPostUtilizavel("javascript:alert(1)")).toBe(false);
  });
});
