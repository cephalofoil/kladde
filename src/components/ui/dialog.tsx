"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className,
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, forwardedRef) => {
    const contentRef = React.useRef<React.ElementRef<
        typeof DialogPrimitive.Content
    > | null>(null);

    const setRefs = React.useCallback(
        (node: React.ElementRef<typeof DialogPrimitive.Content> | null) => {
            contentRef.current = node;

            if (typeof forwardedRef === "function") {
                forwardedRef(node);
            } else if (forwardedRef) {
                forwardedRef.current = node;
            }
        },
        [forwardedRef],
    );

    const handleOpenAutoFocus = React.useCallback((e: Event) => {
        e.preventDefault();

        if (typeof window !== "undefined") {
            window.getSelection?.()?.removeAllRanges();
        }

        const root = contentRef.current;
        if (!root) return;

        const preferred = root.querySelector<HTMLElement>(
            "[data-dialog-initial-focus]",
        );
        if (preferred) {
            preferred.focus({ preventScroll: true });
            return;
        }

        const firstFocusable = root.querySelector<HTMLElement>(
            [
                "input:not([disabled])",
                "textarea:not([disabled])",
                "select:not([disabled])",
                "button:not([disabled]):not([data-dialog-close])",
                "[tabindex]:not([tabindex='-1']):not([data-dialog-close])",
                "a[href]",
            ].join(","),
        );

        if (firstFocusable) {
            firstFocusable.focus({ preventScroll: true });
        } else {
            root.focus({ preventScroll: true });
        }
    }, []);

    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                ref={setRefs}
                tabIndex={-1}
                onOpenAutoFocus={handleOpenAutoFocus}
                className={cn(
                    "fixed left-[50%] top-[50%] z-[130] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card/95 backdrop-blur-md p-6 shadow-2xl",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                    "rounded-xl focus:outline-none focus-visible:outline-none",
                    className,
                )}
                {...props}
            >
                <span
                    data-dialog-initial-focus
                    tabIndex={0}
                    aria-hidden="true"
                    className="sr-only"
                />
                {children}
                <DialogPrimitive.Close
                    data-dialog-close
                    className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPortal>
    );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col space-y-1.5 text-center sm:text-left",
            className,
        )}
        {...props}
    />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
            className,
        )}
        {...props}
    />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn(
            "text-lg font-semibold leading-none tracking-tight",
            className,
        )}
        {...props}
    />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogTrigger,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
};
