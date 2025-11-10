// Unmark all VassDistro articles as unprocessed
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

export async function POST() {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
    }

    const snapshot = await getDocs(collection(db!, 'vassdistro_articles'));

    let unmarked = 0;
    for (const docSnap of snapshot.docs) {
      await updateDoc(doc(db!, 'vassdistro_articles', docSnap.id), {
        processed: false
      });
      unmarked++;
    }

    return NextResponse.json({
      success: true,
      unmarked,
      message: `Unmarked ${unmarked} articles`
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
