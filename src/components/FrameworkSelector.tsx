import { useState } from 'react';
import {
  Zap, Clock, Target, Users, Truck, ShieldCheck, Eye,
  Lightbulb, TrendingUp, Brain, Rocket, Search, Award, Flame,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FrameworkRegistry } from '@/lib/frameworks/registry';
import type { FrameworkDefinition } from '@/lib/frameworks/types';

const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Clock, Target, Users, Truck, ShieldCheck, Eye,
  Lightbulb, TrendingUp, Brain, Rocket, Search, Award, Flame,
};

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] || Zap;
}

interface FrameworkSelectorProps {
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function FrameworkSelector({ selected, onChange }: FrameworkSelectorProps) {
  const frameworks = FrameworkRegistry.getAll();

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      // Must keep at least one selected
      if (selected.length > 1) {
        onChange(selected.filter(s => s !== id));
      }
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          Evaluation Frameworks
        </span>
        <span className="text-[10px] text-zinc-600">
          (select at least one)
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {frameworks.map((fw) => {
          const Icon = getIcon(fw.icon);
          const isSelected = selected.includes(fw.id);
          return (
            <button
              key={fw.id}
              onClick={() => toggle(fw.id)}
              className={cn(
                'relative flex items-start gap-3 p-4 rounded-lg border text-left transition-all',
                isSelected
                  ? 'border-cyan-500/50 bg-cyan-500/5'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              )}
            >
              {/* Check indicator */}
              <div className={cn(
                'absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center transition-all',
                isSelected
                  ? 'bg-cyan-500 text-white'
                  : 'border border-zinc-700'
              )}>
                {isSelected && <Check className="w-3 h-3" />}
              </div>

              {/* Icon */}
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                isSelected ? 'bg-cyan-500/10' : 'bg-zinc-800/50'
              )}>
                <Icon className={cn('w-5 h-5', isSelected ? fw.color : 'text-zinc-500')} />
              </div>

              {/* Content */}
              <div className="min-w-0 pr-6">
                <div className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-zinc-100' : 'text-zinc-400'
                )}>
                  {fw.name}
                </div>
                <div className="text-[11px] text-zinc-600 mt-0.5 line-clamp-2">
                  {fw.description}
                </div>
                <div className="text-[10px] text-zinc-700 mt-1">
                  {fw.stepOrder.length} evaluation steps
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
