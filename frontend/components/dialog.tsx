"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
}

export function Dialog({ title, description, onClose, children }: DialogProps) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-100 flex items-center justify-center bg-on-surface/35 px-4 py-6"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                className="w-full max-w-md rounded-xl bg-surface-container-lowest p-5 shadow-[0_18px_60px_rgba(19,27,46,0.22)]"
            >
                <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                        <h2 id="dialog-title" className="font-headline-md text-headline-md font-bold text-on-surface">
                            {title}
                        </h2>
                        {description && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{description}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}