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

  it("aceita URL /posts/ do LinkedIn", () => {
    expect(
      ehUrlPostUtilizavel(
        "https://www.linkedin.com/posts/rafael-vieira1720_cli-activity-7508918674624438273-AbCd",
      ),
    ).toBe(true);
  });

  it("rejeita vazio, relativo e esquemas invalidos", () => {
    expect(ehUrlPostUtilizavel("")).toBe(false);
    expect(ehUrlPostUtilizavel("   ")).toBe(false);
    expect(ehUrlPostUtilizavel("/feed/update/urn:li:activity:1")).toBe(false);
    expect(ehUrlPostUtilizavel("javascript:alert(1)")).toBe(false);
    expect(ehUrlPostUtilizavel("https://www.linkedin.com/in/rafael-vieira1720/")).toBe(false);
  });
});
