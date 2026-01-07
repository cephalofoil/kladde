"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBoardStore } from "@/store/board-store";

const CONFIRM_PHRASE = "DELETE ALL DATA";

interface ClearDataDialogProps {
  boardCount: number;
  workspaceCount: number;
}

export function ClearDataDialog({ boardCount, workspaceCount }: ClearDataDialogProps) {
  const router = useRouter();
  const clearAllData = useBoardStore((s) => s.clearAllData);

  const [warningOpen, setWarningOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  const canConfirm = confirmText === CONFIRM_PHRASE;

  const handleWarningContinue = () => {
    setWarningOpen(false);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!canConfirm) return;

    setIsClearing(true);
    try {
      await clearAllData();
      setConfirmOpen(false);
      setConfirmText("");
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to clear data:", error);
      setIsClearing(false);
    }
  };

  const handleDialogClose = () => {
    setConfirmOpen(false);
    setConfirmText("");
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>Irreversible actions that affect all your data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
          <div className="space-y-1">
            <p className="font-medium">Clear All Data</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete all boards, workspaces, and settings
            </p>
          </div>

          <AlertDialog open={warningOpen} onOpenChange={setWarningOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Clear All Data
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>This will permanently delete:</p>
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      <li>
                        <strong>{boardCount}</strong> board{boardCount !== 1 ? "s" : ""}
                      </li>
                      <li>
                        <strong>{workspaceCount}</strong> workspace{workspaceCount !== 1 ? "s" : ""}
                      </li>
                      <li>All preferences and settings</li>
                    </ul>
                    <p className="font-medium text-destructive">This action CANNOT be undone.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleWarningContinue}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  I understand, continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={confirmOpen} onOpenChange={handleDialogClose}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                  To confirm, type <strong>{CONFIRM_PHRASE}</strong> in the box below:
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <Label htmlFor="confirm-input" className="sr-only">
                  Confirmation text
                </Label>
                <Input
                  id="confirm-input"
                  placeholder={CONFIRM_PHRASE}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={!canConfirm || isClearing}
                >
                  {isClearing ? "Deleting..." : "Delete all data"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
