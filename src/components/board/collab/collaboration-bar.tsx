"use client";

import { Eye, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CollaboratorAvatars } from "./collaborator-avatars";

interface CollaborationBarProps {
    peerCount: number;
    myName: string;
    collaboratorUsers: Array<{
        id: string;
        name: string;
        color: string;
        viewport?: { pan: { x: number; y: number }; zoom: number };
    }>;
    onFollowUser: (userId: string) => void;
    followedUserId: string | null;
    spectatedUserIds: Set<string>;
    isBeingSpectated: boolean;
    onInvite?: () => void;
}

export function CollaborationBar({
    peerCount,
    myName,
    collaboratorUsers,
    onFollowUser,
    followedUserId,
    spectatedUserIds,
    isBeingSpectated,
    onInvite,
}: CollaborationBarProps) {
    if (!onInvite && peerCount === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 h-10 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md px-2.5 shadow-2xl overflow-hidden transition-all duration-300">
            {/* Your Name - Only show when peers are connected */}
            {peerCount > 0 && (
                <>
                    <div className="flex items-center gap-2 px-1 animate-in slide-in-from-left duration-300">
                        <span
                            className="text-xs font-medium text-foreground max-w-[140px] truncate"
                            title={myName}
                        >
                            {myName}
                        </span>
                        {isBeingSpectated && (
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <CollaboratorAvatars
                            users={collaboratorUsers}
                            maxDisplay={5}
                            onFollowUser={onFollowUser}
                            followedUserId={followedUserId}
                            spectatedUserIds={spectatedUserIds}
                        />
                    </div>

                    {onInvite && <div className="w-px h-5 bg-border" />}
                </>
            )}

            {/* Share Button */}
            {onInvite && (
                <button
                    onClick={onInvite}
                    className={cn(
                        "flex items-center gap-1.5 h-10 px-2.5 rounded-sm transition-all duration-200",
                        "hover:bg-secondary/80 text-muted-foreground hover:text-foreground",
                    )}
                >
                    <Share2 className="w-4 h-4" />
                    <span className="text-xs font-medium">Invite</span>
                </button>
            )}
        </div>
    );
}
