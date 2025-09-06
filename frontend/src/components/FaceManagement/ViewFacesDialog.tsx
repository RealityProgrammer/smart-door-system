import { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogContent } from "@/components/ui/dialog";
import { FaceVariation } from "@/types";

interface ViewFacesDialogProps {
  isOpen: boolean;
  onOpenChange?(open: boolean): void;
  faceVariations: FaceVariation[];
}

export function ViewFacesDialog({ isOpen, onOpenChange, faceVariations } : ViewFacesDialogProps) {
  console.log(JSON.stringify(faceVariations));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2/3">
        <DialogHeader>
          <DialogTitle>Face Variations</DialogTitle>
        </DialogHeader>

      </DialogContent>
    </Dialog>
  );
}