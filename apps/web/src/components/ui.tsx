"use client";

import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

// Shared back-office UI primitives (simplified shadcn style).

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }
>(function Button({ className, variant = "primary", loading, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60",
        {
          primary: "bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700",
          secondary: "border border-neutral-200 bg-white text-neutral-800 hover:border-brand-200 hover:bg-brand-50/60",
          ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
          danger: "bg-red-600 text-white hover:bg-red-700",
        }[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(
          "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-[3px] focus:ring-brand-100",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={clsx("mb-1 block text-sm font-medium text-neutral-700", className)} {...props} />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx("rounded-lg border px-4 py-3 text-sm", {
        "border-red-200 bg-red-50 text-red-800": variant === "error",
        "border-green-200 bg-green-50 text-green-800": variant === "success",
        "border-blue-200 bg-blue-50 text-blue-800": variant === "info",
      })}
    >
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  );
}
