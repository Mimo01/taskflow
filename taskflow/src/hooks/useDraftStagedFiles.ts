import { useCallback, useRef, useState } from 'react';
import { readDraftFile, removeDraftFile, stageDraftFile } from '@/lib/issue-draft-files';
import type { DraftFileRef } from '@/stores/issue-drafts.store';

interface Options {
  ensureDraftId: () => string;
  /** Called after every change to the staged list so the host can schedule autosave. */
  onChange?: () => void;
}

/**
 * Staged attachments for a create flow: the live File objects plus durable copies in
 * app storage (one unique path per file, tracked by File identity, never by name). Never log names or bytes: drafts may hold customer data.
 */
export function useDraftStagedFiles({ ensureDraftId, onChange }: Options) {
  const [files, setFiles] = useState<File[]>([]);
  const [refs, setRefs] = useState<DraftFileRef[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [copyFailed, setCopyFailed] = useState(false);
  // Bumped on reset so a copy that resolves after a reset is ignored.
  const generationRef = useRef(0);
  // Files still staged: a copy that resolves after its file was removed is ignored.
  const liveRef = useRef(new Set<File>());
  const refByFileRef = useRef(new Map<File, DraftFileRef>());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const ensureRef = useRef(ensureDraftId);
  ensureRef.current = ensureDraftId;

  const stage = useCallback((file: File) => {
    const generation = generationRef.current;
    liveRef.current.add(file);
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
        if (!liveRef.current.has(file)) {
          void removeDraftFile(ref);
          return;
        }
        refByFileRef.current.set(file, ref);
        setRefs((prev) => [...prev, ref]);
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
      liveRef.current.delete(target);
      const ref = refByFileRef.current.get(target);
      refByFileRef.current.delete(target);
      setFiles((prev) => prev.filter((_, i) => i !== index));
      if (ref) {
        setRefs((prev) => prev.filter((r) => r !== ref));
        void removeDraftFile(ref);
      }
      onChangeRef.current?.();
    },
    [files],
  );

  const restore = useCallback(async (toRestore: DraftFileRef[]): Promise<File[]> => {
    const generation = generationRef.current;
    const results = await Promise.all(toRestore.map((r) => readDraftFile(r)));
    if (generation !== generationRef.current) return [];
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
    liveRef.current = new Set(found);
    refByFileRef.current = new Map(found.map((f, i) => [f, keptRefs[i]]));
    setFiles(found);
    setRefs(keptRefs);
    setMissing(gone);
    return found;
  }, []);

  const removeMissing = useCallback((name: string) => {
    setMissing((prev) => prev.filter((n) => n !== name));
    onChangeRef.current?.();
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    liveRef.current = new Set();
    refByFileRef.current = new Map();
    setFiles([]);
    setRefs([]);
    setMissing([]);
    setCopyFailed(false);
  }, []);

  return { files, refs, missing, copyFailed, stage, remove, restore, removeMissing, reset };
}
