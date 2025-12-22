import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RevendedoraAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  revendedoras: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function RevendedoraAutocomplete({
  value,
  onChange,
  revendedoras,
  placeholder = "Ex: Maria Silva",
  disabled = false,
  className
}: RevendedoraAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filtrar revendedoras baseado no input
  const filteredRevendedoras = value.trim().length > 0
    ? revendedoras.filter(r => 
        r.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8) // Limitar a 8 sugestões
    : [];

  const showSuggestions = isOpen && filteredRevendedoras.length > 0 && value.trim().length > 0;

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelect = (revendedora: string) => {
    onChange(revendedora);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredRevendedoras.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredRevendedoras.length) {
          handleSelect(filteredRevendedoras[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Delay closing to allow click on suggestion
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 150);
  };

  const handleFocus = () => {
    if (value.trim().length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      
      {showSuggestions && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-md"
          role="listbox"
        >
          {filteredRevendedoras.map((revendedora, index) => (
            <li
              key={revendedora}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors",
                index === highlightedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onClick={() => handleSelect(revendedora)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <HighlightMatch text={revendedora} query={value} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Componente auxiliar para destacar o texto correspondente
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const startIndex = lowerText.indexOf(lowerQuery);
  
  if (startIndex === -1) return <span>{text}</span>;
  
  const beforeMatch = text.slice(0, startIndex);
  const match = text.slice(startIndex, startIndex + query.length);
  const afterMatch = text.slice(startIndex + query.length);
  
  return (
    <span>
      {beforeMatch}
      <span className="font-semibold text-primary">{match}</span>
      {afterMatch}
    </span>
  );
}
