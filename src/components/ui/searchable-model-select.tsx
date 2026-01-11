/**
 * SearchableModelSelect Component
 *
 * A searchable combobox for selecting phone models.
 * Supports filtering by model name with Vietnamese diacritics normalization.
 */

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ModelOption {
  id: string;
  name: string;
}

interface SearchableModelSelectProps {
  models: ModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Normalize Vietnamese text for search (remove diacritics)
 */
function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function SearchableModelSelect({
  models,
  value,
  onValueChange,
  placeholder = 'Chọn model...',
  searchPlaceholder = 'Tìm model...',
  emptyText = 'Không tìm thấy model.',
  disabled = false,
  className,
}: SearchableModelSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Find selected model for display
  const selectedModel = models.find((model) => model.id === value);

  // Filter models based on search query
  const filteredModels = React.useMemo(() => {
    if (!searchQuery.trim()) return models;

    const normalizedQuery = normalizeVietnamese(searchQuery);
    return models.filter((model) => {
      const normalizedName = normalizeVietnamese(model.name);
      return normalizedName.includes(normalizedQuery);
    });
  }, [models, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between h-8 text-xs font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {selectedModel ? selectedModel.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-3 w-3 shrink-0 opacity-50" />
            <input
              className="flex h-9 w-full rounded-md bg-transparent py-2 text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {filteredModels.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.id}
                  onSelect={() => {
                    onValueChange(model.id);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-3 w-3',
                      value === model.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{model.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
