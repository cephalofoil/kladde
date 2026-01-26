"use client";

import { useState } from "react";
import { Shuffle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateFunnyName } from "@/lib/funny-names";

interface JoinModalProps {
  open: boolean;
  onJoin: (name: string) => void;
}

export function JoinModal({ open, onJoin }: JoinModalProps) {
  const [displayName, setDisplayName] = useState(() => generateFunnyName());

  const handleRandomizeName = () => {
    setDisplayName(generateFunnyName());
  };

  const handleJoin = () => {
    const name = displayName.trim() || generateFunnyName();
    sessionStorage.setItem("kladde-name", name);
    onJoin(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoin();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Join Collaboration</DialogTitle>
          <DialogDescription>
            Choose a display name to join this board. Other collaborators will
            see this name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="join-display-name">Your display name</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="join-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your name..."
                className="flex-1"
                autoFocus
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleRandomizeName}
                className="sm:w-36"
                title="Generate random name"
              >
                <Shuffle className="h-4 w-4" />
                Random
              </Button>
            </div>
          </div>

          <Button onClick={handleJoin} className="w-full">
            Join Board
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
