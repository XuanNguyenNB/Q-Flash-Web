import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Smartphone, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface RomCardProps {
    device: string;
    brand: string;
    chipset: string;
    version: string;
    size: string;
    downloadUrl: string;
    category?: string;
    className?: string;
}

export function RomCard({
    device,
    brand,
    chipset,
    version,
    size,
    downloadUrl,
    category = 'unbrick',
    className,
}: RomCardProps) {
    const { t } = useTranslation();

    const handleClick = () => {
        // Placeholder for future analytics
        console.log(`ROM download clicked: ${device}`);
    };

    return (
        <Card
            className={cn('flex flex-col h-full transition-all hover:shadow-lg hover:border-primary/50', className)}
            data-rom={device.toLowerCase().replace(/\s+/g, '-')}
            data-category={category}
        >
            <CardHeader className="flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                                {brand}
                            </Badge>
                            {category === 'unbrick' && (
                                <Badge variant="destructive" className="text-xs">
                                    {t('downloads.stockRoms.unbrick')}
                                </Badge>
                            )}
                        </div>
                        <CardTitle className="text-lg leading-tight">{device}</CardTitle>
                    </div>
                </div>

                <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Cpu className="h-4 w-4" />
                        <span>{chipset}</span>
                    </div>
                    <CardDescription className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                        {version}
                    </CardDescription>
                </div>
            </CardHeader>

            <CardFooter className="flex flex-col gap-2">
                <div className="w-full flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t('downloads.stockRoms.size')}: {size}</span>
                </div>
                <Button
                    variant="default"
                    className="w-full"
                    asChild
                    onClick={handleClick}
                    data-action="download-rom"
                >
                    <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        {t('downloads.common.download')}
                        <ExternalLink className="ml-2 h-4 w-4 opacity-50" />
                    </a>
                </Button>
            </CardFooter>
        </Card>
    );
}
