/**
 * Custom Workflow Store
 *
 * Quản lý custom workflows với localStorage persistence
 * + Import/Export JSON
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workflow, BrandOption } from '@/types/workflow';
import { ALL_WORKFLOWS, BRAND_OPTIONS } from '@/data/workflowPresets';

interface CustomWorkflowState {
  // Custom workflows (user-created)
  customWorkflows: Workflow[];

  // Custom brands/models (user-created)
  customBrands: BrandOption[];

  // CRUD Workflows
  addWorkflow: (workflow: Workflow) => void;
  updateWorkflow: (id: string, workflow: Partial<Workflow>) => void;
  deleteWorkflow: (id: string) => void;
  duplicateWorkflow: (id: string) => Workflow | null;

  // CRUD Brands
  addBrand: (brand: BrandOption) => void;
  updateBrand: (id: string, brand: Partial<BrandOption>) => void;
  deleteBrand: (id: string) => void;

  // Import/Export
  exportToJSON: () => string;
  importFromJSON: (json: string) => { success: boolean; message: string };

  // Get all workflows (preset + custom)
  getAllWorkflows: () => Workflow[];

  // Get all brands (preset + custom)
  getAllBrands: () => BrandOption[];

  // Reset to defaults
  resetToDefaults: () => void;
}

export const useCustomWorkflowStore = create<CustomWorkflowState>()(
  persist(
    (set, get) => ({
      customWorkflows: [],
      customBrands: [],

      // Add workflow
      addWorkflow: (workflow) => {
        set((state) => ({
          customWorkflows: [...state.customWorkflows, {
            ...workflow,
            id: workflow.id || `custom-${Date.now()}`,
            isOfficial: false,
          }],
        }));
      },

      // Update workflow
      updateWorkflow: (id, updates) => {
        set((state) => ({
          customWorkflows: state.customWorkflows.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        }));
      },

      // Delete workflow
      deleteWorkflow: (id) => {
        set((state) => ({
          customWorkflows: state.customWorkflows.filter((w) => w.id !== id),
        }));
      },

      // Duplicate workflow
      duplicateWorkflow: (id) => {
        const state = get();
        const all = [...ALL_WORKFLOWS, ...state.customWorkflows];
        const original = all.find((w) => w.id === id);
        if (!original) return null;

        const newWorkflow: Workflow = {
          ...original,
          id: `custom-${Date.now()}`,
          name: `${original.name} (Copy)`,
          nameVi: `${original.nameVi} (Bản sao)`,
          isOfficial: false,
        };

        set((state) => ({
          customWorkflows: [...state.customWorkflows, newWorkflow],
        }));

        return newWorkflow;
      },

      // Add brand
      addBrand: (brand) => {
        set((state) => ({
          customBrands: [...state.customBrands, brand],
        }));
      },

      // Update brand
      updateBrand: (id, updates) => {
        set((state) => ({
          customBrands: state.customBrands.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        }));
      },

      // Delete brand
      deleteBrand: (id) => {
        set((state) => ({
          customBrands: state.customBrands.filter((b) => b.id !== id),
        }));
      },

      // Export to JSON
      exportToJSON: () => {
        const state = get();
        const exportData = {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          workflows: state.customWorkflows,
          brands: state.customBrands,
        };
        return JSON.stringify(exportData, null, 2);
      },

      // Import from JSON
      importFromJSON: (json) => {
        try {
          const data = JSON.parse(json);

          if (!data.version) {
            return { success: false, message: 'Invalid JSON format: missing version' };
          }

          const workflows = data.workflows || [];
          const brands = data.brands || [];

          // Validate workflows
          for (const w of workflows) {
            if (!w.id || !w.name || !w.steps) {
              return { success: false, message: `Invalid workflow: ${w.name || 'unknown'}` };
            }
          }

          set((state) => ({
            customWorkflows: [...state.customWorkflows, ...workflows],
            customBrands: [...state.customBrands, ...brands],
          }));

          return {
            success: true,
            message: `Imported ${workflows.length} workflows and ${brands.length} brands`
          };
        } catch (e) {
          return { success: false, message: `Parse error: ${e instanceof Error ? e.message : 'Unknown'}` };
        }
      },

      // Get all workflows
      getAllWorkflows: () => {
        const state = get();
        return [...ALL_WORKFLOWS, ...state.customWorkflows];
      },

      // Get all brands
      getAllBrands: () => {
        const state = get();
        return [...BRAND_OPTIONS, ...state.customBrands];
      },

      // Reset to defaults
      resetToDefaults: () => {
        set({ customWorkflows: [], customBrands: [] });
      },
    }),
    {
      name: 'qflash-custom-workflows',
    }
  )
);

/**
 * Helper: Get workflows by device (includes custom)
 * When model or osVersion is 'auto', skip that filter (used for auto-detected devices)
 */
export function getWorkflowsByDeviceWithCustom(
  brand: string | null,
  model: string | null,
  osVersion: string | null
): Workflow[] {
  const store = useCustomWorkflowStore.getState();
  const allWorkflows = store.getAllWorkflows();

  return allWorkflows.filter((workflow) => {
    if (workflow.brand === 'all') return true;
    if (brand && workflow.brand !== brand) return false;
    // Skip model/osVersion filter when 'auto' (auto-detected device)
    if (model && model !== 'auto' && workflow.models && workflow.models.length > 0 && !workflow.models.includes(model)) return false;
    if (osVersion && osVersion !== 'auto' && workflow.osVersions && workflow.osVersions.length > 0 && !workflow.osVersions.includes(osVersion)) return false;
    return true;
  });
}
