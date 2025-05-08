import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, CollectionReference, DocumentData } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private categoriasRef: CollectionReference<DocumentData>;

  constructor(private firestore: Firestore) {
    this.categoriasRef = collection(this.firestore, 'categorias');
  }

  // Obtener todas las categorías
  getCategorias(): Promise<any[]> {
    return getDocs(this.categoriasRef).then(snapshot => 
      snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    );
  }

  // Agregar nueva categoría
  addCategoria(nombre: string): Promise<void> {
    if (!nombre || !nombre.trim()) return Promise.reject('Nombre inválido');
    return addDoc(this.categoriasRef, { nombre: nombre.trim() }).then(() => {});
  }
}
