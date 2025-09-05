// urna.js - Lógica da urna de votação

document.addEventListener('DOMContentLoaded', () => {
  // Referências aos elementos do DOM
  const formLoginEleitor = document.getElementById('form-login-eleitor');
  const eleicoesDisponiveis = document.getElementById('eleicoes-disponiveis');
  const urnaPanel = document.getElementById('urna-panel');
  const eleitorLogin = document.getElementById('eleitor-login');
  const candidatosList = document.getElementById('candidatos-list');
  const candidatoSelecionado = document.getElementById('candidato-selecionado');
  const btnConfirmar = document.getElementById('btn-confirmar');
  const btnCorrigir = document.getElementById('btn-corrigir');
  const btnBranco = document.getElementById('btn-branco');
  const votoConfirmado = document.getElementById('voto-confirmado');
  
  // Seletores de elementos dentro do painel de candidato selecionado
  const fotoCandidatoSelecionado = document.getElementById('foto-candidato-selecionado');
  const nomeCandidatoSelecionado = document.getElementById('nome-candidato-selecionado');
  const numeroCandidatoSelecionado = document.getElementById('numero-candidato-selecionado');
  const nomeEleicao = document.getElementById('nome-eleicao');
  
  // Estado da aplicação
  let eleicoes = [];
  let candidatos = [];
  let eleicaoSelecionada = null;
  let candidatoSelecionadoId = null;
  let eleitorAtual = null;
  let votoBranco = false;
  
  // Som da urna
  const somConfirmacao = new Audio('https://www.tse.jus.br/hotsites/simulador-de-votacao/sons/confirma.mp3');
  
  // Inicialização
  init();
  
  function init() {
    // Carregar eleições disponíveis
    loadEleicoes().then(() => {
      // Event listeners
      setupEventListeners();
    });
  }
  
  function setupEventListeners() {
    // Login do eleitor
    if (formLoginEleitor) {
      formLoginEleitor.addEventListener('submit', handleEleitorLogin);
    }
    
    // Botão de confirmar voto
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', handleConfirmarVoto);
    }
    
    // Botão de corrigir voto
    if (btnCorrigir) {
      btnCorrigir.addEventListener('click', handleCorrigirVoto);
    }
    
    // Botão de voto em branco
    if (btnBranco) {
      btnBranco.addEventListener('click', handleVotoBranco);
    }
  }
  
  // ===== Carregamento de Dados =====
  
  async function loadEleicoes() {
    try {
      showLoader('Carregando eleições disponíveis...');
      
      const snapshot = await db.collection('eleicoes')
        .where('ativa', '==', true)
        .get();
      
      eleicoes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Renderizar lista de eleições disponíveis
      renderEleicoes();
      
      // Salvar no IndexedDB para acesso offline
      offlineManager.saveElectionData(eleicoes);
      
      hideLoader();
    } catch (error) {
      console.error('Erro ao carregar eleições:', error);
      
      // Tentar carregar do IndexedDB se estiver offline
      try {
        eleicoes = await offlineManager.getOfflineData('elections');
        renderEleicoes();
      } catch (err) {
        console.error('Erro ao carregar eleições offline:', err);
      }
      
      hideLoader();
      showNotification('Erro ao carregar eleições. Tentando modo offline.', 'warning');
    }
  }
  
  async function loadCandidatos(eleicaoId) {
    try {
      showLoader('Carregando candidatos...');
      
      const snapshot = await db.collection('candidatos')
        .where('eleicaoId', '==', eleicaoId)
        .get();
      
      candidatos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Ordenar por número
      candidatos.sort((a, b) => a.numero - b.numero);
      
      // Salvar no IndexedDB para acesso offline
      offlineManager.saveCandidatesData(candidatos);
      
      hideLoader();
    } catch (error) {
      console.error('Erro ao carregar candidatos:', error);
      
      // Tentar carregar do IndexedDB se estiver offline
      try {
        const allCandidates = await offlineManager.getOfflineData('candidates');
        candidatos = allCandidates.filter(c => c.eleicaoId === eleicaoId);
        candidatos.sort((a, b) => a.numero - b.numero);
      } catch (err) {
        console.error('Erro ao carregar candidatos offline:', err);
      }
      
      hideLoader();
      showNotification('Erro ao carregar candidatos. Tentando modo offline.', 'warning');
    }
  }
  
  async function verificarEleitor(codigo, eleicaoId) {
    try {
      // Buscar eleitor pelo código na eleição selecionada
      const snapshot = await db.collection('eleitores')
        .where('codigo', '==', codigo)
        .where('eleicaoId', '==', eleicaoId)
        .get();
      
      if (snapshot.empty) {
        return { 
          success: false, 
          message: 'Eleitor não encontrado para esta eleição' 
        };
      }
      
      const eleitor = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
      
      // Verificar se o eleitor já votou
      if (eleitor.votou) {
        return { 
          success: false, 
          message: 'Você já votou nesta eleição' 
        };
      }
      
      return { 
        success: true, 
        eleitor 
      };
    } catch (error) {
      console.error('Erro ao verificar eleitor:', error);
      
      // Tentar verificar offline
      if (!offlineManager.isOnline) {
        try {
          const eleitores = await offlineManager.getOfflineData('voters');
          const eleitor = eleitores.find(e => e.codigo === codigo && e.eleicaoId === eleicaoId);
          
          if (!eleitor) {
            return { 
              success: false, 
              message: 'Eleitor não encontrado para esta eleição (offline)' 
            };
          }
          
          if (eleitor.votou) {
            return { 
              success: false, 
              message: 'Você já votou nesta eleição (offline)' 
            };
          }
          
          return { 
            success: true, 
            eleitor,
            offline: true 
          };
        } catch (err) {
          console.error('Erro ao verificar eleitor offline:', err);
          return { 
            success: false, 
            message: 'Erro ao verificar eleitor no modo offline' 
          };
        }
      }
      
      return { 
        success: false, 
        message: 'Erro ao verificar eleitor: ' + error.message 
      };
    }
  }
  
  // ===== Renderização de UI =====
  
  function renderEleicoes() {
    if (!eleicoesDisponiveis) return;
    
    eleicoesDisponiveis.innerHTML = '';
    
    if (eleicoes.length === 0) {
      eleicoesDisponiveis.innerHTML = '<div class="alert alert-warning">Nenhuma eleição disponível</div>';
      return;
    }
    
    eleicoes.forEach(eleicao => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
      item.dataset.id = eleicao.id;
      
      item.innerHTML = `
        <div>
          <h6 class="mb-0">${eleicao.nome}</h6>
          <small class="text-muted">Data: ${formatDate(eleicao.data)}</small>
        </div>
        <span class="badge bg-primary rounded-pill">${eleicao.tipo}</span>
      `;
      
      item.addEventListener('click', () => {
        // Remover seleção atual
        document.querySelectorAll('.list-group-item').forEach(el => {
          el.classList.remove('active');
        });
        
        // Adicionar classe ativa
        item.classList.add('active');
        
        // Definir eleição selecionada
        eleicaoSelecionada = eleicao.id;
      });
      
      eleicoesDisponiveis.appendChild(item);
    });
  }
  
  function renderCandidatos() {
    if (!candidatosList) return;
    
    candidatosList.innerHTML = '';
    
    if (candidatos.length === 0) {
      candidatosList.innerHTML = '<div class="col-12"><div class="alert alert-warning">Nenhum candidato disponível nesta eleição</div></div>';
      return;
    }
    
    candidatos.forEach(candidato => {
      const card = document.createElement('div');
      card.className = 'col';
      card.dataset.id = candidato.id;
      
      card.innerHTML = `
        <div class="card candidate-card h-100">
          <div class="card-body text-center">
            <div class="candidate-photo-container mb-3">
              <img src="${candidato.fotoUrl || 'https://via.placeholder.com/150'}" alt="${candidato.nome}" class="candidate-photo">
            </div>
            <h5 class="card-title">${candidato.nome}</h5>
            <p class="card-text">
              <span class="badge bg-primary">Número: ${candidato.numero}</span>
            </p>
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        selecionarCandidato(candidato);
      });
      
      candidatosList.appendChild(card);
    });
  }
  
  // ===== Handlers =====
  
  async function handleEleitorLogin(e) {
    e.preventDefault();
    
    const codigoAcesso = document.getElementById('codigo-acesso').value;
    
    if (!eleicaoSelecionada) {
      showNotification('Selecione uma eleição', 'error');
      return;
    }
    
    try {
      showLoader('Verificando credenciais...');
      
      const result = await verificarEleitor(codigoAcesso, eleicaoSelecionada);
      
      if (result.success) {
        eleitorAtual = result.eleitor;
        
        // Carregar candidatos da eleição
        await loadCandidatos(eleicaoSelecionada);
        
        // Atualizar nome da eleição na urna
        const eleicao = eleicoes.find(e => e.id === eleicaoSelecionada);
        if (nomeEleicao && eleicao) {
          nomeEleicao.textContent = eleicao.nome;
        }
        
        // Mostrar urna
        eleitorLogin.style.display = 'none';
        urnaPanel.style.display = 'block';
        
        // Renderizar candidatos
        renderCandidatos();
        
        showNotification('Bem-vindo à cabine de votação!', 'success');
      } else {
        showNotification(result.message, 'error');
      }
      
      hideLoader();
    } catch (error) {
      hideLoader();
      console.error('Erro no login do eleitor:', error);
      showNotification('Erro ao validar eleitor: ' + error.message, 'error');
    }
  }
  
  function selecionarCandidato(candidato) {
    // Destacar o candidato selecionado na lista
    document.querySelectorAll('.candidate-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    const cardSelecionado = document.querySelector(`.col[data-id="${candidato.id}"] .candidate-card`);
    if (cardSelecionado) {
      cardSelecionado.classList.add('selected');
    }
    
    // Mostrar informações do candidato selecionado
    candidatoSelecionadoId = candidato.id;
    votoBranco = false;
    
    fotoCandidatoSelecionado.src = candidato.fotoUrl || 'https://via.placeholder.com/150';
    nomeCandidatoSelecionado.textContent = candidato.nome;
    numeroCandidatoSelecionado.textContent = `Número: ${candidato.numero}`;
    
    candidatoSelecionado.style.display = 'block';
    
    // Habilitar botão de confirmar
    btnConfirmar.disabled = false;
  }
  
  function handleVotoBranco() {
    // Remover seleção de candidatos
    document.querySelectorAll('.candidate-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    // Configurar voto em branco
    candidatoSelecionadoId = null;
    votoBranco = true;
    
    fotoCandidatoSelecionado.src = 'https://via.placeholder.com/150';
    nomeCandidatoSelecionado.textContent = 'VOTO EM BRANCO';
    numeroCandidatoSelecionado.textContent = '';
    
    candidatoSelecionado.style.display = 'block';
    
    // Habilitar botão de confirmar
    btnConfirmar.disabled = false;
  }
  
  function handleCorrigirVoto() {
    // Limpar seleção
    document.querySelectorAll('.candidate-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    candidatoSelecionadoId = null;
    votoBranco = false;
    candidatoSelecionado.style.display = 'none';
    
    // Desabilitar botão de confirmar
    btnConfirmar.disabled = true;
  }
  
  async function handleConfirmarVoto() {
    if (!eleitorAtual) {
      showNotification('Erro: Eleitor não identificado', 'error');
      return;
    }
    
    try {
      showLoader('Registrando seu voto...');
      
      // Dados do voto
      const votoData = {
        eleicaoId: eleicaoSelecionada,
        candidatoId: candidatoSelecionadoId,  // null para voto em branco
        eleitorId: eleitorAtual.id,
        votoBranco: votoBranco,
        timestamp: new Date().toISOString()
      };
      
      let result;
      
      if (offlineManager.isOnline) {
        // Salvar voto no Firestore
        await db.collection('votos').add({
          eleicaoId: votoData.eleicaoId,
          candidatoId: votoData.candidatoId,
          votoBranco: votoData.votoBranco,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Marcar eleitor como já votou
        await db.collection('eleitores').doc(eleitorAtual.id).update({
          votou: true
        });
        
        result = { success: true };
      } else {
        // Modo offline - salvar no IndexedDB
        result = await offlineManager.saveVoteOffline(votoData);
        
        // Atualizar status do eleitor no IndexedDB
        const request = indexedDB.open(offlineManager.dbName);
        
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = db.transaction(['voters'], 'readwrite');
          const store = transaction.objectStore('voters');
          
          // Obter o eleitor
          const getRequest = store.get(eleitorAtual.id);
          
          getRequest.onsuccess = () => {
            const eleitor = getRequest.result;
            if (eleitor) {
              eleitor.votou = true;
              store.put(eleitor);
            }
          };
        };
      }
      
      // Tocar som de confirmação
      somConfirmacao.play();
      
      // Mostrar tela de confirmação
      urnaPanel.style.display = 'none';
      votoConfirmado.style.display = 'block';
      
      hideLoader();
    } catch (error) {
      hideLoader();
      console.error('Erro ao registrar voto:', error);
      showNotification('Erro ao registrar voto: ' + error.message, 'error');
    }
  }
  
  // ===== Utilitários =====
  
  function formatDate(dateString) {
    if (!dateString) return 'Data não definida';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }
  
  function showLoader(message = 'Carregando...') {
    // Criar loader se não existir
    let loader = document.getElementById('app-loader');
    
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'app-loader';
      loader.className = 'loader-overlay';
      loader.innerHTML = `
        <div class="loader-content">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Carregando...</span>
          </div>
          <p class="mt-2 loader-message">${message}</p>
        </div>
      `;
      
      document.body.appendChild(loader);
    } else {
      loader.querySelector('.loader-message').textContent = message;
      loader.style.display = 'flex';
    }
  }
  
  function hideLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.style.display = 'none';
    }
  }
  
  function showNotification(message, type = 'info') {
    // Criar container de notificações se não existir
    let notifContainer = document.getElementById('notification-container');
    
    if (!notifContainer) {
      notifContainer = document.createElement('div');
      notifContainer.id = 'notification-container';
      notifContainer.className = 'position-fixed top-0 end-0 p-3';
      notifContainer.style.zIndex = '1050';
      
      document.body.appendChild(notifContainer);
    }
    
    // Criar a notificação
    const notification = document.createElement('div');
    notification.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'primary'}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'assertive');
    notification.setAttribute('aria-atomic', 'true');
    
    notification.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
      </div>
    `;
    
    notifContainer.appendChild(notification);
    
    // Mostrar a notificação
    const toast = new bootstrap.Toast(notification, { autohide: true, delay: 5000 });
    toast.show();
    
    // Remover após fechar
    notification.addEventListener('hidden.bs.toast', () => {
      notification.remove();
    });
  }
});
