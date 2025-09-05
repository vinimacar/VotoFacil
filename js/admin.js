// admin.js - Lógica do painel administrativo

document.addEventListener('DOMContentLoaded', () => {
  // Referências aos elementos do DOM
  const adminLoginForm = document.getElementById('admin-login-form');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const adminPanel = document.getElementById('admin-panel');
  const eleicaoForm = document.getElementById('eleicao-form');
  const candidatoForm = document.getElementById('candidato-form');
  const eleitorForm = document.getElementById('eleitor-form');
  const btnUploadCsv = document.getElementById('btn-upload-csv');
  
  // Seletores de eleição nos formulários
  const eleicaoCandidatoSelect = document.getElementById('eleicao-candidato');
  const eleicaoEleitorSelect = document.getElementById('eleicao-eleitor');
  
  // Listas de itens
  const listaEleicoes = document.getElementById('lista-eleicoes');
  const listaCandidatos = document.getElementById('lista-candidatos');
  const listaEleitores = document.getElementById('lista-eleitores');
  
  // Estado da aplicação
  let currentUser = null;
  let eleicoes = [];
  let candidatos = [];
  let eleitores = [];
  
  // Inicialização
  init();
  
  function init() {
    // Verificar se já está autenticado
    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        showAdminPanel();
        loadData();
      } else {
        hideAdminPanel();
      }
    });
    
    // Event listeners
    setupEventListeners();
  }
  
  function setupEventListeners() {
    // Login de administrador
    adminLoginForm.addEventListener('submit', handleAdminLogin);
    
    // Login com Google
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
    
    // Logout
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
    
    // Formulários
    eleicaoForm.addEventListener('submit', handleEleicaoSubmit);
    candidatoForm.addEventListener('submit', handleCandidatoSubmit);
    eleitorForm.addEventListener('submit', handleEleitorSubmit);
    
    // Upload de CSV
    btnUploadCsv.addEventListener('click', handleCsvUpload);
  }
  
  // ===== Autenticação =====
  
  async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('floatingEmail').value;
    const password = document.getElementById('floatingPassword').value;
    
    try {
      showLoader('Autenticando...');
      await auth.signInWithEmailAndPassword(email, password);
      // O listener onAuthStateChanged vai cuidar do resto
      hideLoader();
    } catch (error) {
      hideLoader();
      showNotification('Erro de autenticação: ' + error.message, 'error');
    }
  }
  
  async function handleGoogleLogin() {
    try {
      showLoader('Autenticando com Google...');
      await signInWithGoogle();
      hideLoader();
    } catch (error) {
      hideLoader();
      showNotification('Erro ao autenticar com Google: ' + error.message, 'error');
    }
  }
  
  async function handleLogout() {
    try {
      showLoader('Saindo...');
      await auth.signOut();
      currentUser = null;
      hideLoader();
      showNotification('Você saiu do sistema', 'info');
    } catch (error) {
      hideLoader();
      showNotification('Erro ao sair: ' + error.message, 'error');
    }
  }
  
  function showAdminPanel() {
    document.getElementById('admin-login').style.display = 'none';
    adminPanel.style.display = 'block';
    showNotification('Bem-vindo ao painel administrativo!', 'success');
  }
  
  function hideAdminPanel() {
    document.getElementById('admin-login').style.display = 'block';
    adminPanel.style.display = 'none';
  }
  
  // ===== Carregamento de Dados =====
  
  async function loadData() {
    await loadEleicoes();
    await loadCandidatos();
    await loadEleitores();
    
    // Atualizar seletores de eleição
    updateEleicaoSelectors();
  }
  
  async function loadEleicoes() {
    try {
      const snapshot = await db.collection('eleicoes').get();
      eleicoes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      renderEleicoes();
      
      // Salvar eleições no IndexedDB para acesso offline
      offlineManager.saveElectionData(eleicoes);
    } catch (error) {
      console.error('Erro ao carregar eleições:', error);
      showNotification('Erro ao carregar eleições', 'error');
      
      // Tentar carregar do IndexedDB se estiver offline
      if (!offlineManager.isOnline) {
        try {
          eleicoes = await offlineManager.getOfflineData('elections');
          renderEleicoes();
        } catch (err) {
          console.error('Erro ao carregar eleições offline:', err);
        }
      }
    }
  }
  
  async function loadCandidatos() {
    try {
      const snapshot = await db.collection('candidatos').get();
      candidatos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      renderCandidatos();
      
      // Salvar candidatos no IndexedDB para acesso offline
      offlineManager.saveCandidatesData(candidatos);
    } catch (error) {
      console.error('Erro ao carregar candidatos:', error);
      showNotification('Erro ao carregar candidatos', 'error');
      
      // Tentar carregar do IndexedDB se estiver offline
      if (!offlineManager.isOnline) {
        try {
          candidatos = await offlineManager.getOfflineData('candidates');
          renderCandidatos();
        } catch (err) {
          console.error('Erro ao carregar candidatos offline:', err);
        }
      }
    }
  }
  
  async function loadEleitores() {
    try {
      const snapshot = await db.collection('eleitores').get();
      eleitores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      renderEleitores();
      
      // Salvar eleitores no IndexedDB para acesso offline
      offlineManager.saveVotersData(eleitores);
    } catch (error) {
      console.error('Erro ao carregar eleitores:', error);
      showNotification('Erro ao carregar eleitores', 'error');
      
      // Tentar carregar do IndexedDB se estiver offline
      if (!offlineManager.isOnline) {
        try {
          eleitores = await offlineManager.getOfflineData('voters');
          renderEleitores();
        } catch (err) {
          console.error('Erro ao carregar eleitores offline:', err);
        }
      }
    }
  }
  
  // ===== Renderização de Listas =====
  
  function renderEleicoes() {
    if (!listaEleicoes) return;
    
    listaEleicoes.innerHTML = '';
    
    if (eleicoes.length === 0) {
      listaEleicoes.innerHTML = '<div class="col-12"><p class="text-center text-muted">Nenhuma eleição cadastrada</p></div>';
      return;
    }
    
    eleicoes.forEach(eleicao => {
      const cardHtml = `
        <div class="col">
          <div class="card election-card h-100">
            <div class="card-body">
              <h5 class="card-title">${eleicao.nome}</h5>
              <p class="card-text">
                <small class="text-muted">Data: ${formatDate(eleicao.data)}</small><br>
                <span class="badge bg-primary">${eleicao.tipo}</span>
              </p>
            </div>
            <div class="card-footer bg-transparent d-flex justify-content-between">
              <button class="btn btn-sm btn-outline-primary edit-election" data-id="${eleicao.id}">
                <i class="fas fa-edit"></i> Editar
              </button>
              <button class="btn btn-sm btn-outline-danger delete-election" data-id="${eleicao.id}">
                <i class="fas fa-trash"></i> Excluir
              </button>
            </div>
          </div>
        </div>
      `;
      
      listaEleicoes.innerHTML += cardHtml;
    });
    
    // Adicionar event listeners aos botões
    document.querySelectorAll('.edit-election').forEach(btn => {
      btn.addEventListener('click', () => editEleicao(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-election').forEach(btn => {
      btn.addEventListener('click', () => deleteEleicao(btn.dataset.id));
    });
  }
  
  function renderCandidatos() {
    if (!listaCandidatos) return;
    
    listaCandidatos.innerHTML = '';
    
    if (candidatos.length === 0) {
      listaCandidatos.innerHTML = '<div class="col-12"><p class="text-center text-muted">Nenhum candidato cadastrado</p></div>';
      return;
    }
    
    candidatos.forEach(candidato => {
      // Encontrar nome da eleição
      const eleicao = eleicoes.find(e => e.id === candidato.eleicaoId) || { nome: 'Eleição não encontrada' };
      
      const cardHtml = `
        <div class="col">
          <div class="card candidate-card h-100">
            <div class="card-img-top text-center pt-3">
              <img src="${candidato.fotoUrl || 'https://via.placeholder.com/150'}" alt="${candidato.nome}" class="rounded-circle" style="width: 100px; height: 100px; object-fit: cover;">
            </div>
            <div class="card-body">
              <h5 class="card-title">${candidato.nome}</h5>
              <p class="card-text">
                <span class="badge bg-secondary">Número: ${candidato.numero}</span><br>
                <small class="text-muted">Eleição: ${eleicao.nome}</small>
              </p>
              <p class="card-text small">${candidato.descricao || 'Sem descrição'}</p>
            </div>
            <div class="card-footer bg-transparent d-flex justify-content-between">
              <button class="btn btn-sm btn-outline-primary edit-candidate" data-id="${candidato.id}">
                <i class="fas fa-edit"></i> Editar
              </button>
              <button class="btn btn-sm btn-outline-danger delete-candidate" data-id="${candidato.id}">
                <i class="fas fa-trash"></i> Excluir
              </button>
            </div>
          </div>
        </div>
      `;
      
      listaCandidatos.innerHTML += cardHtml;
    });
    
    // Adicionar event listeners aos botões
    document.querySelectorAll('.edit-candidate').forEach(btn => {
      btn.addEventListener('click', () => editCandidato(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-candidate').forEach(btn => {
      btn.addEventListener('click', () => deleteCandidato(btn.dataset.id));
    });
  }
  
  function renderEleitores() {
    if (!listaEleitores) return;
    
    listaEleitores.innerHTML = '';
    
    if (eleitores.length === 0) {
      listaEleitores.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum eleitor cadastrado</td></tr>';
      return;
    }
    
    eleitores.forEach(eleitor => {
      // Encontrar nome da eleição
      const eleicao = eleicoes.find(e => e.id === eleitor.eleicaoId) || { nome: 'Eleição não encontrada' };
      
      const rowHtml = `
        <tr>
          <td>${eleitor.codigo}</td>
          <td>${eleitor.nome}</td>
          <td>${eleicao.nome}</td>
          <td>
            <span class="badge bg-${eleitor.votou ? 'success' : 'warning'}">
              ${eleitor.votou ? 'Votou' : 'Pendente'}
            </span>
          </td>
          <td>
            <button class="btn btn-sm btn-outline-primary edit-voter" data-id="${eleitor.id}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger delete-voter" data-id="${eleitor.id}">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
      
      listaEleitores.innerHTML += rowHtml;
    });
    
    // Adicionar event listeners aos botões
    document.querySelectorAll('.edit-voter').forEach(btn => {
      btn.addEventListener('click', () => editEleitor(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-voter').forEach(btn => {
      btn.addEventListener('click', () => deleteEleitor(btn.dataset.id));
    });
  }
  
  // ===== Atualização de Seletores =====
  
  function updateEleicaoSelectors() {
    // Atualizar seletor de eleição para candidatos
    if (eleicaoCandidatoSelect) {
      eleicaoCandidatoSelect.innerHTML = '<option value="" selected disabled>Selecione a eleição</option>';
      
      eleicoes.forEach(eleicao => {
        eleicaoCandidatoSelect.innerHTML += `<option value="${eleicao.id}">${eleicao.nome}</option>`;
      });
    }
    
    // Atualizar seletor de eleição para eleitores
    if (eleicaoEleitorSelect) {
      eleicaoEleitorSelect.innerHTML = '<option value="" selected disabled>Selecione a eleição</option>';
      
      eleicoes.forEach(eleicao => {
        eleicaoEleitorSelect.innerHTML += `<option value="${eleicao.id}">${eleicao.nome}</option>`;
      });
    }
  }
  
  // ===== Handlers de Formulários =====
  
  async function handleEleicaoSubmit(e) {
    e.preventDefault();
    
    const nomeEleicao = document.getElementById('nome-eleicao').value;
    const dataEleicao = document.getElementById('data-eleicao').value;
    const tipoEleicao = document.getElementById('tipo-eleicao').value;
    
    const eleicaoData = {
      nome: nomeEleicao,
      data: dataEleicao,
      tipo: tipoEleicao,
      ativa: true,
      criadaEm: firebase.firestore.FieldValue.serverTimestamp(),
      criadaPor: currentUser.uid
    };
    
    try {
      showLoader('Salvando eleição...');
      
      const docRef = await db.collection('eleicoes').add(eleicaoData);
      
      // Adicionar ID ao objeto para uso local
      eleicaoData.id = docRef.id;
      eleicoes.push(eleicaoData);
      
      // Atualizar UI
      renderEleicoes();
      updateEleicaoSelectors();
      resetForm(eleicaoForm);
      
      // Atualizar cache offline
      offlineManager.saveElectionData(eleicoes);
      
      hideLoader();
      showNotification('Eleição criada com sucesso!', 'success');
    } catch (error) {
      hideLoader();
      console.error('Erro ao salvar eleição:', error);
      showNotification('Erro ao salvar eleição: ' + error.message, 'error');
    }
  }
  
  async function handleCandidatoSubmit(e) {
    e.preventDefault();
    
    const eleicaoId = document.getElementById('eleicao-candidato').value;
    const numero = document.getElementById('numero-candidato').value;
    const nome = document.getElementById('nome-candidato').value;
    const descricao = document.getElementById('descricao-candidato').value;
    const fotoInput = document.getElementById('foto-candidato');
    
    if (!eleicaoId) {
      showNotification('Selecione uma eleição', 'error');
      return;
    }
    
    try {
      showLoader('Salvando candidato...');
      
      let fotoUrl = '';
      
      // Upload da foto se existir
      if (fotoInput.files.length > 0) {
        const file = fotoInput.files[0];
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`candidatos/${Date.now()}_${file.name}`);
        
        await fileRef.put(file);
        fotoUrl = await fileRef.getDownloadURL();
      }
      
      const candidatoData = {
        eleicaoId,
        numero: parseInt(numero),
        nome,
        descricao,
        fotoUrl,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('candidatos').add(candidatoData);
      
      // Adicionar ID ao objeto para uso local
      candidatoData.id = docRef.id;
      candidatos.push(candidatoData);
      
      // Atualizar UI
      renderCandidatos();
      resetForm(candidatoForm);
      
      // Atualizar cache offline
      offlineManager.saveCandidatesData(candidatos);
      
      hideLoader();
      showNotification('Candidato cadastrado com sucesso!', 'success');
    } catch (error) {
      hideLoader();
      console.error('Erro ao salvar candidato:', error);
      showNotification('Erro ao salvar candidato: ' + error.message, 'error');
    }
  }
  
  async function handleEleitorSubmit(e) {
    e.preventDefault();
    
    const eleicaoId = document.getElementById('eleicao-eleitor').value;
    const codigo = document.getElementById('codigo-eleitor').value;
    const nome = document.getElementById('nome-eleitor').value;
    
    if (!eleicaoId) {
      showNotification('Selecione uma eleição', 'error');
      return;
    }
    
    // Verificar se o código já existe para a eleição
    const codigoExistente = eleitores.find(e => e.codigo === codigo && e.eleicaoId === eleicaoId);
    if (codigoExistente) {
      showNotification('Este código já está em uso para esta eleição', 'error');
      return;
    }
    
    try {
      showLoader('Salvando eleitor...');
      
      const eleitorData = {
        eleicaoId,
        codigo,
        nome,
        votou: false,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('eleitores').add(eleitorData);
      
      // Adicionar ID ao objeto para uso local
      eleitorData.id = docRef.id;
      eleitores.push(eleitorData);
      
      // Atualizar UI
      renderEleitores();
      resetForm(eleitorForm);
      
      // Atualizar cache offline
      offlineManager.saveVotersData(eleitores);
      
      hideLoader();
      showNotification('Eleitor cadastrado com sucesso!', 'success');
    } catch (error) {
      hideLoader();
      console.error('Erro ao salvar eleitor:', error);
      showNotification('Erro ao salvar eleitor: ' + error.message, 'error');
    }
  }
  
  // ===== Handlers de Upload CSV =====
  
  function handleCsvUpload() {
    // Criar um input de arquivo temporário
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Verificar se uma eleição está selecionada
      const eleicaoId = document.getElementById('eleicao-eleitor').value;
      if (!eleicaoId) {
        showNotification('Selecione uma eleição antes de importar eleitores', 'error');
        return;
      }
      
      showLoader('Processando arquivo CSV...');
      
      try {
        const eleitoresData = await parseCSV(file);
        await bulkImportEleitores(eleitoresData, eleicaoId);
        
        hideLoader();
        showNotification(`${eleitoresData.length} eleitores importados com sucesso!`, 'success');
        
        // Recarregar a lista de eleitores
        loadEleitores();
      } catch (error) {
        hideLoader();
        showNotification('Erro ao importar CSV: ' + error.message, 'error');
      }
    });
    
    fileInput.click();
  }
  
  function parseCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target.result;
        const lines = content.split('\\n');
        
        // Verificar se há um cabeçalho
        if (lines.length < 2) {
          reject(new Error('Arquivo CSV vazio ou inválido'));
          return;
        }
        
        // Ignorar a primeira linha (cabeçalho) e processar as demais
        const result = lines.slice(1)
          .filter(line => line.trim() !== '') // Remover linhas vazias
          .map(line => {
            const [codigo, nome] = line.split(',');
            return {
              codigo: codigo.trim(),
              nome: nome.trim()
            };
          });
        
        resolve(result);
      };
      
      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'));
      };
      
      reader.readAsText(file);
    });
  }
  
  async function bulkImportEleitores(eleitoresData, eleicaoId) {
    // Criar um batch para otimizar a gravação
    const batch = db.batch();
    
    // Mapear códigos existentes para evitar duplicatas
    const codigosExistentes = eleitores
      .filter(e => e.eleicaoId === eleicaoId)
      .map(e => e.codigo);
    
    // Filtrar apenas eleitores não duplicados
    const novosEleitores = eleitoresData.filter(e => !codigosExistentes.includes(e.codigo));
    
    if (novosEleitores.length === 0) {
      throw new Error('Todos os eleitores já estão cadastrados');
    }
    
    // Adicionar cada eleitor ao batch
    novosEleitores.forEach(eleitor => {
      const novoEleitorRef = db.collection('eleitores').doc();
      batch.set(novoEleitorRef, {
        eleicaoId,
        codigo: eleitor.codigo,
        nome: eleitor.nome,
        votou: false,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    
    // Executar o batch
    await batch.commit();
    
    return novosEleitores.length;
  }
  
  // ===== Edição e Exclusão =====
  
  function editEleicao(id) {
    const eleicao = eleicoes.find(e => e.id === id);
    if (!eleicao) return;
    
    // Preencher o formulário
    document.getElementById('nome-eleicao').value = eleicao.nome;
    document.getElementById('data-eleicao').value = eleicao.data;
    document.getElementById('tipo-eleicao').value = eleicao.tipo;
    
    // Modificar o formulário para edição
    eleicaoForm.dataset.editId = id;
    eleicaoForm.querySelector('button[type="submit"]').textContent = 'Atualizar Eleição';
    
    // Scroll para o formulário
    eleicaoForm.scrollIntoView({ behavior: 'smooth' });
  }
  
  function editCandidato(id) {
    const candidato = candidatos.find(c => c.id === id);
    if (!candidato) return;
    
    // Preencher o formulário
    document.getElementById('eleicao-candidato').value = candidato.eleicaoId;
    document.getElementById('numero-candidato').value = candidato.numero;
    document.getElementById('nome-candidato').value = candidato.nome;
    document.getElementById('descricao-candidato').value = candidato.descricao || '';
    
    // Modificar o formulário para edição
    candidatoForm.dataset.editId = id;
    candidatoForm.querySelector('button[type="submit"]').textContent = 'Atualizar Candidato';
    
    // Scroll para o formulário
    candidatoForm.scrollIntoView({ behavior: 'smooth' });
  }
  
  function editEleitor(id) {
    const eleitor = eleitores.find(e => e.id === id);
    if (!eleitor) return;
    
    // Preencher o formulário
    document.getElementById('eleicao-eleitor').value = eleitor.eleicaoId;
    document.getElementById('codigo-eleitor').value = eleitor.codigo;
    document.getElementById('nome-eleitor').value = eleitor.nome;
    
    // Modificar o formulário para edição
    eleitorForm.dataset.editId = id;
    eleitorForm.querySelector('button[type="submit"]').textContent = 'Atualizar Eleitor';
    
    // Scroll para o formulário
    eleitorForm.scrollIntoView({ behavior: 'smooth' });
  }
  
  async function deleteEleicao(id) {
    if (!confirm('Tem certeza que deseja excluir esta eleição? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      showLoader('Excluindo eleição...');
      
      // Verificar se há candidatos ou eleitores vinculados
      const candidatosVinculados = candidatos.filter(c => c.eleicaoId === id);
      const eleitoresVinculados = eleitores.filter(e => e.eleicaoId === id);
      
      if (candidatosVinculados.length > 0 || eleitoresVinculados.length > 0) {
        if (!confirm('Esta eleição possui candidatos e/ou eleitores vinculados. Excluir mesmo assim?')) {
          hideLoader();
          return;
        }
        
        // Excluir candidatos vinculados
        const batchCandidatos = db.batch();
        candidatosVinculados.forEach(candidato => {
          batchCandidatos.delete(db.collection('candidatos').doc(candidato.id));
        });
        await batchCandidatos.commit();
        
        // Excluir eleitores vinculados
        const batchEleitores = db.batch();
        eleitoresVinculados.forEach(eleitor => {
          batchEleitores.delete(db.collection('eleitores').doc(eleitor.id));
        });
        await batchEleitores.commit();
      }
      
      // Excluir a eleição
      await db.collection('eleicoes').doc(id).delete();
      
      // Atualizar dados locais
      eleicoes = eleicoes.filter(e => e.id !== id);
      candidatos = candidatos.filter(c => c.eleicaoId !== id);
      eleitores = eleitores.filter(e => e.eleicaoId !== id);
      
      // Atualizar UI
      renderEleicoes();
      renderCandidatos();
      renderEleitores();
      updateEleicaoSelectors();
      
      // Atualizar cache offline
      offlineManager.saveElectionData(eleicoes);
      offlineManager.saveCandidatesData(candidatos);
      offlineManager.saveVotersData(eleitores);
      
      hideLoader();
      showNotification('Eleição excluída com sucesso!', 'success');
    } catch (error) {
      hideLoader();
      console.error('Erro ao excluir eleição:', error);
      showNotification('Erro ao excluir eleição: ' + error.message, 'error');
    }
  }
  
  async function deleteCandidato(id) {
    if (!confirm('Tem certeza que deseja excluir este candidato?')) {
      return;
    }
    
    try {
      showLoader('Excluindo candidato...');
      
      // Excluir a foto do storage, se existir
      const candidato = candidatos.find(c => c.id === id);
      if (candidato && candidato.fotoUrl) {
        try {
          const storageRef = storage.refFromURL(candidato.fotoUrl);
          await storageRef.delete();
        } catch (error) {
          console.warn('Erro ao excluir foto do candidato:', error);
        }
      }
      
      // Excluir o candidato do Firestore
      await db.collection('candidatos').doc(id).delete();
      
      // Atualizar dados locais
      candidatos = candidatos.filter(c => c.id !== id);
      
      // Atualizar UI
      renderCandidatos();
      
      // Atualizar cache offline
      offlineManager.saveCandidatesData(candidatos);
      
      hideLoader();
      showNotification('Candidato excluído com sucesso!', 'success');
    } catch (error) {
      hideLoader();
      console.error('Erro ao excluir candidato:', error);
      showNotification('Erro ao excluir candidato: ' + error.message, 'error');
    }
  }
  
  async function deleteEleitor(id) {
    if (!confirm('Tem certeza que deseja excluir este eleitor?')) {
      return;
    }
    
    try {
      showLoader('Excluindo eleitor...');
      
      // Excluir o eleitor do Firestore
      await db.collection('eleitores').doc(id).delete();
      
      // Atualizar dados locais
      eleitores = eleitores.filter(e => e.id !== id);
      
      // Atualizar UI
      renderEleitores();
      
      // Atualizar cache offline
      offlineManager.saveVotersData(eleitores);
      
      hideLoader();
      showNotification('Eleitor excluído com sucesso!', 'success');
    } catch (error) {
      hideLoader();
      console.error('Erro ao excluir eleitor:', error);
      showNotification('Erro ao excluir eleitor: ' + error.message, 'error');
    }
  }
  
  // ===== Utilitários =====
  
  function resetForm(form) {
    form.reset();
    
    // Remover ID de edição, se existir
    if (form.dataset.editId) {
      delete form.dataset.editId;
      form.querySelector('button[type="submit"]').textContent = form.id === 'eleicao-form' ? 'Salvar Eleição' : 
                                                              form.id === 'candidato-form' ? 'Salvar Candidato' : 'Salvar Eleitor';
    }
  }
  
  function formatDate(dateString) {
    if (!dateString) return 'Data não definida';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }
  
  function showLoader(message = 'Carregando...') {
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderMessage = document.getElementById('loader-message');
    
    if (loaderMessage) {
      loaderMessage.textContent = message;
    }
    
    if (loaderOverlay) {
      loaderOverlay.style.display = 'flex';
    }
  }
  
  function hideLoader() {
    const loaderOverlay = document.getElementById('loader-overlay');
    if (loaderOverlay) {
      loaderOverlay.style.display = 'none';
    }
  }
  
  function showNotification(message, type = 'info') {
    const notificationToast = document.getElementById('notification-toast');
    const notificationMessage = document.getElementById('notification-message');
    
    // Definir a cor baseada no tipo
    let bgColor = 'bg-info';
    if (type === 'success') bgColor = 'bg-success';
    if (type === 'error') bgColor = 'bg-danger';
    if (type === 'warning') bgColor = 'bg-warning';
    
    // Remover classes anteriores
    notificationToast.classList.remove('bg-info', 'bg-success', 'bg-danger', 'bg-warning');
    
    // Adicionar classe de cor apropriada
    notificationToast.classList.add(bgColor);
    
    // Definir a mensagem
    if (notificationMessage) {
      notificationMessage.textContent = message;
    }
    
    // Mostrar a notificação
    const toast = new bootstrap.Toast(notificationToast);
    toast.show();
  }
    
    // Criar a notificação
    const notification = document.createElement('div');
    notification.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'}`;
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
);
