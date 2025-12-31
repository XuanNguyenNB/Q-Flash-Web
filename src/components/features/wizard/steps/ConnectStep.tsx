/**
 * ConnectStep Component
 * 
 * Fourth step of the setup wizard.
 * Handles device connection using useWebUSB hook.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useWebUSB } from '@/hooks/useWebUSB';
import { useDeviceStore } from '@/stores/deviceStore';
import { Loader2, CheckCircle, XCircle, Usb } from 'lucide-react';

/**
 * Connect step component
 * 
 * Shows connection button and status.
 * Handles connection flow with error handling and retry.
 */
export function ConnectStep() {
    const { t } = useTranslation();
    const { connect } = useWebUSB();
    const isConnected = useDeviceStore((state) => state.isConnected);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            await connect();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('wizard.connect.errorGeneric'));
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="space-y-6 py-4">
            {/* Title */}
            <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                    {t('wizard.connect.title')}
                </h3>
                <p className="text-muted-foreground">
                    {t('wizard.connect.description')}
                </p>
            </div>

            {/* Connection status */}
            <div className="flex flex-col items-center gap-4 py-6">
                {/* Not connected - show connect button */}
                {!isConnected && !isConnecting && !error && (
                    <>
                        <div className="rounded-full bg-muted p-6">
                            <Usb className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <Button onClick={handleConnect} size="lg" className="w-full max-w-xs">
                            {t('wizard.connect.connectButton')}
                        </Button>
                    </>
                )}

                {/* Connecting - show spinner */}
                {isConnecting && (
                    <>
                        <div className="rounded-full bg-primary/10 p-6">
                            <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="font-medium">{t('wizard.connect.connecting')}</p>
                            <p className="text-sm text-muted-foreground">
                                {t('wizard.connect.connectingHint')}
                            </p>
                        </div>
                    </>
                )}

                {/* Connected - show success */}
                {isConnected && (
                    <>
                        <div className="rounded-full bg-green-500/10 p-6">
                            <CheckCircle className="h-12 w-12 text-green-600" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="font-medium text-green-900 dark:text-green-100">
                                {t('wizard.connect.connected')}
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300">
                                {t('wizard.connect.connectedHint')}
                            </p>
                        </div>
                    </>
                )}

                {/* Error - show error message and retry */}
                {error && !isConnecting && (
                    <>
                        <div className="rounded-full bg-red-500/10 p-6">
                            <XCircle className="h-12 w-12 text-red-600" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="font-medium text-red-900 dark:text-red-100">
                                {t('wizard.connect.error')}
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {error}
                            </p>
                        </div>
                        <Button onClick={handleConnect} variant="outline" className="w-full max-w-xs">
                            {t('wizard.connect.retry')}
                        </Button>
                    </>
                )}
            </div>

            {/* Help text */}
            {!isConnected && (
                <div className="text-sm text-muted-foreground text-center">
                    {t('wizard.connect.helpText')}
                </div>
            )}
        </div>
    );
}
