import { useState } from "react";

import { archiveEvent, deleteEvent, forceCompleteEvent } from "./api";
import type { SomoimEvent } from "./types";

interface Options {
  eventRecord: SomoimEvent | null;
  onEventUpdated: (eventRecord: SomoimEvent) => void;
  onEventDeleted: () => void;
}

export const useEventLifecycleActions = ({
  eventRecord,
  onEventUpdated,
  onEventDeleted,
}: Options) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveError, setArchiveError] = useState("");

  const [isForceCompleting, setIsForceCompleting] = useState(false);
  const [isForceCompleteDialogOpen, setForceCompleteDialogOpen] =
    useState(false);
  const [forceCompleteError, setForceCompleteError] = useState("");

  const openDeleteDialog = () => {
    setDeleteError("");
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteError("");
    setDeleteDialogOpen(false);
  };

  const openArchiveDialog = () => {
    setArchiveError("");
    setArchiveDialogOpen(true);
  };

  const closeArchiveDialog = () => {
    setArchiveError("");
    setArchiveDialogOpen(false);
  };

  const openForceCompleteDialog = () => {
    setForceCompleteError("");
    setForceCompleteDialogOpen(true);
  };

  const closeForceCompleteDialog = () => {
    setForceCompleteError("");
    setForceCompleteDialogOpen(false);
  };

  const confirmDelete = async () => {
    if (!eventRecord || eventRecord.status !== "draft") {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteEvent(eventRecord.id, eventRecord.version);
      onEventDeleted();
    } catch (caughtError) {
      setDeleteError(
        caughtError instanceof Error
          ? caughtError.message
          : "회차를 삭제하지 못했습니다.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmArchive = async () => {
    if (!eventRecord || eventRecord.status !== "completed") {
      return;
    }

    setIsArchiving(true);
    setArchiveError("");

    try {
      const archivedEvent = await archiveEvent(
        eventRecord.id,
        eventRecord.version,
      );

      onEventUpdated(archivedEvent);
      setArchiveDialogOpen(false);
    } catch (caughtError) {
      setArchiveError(
        caughtError instanceof Error
          ? caughtError.message
          : "회차를 보관하지 못했습니다.",
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const confirmForceComplete = async () => {
    if (!eventRecord || eventRecord.status !== "active") {
      return;
    }

    setIsForceCompleting(true);
    setForceCompleteError("");

    try {
      const completedEvent = await forceCompleteEvent(
        eventRecord.id,
        eventRecord.version,
      );

      onEventUpdated(completedEvent);
      setForceCompleteDialogOpen(false);
    } catch (caughtError) {
      setForceCompleteError(
        caughtError instanceof Error
          ? caughtError.message
          : "회차를 강제로 종료하지 못했습니다.",
      );
    } finally {
      setIsForceCompleting(false);
    }
  };

  return {
    isDeleting,
    isArchiving,
    isForceCompleting,
    openDeleteDialog,
    openArchiveDialog,
    openForceCompleteDialog,

    deleteDialog: {
      isOpen: isDeleteDialogOpen,
      isWorking: isDeleting,
      error: deleteError,
      onClose: closeDeleteDialog,
      onConfirm: () => {
        void confirmDelete();
      },
    },

    archiveDialog: {
      isOpen: isArchiveDialogOpen,
      isWorking: isArchiving,
      error: archiveError,
      onClose: closeArchiveDialog,
      onConfirm: () => {
        void confirmArchive();
      },
    },

    forceCompleteDialog: {
      isOpen: isForceCompleteDialogOpen,
      isWorking: isForceCompleting,
      error: forceCompleteError,
      onClose: closeForceCompleteDialog,
      onConfirm: () => {
        void confirmForceComplete();
      },
    },
  };
};
