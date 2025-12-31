import { useTranslation } from 'react-i18next';
import { ToolCard, RomCard } from '@/components/features/downloads';

export default function DownloadsPage() {
    const { t } = useTranslation();

    const companionTools = [
        {
            name: 'Q-FLASH-FORGE',
            description: t('downloads.companionTools.qFlashForge.description'),
            version: t('downloads.companionTools.qFlashForge.version'),
            githubUrl: 'https://github.com/XuanNguyenNB/Q-FLASH-FORGE/releases',
            trackingId: 'q-flash-forge',
        },
        {
            name: 'Android Platform Tools',
            description: t('downloads.companionTools.platformTools.description'),
            version: t('downloads.companionTools.platformTools.version'),
            downloadUrl: 'https://developer.android.com/tools/releases/platform-tools',
            trackingId: 'platform-tools',
        },
        {
            name: 'Zadig',
            description: t('downloads.companionTools.zadig.description'),
            version: t('downloads.companionTools.zadig.version'),
            downloadUrl: 'https://zadig.akeo.ie/',
            trackingId: 'zadig',
        },
    ];

    const stockRoms = [
        {
            device: 'Oppo Find X7 Ultra',
            brand: 'Oppo',
            chipset: 'SM8650 - Snapdragon 8 Gen 3',
            version: 'PHY110_15.0.0.801CN01',
            size: '9.68 GB',
            downloadUrl: 'https://drive.google.com/uc?export=download&id=1TzyCHVOmwp4ub2JKfZOin5shD_59uMAh',
            category: 'unbrick',
        },
        {
            device: 'Oppo Find X6 Pro',
            brand: 'Oppo',
            chipset: 'SM8550 - Snapdragon 8 Gen 2',
            version: 'PGEM10_A.32',
            size: '~8 GB',
            downloadUrl: 'https://drive.google.com/uc?export=download&id=1GSVyWl6rGWj8HcLEhHoHfFYWsG45RGcO',
            category: 'unbrick',
        },
        {
            device: 'Oppo Find N5',
            brand: 'Oppo',
            chipset: 'SM8750 - Snapdragon 8 Elite',
            version: 'PKH110_15.0.1.104CN01',
            size: '~10 GB',
            downloadUrl: 'https://drive.google.com/uc?export=download&id=1hLxS89oc54aFHfQ44ixvnFxf4EfVwqu3',
            category: 'unbrick',
        },
    ];

    return (
        <div className="container mx-auto py-8 space-y-8">
            {/* Page Header */}
            <header className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    {t('downloads.title')}
                </h1>
                <p className="text-muted-foreground text-lg">
                    {t('downloads.description')}
                </p>
            </header>

            {/* Companion Tools Section */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">
                    {t('downloads.companionTools.title')}
                </h2>
                <p className="text-muted-foreground">
                    {t('downloads.companionTools.description')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companionTools.map((tool) => (
                        <ToolCard key={tool.trackingId} {...tool} />
                    ))}
                </div>
            </section>

            {/* Stock ROMs Section */}
            <section className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">
                    {t('downloads.stockRoms.title')}
                </h2>
                <p className="text-muted-foreground">
                    {t('downloads.stockRoms.description')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stockRoms.map((rom) => (
                        <RomCard key={rom.device} {...rom} />
                    ))}
                </div>
            </section>
        </div>
    );
}

