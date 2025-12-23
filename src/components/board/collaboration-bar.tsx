"use client";

import { Eye, Share2 } from "lucide-react";
import type { ConnectionStatus } from "@/lib/collaboration";
import { cn } from "@/lib/utils";
import { CollaboratorAvatars } from "./collaborator-avatars";

interface CollaborationBarProps {
    peerCount: number;
    connectionStatus: ConnectionStatus;
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
    connectionStatus,
    myName,
    collaboratorUsers,
    onFollowUser,
    followedUserId,
    spectatedUserIds,
    isBeingSpectated,
    onInvite,
}: CollaborationBarProps) {
    return (
        <div className="flex items-center gap-2 h-10 bg-card/95 backdrop-blur-md border border-border rounded-md px-2.5 shadow-2xl overflow-hidden transition-all duration-300">
            {/* Your Name - Only show when peers are connected */}
            {peerCount > 0 && (
                <>
                    <div className="flex items-center gap-2 px-1 animate-in slide-in-from-left duration-300">
                        {/* Status indicator */}
                        <div
                            className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                connectionStatus === "connected" &&
                                    peerCount > 0
                                    ? "bg-green-500"
                                    : connectionStatus === "connected"
                                      ? "bg-yellow-500 animate-pulse"
                                      : connectionStatus === "connecting"
                                        ? "bg-yellow-500 animate-pulse"
                                        : "bg-red-500",
                            )}
                            title={
                                connectionStatus === "connected" &&
                                peerCount > 0
                                    ? `Connected to ${peerCount} peer(s)`
                                    : connectionStatus === "connected"
                                      ? "Waiting for collaborators..."
                                      : connectionStatus === "connecting"
                                        ? "Connecting..."
                                        : "Disconnected"
                            }
                        />
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

                    <div className="w-px h-5 bg-border" />
                </>
            )}

            {/* Share Button */}
            <button
                onClick={onInvite}
                disabled={!onInvite}
                className={cn(
                    "flex items-center gap-1.5 h-8 px-2.5 rounded-sm transition-all duration-200",
                    "hover:bg-secondary/80 text-muted-foreground hover:text-foreground",
                    "disabled:opacity-50 disabled:pointer-events-none",
                )}
            >
                <Share2 className="w-4 h-4" />
                <span className="text-xs font-medium">Invite</span>
            </button>
        </div>
    );
}
