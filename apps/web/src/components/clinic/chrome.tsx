import {
  cloneElement,
  useId,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cx } from '@/components/ui/cx';

const buttonClass =
  'inline-flex min-h-[var(--tap)] w-full items-center justify-center rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9890a] disabled:opacity-50 sm:w-auto';

const tones = {
  primary: 'bg-[#c9890a] text-white hover:bg-[#b37808]',
  secondary: 'border border-[#d7cbb8] bg-white text-[#1c2430] hover:bg-[#f6f1e8]',
  danger: 'border border-[#e7c2b8] bg-white text-[#8c3a2f] hover:bg-[#fdeceb]',
} as const;

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: keyof typeof tones;
}

export const ActionButton = ({
  tone = 'secondary',
  className,
  type = 'button',
  ...props
}: ActionButtonProps) => (
  <button type={type} className={cx(buttonClass, tones[tone], className)} {...props} />
);

export const fieldClass =
  'h-11 w-full rounded-md border border-[#d7cbb8] bg-white px-3 text-[16px] text-[#1c2430] outline-none focus-visible:ring-2 focus-visible:ring-[#c9890a] sm:h-9 sm:text-sm';

export const CommandBar = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col gap-2 border-b border-[#e4d8c6] bg-[#fffdf8] px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
    {children}
  </div>
);

export const PanelTitle = ({ title, meta }: { title: string; meta?: string | undefined }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e4d8c6] px-3 py-3">
    <h2 className="text-base font-semibold text-[#2c3848]">{title}</h2>
    {meta ? <p className="text-xs text-[#5c6b7a]">{meta}</p> : null}
  </div>
);

export const Field = ({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) => {
  const generatedId = useId();
  const controlId = children.props.id ?? generatedId;
  return (
    <label
      htmlFor={controlId}
      className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#5c6b7a]"
    >
      <span>{label}</span>
      {cloneElement(children, { id: controlId })}
    </label>
  );
};

export const MissingRecord = ({ onBack }: { onBack: () => void }) => (
  <div className="space-y-3 p-4">
    <p className="text-sm text-[#3d4b5c]">
      Запись не найдена. Её могли пометить на удаление в другом списке.
    </p>
    <ActionButton onClick={onBack}>К списку</ActionButton>
  </div>
);
