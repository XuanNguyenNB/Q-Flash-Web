/**
 * Devices Page
 * 
 * List of supported devices with chipset information.
 */

import { useTranslation } from 'react-i18next';

export default function DevicesPage() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-foreground mb-4">
                {t('page.devices.title')}
            </h1>
            <p className="text-muted-foreground mb-8">
                {t('page.devices.description')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['SM8650', 'SM8550', 'SM8450', 'SDM845', 'SM7325', 'SM6225'].map((chipset) => (
                    <div
                        key={chipset}
                        className="p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors"
                    >
                        <h3 className="font-mono font-semibold text-foreground">{chipset}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Device list coming in Story 2.1
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
