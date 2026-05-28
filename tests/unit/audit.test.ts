import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted garante que essas refs existem antes do hoist do vi.mock,
// que e pre-requisito pra acessar createMock/headersMock dentro da factory.
const { createMock, headersMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  headersMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: createMock,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

import { logEvent } from "@/lib/audit";

function makeHeaders(map: Record<string, string>) {
  return {
    get: (key: string) => map[key.toLowerCase()] ?? null,
  };
}

describe("logEvent", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue(undefined);
    headersMock.mockReset();
    headersMock.mockResolvedValue(makeHeaders({}));
  });

  it("chama db.auditLog.create com action + userId + meta", async () => {
    headersMock.mockResolvedValue(
      makeHeaders({
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "user-agent": "Mozilla/5.0 Test",
      }),
    );

    await logEvent({
      userId: "user-1",
      action: "signin_success",
      meta: { provider: "credentials" },
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "signin_success",
        entityType: null,
        entityId: null,
        rootEntityType: null,
        rootEntityId: null,
        meta: { provider: "credentials" },
        ipAddress: "203.0.113.10",
        userAgent: "Mozilla/5.0 Test",
      },
    });
  });

  it("aceita evento sem userId (pre-auth como signin_failed)", async () => {
    headersMock.mockResolvedValue(makeHeaders({ "user-agent": "curl/8.0" }));

    await logEvent({
      action: "signin_failed",
      meta: { email: "ghost@example.com" },
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: null,
        action: "signin_failed",
        entityType: null,
        entityId: null,
        rootEntityType: null,
        rootEntityId: null,
        meta: { email: "ghost@example.com" },
        ipAddress: null,
        userAgent: "curl/8.0",
      },
    });
  });

  it("usa x-real-ip quando x-forwarded-for ausente", async () => {
    headersMock.mockResolvedValue(makeHeaders({ "x-real-ip": "198.51.100.5" }));

    await logEvent({ action: "signout", userId: "user-2" });

    const call = createMock.mock.calls[0]?.[0];
    expect(call.data.ipAddress).toBe("198.51.100.5");
  });

  it("passa entityType e entityId quando fornecidos", async () => {
    await logEvent({
      userId: "admin-1",
      action: "role_changed",
      entityType: "user",
      entityId: "target-user-1",
      meta: { from: "social", to: "gestor_unidade" },
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        userId: "admin-1",
        action: "role_changed",
        entityType: "user",
        entityId: "target-user-1",
        rootEntityType: null,
        rootEntityId: null,
        meta: { from: "social", to: "gestor_unidade" },
        ipAddress: null,
        userAgent: null,
      },
    });
  });

  it("encaminha rootEntityType e rootEntityId (aggregate root) quando fornecidos", async () => {
    await logEvent({
      userId: "recep-1",
      action: "anexo_uploaded",
      entityType: "anexo_cidadao",
      entityId: "anexo-9",
      rootEntityType: "cidadao",
      rootEntityId: "cid-1",
      meta: { fileName: "rg.pdf" },
    });

    const call = createMock.mock.calls[0]?.[0];
    expect(call.data.rootEntityType).toBe("cidadao");
    expect(call.data.rootEntityId).toBe("cid-1");
  });

  it("nao lanca quando db.create rejeita (audit nao quebra fluxo)", async () => {
    createMock.mockRejectedValueOnce(new Error("DB down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(logEvent({ action: "signin_success", userId: "user-1" })).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[audit] Failed to log event",
      "signin_success",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
