"use client";

import { AvatarGroup } from "@/components/animate-ui/components/animate/avatar-group";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye } from "lucide-react";

interface CollaboratorUser {
    id: string;
    name: string;
    color: string;
    viewport?: { pan: { x: number; y: number }; zoom: number };
}

interface CollaboratorAvatarsProps {
    users: CollaboratorUser[];
    maxDisplay?: number;
    onFollowUser: (userId: string) => void;
    followedUserId: string | null;
    spectatedUserIds?: Set<string>;
}

/**
 * Gets the first letter of a name for avatar display
 * Handles edge cases like empty strings
 */
function getFirstLetter(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return "?";
    return trimmed.charAt(0).toUpperCase();
}

/**
 * Displays a group of collaborator avatars with the first letter of their names
 * Uses the user's assigned color and shows their full name in a tooltip
 */
export function CollaboratorAvatars({
    users,
    maxDisplay = 5,
    onFollowUser,
    followedUserId,
    spectatedUserIds = new Set(),
}: CollaboratorAvatarsProps) {
    if (users.length === 0) return null;

    const avatarElements = users.slice(0, maxDisplay).map((user) => {
        const firstLetter = getFirstLetter(user.name);
        const isFollowed = followedUserId === user.id;
        const isBeingSpectated = spectatedUserIds.has(user.id);

        return (
            <div key={user.id} className="relative">
                <Avatar
                    className={`size-7 border-2 cursor-pointer transition-all ${
                        isFollowed
                            ? "border-white ring-1 ring-offset-1 ring-offset-background"
                            : "border-background hover:ring-1 hover:ring-white/30"
                    }`}
                    style={{
                        backgroundColor: user.color,
                        ...(isFollowed && { ringColor: user.color }),
                    }}
                    onClick={() => onFollowUser(user.id)}
                >
                    <AvatarFallback
                        className="bg-transparent text-white font-semibold text-sm"
                        style={{
                            backgroundColor: user.color,
                        }}
                    >
                        {firstLetter}
                    </AvatarFallback>
                </Avatar>
                {isBeingSpectated && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-background flex items-center justify-center">
                        <Eye className="w-2 h-2 text-muted-foreground" />
                    </div>
                )}
            </div>
        );
    });

    // Add overflow indicator if needed
    if (users.length > maxDisplay) {
        avatarElements.push(
            <Avatar
                key="overflow"
                className="size-7 border-2 border-background bg-muted"
            >
                <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                    +{users.length - maxDisplay}
                </AvatarFallback>
            </Avatar>,
        );
    }

    return (
        <AvatarGroup className="ml-2 -space-x-2 h-7" translate="0">
            {avatarElements}
        </AvatarGroup>
    );
}
