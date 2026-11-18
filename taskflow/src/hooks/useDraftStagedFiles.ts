import { useCallback, useRef, useState } from 'react';
import { readDraftFile, stageDraftFile } from '@/lib/issue-draft-files';
import type { DraftFileRef } from '@/stores/issue-drafts.store';

interface Options {
  ensureDraftId: () => string;
  /** Called after every change to the staged list so the host can schedule autosave. */
  onChange?: () => void;
}

/**
 * Staged attachments for a create flow: the live File objects plus durable copies in
 * app storage (referenced by name). Never log names or bytes: drafts may hold customer data.
 */
export function useDraftStagedFiles({ ensureDraftId, onChange }: Options) {
  const [files, setFiles] = useState<File[]>([]);
  const [refs, setRefs] = useState<DraftFileRef[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [copyFailed, setCopyFailed] = useState(false);
  // Bumped on reset so a copy that resolves after a reset is ignored.
  const generationRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const ensureRef = useRef(ensureDraftId);
  ensureRef.current = ensureDraftId;

  const stage = useCallback((file: File) => {
    const generation = generationRef.current;
    setFiles((prev) => [...prev, file]);
    onChangeRef.current?.();
    let draftId: string;
    try {
      draftId = ensureRef.current();
    } catch (err) {
      console.error(err);
      setCopyFailed(true);
      return;
    }
    stageDraftFile(draftId, file).then(
      (ref) => {
        if (generation !== generationRef.current) return;
        setRefs((prev) => [...prev.filter((r) => r.name !== ref.name), ref]);
        onChangeRef.current?.();
      },
      (err: unknown) => {
        if (generation !== generationRef.current) return;
        console.error(err);
        setCopyFailed(true);
      },
    );
  }, []);

  const remove = useCallback(
    (index: number) => {
      const target = files[index];
      if (!target) return;
      setFiles((prev) => prev.filter((_, i) => i !== index));
      setRefs((prev) => prev.filter((r) => r.name !== target.name));
      onChangeRef.current?.();
    },
    [files],
  );

  const restore = useCallback(async (toRestore: DraftFileRef[]) => {
    const generation = generationRef.current;
    const results = await Promise.all(toRestore.map((r) => readDraftFile(r)));
    if (generation !== generationRef.current) return;
    const found: File[] = [];
    const keptRefs: DraftFileRef[] = [];
    const gone: string[] = [];
    results.forEach((file, i) => {
      if (file) {
        found.push(file);
        keptRefs.push(toRestore[i]);
      } else {
        gone.push(toRestore[i].name);
      }
    });
    setFiles(found);
    setRefs(keptRefs);
    setMissing(gone);
  }, []);

  const removeMissing = useCallback((name: string) => {
    setMissing((prev) => prev.filter((n) => n !== name));
    onChangeRef.current?.();
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    setFiles([]);
    setRefs([]);
    setMissing([]);
    setCopyFailed(false);
  }, []);

  return { files, refs, missing, copyFailed, stage, remove, restore, removeMissing, reset };
}
