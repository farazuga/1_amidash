'use client';

import { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Loader2, FolderOpen } from 'lucide-react';
import { useProjectSearch } from '@/hooks/queries/use-per-diems';

interface ProjectSearchProps {
  value: { id: string | null; label: string };
  onChange: (project: {
    id: string | null;
    client_name: string;
    sales_order_number: string | null;
    delivery_state: string | null;
  } | null) => void;
  disabled?: boolean;
}

export function ProjectSearch({ value, onChange, disabled }: ProjectSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search query at 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: projects = [], isLoading } = useProjectSearch(debouncedQuery);

  const handleSelect = (project: {
    id: string;
    client_name: string;
    sales_order_number: string | null;
    delivery_state: string | null;
  }) => {
    onChange(project);
    setOpen(false);
    setQuery('');
  };

  const handleSelectOther = () => {
    onChange({
      id: null,
      client_name: 'Other',
      sales_order_number: null,
      delivery_state: null,
    });
    setOpen(false);
    setQuery('');
  };

  const formatLabel = (project: {
    client_name: string;
    sales_order_number: string | null;
  }) => {
    if (project.sales_order_number) {
      return `[${project.sales_order_number}] ${project.client_name}`;
    }
    return project.client_name;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {value.label || 'Search projects...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search projects..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="__other__"
                onSelect={handleSelectOther}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>Other (not project-specific)</span>
              </CommandItem>
            </CommandGroup>

            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {projects.length > 0 && (
              <CommandGroup heading="Projects">
                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.id}
                    onSelect={() => handleSelect(project)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{formatLabel(project)}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!isLoading &&
              projects.length === 0 &&
              debouncedQuery.length >= 2 && (
                <CommandEmpty>No projects found</CommandEmpty>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
