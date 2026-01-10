/**
 * Workflow Editor Page
 *
 * Trang quản lý workflows: Thêm/Sửa/Xóa + Import/Export JSON
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// Stores
import { useCustomWorkflowStore, getWorkflowsByDeviceWithCustom } from '@/stores/customWorkflowStore';
import { ALL_WORKFLOWS, BRAND_OPTIONS } from '@/data/workflowPresets';

// Types
import type { Workflow as WorkflowType, WorkflowStep, WorkflowCategory, WorkflowDifficulty, WorkflowStepType } from '@/types/workflow';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Icons
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Download,
  Upload,
  FileJson,
  Workflow,
  Terminal,
  Package,
  User,
  Clock,
  ChevronUp,
  ChevronDown,
  X,
  Save,
  RotateCcw,
  Shield,
  Zap,
  Star,
  Settings,
  GripVertical,
  Navigation,
  Bell,
} from 'lucide-react';

import { cn } from '@/lib/utils';

// Step type icons
const STEP_TYPE_ICONS: Record<WorkflowStepType, React.ReactNode> = {
  'adb-command': <Terminal className="w-4 h-4" />,
  'install-apk': <Package className="w-4 h-4" />,
  'uninstall-packages': <Trash2 className="w-4 h-4" />,
  'user-action': <User className="w-4 h-4" />,
  'guided-action': <Navigation className="w-4 h-4" />,
  'optimize-notifications': <Bell className="w-4 h-4" />,
  'delay': <Clock className="w-4 h-4" />,
};

// Category options
const CATEGORY_OPTIONS: { value: WorkflowCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'cleanup', label: 'Dọn dẹp', icon: <Trash2 className="w-4 h-4" /> },
  { value: 'optimization', label: 'Tối ưu hóa', icon: <Zap className="w-4 h-4" /> },
  { value: 'gaming', label: 'Gaming', icon: <Star className="w-4 h-4" /> },
  { value: 'google-services', label: 'Google Services', icon: <Shield className="w-4 h-4" /> },
  { value: 'vietnam-setup', label: 'Thiết lập VN', icon: <Settings className="w-4 h-4" /> },
  { value: 'custom', label: 'Tùy chỉnh', icon: <Settings className="w-4 h-4" /> },
];

// Difficulty options
const DIFFICULTY_OPTIONS: { value: WorkflowDifficulty; label: string; color: string }[] = [
  { value: 'easy', label: 'Dễ', color: 'bg-green-500' },
  { value: 'medium', label: 'Trung bình', color: 'bg-yellow-500' },
  { value: 'hard', label: 'Khó', color: 'bg-red-500' },
];

// Empty workflow template
const createEmptyWorkflow = (): WorkflowType => ({
  id: `custom-${Date.now()}`,
  name: '',
  nameVi: '',
  description: '',
  descriptionVi: '',
  brand: 'all',
  models: [],
  osVersions: [],
  category: 'custom',
  tags: [],
  difficulty: 'easy',
  estimatedMinutes: 5,
  isOfficial: false,
  steps: [],
  aiAssistEnabled: false,
});

// Empty step template
const createEmptyStep = (): WorkflowStep => ({
  id: `step-${Date.now()}`,
  type: 'adb-command',
  title: '',
  titleVi: '',
  command: '',
  canSkip: true,
});

export function WorkflowEditorPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store
  const {
    customWorkflows,
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    duplicateWorkflow,
    exportToJSON,
    importFromJSON,
    resetToDefaults,
  } = useCustomWorkflowStore();

  // State
  const [selectedTab, setSelectedTab] = useState<'preset' | 'custom'>('custom');
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // All workflows
  const presetWorkflows = ALL_WORKFLOWS;

  // Handle create new
  const handleCreate = () => {
    setEditingWorkflow(createEmptyWorkflow());
    setIsDialogOpen(true);
  };

  // Handle edit
  const handleEdit = (workflow: WorkflowType) => {
    setEditingWorkflow({ ...workflow });
    setIsDialogOpen(true);
  };

  // Handle duplicate
  const handleDuplicate = (id: string) => {
    const newWorkflow = duplicateWorkflow(id);
    if (newWorkflow) {
      toast.success('Đã nhân đôi workflow');
      setSelectedTab('custom');
    }
  };

  // Handle delete
  const handleDelete = (id: string) => {
    deleteWorkflow(id);
    toast.success('Đã xóa workflow');
    setDeleteConfirmId(null);
  };

  // Handle save
  const handleSave = () => {
    if (!editingWorkflow) return;

    if (!editingWorkflow.name || !editingWorkflow.nameVi) {
      toast.error('Vui lòng nhập tên workflow');
      return;
    }

    if (editingWorkflow.steps.length === 0) {
      toast.error('Workflow phải có ít nhất 1 bước');
      return;
    }

    // Check if updating existing or creating new
    const existing = customWorkflows.find((w) => w.id === editingWorkflow.id);
    if (existing) {
      updateWorkflow(editingWorkflow.id, editingWorkflow);
      toast.success('Đã cập nhật workflow');
    } else {
      addWorkflow(editingWorkflow);
      toast.success('Đã tạo workflow mới');
    }

    setIsDialogOpen(false);
    setEditingWorkflow(null);
  };

  // Handle export
  const handleExport = () => {
    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qflash-workflows-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file JSON');
  };

  // Handle import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      const result = importFromJSON(json);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle reset
  const handleReset = () => {
    resetToDefaults();
    toast.success('Đã xóa tất cả workflows tùy chỉnh');
    setResetConfirmOpen(false);
  };

  // Step editor helpers
  const addStep = () => {
    if (!editingWorkflow) return;
    setEditingWorkflow({
      ...editingWorkflow,
      steps: [...editingWorkflow.steps, createEmptyStep()],
    });
  };

  const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
    if (!editingWorkflow) return;
    const newSteps = [...editingWorkflow.steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setEditingWorkflow({ ...editingWorkflow, steps: newSteps });
  };

  const deleteStep = (index: number) => {
    if (!editingWorkflow) return;
    const newSteps = editingWorkflow.steps.filter((_, i) => i !== index);
    setEditingWorkflow({ ...editingWorkflow, steps: newSteps });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (!editingWorkflow) return;
    const newSteps = [...editingWorkflow.steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setEditingWorkflow({ ...editingWorkflow, steps: newSteps });
  };

  // Render workflow card
  const renderWorkflowCard = (workflow: WorkflowType, isPreset: boolean) => (
    <Card key={workflow.id} className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate">
              {workflow.nameVi || workflow.name}
            </CardTitle>
            <CardDescription className="text-xs line-clamp-2 mt-1">
              {workflow.descriptionVi || workflow.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isPreset && (
              <Badge variant="secondary" className="text-[10px]">
                <Shield className="w-3 h-3 mr-1" />
                Preset
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="text-[10px]">
            {CATEGORY_OPTIONS.find((c) => c.value === workflow.category)?.label || workflow.category}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {workflow.steps.length} bước
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {workflow.brand === 'all' ? 'Tất cả' : workflow.brand}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {isPreset ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => handleDuplicate(workflow.id)}
              >
                <Copy className="w-3 h-3" />
                Nhân đôi
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => handleEdit(workflow)}
              >
                <Pencil className="w-3 h-3" />
                Sửa
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => handleDuplicate(workflow.id)}
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs gap-1"
                onClick={() => setDeleteConfirmId(workflow.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="w-6 h-6" />
            Quản lý Quy trình
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Thêm, sửa, xóa và import/export các quy trình tự động
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Import JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Tạo mới
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'preset' | 'custom')}>
        <TabsList>
          <TabsTrigger value="custom" className="gap-2">
            <Settings className="w-4 h-4" />
            Tùy chỉnh ({customWorkflows.length})
          </TabsTrigger>
          <TabsTrigger value="preset" className="gap-2">
            <Shield className="w-4 h-4" />
            Mặc định ({presetWorkflows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="custom" className="mt-4">
          {customWorkflows.length === 0 ? (
            <Card className="p-8 text-center">
              <FileJson className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">Chưa có workflow tùy chỉnh</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Tạo workflow mới hoặc nhân đôi từ preset
              </p>
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Tạo workflow đầu tiên
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customWorkflows.map((w) => renderWorkflowCard(w, false))}
            </div>
          )}

          {customWorkflows.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setResetConfirmOpen(true)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Xóa tất cả tùy chỉnh
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preset" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presetWorkflows.map((w) => renderWorkflowCard(w, true))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow && customWorkflows.find((w) => w.id === editingWorkflow.id)
                ? 'Chỉnh sửa Workflow'
                : 'Tạo Workflow mới'}
            </DialogTitle>
            <DialogDescription>
              Điền thông tin và thêm các bước cho workflow
            </DialogDescription>
          </DialogHeader>

          {editingWorkflow && (
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {/* Basic Info - Vietnamese Only */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tên quy trình</label>
                  <Input
                    value={editingWorkflow.nameVi}
                    onChange={(e) => {
                      setEditingWorkflow({
                        ...editingWorkflow,
                        nameVi: e.target.value,
                        name: e.target.value // sync to name field
                      });
                    }}
                    placeholder="VD: Dọn dẹp máy Honor Trung Quốc"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mô tả</label>
                  <Textarea
                    value={editingWorkflow.descriptionVi}
                    onChange={(e) => {
                      setEditingWorkflow({
                        ...editingWorkflow,
                        descriptionVi: e.target.value,
                        description: e.target.value // sync to description field
                      });
                    }}
                    placeholder="Mô tả ngắn gọn về quy trình này..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hãng</label>
                  <Select
                    value={editingWorkflow.brand}
                    onValueChange={(v) => setEditingWorkflow({ ...editingWorkflow, brand: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả</SelectItem>
                      {BRAND_OPTIONS.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.icon} {b.nameVi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Danh mục</label>
                  <Select
                    value={editingWorkflow.category}
                    onValueChange={(v) =>
                      setEditingWorkflow({ ...editingWorkflow, category: v as WorkflowCategory })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Độ khó</label>
                  <Select
                    value={editingWorkflow.difficulty}
                    onValueChange={(v) =>
                      setEditingWorkflow({ ...editingWorkflow, difficulty: v as WorkflowDifficulty })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTY_OPTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Thời gian (phút)</label>
                  <Input
                    type="number"
                    min={1}
                    value={editingWorkflow.estimatedMinutes}
                    onChange={(e) =>
                      setEditingWorkflow({
                        ...editingWorkflow,
                        estimatedMinutes: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Các bước ({editingWorkflow.steps.length})
                  </label>
                  <Button size="sm" variant="outline" onClick={addStep}>
                    <Plus className="w-4 h-4 mr-1" />
                    Thêm bước
                  </Button>
                </div>

                <ScrollArea className="h-[300px] border rounded-lg p-3">
                  {editingWorkflow.steps.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Chưa có bước nào. Nhấn "Thêm bước" để bắt đầu.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {editingWorkflow.steps.map((step, index) => (
                        <Card key={step.id} className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col gap-1 pt-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => moveStep(index, 'up')}
                                disabled={index === 0}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => moveStep(index, 'down')}
                                disabled={index === editingWorkflow.steps.length - 1}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="shrink-0">
                                  #{index + 1}
                                </Badge>
                                <Select
                                  value={step.type}
                                  onValueChange={(v) =>
                                    updateStep(index, { type: v as WorkflowStepType })
                                  }
                                >
                                  <SelectTrigger className="w-48">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="adb-command">
                                      <div className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4" />
                                        Lệnh ADB
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="install-apk">
                                      <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Cài APK
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="uninstall-packages">
                                      <div className="flex items-center gap-2">
                                        <Trash2 className="w-4 h-4" />
                                        Gỡ ứng dụng
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="user-action">
                                      <div className="flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Hành động người dùng
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="delay">
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Chờ
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <Input
                                  placeholder="Tiêu đề bước"
                                  value={step.titleVi || ''}
                                  onChange={(e) => updateStep(index, {
                                    titleVi: e.target.value,
                                    title: e.target.value // sync
                                  })}
                              />

                              {/* Type-specific fields */}
                              {step.type === 'adb-command' && (
                                <Input
                                  placeholder="Lệnh ADB (VD: settings put ...)"
                                  value={step.command || ''}
                                  onChange={(e) => updateStep(index, { command: e.target.value })}
                                  className="font-mono text-sm"
                                />
                              )}

                              {step.type === 'install-apk' && (
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    placeholder="Đường dẫn APK (URL hoặc local)"
                                    value={step.apkUrl || ''}
                                    onChange={(e) => updateStep(index, { apkUrl: e.target.value })}
                                  />
                                  <Input
                                    placeholder="Tên APK"
                                    value={step.apkName || ''}
                                    onChange={(e) => updateStep(index, { apkName: e.target.value })}
                                  />
                                </div>
                              )}

                              {step.type === 'uninstall-packages' && (
                                <Textarea
                                  placeholder="Tên package (mỗi dòng 1 package)"
                                  value={step.packages?.join('\n') || ''}
                                  onChange={(e) =>
                                    updateStep(index, {
                                      packages: e.target.value.split('\n').filter((p) => p.trim()),
                                    })
                                  }
                                  rows={3}
                                  className="font-mono text-sm"
                                />
                              )}

                              {step.type === 'user-action' && (
                                <Input
                                  placeholder="Hướng dẫn cho người dùng"
                                  value={step.userPromptVi || ''}
                                  onChange={(e) => updateStep(index, {
                                    userPromptVi: e.target.value,
                                    userPrompt: e.target.value // sync
                                  })}
                                />
                              )}

                              {step.type === 'delay' && (
                                <Input
                                  type="number"
                                  placeholder="Thời gian chờ (ms)"
                                  value={step.delayMs || 1000}
                                  onChange={(e) =>
                                    updateStep(index, { delayMs: parseInt(e.target.value) || 1000 })
                                  }
                                />
                              )}
                            </div>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteStep(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Workflow sẽ bị xóa vĩnh viễn. Bạn không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirm Dialog */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tất cả tùy chỉnh?</AlertDialogTitle>
            <AlertDialogDescription>
              Tất cả workflows và brands tùy chỉnh sẽ bị xóa. Bạn không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReset}
            >
              Xóa tất cả
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
