const vhmobileBaseUrl = "https://vhmobile.io.vn/FIRMWARE/Xiaomi";

export type VhmobileMiniEngStatus = "available" | "missing-mini-eng";

export type VhmobileMiniEngEntry = {
  chip: "8E" | "8G2" | "8G3" | "8SG3" | "8SG4";
  modelId: string;
  modelName: string;
  codename: string;
  status: VhmobileMiniEngStatus;
  archiveName?: string;
  expectedSize?: number;
  url?: string;
};

const archiveUrl = (codename: string, archiveName: string) =>
  `${vhmobileBaseUrl}/${encodeURIComponent(codename)}/${encodeURIComponent(archiveName)}`;

const available = (
  chip: VhmobileMiniEngEntry["chip"],
  modelId: string,
  modelName: string,
  codename: string,
  archiveName: string,
  expectedSize: number,
): VhmobileMiniEngEntry => ({
  chip,
  modelId,
  modelName,
  codename,
  status: "available",
  archiveName,
  expectedSize,
  url: archiveUrl(codename, archiveName),
});

const missing = (
  chip: VhmobileMiniEngEntry["chip"],
  modelId: string,
  modelName: string,
  codename: string,
): VhmobileMiniEngEntry => ({
  chip,
  modelId,
  modelName,
  codename,
  status: "missing-mini-eng",
});

export const defaultVhmobileMiniEngRoot =
  "C:\\Users\\XuanNguyen\\Downloads\\vhmobile-minieng";

export const vhmobileMiniEngEntries = [
  available("8E", "xiaomi15", "Xiaomi 15", "dada", "Mini_ENG_dada.rar", 74_388_974),
  missing("8E", "xiaomi15pro", "Xiaomi 15 Pro", "haotian"),
  missing("8E", "xiaomi15ultra", "Xiaomi 15 Ultra", "xuanyuan"),
  missing("8E", "redmi-k80pro", "Redmi K80 Pro", "miro"),
  missing("8E", "redmi-k90", "Redmi K90", "annibale"),
  missing("8E", "xiaomi-pad8pro", "Xiaomi Pad 8 Pro", "piano"),

  missing("8G3", "xiaomi14", "Xiaomi 14", "houji"),
  available("8G3", "xiaomi14pro", "Xiaomi 14 Pro", "shennong", "14pro_minieng.rar", 66_315_369),
  available("8G3", "xiaomi14ultra", "Xiaomi 14 Ultra", "aurora", "aurora_mineng_keepnv.rar", 65_030_356),
  missing("8G3", "redmi-k70pro", "Redmi K70 Pro", "manet"),
  available("8G3", "redmi-k80", "Redmi K80", "zorn", "K80_miniENG.rar", 76_319_294),
  missing("8G3", "xiaomimixfold4", "Xiaomi MIX Fold 4", "goku"),
  missing("8G3", "xiaomimixflip", "Xiaomi MIX Flip", "ruyi"),

  available("8G2", "xiaomi13", "Xiaomi 13", "fuxi", "fuxi-minieng.rar", 68_014_686),
  available("8G2", "xiaomi13pro", "Xiaomi 13 Pro", "nuwa", "nuwa-minieng.rar", 69_314_558),
  available("8G2", "xiaomi13ultra", "Xiaomi 13 Ultra", "ishtar", "13u-minieng.rar", 70_694_894),
  missing("8G2", "redmi-k60pro", "Redmi K60 Pro", "socrates"),
  available("8G2", "redmi-k70", "Redmi K70", "vermeer", "k70_minieng.rar", 73_240_878),
  missing("8G2", "xiaomi-pad6spro", "Xiaomi Pad 6S Pro", "sheng"),

  available("8SG3", "xiaomi-pad7pro", "Xiaomi Pad 7 Pro", "muyu", "mipad7Pro_minieng.rar", 69_802_938),
  available("8SG3", "xiaomi-civi4pro", "Xiaomi Civi 4 Pro", "chenfeng", "civi4pro_minieng.rar", 67_403_306),
  missing("8SG3", "redmi-turbo3", "Redmi Turbo 3", "peridot"),
  missing("8SG3", "xiaomi-pad7", "Xiaomi Pad 7", "uke"),

  available("8SG4", "redmi-turbo4pro", "Redmi Turbo 4 Pro / POCO F7", "onyx", "turbo4pro_minieng.rar", 78_200_210),
  missing("8SG4", "xiaomi-civi5pro", "Xiaomi Civi 5 Pro", "luming"),
  missing("8SG4", "xiaomi-pad8", "Xiaomi Pad 8", "yupei"),
] as const satisfies readonly VhmobileMiniEngEntry[];

export const vhmobileMiniEngByModelId = Object.fromEntries(
  vhmobileMiniEngEntries.map((entry) => [entry.modelId, entry]),
) as Record<string, VhmobileMiniEngEntry>;

export const vhmobileAvailableMiniEngEntries = vhmobileMiniEngEntries.filter(
  (entry) => entry.status === "available",
);

export const vhmobileMissingMiniEngEntries = vhmobileMiniEngEntries.filter(
  (entry) => entry.status === "missing-mini-eng",
);
