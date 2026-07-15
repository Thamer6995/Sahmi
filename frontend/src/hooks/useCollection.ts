import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CollectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

/** يشترك في collection كاملة (بدون فلاتر) ويحدّثها حيًا - مناسب لحجم بيانات TASI الشخصي. */
export function useCollection<T>(path: string): CollectionState<T & { id: string }> {
  const [state, setState] = useState<CollectionState<T & { id: string }>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snap) => {
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })),
          loading: false,
          error: null,
        });
      },
      (err) => setState({ data: [], loading: false, error: err.message })
    );
    return unsubscribe;
  }, [path]);

  return state;
}
