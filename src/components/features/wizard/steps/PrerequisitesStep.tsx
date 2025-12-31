/**
 * PrerequisitesStep Component
 * 
 * Second step of the setup wizard.
 * Shows checklist of prerequisites for flashing device.
 */

import { useTranslation } from 'react-i18next';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Prerequisites step component
 * 
 * Displays checklist of requirements:
 * - Device in EDL mode
 * - USB cable connected
 * - WinUSB driver installed
 */
export function PrerequisitesStep() {
    const { t } = useTranslation();

    const prerequisites = [
        {
            key: 'edlMode',
            icon: CheckCircle2,
        },
        {
            key: 'usbCable',
            icon: CheckCircle2,
        },
        {
            key: 'driver',
            icon: CheckCircle2,
        },
    ];

    return (
        <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                    {t('wizard.prerequisites.title')}
                </h3>
                <p className="text-muted-foreground">
                    {t('wizard.prerequisites.description')}
                </p>
            </div>

            {/* Prerequisites checklist */}
            <div className="space-y-3">
                {prerequisites.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div
                            key={item.key}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                            <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="font-medium">
                                    {t(`wizard.prerequisites.items.${item.key}.title`)}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t(`wizard.prerequisites.items.${item.key}.description`)}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Help links */}
            <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                    {t('wizard.prerequisites.needHelp')}
                </p>
                <div className="flex flex-col gap-2">
                    <Link
                        to="/guide"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        {t('wizard.prerequisites.viewGuide')}
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Link
                        to="/downloads"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        {t('wizard.prerequisites.downloadDriver')}
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
