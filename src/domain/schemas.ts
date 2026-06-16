import { z } from "zod";

export const flashOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("getvar"),
    name: z.string().min(1),
    expect: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("erase"),
    partition: z.string().min(1),
  }),
  z.object({
    type: z.literal("flash"),
    partition: z.string().min(1),
    file: z.string().min(1),
  }),
  z.object({
    type: z.literal("set_active"),
    slot: z.enum(["a", "b"]),
  }),
  z.object({
    type: z.literal("reboot"),
    target: z.enum(["bootloader", "system"]).optional(),
  }),
]);

export const flashPlanSchema = z.object({
  modelId: z.string().min(1),
  product: z.string().min(1),
  operations: z.array(flashOperationSchema).min(1),
  antiRollbackFile: z.string().min(1).optional(),
});

export const edlAblTargetSchema = z.object({
  slot: z.enum(["a", "b"]),
  label: z.string().min(1),
  lun: z.number().int().nonnegative(),
  startSector: z.string().regex(/^\d+$/),
  maxSectors: z.number().int().positive(),
});

export const edlAblSchema = z.object({
  firehoseFile: z.string().min(1),
  firehoseSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sectorSize: z.number().int().positive(),
  targets: z.array(edlAblTargetSchema).length(2),
});

const modelBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  product: z.string().min(1),
  notes: z.array(z.string()).optional(),
});

export const legacyFtdModelSchema = modelBaseSchema.extend({
  family: z.literal("legacy-ftd").default("legacy-ftd"),
  chip: z.enum(["8E", "8G2", "8G3", "8SG3", "8SG4"]),
  ablFile: z.string().min(1),
  ftdPackage: z.string().min(1),
  unlock: z.object({
    gptBoth4: z.string().min(1),
    bootImage: z.string().min(1),
    payloadFile: z.string().min(1).optional(),
    enneaFile: z.string().min(1).optional(),
    finalGptFile: z.string().min(1).optional(),
  }),
  finalGpt: z.array(z.string().min(1)).length(6),
  edlAbl: edlAblSchema.optional(),
  adbExploit: z.object({
    exploitFile: z.string().min(1),
    suFile: z.string().min(1),
  }).optional(),
});

export const efisp8eModelSchema = modelBaseSchema.extend({
  family: z.literal("efisp-8e-gen5"),
  efispUnlockFile: z.string().min(1),
});

export const supportedModelSchema = z.union([legacyFtdModelSchema, efisp8eModelSchema]);

export const manifestSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().optional(),
  models: z.array(supportedModelSchema).min(1),
});

export const sha256SumsSchema = z.record(z.string().min(1), z.string().regex(/^[a-f0-9]{64}$/i));

export type FlashOperation = z.infer<typeof flashOperationSchema>;
export type FlashPlan = z.infer<typeof flashPlanSchema>;
export type EdlAblTarget = z.infer<typeof edlAblTargetSchema>;
export type EdlAbl = z.infer<typeof edlAblSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type LegacyFtdModel = z.infer<typeof legacyFtdModelSchema>;
export type Efisp8eModel = z.infer<typeof efisp8eModelSchema>;
export type SupportedModel = z.infer<typeof supportedModelSchema>;
export type Sha256Sums = z.infer<typeof sha256SumsSchema>;
