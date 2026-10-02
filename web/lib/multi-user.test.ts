import { describe, it, expect, vi, beforeEach } from "vitest";
import { signJwtToken, verifyJwtToken, extractTokenFromRequest, verifySemesterOwnership, verifyCourseOwnership, verifySlotOwnership } from "./auth";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

// Mock prisma for unit isolation tests
vi.mock("./prisma", () => ({
  prisma: {
    semester: {
      findUnique: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
    },
    classSlot: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Multi-User Authentication & Isolation Tests", () => {
  describe("JWT Generation & Verification", () => {
    it("signs and verifies a valid JWT payload", async () => {
      const payload = { id: "user-abc-123", studentId: "202100123" };
      const token = await signJwtToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const decoded = await verifyJwtToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe("user-abc-123");
      expect(decoded?.studentId).toBe("202100123");
    });

    it("rejects an invalid or tampered JWT token", async () => {
      const validToken = await signJwtToken({ id: "user-1", studentId: "202100456" });
      const tamperedToken = validToken.slice(0, -5) + "abcde";

      const decoded = await verifyJwtToken(tamperedToken);
      expect(decoded).toBeNull();
    });
  });

  describe("Token Extraction from Request", () => {
    it("extracts token from Authorization: Bearer header", () => {
      const req = new NextRequest("http://localhost:3000/api/semesters", {
        headers: {
          authorization: "Bearer my-secret-jwt-token",
        },
      });

      const token = extractTokenFromRequest(req);
      expect(token).toBe("my-secret-jwt-token");
    });

    it("extracts token from x-api-token header", () => {
      const req = new NextRequest("http://localhost:3000/api/semesters", {
        headers: {
          "x-api-token": "custom-header-token",
        },
      });

      const token = extractTokenFromRequest(req);
      expect(token).toBe("custom-header-token");
    });

    it("extracts token from attendance_jwt cookie", () => {
      const req = new NextRequest("http://localhost:3000/api/semesters", {
        headers: {
          cookie: "attendance_jwt=cookie-jwt-token",
        },
      });

      const token = extractTokenFromRequest(req);
      expect(token).toBe("cookie-jwt-token");
    });
  });

  describe("Multi-Tenant Resource Ownership Checks", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("allows access when semester belongs to caller", async () => {
      vi.mocked(prisma.semester.findUnique).mockResolvedValue({
        id: "sem-1",
        userId: "user-1",
        name: "Fall 2026",
      } as any);

      const result = await verifySemesterOwnership("sem-1", "user-1");
      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.semester.id).toBe("sem-1");
      }
    });

    it("rejects access with 403 when semester belongs to a different user", async () => {
      vi.mocked(prisma.semester.findUnique).mockResolvedValue({
        id: "sem-1",
        userId: "user-other",
        name: "Fall 2026",
      } as any);

      const result = await verifySemesterOwnership("sem-1", "user-1");
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.errorResponse.status).toBe(403);
      }
    });

    it("returns 404 when semester does not exist", async () => {
      vi.mocked(prisma.semester.findUnique).mockResolvedValue(null);

      const result = await verifySemesterOwnership("sem-none", "user-1");
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.errorResponse.status).toBe(404);
      }
    });

    it("verifies course ownership through transitive semester link", async () => {
      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: "course-1",
        semester: { userId: "user-owner" },
      } as any);

      // Same user
      const ok = await verifyCourseOwnership("course-1", "user-owner");
      expect(ok.authorized).toBe(true);

      // Different user
      const forbidden = await verifyCourseOwnership("course-1", "user-intruder");
      expect(forbidden.authorized).toBe(false);
      if (!forbidden.authorized) {
        expect(forbidden.errorResponse.status).toBe(403);
      }
    });

    it("verifies slot ownership through transitive course -> semester link", async () => {
      vi.mocked(prisma.classSlot.findUnique).mockResolvedValue({
        id: "slot-1",
        course: {
          semester: { userId: "user-owner" },
        },
      } as any);

      const ok = await verifySlotOwnership("slot-1", "user-owner");
      expect(ok.authorized).toBe(true);

      const forbidden = await verifySlotOwnership("slot-1", "user-attacker");
      expect(forbidden.authorized).toBe(false);
      if (!forbidden.authorized) {
        expect(forbidden.errorResponse.status).toBe(403);
      }
    });
  });

  describe("Logout Route Cookie Clearance", () => {
    it("clears attendance_jwt and session cookies on logout", async () => {
      const { POST: logoutHandler } = await import("../app/api/auth/logout/route");
      const req = new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
      });

      const response = await logoutHandler(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      const cookieHeader = response.headers.get("set-cookie");
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain("attendance_jwt=");
      expect(cookieHeader).toContain("Expires=Thu, 01 Jan 1970");
    });
  });
});

