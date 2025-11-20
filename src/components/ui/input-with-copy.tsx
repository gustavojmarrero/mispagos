import React, { useState, useEffect } from 'react';
import { Copy, Check, LucideIcon } from 'lucide-react';
import { Input } from './input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InputWithCopyProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: LucideIcon;
  maxLength?: number;
  formatValue?: (value: string) => string;
  unformatValue?: (value: string) => string;
  required?: boolean;
  type?: string;
  copyMessage?: string;
  className?: string;
}

export function InputWithCopy({
  id,
  value,
  onChange,
  placeholder,
  icon: Icon,
  maxLength,
  formatValue,
  unformatValue,
  required,
  type = 'text',
  copyMessage = 'Copiado al portapapeles',
  className,
}: InputWithCopyProps) {
  const [copied, setCopied] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);

  // Formatear el valor inicial y cuando cambia externamente
  useEffect(() => {
    if (value && formatValue) {
      setDisplayValue(formatValue(value));
    } else {
      setDisplayValue(value);
    }
  }, [value, formatValue]);

  const handleCopy = async () => {
    if (!value) return;

    try {
      // Usar el valor sin formato para copiar
      const valueToCopy = unformatValue ? unformatValue(value) : value;
      await navigator.clipboard.writeText(valueToCopy);
      setCopied(true);
      toast.success(copyMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Error al copiar');
      console.error('Failed to copy:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    let formattedValue = newValue;

    // Si hay una función de formateo, aplicarla
    if (formatValue) {
      formattedValue = formatValue(newValue);
    }

    setDisplayValue(formattedValue);
    onChange(formattedValue);
  };

  return (
    <div className={cn('relative', className)}>
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <Input
        id={id}
        type={type}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className={cn(
          'pr-10 transition-all',
          Icon && 'pl-10',
        )}
      />
      <button
        type="button"
        onClick={handleCopy}
        disabled={!value}
        className={cn(
          'absolute right-2 top-1/2 -translate-y-1/2 p-2 sm:p-1.5 rounded-md transition-all min-h-[40px] sm:min-h-0',
          'hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
          copied && 'text-green-600'
        )}
        title={value ? 'Copiar' : 'Sin valor para copiar'}
      >
        {copied ? <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
      </button>
    </div>
  );
}
