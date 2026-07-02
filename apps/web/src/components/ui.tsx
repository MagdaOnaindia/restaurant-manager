"use client";

import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

// Primitivas de UI compartidas del backoffice (estilo shadcn simplificado).

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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60",
        {
          primary: "bg-brand-600 text-white hover:bg-brand-700",
          secondary: "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100",
          ghost: "text-neutral-700 hover:bg-neutral-100",
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
          "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200",
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
      className={clsx("rounded-xl border border-neutral-200 bg-white p-6 shadow-sm", className)}
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
