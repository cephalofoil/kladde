"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBoardStore } from "@/store/board-store";
import { useIsClient } from "@/hooks/use-is-client";

const DISPLAY_NAME_KEY = "kladde-name";

export function ProfileSection() {
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(DISPLAY_NAME_KEY) || "";
  });
  const mounted = useIsClient();
  const collabInvitesEnabled = useBoardStore(
    (s) => s.settings?.collabInvitesEnabled ?? true,
  );
  const setCollabInvitesEnabled = useBoardStore(
    (s) => s.setCollabInvitesEnabled,
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setDisplayName(newName);
    if (newName) {
      sessionStorage.setItem(DISPLAY_NAME_KEY, newName);
    } else {
      sessionStorage.removeItem(DISPLAY_NAME_KEY);
    }
  };

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your profile settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your profile and preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Anonymous User</p>
            <p className="text-xs text-muted-foreground">
              Your data lives on your device. No account required.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <Input
            id="display-name"
            placeholder="Enter your name (optional)"
            value={displayName}
            onChange={handleNameChange}
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            Used for collaborative sessions. Stored only in this browser session.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Allow collaboration invites
            </p>
            <p className="text-xs text-muted-foreground">
              Hide invite buttons and disable generating collaboration links.
            </p>
          </div>
          <Switch
            checked={collabInvitesEnabled}
            onCheckedChange={setCollabInvitesEnabled}
            aria-label="Allow collaboration invites"
          />
        </div>
      </CardContent>
    </Card>
  );
}
