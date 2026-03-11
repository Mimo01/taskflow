/**
 * StepIndicator — horizontal step progress indicator for the onboarding wizard.
 *
 * Completed steps show a green CheckCircle2 icon.
 * Current step is highlighted with the primary accent color.
 * Future steps are muted/neutral.
 */
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  completedSteps: number[];
}

export default function StepIndicator({ steps, currentStep, completedSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center w-full gap-0">
      {steps.map((label, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = index === currentStep;
        const isFuture = index > currentStep && !isCompleted;

        return (
          <div key={index} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors',
                  isCompleted &&
                    'bg-green-500 border-green-500 text-white',
                  isCurrent &&
                    !isCompleted &&
                    'bg-primary border-primary text-primary-foreground',
                  isFuture && 'bg-muted border-muted-foreground/30 text-muted-foreground',
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" aria-label="completed" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs whitespace-nowrap',
                  isCompleted && 'text-green-600',
                  isCurrent && !isCompleted && 'text-primary font-medium',
                  isFuture && 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-12 mx-1 -mt-5',
                  isCompleted ? 'bg-green-500' : 'bg-muted-foreground/30',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
