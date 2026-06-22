import type { ServerConfig } from "../config.js";
import { createPayosSignature } from "../payos/signature.js";

export type PaymentLinkRequest = {
  orderCode: number;
  amount: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  itemName?: string;
};

export type PaymentLinkResult = {
  checkoutUrl: string;
  qrCode?: string;
  paymentLinkId?: string;
  raw: unknown;
};

export interface PaymentProvider {
  createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkResult>;
  confirmWebhook(webhookUrl: string): Promise<unknown>;
}

export class MockPaymentProvider implements PaymentProvider {
  async createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkResult> {
    return {
      checkoutUrl: `http://localhost:8787/mock-checkout/${request.orderCode}`,
      qrCode: `mock-qr-${request.orderCode}`,
      paymentLinkId: `mock-${request.orderCode}`,
      raw: { provider: "mock", orderCode: request.orderCode },
    };
  }

  async confirmWebhook(webhookUrl: string) {
    return { provider: "mock", webhookUrl, confirmed: true };
  }
}

export class PayosHttpProvider implements PaymentProvider {
  private readonly config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  async createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkResult> {
    const { clientId, apiKey, checksumKey } = this.config.payos;

    if (!clientId || !apiKey || !checksumKey) {
      throw new Error("Missing payOS credentials.");
    }

    const body = {
      orderCode: request.orderCode,
      amount: request.amount,
      description: request.description,
      items: [{ name: request.itemName ?? "Q Flash Web unlock pass", quantity: 1, price: request.amount }],
      cancelUrl: request.cancelUrl,
      returnUrl: request.returnUrl,
      signature: createPayosSignature(
        {
          amount: request.amount,
          cancelUrl: request.cancelUrl,
          description: request.description,
          orderCode: request.orderCode,
          returnUrl: request.returnUrl,
        },
        checksumKey,
      ),
    };

    const response = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": clientId,
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    const raw = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`payOS create payment link failed: HTTP ${response.status}`);
    }

    const data = raw && typeof raw === "object" && "data" in raw ? (raw as { data?: Record<string, unknown> }).data : undefined;
    const checkoutUrl = typeof data?.checkoutUrl === "string" ? data.checkoutUrl : "";

    if (!checkoutUrl) {
      throw new Error("payOS response did not include checkoutUrl.");
    }

    return {
      checkoutUrl,
      qrCode: typeof data?.qrCode === "string" ? data.qrCode : undefined,
      paymentLinkId: typeof data?.paymentLinkId === "string" ? data.paymentLinkId : undefined,
      raw,
    };
  }

  async confirmWebhook(webhookUrl: string) {
    const { clientId, apiKey } = this.config.payos;

    if (!clientId || !apiKey) {
      throw new Error("Missing payOS credentials.");
    }

    const response = await fetch("https://api-merchant.payos.vn/confirm-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": clientId,
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ webhookUrl }),
    });
    const raw = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`payOS confirm-webhook failed: HTTP ${response.status}`);
    }

    return raw;
  }
}

export const createPaymentProvider = (config: ServerConfig): PaymentProvider =>
  config.provider === "payos" ? new PayosHttpProvider(config) : new MockPaymentProvider();
