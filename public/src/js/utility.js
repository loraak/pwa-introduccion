// CRUD DE LA BASE DE DATOS INDEXADA. 

var dbPromise = idb.open('post-store', 1, function(db) {
    if (!db.objectStoreNames.contains('posts')) {
        db.createObjectStore('posts', { keyPath: 'id' });
    }

    if (!db.objectStoreNames.contains('sync-posts')) {
        db.createObjectStore('sync-posts', { keyPath: 'id' });
    }
});

// registro de un documento (base de datos no relacional)
// st -> storage, data -> la información que se manda. 
function writeData(st, data) { 
    return dbPromise 
    .then(function(db) { 
        var tx = db.transaction(st, 'readwrite'); 
        // "en esta colección vamos a guardar esta información". 
        var store = tx.objectStore(st);
        store.put(data); 
        return tx.complete; 
    }); 
}

// lee todos los registros. 
// st es el almacén. 
function readAllData(st) { 
    return dbPromise.then(function(db) { 
        var tx = db.transaction(st, 'readonly'); 
        var store = tx.objectStore(st); 
        return store.getAll() 
    }); 
}

// borramos para meter datos actualizados. 
function clearAllData(st) { 
    return dbPromise 
    .then(function(db) { 
        var tx = db.transaction(st, 'readwrite'); 
        var store = tx.objectStore(st); 
        store.clear(); 
        return tx.complete; 
    }); 
}   

// elimina un solo registro, el que tiene ese id.
// (antes se llamaba store.delete() sin pasarle el id y siempre fallaba; además no devolvía la promesa).
function deleteItemFromData(st, id) { 
    return dbPromise
    .then(function(db) { 
        var tx = db.transaction(st, 'readwrite') 
        var store = tx.objectStore(st); 
        store.delete(id); 
        return tx.complete; 
    })
    // este sería el return que da. 
    .then(function() { 
        console.log('ARCHIVO ELIMINADO!!!!'); 
    }); 
}