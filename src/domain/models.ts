import type { Efisp8eModel, LegacyFtdModel, SupportedModel } from "./schemas";

type LegacyModelSource = LegacyFtdModel & {
  localPackageDir: string;
  skipFtdPackage?: boolean;
};

const missingMiniEngPackage = {
  packageStatus: "missing-mini-eng",
} as const;

const finalGpt = (packagePath: string) =>
  Array.from({ length: 6 }, (_, index) => `${packagePath}/images/gpt_both${index}.bin`);

const enneaByChip = {
  sm8550: "ennea/8550-Ennea.img",
  sm8650: "ennea/8650-Ennea.img",
  sm8635: "ennea/8635-Ennea.img",
  sm8735: "ennea/8735-Ennea.img",
} as const;

const perDeviceUnlock = (chip: keyof typeof enneaByChip, slug: string) => ({
  payloadFile: `unlock/payloads/${slug}.bin`,
  enneaFile: enneaByChip[chip],
  finalGptFile: `unlock/gpt/${slug}.bin`,
});

const legacy8eUnlock = (packagePath: string) => ({
  gptBoth4: "unlock/gpt_both4.bin",
  bootImage: "unlock/boot.img",
  finalGptFile: `${packagePath}/images/gpt_both4.bin`,
});

const legacy8ePreFtdModelIds = new Set(["xiaomi15", "xiaomi15pro"]);
const legacy8eMqsasModelIds = new Set([
  "xiaomi15",
  "xiaomi15pro",
  "xiaomi15ultra",
  "redmi-k80pro",
  "redmi-k90",
  "xiaomi-pad8pro",
]);

const adbExploit8g3 = {
  candidates: [
    { name: "Xiaomi 14", exploitFile: "bin/8g3/mi14/exploit", suFile: "bin/8g3/mi14/su" },
    { name: "Redmi K80", exploitFile: "bin/8g3/k80/exploit", suFile: "bin/8g3/k80/su" },
  ],
};

const adbExploit8sg3Pad7 = {
  candidates: [{ name: "Xiaomi Pad 7", exploitFile: "bin/8sg3/pad7/exploit", suFile: "bin/8sg3/pad7/su" }],
};

