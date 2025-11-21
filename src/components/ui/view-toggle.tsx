import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div className={cn('flex items-center border rounded-lg p-1 bg-muted/50', className)}>
      <Button
        variant={value === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('grid')}
        className={cn(
          'h-8 px-3',
          value === 'grid' ? 'shadow-sm' : 'hover:bg-transparent'
        )}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-2">Grid</span>
      </Button>
      <Button
        variant={value === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('list')}
        className={cn(
          'h-8 px-3',
          value === 'list' ? 'shadow-sm' : 'hover:bg-transparent'
        )}
      >
        <List className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only sm:ml-2">Lista</span>
      </Button>
    </div>
  );
}
