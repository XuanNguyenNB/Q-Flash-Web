import { useState } from 'react';
import { BackupConfirmDialog, BackupProgress } from '@/components/features/backup';
import { Button } from '@/components/ui/button';
import { useFlashStore } from '@/stores/flashStore';
import type { PartitionInfo } from '@/types';

/**
 * Test page for Backup components
 * Navigate to /test-backup to see this page
 */
export default function TestBackupPage() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const { startBackup, setBackupPartitionStatus, updateBackupProgress } = useFlashStore();

    // Mock partition data for testing
    const mockPartitions: PartitionInfo[] = [
        {
            name: 'boot',
            lun: 0,
            startSector: BigInt(1000),
            endSector: BigInt(2000),
            sizeInSectors: BigInt(1000),
            size: 512000, // 500KB
            sizeFormatted: '500 KB',
            typeGuid: 'test-guid-1',
            uniqueGuid: 'unique-1',
            attributes: BigInt(0),
            numSectors: BigInt(1000),
        },
        {
            name: 'system',
            lun: 0,
            startSector: BigInt(2000),
            endSector: BigInt(5000),
            sizeInSectors: BigInt(3000),
            size: 1536000, // 1.5MB
            sizeFormatted: '1.5 MB',
            typeGuid: 'test-guid-2',
            uniqueGuid: 'unique-2',
            attributes: BigInt(0),
            numSectors: BigInt(3000),
        },
        {
            name: 'vendor',
            lun: 0,
            startSector: BigInt(5000),
            endSector: BigInt(7000),
            sizeInSectors: BigInt(2000),
            size: 1024000, // 1MB
            sizeFormatted: '1 MB',
            typeGuid: 'test-guid-3',
            uniqueGuid: 'unique-3',
            attributes: BigInt(0),
            numSectors: BigInt(2000),
        },
    ];

    const handleConfirm = (directoryHandle: FileSystemDirectoryHandle) => {
        console.log('Directory selected:', directoryHandle.name);

        // Simulate backup process
        const totalSize = mockPartitions.reduce((sum, p) => sum + p.size, 0);
        startBackup(mockPartitions.map(p => p.name), directoryHandle.name, totalSize);

        // Simulate progress updates
        let currentIndex = 0;
        const interval = setInterval(() => {
            if (currentIndex < mockPartitions.length) {
                const partition = mockPartitions[currentIndex];

                // Set to in-progress
                setBackupPartitionStatus(partition.name, 'in-progress');
                updateBackupProgress(partition.name, partition.size / 2, partition.size);

                // After 1 second, mark as done
                setTimeout(() => {
                    setBackupPartitionStatus(partition.name, 'done');
                    currentIndex++;
                }, 1000);
            } else {
                clearInterval(interval);
            }
        }, 2000);
    };

    return (
        <div className="container mx-auto p-8 space-y-8">
            <div className="space-y-4">
                <h1 className="text-3xl font-bold">Backup Components Test Page</h1>
                <p className="text-muted-foreground">
                    Test các backup components đã tạo
                </p>
            </div>

            {/* Test BackupConfirmDialog */}
            <div className="space-y-4 border rounded-lg p-6">
                <h2 className="text-xl font-semibold">1. BackupConfirmDialog</h2>
                <p className="text-sm text-muted-foreground">
                    Click button để mở dialog xác nhận backup
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                    Open Backup Dialog
                </Button>

                <BackupConfirmDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    partitions={mockPartitions}
                    onConfirm={handleConfirm}
                />
            </div>

            {/* Test BackupProgress */}
            <div className="space-y-4 border rounded-lg p-6">
                <h2 className="text-xl font-semibold">2. BackupProgress</h2>
                <p className="text-sm text-muted-foreground">
                    Component sẽ hiển thị khi có backup đang chạy
                </p>
                <BackupProgress onCancel={() => console.log('Cancel clicked')} />
            </div>

            {/* Instructions */}
            <div className="space-y-4 border rounded-lg p-6 bg-muted/50">
                <h2 className="text-xl font-semibold">📝 Test Instructions</h2>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Click "Open Backup Dialog" để test BackupConfirmDialog</li>
                    <li>Trong dialog, xem danh sách 3 partitions (boot, system, vendor)</li>
                    <li>Click "Choose Location" để test File System Access API</li>
                    <li>Chọn một folder (sẽ không thực sự backup, chỉ simulate)</li>
                    <li>Xem BackupProgress component hiển thị tiến trình</li>
                    <li>Kiểm tra partition status icons thay đổi (pending → in-progress → done)</li>
                    <li>Test i18n bằng cách đổi ngôn ngữ trong settings</li>
                </ol>
            </div>

            {/* Current Store State */}
            <div className="space-y-4 border rounded-lg p-6 bg-muted/50">
                <h2 className="text-xl font-semibold">🔍 Current Backup State</h2>
                <pre className="text-xs overflow-auto bg-background p-4 rounded">
                    {JSON.stringify(useFlashStore.getState(), (key, value) =>
                        typeof value === 'bigint' ? value.toString() :
                            value instanceof Map ? Object.fromEntries(value) :
                                value
                        , 2)}
                </pre>
            </div>
        </div>
    );
}