const adbExploit8sg3Pad7Pro = {
  candidates: [{ name: "Xiaomi Pad 7 Pro", exploitFile: "bin/8sg3/pad7pro/exploit", suFile: "bin/8sg3/pad7pro/su" }],
};

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
    chip: "8E",
    ablProvisioning: "mqsas-permissive",
    preUnlockFlashPlan: true,
    ablFile: "abl/mi15.elf",
    ftdPackage: "packages/xiaomi15",
    unlock: legacy8eUnlock("packages/xiaomi15"),
    finalGpt: finalGpt("packages/xiaomi15"),
    edlAbl: phoneEdlAbl(),
    localPackageDir: "Xiaomi15主板工厂提示系统损坏时使用_正常开机后需再刷一次正常的工厂包",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi15pro",
    name: "Xiaomi 15 Pro",
    product: "haotian",
    chip: "8E",
    ablProvisioning: "mqsas-permissive",
    preUnlockFlashPlan: true,
    ablFile: "abl/mi15p.elf",
    ftdPackage: "packages/xiaomi15pro",
    unlock: legacy8eUnlock("packages/xiaomi15pro"),
    finalGpt: finalGpt("packages/xiaomi15pro"),
    edlAbl: phoneEdlAbl(),
    localPackageDir: "Xiaomi15Pro主板工厂提示系统损坏时使用_正常开机后需再刷一次正常的工厂包",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi15ultra",
    name: "Xiaomi 15 Ultra",
    product: "xuanyuan",
    chip: "8E",
    ablProvisioning: "mqsas-permissive",
    preUnlockFlashPlan: false,
    ablFile: "abl/mi15u.elf",
    ftdPackage: "packages/xiaomi15ultra",
    unlock: legacy8eUnlock("packages/xiaomi15ultra"),
    finalGpt: finalGpt("packages/xiaomi15ultra"),
    edlAbl: phoneEdlAbl(),
    localPackageDir: "小米15ultra降级小包2025.04.08",
  },
  {
    family: "legacy-ftd",
    id: "redmi-k80pro",
    name: "Redmi K80 Pro",
    product: "miro",
    chip: "8E",
    ablProvisioning: "mqsas-permissive",
    preUnlockFlashPlan: false,
    postAblFastbootAliases: ["dada"],
    ablFile: "abl/k80pro.elf",
    ftdPackage: "packages/redmi-k80pro",
    unlock: legacy8eUnlock("packages/redmi-k80pro"),
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
    chip: "8E",
    ablProvisioning: "mqsas-permissive",
    preUnlockFlashPlan: false,
    ablFile: "abl/K90.elf",
    ftdPackage: "packages/redmi-k90",
    unlock: legacy8eUnlock("packages/redmi-k90"),
    finalGpt: finalGpt("packages/redmi-k90"),
    edlAbl: phoneEdlAbl(),
    localPackageDir: "红米k90降级小包2026.02.23",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi-pad8pro",
    name: "Xiaomi Pad 8 Pro",
    product: "piano",
    chip: "8E",
    ablProvisioning: "mqsas-permissive",
    preUnlockFlashPlan: false,
    ablFile: "abl/pad8.elf",
    ftdPackage: "packages/xiaomi-pad8pro",
    unlock: legacy8eUnlock("packages/xiaomi-pad8pro"),
    finalGpt: finalGpt("packages/xiaomi-pad8pro"),
    edlAbl: pad8ProEdlAbl(),
    localPackageDir: "小米平板8pro降级小包",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi14",
    name: "Xiaomi 14",
    product: "houji",
    chip: "8G3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/mi14.elf",
    ftdPackage: "packages/xiaomi14",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8650", "14"),
    },
    finalGpt: finalGpt("packages/xiaomi14"),
    adbExploit: adbExploit8g3,
    localPackageDir: "Xiaomi14_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi14pro",
    name: "Xiaomi 14 Pro",
    product: "shennong",
    chip: "8G3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/mi14p.elf",
    ftdPackage: "packages/xiaomi14pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8650", "14p"),
    },
    finalGpt: finalGpt("packages/xiaomi14pro"),
    adbExploit: adbExploit8g3,
    localPackageDir: "Xiaomi14Pro_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi14ultra",
    name: "Xiaomi 14 Ultra",
    product: "aurora",
    chip: "8G3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/mi14u.elf",
    ftdPackage: "packages/xiaomi14ultra",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8650", "14u"),
    },
    finalGpt: finalGpt("packages/xiaomi14ultra"),
    adbExploit: adbExploit8g3,
    localPackageDir: "Xiaomi14Ultra_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "redmi-k70pro",
    name: "Redmi K70 Pro",
    product: "manet",
    chip: "8G3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/k70pro.elf",
    ftdPackage: "packages/redmi-k70pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8650", "k70p"),
    },
    finalGpt: finalGpt("packages/redmi-k70pro"),
    adbExploit: adbExploit8g3,
    localPackageDir: "RedmiK70Pro_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "redmi-k80",
    name: "Redmi K80",
    product: "zorn",
    chip: "8G3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/k80.elf",
    ftdPackage: "packages/redmi-k80",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8650", "k80"),
    },
    finalGpt: finalGpt("packages/redmi-k80"),
    adbExploit: adbExploit8g3,
    localPackageDir: "RedmiK80_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomimixfold4",
    name: "Xiaomi MIX Fold 4",
    product: "goku",
    chip: "8G3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/mixfold4.elf",
    ftdPackage: "packages/xiaomimixfold4",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8650", "fold4"),
    },
    finalGpt: finalGpt("packages/xiaomimixfold4"),
    adbExploit: adbExploit8g3,
    localPackageDir: "XiaomiMixFold4_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomimixflip",
    name: "Xiaomi MIX Flip",
    product: "ruyi",
    chip: "8G3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/mixflip.elf",
    ftdPackage: "packages/xiaomimixflip",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8650", "flip"),
    },
    finalGpt: finalGpt("packages/xiaomimixflip"),
    adbExploit: adbExploit8g3,
    localPackageDir: "XiaomiMixFlip_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi13",
    name: "Xiaomi 13",
    product: "fuxi",
    chip: "8G2",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/mi13.elf",
    ftdPackage: "packages/xiaomi13",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8550", "13"),
    },
    finalGpt: finalGpt("packages/xiaomi13"),
    localPackageDir: "Xiaomi13_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi13pro",
    name: "Xiaomi 13 Pro",
    product: "nuwa",
    chip: "8G2",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/mi13p.elf",
    ftdPackage: "packages/xiaomi13pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8550", "13p"),
    },
    finalGpt: finalGpt("packages/xiaomi13pro"),
    localPackageDir: "Xiaomi13Pro_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi13ultra",
    name: "Xiaomi 13 Ultra",
    product: "ishtar",
    chip: "8G2",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/mi13u.elf",
    ftdPackage: "packages/xiaomi13ultra",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8550", "13u"),
    },
    finalGpt: finalGpt("packages/xiaomi13ultra"),
    localPackageDir: "Xiaomi13Ultra_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "redmi-k60pro",
    name: "Redmi K60 Pro",
    product: "socrates",
    chip: "8G2",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/k60pro.elf",
    ftdPackage: "packages/redmi-k60pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8550", "k60p"),
    },
    finalGpt: finalGpt("packages/redmi-k60pro"),
    localPackageDir: "RedmiK60Pro_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "redmi-k70",
    name: "Redmi K70",
    product: "vermeer",
    chip: "8G2",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/k70.elf",
    ftdPackage: "packages/redmi-k70",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8550", "k70"),
    },
    finalGpt: finalGpt("packages/redmi-k70"),
    localPackageDir: "RedmiK70_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi-pad6spro",
    name: "Xiaomi Pad 6S Pro",
    product: "sheng",
    chip: "8G2",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/pad6spro.elf",
    ftdPackage: "packages/xiaomi-pad6spro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8550", "pad6sp"),
    },
    finalGpt: finalGpt("packages/xiaomi-pad6spro"),
    localPackageDir: "XiaomiPad6SPro_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi-pad7pro",
    name: "Xiaomi Pad 7 Pro",
    product: "muyu",
    chip: "8SG3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/pad7pro.elf",
    ftdPackage: "packages/xiaomi-pad7pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8635", "pad7p"),
    },
    finalGpt: finalGpt("packages/xiaomi-pad7pro"),
    adbExploit: adbExploit8sg3Pad7Pro,
    localPackageDir: "XiaomiPad7Pro_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi-civi4pro",
    name: "Xiaomi Civi 4 Pro",
    product: "chenfeng",
    chip: "8SG3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/civi4pro.elf",
    ftdPackage: "packages/xiaomi-civi4pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8635", "civi4"),
    },
    finalGpt: finalGpt("packages/xiaomi-civi4pro"),
    adbExploit: adbExploit8sg3Pad7,
    localPackageDir: "XiaomiCivi4Pro_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "redmi-turbo3",
    name: "Redmi Turbo 3",
    product: "peridot",
    chip: "8SG3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/turbo3.elf",
    ftdPackage: "packages/redmi-turbo3",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8635", "tb3"),
    },
    finalGpt: finalGpt("packages/redmi-turbo3"),
    adbExploit: adbExploit8sg3Pad7,
    localPackageDir: "RedmiTurbo3_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi-pad7",
    name: "Xiaomi Pad 7",
    product: "uke",
    chip: "8SG3",
    ablProvisioning: "adb-exploit-root",
    preUnlockFlashPlan: true,
    ablFile: "abl/pad7.elf",
    ftdPackage: "packages/xiaomi-pad7",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8635", "pad7"),
    },
    finalGpt: finalGpt("packages/xiaomi-pad7"),
    adbExploit: adbExploit8sg3Pad7,
    localPackageDir: "XiaomiPad7_ADB_Exploit",
  },
  {
    family: "legacy-ftd",
    id: "redmi-turbo4pro",
    name: "Redmi Turbo 4 Pro / POCO F7",
    product: "onyx",
    chip: "8SG4",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/turbo4pro.elf",
    ftdPackage: "packages/redmi-turbo4pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8735", "onyx"),
    },
    finalGpt: finalGpt("packages/redmi-turbo4pro"),
    notes: ["Chua co exploit/su SM8735; dung workflow EDL_Standard sau khi nap ABL_ENG thu cong."],
    localPackageDir: "turbo4pro_minieng",
  },
  {
    family: "legacy-ftd",
    id: "xiaomi-civi5pro",
    name: "Xiaomi Civi 5 Pro",
    product: "luming",
    chip: "8SG4",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/civi5pro.elf",
    ftdPackage: "packages/xiaomi-civi5pro",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8735", "luming"),
    },
    finalGpt: finalGpt("packages/xiaomi-civi5pro"),
    ...missingMiniEngPackage,
    notes: ["Chua co exploit/su SM8735; dung workflow EDL_Standard sau khi nap ABL_ENG thu cong.", "Dang cho FTD package."],
    localPackageDir: "xiaomi-civi5pro_pending",
    skipFtdPackage: true,
  },
  {
    family: "legacy-ftd",
    id: "xiaomi-pad8",
    name: "Xiaomi Pad 8",
    product: "yupei",
    chip: "8SG4",
    ablProvisioning: "manual-external",
    preUnlockFlashPlan: true,
    ablFile: "abl/pad8.elf",
    ftdPackage: "packages/xiaomi-pad8",
    unlock: {
      gptBoth4: "unlock/gpt_both4.bin",
      bootImage: "unlock/boot.img",
      ...perDeviceUnlock("sm8735", "yupei"),
    },
    finalGpt: finalGpt("packages/xiaomi-pad8"),
    ...missingMiniEngPackage,
    notes: ["Chua co exploit/su SM8735; dung workflow EDL_Standard sau khi nap ABL_ENG thu cong.", "Dang cho FTD package."],
    localPackageDir: "xiaomi-pad8_pending",
    skipFtdPackage: true,
  },
] as const;

