import { describe, expect, it } from "vitest";

import { mobileAppUrl } from "@/lib/mobile-app";

describe("lien de téléchargement de l'application", () => {
  it("accepte une adresse http(s), refuse le reste (encart masqué)", () => {
    expect(mobileAppUrl("https://drive.google.com/file/d/abc/view")).toBe(
      "https://drive.google.com/file/d/abc/view",
    );
    expect(mobileAppUrl("  http://192.168.1.20:3000/app.apk ")).toBe(
      "http://192.168.1.20:3000/app.apk",
    );
    expect(mobileAppUrl("")).toBeNull();
    expect(mobileAppUrl(undefined)).toBeNull();
    expect(mobileAppUrl("javascript:alert(1)")).toBeNull();
    expect(mobileAppUrl("pas une adresse")).toBeNull();
  });
});
