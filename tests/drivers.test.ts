import { afterEach, describe, expect, it } from "vitest";
import { selectedDriver } from "@/server/drivers";

const saved = { DB_DRIVER: process.env.DB_DRIVER, VERCEL: process.env.VERCEL };

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("database selection", () => {
  it("runs on MongoDB locally", () => {
    delete process.env.DB_DRIVER;
    delete process.env.VERCEL;
    expect(selectedDriver()).toBe("mongodb");
  });

  it("runs on Firestore on the hosted (Vercel) deployment", () => {
    delete process.env.DB_DRIVER;
    process.env.VERCEL = "1";
    expect(selectedDriver()).toBe("firestore");
  });

  it("lets DB_DRIVER override either default", () => {
    process.env.VERCEL = "1";
    process.env.DB_DRIVER = "mongodb";
    expect(selectedDriver()).toBe("mongodb");
    delete process.env.VERCEL;
    process.env.DB_DRIVER = "firebase";
    expect(selectedDriver()).toBe("firestore");
    process.env.DB_DRIVER = "memory";
    expect(selectedDriver()).toBe("memory");
  });
});
