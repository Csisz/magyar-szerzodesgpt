import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50",
        "placeholder:text-slate-400",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Autofill elleni fix
        "[&:-webkit-autofill]:bg-slate-800 [&:-webkit-autofill]:text-slate-50 [&:-webkit-autofill]:shadow-[inset_0_0_0px_9999px_rgb(30,41,59)]",
        "focus:bg-slate-800",
        "focus-visible:bg-slate-800",
        "active:bg-slate-800",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
