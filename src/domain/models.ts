import type { Efisp8eModel, LegacyFtdModel, SupportedModel } from "./schemas";

type LegacyModelSource = LegacyFtdModel & {
  localPackageDir: string;
};

const finalGpt = (packagePath: string) =>
  Array.from({ length: 6 }, (_, index) => `${packagePath}/images/gpt_both${index}.bin`);

const commonEdlAbl = {
  firehoseFile: "firehose/firehose_SM8750.melf",
  firehoseSha256: "95bd33db724706db5da03882c65783d01338df6159ce563be0ce1b963d83668d",
  sectorSize: 4096,
} as const;

const phoneEdlAbl = () => ({
  ...commonEdlAbl,
  targets: [
    { slot: "a" as const, label: "abl_a", lun: 4, startSector: "121734", maxSectors: 2048 },
    { slot: "b" as const, label: "abl_b", lun: 4, startSector: "367036", maxSectors: 2048 },
  ],
});

const pad8ProEdlAbl = () => ({
  ...commonEdlAbl,
  targets: [
    { slot: "a" as const, label: "abl_a", lun: 4, startSector: "58758", maxSectors: 2048 },
    { slot: "b" as const, label: "abl_b", lun: 4, startSector: "241084", maxSectors: 2048 },
  ],
});

export const efisp8eUnlockFile = "efisp/gbl_efi_unlock.efi";

export const v1Efisp8eModels: readonly Efisp8eModel[] = [
  {
    family: "efisp-8e-gen5",
    id: "xiaomi17",
    name: "Xiaomi 17",
    product: "pudding",
    efispUnlockFile: efisp8eUnlockFile,
  },
  {
    family: "efisp-8e-gen5",
    id: "xiaomi17pro",
    name: "Xiaomi 17 Pro",
    product: "pandora",
    efispUnlockFile: efisp8eUnlockFile,
  },
  {
    family: "efisp-8e-gen5",
    id: "xiaomi17promax",
    name: "Xiaomi 17 Pro Max",
    product: "popsicle",
    efispUnlockFile: efisp8eUnlockFile,
  },
  {
    family: "efisp-8e-gen5",
    id: "xiaomi17ultra",
    name: "Xiaomi 17 Ultra",
    product: "nezha",
    efispUnlockFile: efisp8eUnlockFile,
  },
  {
    family: "efisp-8e-gen5",
    id: "redmi-k90promax",
    name: "Redmi K90 Pro Max / POCO F8 Ultra",
    product: "myron",
    efispUnlockFile: efisp8eUnlockFile,
  },
] as const;

export const v1LegacyModelSources: readonly LegacyModelSource[] = [
  {
    family: "legacy-ftd",
    id: "xiaomi15",
    name: "Xiaomi 15",
    product: "dada",
    ablFile: "abl/mi15.elf",
    ftdPackage: "packages/xiaomi15",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
    },
    finalGpt: finalGpt("packages/xiaomi15"),
    edlAbl: phoneEdlAbl(),
    localPackageDir: "Xiaomi15主板工厂提示系统损坏时使用_正常开机后需再刷一次正常的工厂包",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi15pro",
    name: "Xiaomi 15 Pro",
    product: "haotian",
    ablFile: "abl/mi15p.elf",
    ftdPackage: "packages/xiaomi15pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
    },
    finalGpt: finalGpt("packages/xiaomi15pro"),
    edlAbl: phoneEdlAbl(),
    localPackageDir: "Xiaomi15Pro主板工厂提示系统损坏时使用_正常开机后需再刷一次正常的工厂包",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi15ultra",
    name: "Xiaomi 15 Ultra",
    product: "xuanyuan",
    ablFile: "abl/mi15u.elf",
    ftdPackage: "packages/xiaomi15ultra",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
    },
    finalGpt: finalGpt("packages/xiaomi15ultra"),
    edlAbl: phoneEdlAbl(),
    localPackageDir: "小米15ultra降级小包2025.04.08",
  },
  {
    family: "legacy-ftd",
    id: "redmi-k80pro",
    name: "Redmi K80 Pro",
    product: "miro",
    ablFile: "abl/k80pro.elf",
    ftdPackage: "packages/redmi-k80pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
    },
    finalGpt: finalGpt("packages/redmi-k80pro"),
    edlAbl: phoneEdlAbl(),
    notes: ["Batch gốc không có getvar product; website enforce product miro từ manifest."],
    localPackageDir: "Redmi_K80Pro/Redmi_K80Pro主板工厂提示系统损坏时使用_正常开机后需再刷一次正常的工厂包",
  },
  {
    family: "legacy-ftd",
    id: "redmi-k90",
    name: "Redmi K90",
    product: "annibale",
    ablFile: "abl/K90.elf",
    ftdPackage: "packages/redmi-k90",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
    },
    finalGpt: finalGpt("packages/redmi-k90"),
    edlAbl: phoneEdlAbl(),
    localPackageDir: "红米k90降级小包2026.02.23",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi-pad8pro",
    name: "Xiaomi Pad 8 Pro",
    product: "piano",
    ablFile: "abl/pad8.elf",
    ftdPackage: "packages/xiaomi-pad8pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
    },
    finalGpt: finalGpt("packages/xiaomi-pad8pro"),
    edlAbl: pad8ProEdlAbl(),
    localPackageDir: "小米平板8pro降级小包",
  },
] as const;

export const v1ModelSources: readonly LegacyModelSource[] = v1LegacyModelSources;

export const v1LegacyManifestModels: readonly LegacyFtdModel[] = v1LegacyModelSources.map(
  ({ localPackageDir: _localPackageDir, ...model }) => model,
);

export const v1ManifestModels: readonly SupportedModel[] = [...v1Efisp8eModels, ...v1LegacyManifestModels];

export const findModelByProduct = (
  models: readonly SupportedModel[],
  product: string,
  family?: SupportedModel["family"],
) =>
  models.find(
    (model) =>
      model.product.toLowerCase() === product.trim().toLowerCase() && (family === undefined || model.family === family),
  );

export const isLegacyFtdModel = (model: SupportedModel): model is LegacyFtdModel => model.family === "legacy-ftd";

export const isEfisp8eModel = (model: SupportedModel): model is Efisp8eModel => model.family === "efisp-8e-gen5";
