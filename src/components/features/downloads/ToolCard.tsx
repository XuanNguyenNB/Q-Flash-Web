import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/services/analytics';

export interface ToolCardProps {
    name: string;
    description: string;
    version: string;
    downloadUrl?: string;
    githubUrl?: string;
    trackingId: string;
    className?: string;
}

export function ToolCard({
    name,
    description,
    version,
    downloadUrl,
    githubUrl,
    trackingId,
    className,
}: ToolCardProps) {
    const { t } = useTranslation();

    const handleDownloadClick = () => {
        trackEvent('download', 'click', trackingId, name);
    };

    const handleGithubClick = () => {
        trackEvent('download', 'github', trackingId, name);
    };

    return (
        <Card
            className={cn('flex flex-col h-full transition-all hover:shadow-lg', className)}
            data-tool={trackingId}
        >
            <CardHeader className="flex-1">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xl">{name}</CardTitle>
                    </div>
                    <Badge variant="secondary">{version}</Badge>
                </div>
                <CardDescription className="text-sm text-balance leading-relaxed py-2">
                    {description}
                </CardDescription>
            </CardHeader>
            <CardFooter>
                <div className="w-full space-y-2">
                    {githubUrl && (
                        <Button
                            variant="outline"
                            className="w-full"
                            asChild
                            onClick={handleGithubClick}
                            data-action="visit"
                        >
                            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                                <Github className="mr-2 h-4 w-4" />
                                {t('downloads.common.visitGithub')}
                                <ExternalLink className="ml-2 h-4 w-4 opacity-50" />
                            </a>
                        </Button>
                    )}
                    {downloadUrl && (
                        <Button
                            variant="default"
                            className="w-full"
                            asChild
                            onClick={handleDownloadClick}
                            data-action="download"
                        >
                            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                {t('downloads.common.download')}
                                <ExternalLink className="ml-2 h-4 w-4 opacity-50" />
                            </a>
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
