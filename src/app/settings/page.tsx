"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { ProfileSection } from "@/components/settings/profile-section";
import { StorageSection } from "@/components/settings/storage-section";
import { ClearDataDialog } from "@/components/settings/clear-data-dialog";
import { useBoardStore } from "@/store/board-store";

export default function SettingsPage() {
    const [mounted, setMounted] = useState(false);
    const getStorageStats = useBoardStore((s) => s.getStorageStats);

    useEffect(() => {
        setMounted(true);
    }, []);

    const stats = mounted
        ? getStorageStats()
        : { boardCount: 0, workspaceCount: 0 };

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
                <div className="space-y-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight font-[var(--font-heading)]">
                            Settings
                        </h1>
                        <p className="text-muted-foreground">
                            Manage your profile, storage, and data preferences
                        </p>
                    </div>

                    <ProfileSection />
                    <StorageSection />
                    <ClearDataDialog
                        boardCount={stats.boardCount}
                        workspaceCount={stats.workspaceCount}
                    />
                </div>
            </main>
        </div>
    );
}
