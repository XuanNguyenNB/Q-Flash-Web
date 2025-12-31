export interface DebuggingGuideStep {
    title: string;
    instructions: string[];
}

export interface DebuggingGuide {
    id: string;
    brand: string;
    osName: string; // e.g. ColorOS, FuntouchOS
    androidVersions: string; // e.g. "11-16"
    steps: {
        developerOptions: DebuggingGuideStep;
        usbDebugging: {
            title: string;
            oemSteps: string[]; // Steps if OEM Unlock is enabled
            standardSteps: string[]; // Steps if only USB Debugging
        };
    };
    pathSummary: {
        buildNumber: string;
        developerOptions: string;
    };
}

export const DEBUGGING_GUIDES: DebuggingGuide[] = [
    {
        id: 'oppo_realme_oneplus',
        brand: 'Oppo / Realme / OnePlus',
        osName: 'ColorOS / RealmeUI / OxygenOS',
        androidVersions: 'Android 11+',
        steps: {
            developerOptions: {
                title: 'adb.guide.step1Title',
                instructions: [
                    'adb.guide.steps.oppo.dev.1',
                    'adb.guide.steps.oppo.dev.2',
                    'adb.guide.steps.oppo.dev.3',
                    'adb.guide.steps.oppo.dev.4',
                    'adb.guide.steps.oppo.dev.5'
                ]
            },
            usbDebugging: {
                title: 'adb.guide.step2Title',
                oemSteps: [
                    'adb.guide.steps.oppo.oem.1',
                    'adb.guide.steps.oppo.oem.2',
                    'adb.guide.steps.oppo.oem.3',
                    'adb.guide.steps.oppo.oem.4',
                    'adb.guide.steps.oppo.oem.5',
                    'adb.guide.steps.oppo.oem.6'
                ],
                standardSteps: [
                    'adb.guide.steps.oppo.std.1',
                    'adb.guide.steps.oppo.std.2',
                    'adb.guide.steps.oppo.std.3',
                    'adb.guide.steps.oppo.std.4',
                    'adb.guide.steps.oppo.std.5'
                ]
            }
        },
        pathSummary: {
            buildNumber: 'adb.guide.path.oppo.build',
            developerOptions: 'adb.guide.path.oppo.dev'
        }
    },
    {
        id: 'vivo_iqoo',
        brand: 'Vivo / iQOO',
        osName: 'Funtouch OS / OriginOS',
        androidVersions: 'Android 11+',
        steps: {
            developerOptions: {
                title: 'adb.guide.step1Title',
                instructions: [
                    'adb.guide.steps.vivo.dev.1',
                    'adb.guide.steps.vivo.dev.2',
                    'adb.guide.steps.vivo.dev.3'
                ]
            },
            usbDebugging: {
                title: 'adb.guide.step2Title',
                oemSteps: [
                    'adb.guide.steps.vivo.oem.1',
                    'adb.guide.steps.vivo.oem.2',
                    'adb.guide.steps.vivo.oem.3'
                ],
                standardSteps: [
                    'adb.guide.steps.vivo.std.1',
                    'adb.guide.steps.vivo.std.2'
                ]
            }
        },
        pathSummary: {
            buildNumber: 'adb.guide.path.vivo.build',
            developerOptions: 'adb.guide.path.vivo.dev'
        }
    },
    {
        id: 'honor',
        brand: 'Honor',
        osName: 'MagicOS',
        androidVersions: 'Android 11+',
        steps: {
            developerOptions: {
                title: 'adb.guide.step1Title',
                instructions: [
                    'adb.guide.steps.honor.dev.1',
                    'adb.guide.steps.honor.dev.2'
                ]
            },
            usbDebugging: {
                title: 'adb.guide.step2Title',
                oemSteps: [
                    'adb.guide.steps.honor.oem.1',
                    'adb.guide.steps.honor.oem.2',
                    'adb.guide.steps.honor.oem.3'
                ],
                standardSteps: [
                    'adb.guide.steps.honor.std.1',
                    'adb.guide.steps.honor.std.2'
                ]
            }
        },
        pathSummary: {
            buildNumber: 'adb.guide.path.honor.build',
            developerOptions: 'adb.guide.path.honor.dev'
        }
    },
    {
        id: 'xiaomi_poco_redmi',
        brand: 'Xiaomi / POCO / Redmi',
        osName: 'HyperOS / MIUI',
        androidVersions: 'All',
        steps: {
            developerOptions: {
                title: 'adb.guide.step1Title',
                instructions: [
                    'adb.guide.steps.xiaomi.dev.1',
                    'adb.guide.steps.xiaomi.dev.2'
                ]
            },
            usbDebugging: {
                title: 'adb.guide.step2Title',
                oemSteps: [
                    'adb.guide.steps.xiaomi.oem.1',
                    'adb.guide.steps.xiaomi.oem.2',
                    'adb.guide.steps.xiaomi.oem.3',
                    'adb.guide.steps.xiaomi.oem.4'
                ],
                standardSteps: [
                    'adb.guide.steps.xiaomi.std.1',
                    'adb.guide.steps.xiaomi.std.2',
                    'adb.guide.steps.xiaomi.std.3'
                ]
            }
        },
        pathSummary: {
            buildNumber: 'adb.guide.path.xiaomi.build',
            developerOptions: 'adb.guide.path.xiaomi.dev'
        }
    },
    {
        id: 'samsung',
        brand: 'Samsung',
        osName: 'OneUI',
        androidVersions: 'All',
        steps: {
            developerOptions: {
                title: 'adb.guide.step1Title',
                instructions: [
                    'adb.guide.steps.samsung.dev.1',
                    'adb.guide.steps.samsung.dev.2'
                ]
            },
            usbDebugging: {
                title: 'adb.guide.step2Title',
                oemSteps: [
                    'adb.guide.steps.samsung.oem.1',
                    'adb.guide.steps.samsung.oem.2',
                    'adb.guide.steps.samsung.oem.3'
                ],
                standardSteps: [
                    'adb.guide.steps.samsung.std.1',
                    'adb.guide.steps.samsung.std.2'
                ]
            }
        },
        pathSummary: {
            buildNumber: 'adb.guide.path.samsung.build',
            developerOptions: 'adb.guide.path.samsung.dev'
        }
    }
];
