/**
 * Import Button Component
 * Simple button to trigger the import modal
 */

"use client";

import React, { useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { ImportModal } from "./ImportModal";
import type { ImportError } from "../types";

interface ImportButtonProps extends ButtonProps {
  orgId: string;
  userId: string;
  onImportSuccess?: (collectionId: string) => void;
  onImportError?: (error: ImportError) => void;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

export const ImportButton: React.FC<ImportButtonProps> = ({
  orgId,
  userId,
  onImportSuccess,
  onImportError,
  variant = "default",
  size = "default",
  children = "Import Data",
  className,
  ...props
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback((open: boolean) => {
    setIsModalOpen(open);
  }, []);

  return (
    <>
      <Button
        onClick={handleOpenModal}
        variant={variant}
        size={size}
        className={className}
        {...props}
      >
        <Upload className="h-4 w-4 mr-2" />
        {children}
      </Button>

      <ImportModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        orgId={orgId}
        userId={userId}
        onImportSuccess={onImportSuccess}
        onImportError={onImportError}
      />
    </>
  );
};
