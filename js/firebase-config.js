// Configuração do Firebase
// Credenciais do projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDDtcc3MYu28GqhFEUBtep9lhZcS8uDIuo",
  authDomain: "votofacil-30139.firebaseapp.com",
  projectId: "votofacil-30139",
  storageBucket: "votofacil-30139.firebasestorage.app",
  messagingSenderId: "297918826223",
  appId: "1:297918826223:web:ec329db87d43776ce37d1a",
  measurementId: "G-1YD0GGXDMD",
  databaseURL: "https://votofacil-30139-default-rtdb.firebaseio.com"
};

// Inicialização do Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const rtdb = firebase.database();

// Verificação de conexão para sincronização offline/online
const connectedRef = rtdb.ref(".info/connected");

// Configuração para IndexedDB para suporte offline
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Múltiplas abas abertas, persistência não habilitada');
    } else if (err.code === 'unimplemented') {
      console.warn('O navegador não suporta persistência offline');
    }
  });

// Classe para gerenciamento offline
class OfflineManager {
  constructor() {
    this.pendingVotes = [];
    this.dbName = "votofacil_offline";
    this.isOnline = true;
    this.setupDB();
    this.setupConnectionListener();
  }

  // Inicializar IndexedDB
  setupDB() {
    const request = indexedDB.open(this.dbName, 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Armazenar votos pendentes enquanto offline
      if (!db.objectStoreNames.contains('pendingVotes')) {
        db.createObjectStore('pendingVotes', { keyPath: 'id', autoIncrement: true });
      }
      
      // Armazenar dados de eleições
      if (!db.objectStoreNames.contains('elections')) {
        db.createObjectStore('elections', { keyPath: 'id' });
      }
      
      // Armazenar dados de candidatos
      if (!db.objectStoreNames.contains('candidates')) {
        db.createObjectStore('candidates', { keyPath: 'id' });
      }
      
      // Armazenar dados de eleitores
      if (!db.objectStoreNames.contains('voters')) {
        db.createObjectStore('voters', { keyPath: 'id' });
      }
    };
    
    request.onerror = (event) => {
      console.error("Erro ao abrir IndexedDB:", event.target.error);
    };
  }

  // Monitorar estado da conexão
  setupConnectionListener() {
    connectedRef.on('value', (snap) => {
      if (snap.val() === true) {
        console.log('Conectado');
        this.isOnline = true;
        this.syncPendingVotes();
      } else {
        console.log('Desconectado');
        this.isOnline = false;
      }
    });
  }

  // Salvar voto offline
  saveVoteOffline(voteData) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(['pendingVotes'], 'readwrite');
        const store = transaction.objectStore('pendingVotes');
        
        const addRequest = store.add(voteData);
        
        addRequest.onsuccess = () => {
          resolve({ success: true, message: 'Voto armazenado offline' });
        };
        
        addRequest.onerror = (error) => {
          reject({ success: false, message: 'Erro ao armazenar voto offline', error });
        };
      };
      
      request.onerror = (event) => {
        reject({ success: false, message: 'Erro ao abrir IndexedDB', error: event.target.error });
      };
    });
  }

  // Sincronizar votos pendentes quando online
  syncPendingVotes() {
    if (!this.isOnline) return;
    
    const request = indexedDB.open(this.dbName);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['pendingVotes'], 'readwrite');
      const store = transaction.objectStore('pendingVotes');
      
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const pendingVotes = getAllRequest.result;
        
        if (pendingVotes.length > 0) {
          console.log(`Sincronizando ${pendingVotes.length} votos pendentes`);
          
          const syncPromises = pendingVotes.map(vote => {
            // Salvar no Firestore
            return db.collection('votos').add({
              eleicaoId: vote.eleicaoId,
              candidatoId: vote.candidatoId,
              eleitorId: vote.eleitorId,
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
            .then((docRef) => {
              // Remover voto pendente após sincronização
              const deleteTransaction = db.transaction(['pendingVotes'], 'readwrite');
              const deleteStore = deleteTransaction.objectStore('pendingVotes');
              deleteStore.delete(vote.id);
              return docRef;
            });
          });
          
          Promise.all(syncPromises)
            .then(() => console.log('Todos os votos sincronizados'))
            .catch(error => console.error('Erro ao sincronizar votos:', error));
        }
      };
    };
  }

  // Salvar dados de eleição no IndexedDB
  saveElectionData(elections) {
    const request = indexedDB.open(this.dbName);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['elections'], 'readwrite');
      const store = transaction.objectStore('elections');
      
      // Limpar store antes de inserir novos dados
      store.clear();
      
      elections.forEach(election => {
        store.add(election);
      });
    };
  }

  // Salvar dados de candidatos no IndexedDB
  saveCandidatesData(candidates) {
    const request = indexedDB.open(this.dbName);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['candidates'], 'readwrite');
      const store = transaction.objectStore('candidates');
      
      // Limpar store antes de inserir novos dados
      store.clear();
      
      candidates.forEach(candidate => {
        store.add(candidate);
      });
    };
  }

  // Salvar dados de eleitores no IndexedDB
  saveVotersData(voters) {
    const request = indexedDB.open(this.dbName);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['voters'], 'readwrite');
      const store = transaction.objectStore('voters');
      
      // Limpar store antes de inserir novos dados
      store.clear();
      
      voters.forEach(voter => {
        store.add(voter);
      });
    };
  }

  // Obter dados offline
  getOfflineData(storeName) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result);
        };
        
        getAllRequest.onerror = (error) => {
          reject(error);
        };
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }
}

// Instanciar gerenciador offline
const offlineManager = new OfflineManager();
