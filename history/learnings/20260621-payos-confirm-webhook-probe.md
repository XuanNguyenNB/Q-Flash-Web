# payOS confirm-webhook Sends A Signed Probe Without A Local Order

**Date:** 2026-06-21
**Feature:** payos-donations
**Category:** integration
**Tags:** [payos, webhook, production-smoke]

## Symptom

Production `/api/health` was healthy, but `POST /api/admin/payos/confirm-webhook` returned `500` because payOS returned `HTTP 400` for webhook confirmation.

## Root Cause

payOS `confirm-webhook` verifies a URL by sending a signed sample webhook. The backend verified the signature, then treated `success=true` webhooks with no matching donation/order as `400 ORDER_NOT_FOUND`. payOS therefore classified the webhook URL as invalid.

## Fix Pattern

For a signed, successful payOS webhook whose `orderCode` is not present locally, return `200` with an ignored response and no side effects. Keep invalid signatures, amount mismatches, currency mismatches, and payment-link mismatches as hard failures for matching local orders/donations.

This preserves the unlock/donation boundary while allowing payOS webhook URL registration.
