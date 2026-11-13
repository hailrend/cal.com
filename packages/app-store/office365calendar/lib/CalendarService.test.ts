import type { CredentialForCalendarServiceWithTenantId } from "@calcom/types/Credential";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestRaw = vi.fn();

vi.mock("../../_utils/oauth/OAuthManager", () => ({
  OAuthManager: class {
    requestRaw = requestRaw;
  },
}));
vi.mock("../../_utils/oauth/oAuthManagerHelper", () => ({
  oAuthManagerHelper: {
    credentialSyncVariables: {},
    invalidateCredential: vi.fn(),
    markTokenAsExpired: vi.fn(),
    updateTokenObject: vi.fn(),
  },
}));
vi.mock("../../_utils/oauth/getTokenObjectFromCredential", () => ({
  getTokenObjectFromCredential: () => ({ access_token: "token" }),
}));
vi.mock("@calcom/features/webhooks/lib/triggerDelegationCredentialErrorWebhook", () => ({
  triggerDelegationCredentialErrorWebhook: vi.fn(),
}));

import BuildCalendarService from "./CalendarService";

const credential = {
  id: 1,
  type: "office365_calendar",
  userId: 43,
  key: {},
  invalid: false,
  delegatedTo: null,
} as unknown as CredentialForCalendarServiceWithTenantId;

const selectedCalendars = [
  { externalId: "cal-1", integration: "office365_calendar", userId: 43, credentialId: 1 },
  { externalId: "cal-2", integration: "office365_calendar", userId: 43, credentialId: 1 },
];

const event = (start: string, end: string, showAs = "busy") => ({
  showAs,
  start: { dateTime: start },
  end: { dateTime: end },
});

const batchResponse = (responses: unknown[], status = 200) =>
  new Response(JSON.stringify({ responses }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const getAvailability = () =>
  BuildCalendarService(credential).getAvailability({
    dateFrom: "2026-11-16T00:00:00.000Z",
    dateTo: "2026-11-17T00:00:00.000Z",
    selectedCalendars,
    mode: "slots",
  });

describe("Office365CalendarService.getAvailability", () => {
  beforeEach(() => {
    requestRaw.mockReset();
  });

  it("returns busy times from every calendar when all sub-requests succeed", async () => {
    requestRaw.mockResolvedValueOnce(
      batchResponse([
        { id: "0", status: 200, body: { value: [event("2026-11-16T09:00:00", "2026-11-16T10:00:00")] } },
        {
          id: "1",
          status: 200,
          body: {
            value: [
              event("2026-11-16T11:00:00", "2026-11-16T12:00:00"),
              event("2026-11-16T13:00:00", "2026-11-16T14:00:00", "free"),
            ],
          },
        },
      ])
    );

    await expect(getAvailability()).resolves.toEqual([
      { start: "2026-11-16T09:00:00Z", end: "2026-11-16T10:00:00Z" },
      { start: "2026-11-16T11:00:00Z", end: "2026-11-16T12:00:00Z" },
    ]);
  });

  it("rejects instead of returning no busy times when one calendar fails", async () => {
    requestRaw.mockResolvedValueOnce(
      batchResponse([
        { id: "0", status: 200, body: { value: [event("2026-11-16T09:00:00", "2026-11-16T10:00:00")] } },
        { id: "1", status: 503, body: { error: { code: "ServiceUnavailable" } } },
      ])
    );

    await expect(getAvailability()).rejects.toEqual([]);
  });

  it("rejects when a calendar is missing from the batch response", async () => {
    requestRaw.mockResolvedValueOnce(batchResponse([{ id: "0", status: 200, body: { value: [] } }]));

    await expect(getAvailability()).rejects.toEqual([]);
  });

  it("rejects when the batch request itself fails", async () => {
    requestRaw.mockResolvedValueOnce(
      new Response("unavailable", { status: 503, headers: { "content-encoding": "gzip" } })
    );

    await expect(getAvailability()).rejects.toEqual([]);
  });
});