export const v1ModelSources: readonly LegacyModelSource[] = v1LegacyModelSources;

export const v1LegacyManifestModels: readonly LegacyFtdModel[] = v1LegacyModelSources.map(
  ({ localPackageDir: _localPackageDir, skipFtdPackage: _skipFtdPackage, ...model }) => model,
);

export const v1ManifestModels: readonly SupportedModel[] = [...v1LegacyManifestModels, ...v1Efisp8eModels];

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

export const hasAvailableFtdPackage = (model: LegacyFtdModel) => model.packageStatus !== "missing-mini-eng";

export const legacyAblProvisioning = (model: LegacyFtdModel) => {
  if (model.ablProvisioning) {
    return model.ablProvisioning;
  }

  if (model.adbExploit) {
    return "adb-exploit-root";
  }

  if (model.chip === "8E" && legacy8eMqsasModelIds.has(model.id)) {
    return "mqsas-permissive";
  }

  return "manual-external";
};

export const shouldRunPreUnlockFlashPlan = (model: LegacyFtdModel) => {
  if (model.preUnlockFlashPlan !== undefined) {
    return model.preUnlockFlashPlan;
  }

  if (model.chip === "8E" && legacy8eMqsasModelIds.has(model.id)) {
    return legacy8ePreFtdModelIds.has(model.id);
  }

  return true;
};
