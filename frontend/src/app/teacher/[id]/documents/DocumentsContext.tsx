"use client";

import { createContext, useContext, useMemo, useState, ReactNode, Dispatch, SetStateAction } from "react";
import type { Document } from "@/lib/api/teacher";

type DocumentsContextValue = {
  documents: Document[];
  setDocuments: Dispatch<SetStateAction<Document[]>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
};

const DocumentsContext = createContext<DocumentsContextValue | undefined>(undefined);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const value = useMemo(
    () => ({ documents, setDocuments, isLoading, setIsLoading, error, setError }),
    [documents, isLoading, error]
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}

export function useDocumentsContext() {
  const context = useContext(DocumentsContext);

  if (!context) {
    throw new Error('useDocumentsContext must be used within DocumentsProvider');
  }

  return context;
}