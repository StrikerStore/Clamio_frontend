"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Info } from "lucide-react";

interface RTOUploadDialogProps {
  onRTODataUploaded: (rtoData: any[]) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RTOUploadDialog({ onRTODataUploaded, open: controlledOpen, onOpenChange }: RTOUploadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-10 text-xs flex items-center justify-center sm:w-auto sm:h-auto sm:text-sm" data-rto-upload-trigger>
          <Upload className="w-3.5 h-3.5 mr-1.5 sm:w-4 sm:h-4 sm:mr-2" />
          <span className="sm:hidden">RTO</span>
          <span className="hidden sm:inline">Upload RTO</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-md p-4 sm:p-6">
        <DialogHeader className="pr-8 sm:pr-0">
          <DialogTitle className="text-base sm:text-lg">RTO Upload</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            RTO data is now automatically loaded from the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 sm:py-4">
          {/* Info Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Automatic RTO Data</p>
              <p className="text-xs text-blue-700">
                RTO inventory data is now automatically fetched from the database when you open this tab.
                The data is updated daily from delivered RTO orders.
              </p>
            </div>
          </div>

          {/* Placeholder for future functionality */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-xs text-gray-600 text-center">
              This button will have new functionality added in a future update.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
